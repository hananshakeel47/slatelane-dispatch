import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  getClientIp,
  PORTAL_SESSION_COOKIE,
  PORTAL_SESSION_LIFETIME_MS,
  portalHash,
  privateNoStoreHeaders,
  recordPortalAudit,
  sameOrigin,
} from "@/lib/carrier-portal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: privateNoStoreHeaders(),
  });
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return json({ ok: false, message: "Request origin was not accepted." }, 403);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const challengeId = String(body?.challenge_id ?? "").trim();
    const code = String(body?.code ?? "").trim();

    if (
      !validEmail(email) ||
      email.length > 254 ||
      !/^[0-9a-f-]{36}$/i.test(challengeId) ||
      !/^\d{6}$/.test(code)
    ) {
      return json(
        { ok: false, message: "That code is invalid or expired. Request a new code and try again." },
        400
      );
    }

    const supabase = createAdminSupabase();
    const emailHash = portalHash("email:" + email);
    const codeHash = portalHash("code:" + challengeId + ":" + code);

    const { data: verified, error: verifyError } = await supabase.rpc(
      "verify_carrier_portal_login_code",
      {
        p_challenge_id: challengeId,
        p_email_hash: emailHash,
        p_code_hash: codeHash,
      }
    );

    if (verifyError) {
      console.error(
        "CARRIER_PORTAL_CODE_VERIFY_FAILED",
        verifyError.message
      );

      return json(
        { ok: false, message: "Secure sign-in is temporarily unavailable." },
        503
      );
    }

    if (verified !== true) {
      return json(
        { ok: false, message: "That code is invalid or expired. Request a new code and try again." },
        401
      );
    }

    const { data: access, error: accessError } = await supabase
      .from("carrier_portal_access")
      .select("id, onboarding_id, email, status")
      .eq("email", email)
      .eq("status", "active");

    if (accessError || !access?.length) {
      return json(
        { ok: false, message: "That code is invalid or expired. Request a new code and try again." },
        401
      );
    }

    const sessionToken = randomBytes(32).toString("base64url");
    const sessionExpiry = new Date(
      Date.now() + PORTAL_SESSION_LIFETIME_MS
    ).toISOString();

    const { data: session, error: sessionError } = await supabase
      .from("carrier_portal_sessions")
      .insert({
        token_hash: portalHash("session:" + sessionToken),
        email,
        ip_hash: portalHash("ip:" + getClientIp(request)),
        expires_at: sessionExpiry,
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      console.error(
        "CARRIER_PORTAL_SESSION_CREATE_FAILED",
        sessionError?.message ?? "missing session"
      );

      return json(
        { ok: false, message: "Could not complete sign-in. Please request a new code." },
        503
      );
    }

    await supabase
      .from("carrier_portal_access")
      .update({
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("email", email)
      .eq("status", "active");

    await Promise.all(
      access.map((item) =>
        recordPortalAudit({
          onboardingId: item.onboarding_id,
          accessId: item.id,
          sessionId: session.id,
          eventType: "login",
          metadata: { method: "email_code" },
        })
      )
    );

    const response = NextResponse.json(
      { ok: true, message: "Signed in successfully." },
      { headers: privateNoStoreHeaders() }
    );

    response.cookies.set(PORTAL_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(PORTAL_SESSION_LIFETIME_MS / 1000),
    });

    return response;
  } catch (error) {
    console.error(
      "CARRIER_PORTAL_CODE_VERIFY_FAILED",
      error instanceof Error ? error.message : "unknown error"
    );

    return json(
      { ok: false, message: "Secure sign-in is temporarily unavailable." },
      503
    );
  }
}
