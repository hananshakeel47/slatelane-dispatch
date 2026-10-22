import { NextResponse } from "next/server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  privateNoStoreHeaders,
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

function validUuid(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET() {
  try {
    const supabase = createAdminSupabase();

    const [onboardingResult, accessResult] = await Promise.all([
      supabase
        .from("carrier_onboardings")
        .select(
          "id, company_name, dot_number, mc_number, primary_contact_name, primary_contact_email, status, created_at, updated_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("carrier_portal_access")
        .select("id, onboarding_id, email, status, created_at, last_login_at, revoked_at")
        .order("created_at", { ascending: false }),
    ]);

    if (onboardingResult.error || accessResult.error) {
      console.error(
        "ADMIN_CLIENT_PORTAL_LIST_FAILED",
        onboardingResult.error?.message ??
          accessResult.error?.message ??
          "unknown error"
      );

      return json(
        { ok: false, message: "Could not load portal access." },
        503
      );
    }

    const accessRows = accessResult.data ?? [];
    const onboardings = (onboardingResult.data ?? []).map((onboarding) => ({
      ...onboarding,
      portal_access: accessRows.filter(
        (access) => access.onboarding_id === onboarding.id
      ),
    }));

    return json({ ok: true, onboardings });
  } catch (error) {
    console.error(
      "ADMIN_CLIENT_PORTAL_LIST_FAILED",
      error instanceof Error ? error.message : "unknown error"
    );

    return json(
      { ok: false, message: "Could not load portal access." },
      503
    );
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return json({ ok: false, message: "Request origin was not accepted." }, 403);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const onboardingId = String(body?.onboarding_id ?? "").trim();
    const action = String(body?.action ?? "").trim();

    if (!validUuid(onboardingId) || !["enable", "revoke"].includes(action)) {
      return json({ ok: false, message: "A valid onboarding and action are required." }, 400);
    }

    const supabase = createAdminSupabase();
    const now = new Date().toISOString();

    if (action === "revoke") {
      const { data: activeAccess, error: lookupError } = await supabase
        .from("carrier_portal_access")
        .select("id, email")
        .eq("onboarding_id", onboardingId)
        .eq("status", "active");

      if (lookupError) {
        return json({ ok: false, message: "Could not revoke portal access." }, 503);
      }

      const { error } = await supabase
        .from("carrier_portal_access")
        .update({
          status: "revoked",
          revoked_at: now,
          updated_at: now,
        })
        .eq("onboarding_id", onboardingId)
        .eq("status", "active");

      if (error) {
        console.error("ADMIN_CLIENT_PORTAL_REVOKE_FAILED", error.message);
        return json({ ok: false, message: "Could not revoke portal access." }, 503);
      }

      if (activeAccess?.length) {
        const { error: auditError } = await supabase
          .from("carrier_portal_audit_events")
          .insert(
            activeAccess.map((access) => ({
              onboarding_id: onboardingId,
              portal_access_id: access.id,
              event_type: "portal_access_revoked",
              metadata: { source: "admin_crm" },
            }))
          );

        if (auditError) {
          console.error("ADMIN_CLIENT_PORTAL_AUDIT_FAILED", auditError.message);
        }
      }

      return json({ ok: true, message: "Portal access revoked." });
    }

    const { data: onboarding, error: onboardingError } = await supabase
      .from("carrier_onboardings")
      .select("id, primary_contact_email")
      .eq("id", onboardingId)
      .maybeSingle();

    if (onboardingError || !onboarding) {
      return json({ ok: false, message: "Onboarding record was not found." }, 404);
    }

    const email = String(onboarding.primary_contact_email ?? "")
      .trim()
      .toLowerCase();

    if (!validEmail(email) || email.length > 254) {
      return json(
        { ok: false, message: "Add a valid primary contact email before enabling portal access." },
        400
      );
    }

    // A portal grant is limited to the current primary contact for this onboarding.
    const { data: oldAccess, error: oldAccessLookupError } = await supabase
      .from("carrier_portal_access")
      .select("id")
      .eq("onboarding_id", onboardingId)
      .eq("status", "active")
      .neq("email", email);

    if (oldAccessLookupError) {
      return json({ ok: false, message: "Could not update existing portal access." }, 503);
    }

    const { error: revokeOldError } = await supabase
      .from("carrier_portal_access")
      .update({
        status: "revoked",
        revoked_at: now,
        updated_at: now,
      })
      .eq("onboarding_id", onboardingId)
      .eq("status", "active")
      .neq("email", email);

    if (revokeOldError) {
      return json({ ok: false, message: "Could not update existing portal access." }, 503);
    }

    if (oldAccess?.length) {
      const { error: auditError } = await supabase
        .from("carrier_portal_audit_events")
        .insert(
          oldAccess.map((access) => ({
            onboarding_id: onboardingId,
            portal_access_id: access.id,
            event_type: "portal_access_revoked",
            metadata: { source: "admin_crm", reason: "primary_contact_changed" },
          }))
        );

      if (auditError) {
        console.error("ADMIN_CLIENT_PORTAL_AUDIT_FAILED", auditError.message);
      }
    }

    const { data: newAccess, error: upsertError } = await supabase
      .from("carrier_portal_access")
      .upsert(
        {
          onboarding_id: onboardingId,
          email,
          status: "active",
          revoked_at: null,
          updated_at: now,
        },
        { onConflict: "onboarding_id,email" }
      )
      .select("id")
      .single();

    if (upsertError || !newAccess) {
      console.error("ADMIN_CLIENT_PORTAL_ENABLE_FAILED", upsertError?.message ?? "missing access row");
      return json({ ok: false, message: "Could not enable portal access." }, 503);
    }

    const { error: auditError } = await supabase
      .from("carrier_portal_audit_events")
      .insert({
        onboarding_id: onboardingId,
        portal_access_id: newAccess.id,
        event_type: "portal_access_enabled",
        metadata: { source: "admin_crm" },
      });

    if (auditError) {
      console.error("ADMIN_CLIENT_PORTAL_AUDIT_FAILED", auditError.message);
    }

    return json({
      ok: true,
      message: "Portal access enabled for the primary contact email.",
    });
  } catch (error) {
    console.error(
      "ADMIN_CLIENT_PORTAL_UPDATE_FAILED",
      error instanceof Error ? error.message : "unknown error"
    );

    return json(
      { ok: false, message: "Could not update portal access." },
      503
    );
  }
}
