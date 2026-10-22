import { randomInt, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";

import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  getClientIp,
  portalHash,
  privateNoStoreHeaders,
} from "@/lib/carrier-portal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_MESSAGE =
  "If this email has active portal access, a sign-in code has been sent.";

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
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();

    if (!validEmail(email) || email.length > 254) {
      return json(
        { ok: false, message: "Enter a valid email address." },
        400
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !fromEmail) {
      return json(
        {
          ok: false,
          message:
            "Secure sign-in email is not configured yet. Please contact SlateLane Dispatch.",
        },
        503
      );
    }

    const supabase = createAdminSupabase();
    const emailHash = portalHash("email:" + email);
    const ipHash = portalHash("ip:" + getClientIp(request));
    const challengeId = randomUUID();
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const [emailLimit, ipLimit] = await Promise.all([
      supabase
        .from("carrier_portal_login_challenges")
        .select("id", { count: "exact", head: true })
        .eq("email_hash", emailHash)
        .gte("created_at", since),
      supabase
        .from("carrier_portal_login_challenges")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", since),
    ]);

    if (emailLimit.error || ipLimit.error) {
      return json(
        { ok: false, message: "Secure sign-in is temporarily unavailable." },
        503
      );
    }

    const tooManyRequests =
      Number(emailLimit.count ?? 0) >= 3 ||
      Number(ipLimit.count ?? 0) >= 10;

    if (tooManyRequests) {
      return json({
        ok: true,
        challenge_id: challengeId,
        message: GENERIC_MESSAGE,
      });
    }

    const { data: access, error: accessError } = await supabase
      .from("carrier_portal_access")
      .select("id")
      .eq("email", email)
      .eq("status", "active")
      .limit(1);

    if (accessError) {
      return json(
        { ok: false, message: "Secure sign-in is temporarily unavailable." },
        503
      );
    }

    // Keep the same public response whether or not the address is authorized.
    if (!access?.length) {
      return json({
        ok: true,
        challenge_id: challengeId,
        message: GENERIC_MESSAGE,
      });
    }

    const now = new Date().toISOString();
    const { error: revokeError } = await supabase
      .from("carrier_portal_login_challenges")
      .update({ consumed_at: now })
      .eq("email_hash", emailHash)
      .is("consumed_at", null);

    if (revokeError) {
      return json(
        { ok: false, message: "Secure sign-in is temporarily unavailable." },
        503
      );
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = portalHash("code:" + challengeId + ":" + code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from("carrier_portal_login_challenges")
      .insert({
        id: challengeId,
        email_hash: emailHash,
        ip_hash: ipHash,
        code_hash: codeHash,
        attempts: 0,
        expires_at: expiresAt,
      });

    if (insertError) {
      return json(
        { ok: false, message: "Secure sign-in is temporarily unavailable." },
        503
      );
    }

    const resend = new Resend(apiKey);
    const sendResult = await resend.emails.send({
      from: fromEmail,
      to: [email],
      replyTo: process.env.RESEND_REPLY_TO || undefined,
      subject: "Your SlateLane Dispatch sign-in code",
      text:
        "Your SlateLane Dispatch client portal code is " +
        code +
        ". It expires in 10 minutes and can only be used once. If you did not request this code, you can ignore this email.",
      html:
        "<div style=\"font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#172033\">" +
        "<p style=\"font-size:12px;letter-spacing:2px;font-weight:700;color:#64748b\">SLATELANE DISPATCH</p>" +
        "<h1 style=\"font-size:24px;margin:20px 0 8px\">Your secure sign-in code</h1>" +
        "<p>Use this one-time code to access your carrier onboarding portal:</p>" +
        "<p style=\"font-size:32px;font-weight:700;letter-spacing:8px;background:#f1f5f9;padding:18px;border-radius:12px;text-align:center\">" +
        code +
        "</p>" +
        "<p>This code expires in 10 minutes and can only be used once.</p>" +
        "<p style=\"font-size:12px;color:#64748b\">If you did not request this code, you can ignore this email.</p>" +
        "</div>",
    });

    if (sendResult.error) {
      await supabase
        .from("carrier_portal_login_challenges")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", challengeId)
        .is("consumed_at", null);

      console.error(
        "CARRIER_PORTAL_CODE_EMAIL_FAILED",
        sendResult.error.message
      );

      return json(
        { ok: false, message: "Could not send a sign-in code. Please try again later." },
        503
      );
    }

    return json({
      ok: true,
      challenge_id: challengeId,
      message: GENERIC_MESSAGE,
    });
  } catch (error) {
    console.error(
      "CARRIER_PORTAL_CODE_REQUEST_FAILED",
      error instanceof Error ? error.message : "unknown error"
    );

    return json(
      { ok: false, message: "Secure sign-in is temporarily unavailable." },
      503
    );
  }
}
