"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

type RecoveryReadiness = {
  success?: boolean;
  ready?: boolean;
  reason?: string | null;
  auto_paused?: boolean;
  pause_reason?: string | null;
  active_enrollments?: number;
  unfinished_pilots?: number;
};

type ResetResult = {
  success?: boolean;
  reason?: string | null;
  message?: string | null;
  previous_pause_reason?: string | null;
};

function safetyUrl(error?: string) {
  if (!error) {
    return "/admin/monitoring/safety";
  }

  return `/admin/monitoring/safety?recovery_error=${encodeURIComponent(
    error
  )}`;
}

export async function resetSafetyRecoveryAction(
  formData: FormData
) {
  /*
   * ============================================================
   * READ FORM VALUES
   * ============================================================
   */

  const confirmation = String(
    formData.get("confirmation") ?? ""
  ).trim();

  const note = String(
    formData.get("note") ?? ""
  ).trim();

  /*
   * ============================================================
   * BASIC PROTECTION
   * ============================================================
   */

  if (confirmation !== "RESET SAFETY") {
    redirect(safetyUrl("confirmation_required"));
  }

  if (!note) {
    redirect(safetyUrl("note_required"));
  }

  /*
   * ============================================================
   * SUPABASE
   * ============================================================
   */

  const supabase = await createServerSupabase();

  /*
   * ============================================================
   * CHECK RECOVERY READINESS AGAIN
   *
   * Never trust only what the browser displayed.
   * Re-check immediately before performing reset.
   * ============================================================
   */

  const {
    data: readinessData,
    error: readinessError,
  } = await supabase.rpc(
    "email_safety_recovery_readiness"
  );

  if (readinessError) {
    console.error(
      "SAFETY RECOVERY READINESS ERROR:",
      readinessError
    );

    redirect(
      safetyUrl("readiness_check_failed")
    );
  }

  const readiness =
    (readinessData as RecoveryReadiness | null) ??
    {};

  if (readiness.ready !== true) {
    console.error(
      "SAFETY RECOVERY NOT READY:",
      readiness
    );

    redirect(
      safetyUrl(
        readiness.reason || "not_ready"
      )
    );
  }

  /*
   * ============================================================
   * RESET SAFETY
   *
   * IMPORTANT:
   *
   * PostgreSQL function arguments are:
   *
   * p_confirmation text
   * p_note text
   *
   * Supabase RPC parameter names MUST match those names exactly.
   * ============================================================
   */

  const {
    data: resetData,
    error: resetError,
  } = await supabase.rpc(
    "reset_email_safety_after_recovery",
    {
      p_confirmation: confirmation,
      p_note: note,
    }
  );

  /*
   * ============================================================
   * DATABASE/RPC ERROR
   * ============================================================
   */

  if (resetError) {
    console.error(
      "SAFETY RESET RPC ERROR:",
      resetError
    );

    redirect(
      safetyUrl("reset_failed")
    );
  }

  const result =
    (resetData as ResetResult | null) ?? {};

  console.log(
    "SAFETY RESET RESULT:",
    result
  );

  /*
   * ============================================================
   * FUNCTION RETURNED A CONTROLLED FAILURE
   * ============================================================
   */

  if (result.success !== true) {
    console.error(
      "SAFETY RESET BLOCKED:",
      result
    );

    redirect(
      safetyUrl(
        result.reason || "reset_blocked"
      )
    );
  }

  /*
   * ============================================================
   * REFRESH ADMIN PAGES
   * ============================================================
   */

  revalidatePath(
    "/admin/monitoring/safety"
  );

  revalidatePath(
    "/admin/monitoring"
  );

  revalidatePath(
    "/admin/settings"
  );

  revalidatePath(
    "/admin/pilot"
  );

  revalidatePath(
    "/admin/dashboard"
  );

  /*
   * ============================================================
   * SUCCESS
   *
   * Keep redirect OUTSIDE a try/catch.
   * Next.js redirect() intentionally throws internally.
   * ============================================================
   */

  redirect(
    "/admin/monitoring/safety?recovery_success=1"
  );
}