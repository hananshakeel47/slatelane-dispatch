import "server-only";

import { createHmac } from "node:crypto";
import { cookies } from "next/headers";

import { createAdminSupabase } from "@/lib/supabase/admin";

export const PORTAL_SESSION_COOKIE = "slatelane_carrier_portal_session";
export const PORTAL_SESSION_LIFETIME_MS =
  14 * 24 * 60 * 60 * 1000;
export const PORTAL_MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024;
export const PORTAL_DOCUMENT_BUCKET = "carrier-document-vault";

export type PortalAccessRow = {
  id: string;
  onboarding_id: string;
  email: string;
  status: string;
};

export type PortalSession = {
  sessionId: string;
  email: string;
  access: PortalAccessRow[];
};

function getPortalPepper() {
  const value =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!value) {
    throw new Error("Portal session signing secret is not configured.");
  }

  return value;
}

export function portalHash(value: string) {
  return createHmac("sha256", getPortalPepper())
    .update("slatelane-carrier-portal-v1:" + value, "utf8")
    .digest("hex");
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim();

  return (
    firstForwarded ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function getPortalSession(): Promise<PortalSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PORTAL_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const supabase = createAdminSupabase();
  const tokenHash = portalHash("session:" + token);

  const { data: session, error: sessionError } = await supabase
    .from("carrier_portal_sessions")
    .select("id, email, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (sessionError) {
    throw new Error("Could not validate portal session.");
  }

  if (!session) {
    return null;
  }

  const { data: access, error: accessError } = await supabase
    .from("carrier_portal_access")
    .select("id, onboarding_id, email, status")
    .eq("email", session.email)
    .eq("status", "active");

  if (accessError) {
    throw new Error("Could not validate carrier portal access.");
  }

  if (!access?.length) {
    await supabase
      .from("carrier_portal_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", session.id)
      .is("revoked_at", null);

    return null;
  }

  return {
    sessionId: session.id,
    email: session.email,
    access: access as PortalAccessRow[],
  };
}

export async function recordPortalAudit(input: {
  onboardingId: string;
  accessId: string;
  sessionId?: string | null;
  documentId?: string | null;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createAdminSupabase();

  const { error } = await supabase
    .from("carrier_portal_audit_events")
    .insert({
      onboarding_id: input.onboardingId,
      portal_access_id: input.accessId,
      session_id: input.sessionId ?? null,
      document_id: input.documentId ?? null,
      event_type: input.eventType,
      metadata: input.metadata ?? {},
    });

  if (error) {
    // Do not expose audit internals to a client response.
    console.error("CARRIER_PORTAL_AUDIT_WRITE_FAILED", error.message);
  }
}

export function privateNoStoreHeaders() {
  return {
    "Cache-Control": "private, no-store, no-cache, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}
