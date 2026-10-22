import { NextResponse } from "next/server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  getPortalSession,
  portalHash,
  PORTAL_SESSION_COOKIE,
  privateNoStoreHeaders,
  sameOrigin,
} from "@/lib/carrier-portal/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { ok: false, message: "Request origin was not accepted." },
      { status: 403, headers: privateNoStoreHeaders() }
    );
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(PORTAL_SESSION_COOKIE)?.value;

    if (token) {
      const supabase = createAdminSupabase();
      await supabase
        .from("carrier_portal_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("token_hash", portalHash("session:" + token))
        .is("revoked_at", null);
    }

    const response = NextResponse.json(
      { ok: true },
      { headers: privateNoStoreHeaders() }
    );

    response.cookies.set(PORTAL_SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error(
      "CARRIER_PORTAL_LOGOUT_FAILED",
      error instanceof Error ? error.message : "unknown error"
    );

    return NextResponse.json(
      { ok: false, message: "Could not sign out right now." },
      { status: 503, headers: privateNoStoreHeaders() }
    );
  }
}
