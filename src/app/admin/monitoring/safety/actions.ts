"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

type RecoveryReadiness = {
  ready?: boolean;
  reason?: string;
  sends?: number;
  bounces?: number;
  failures?: number;
  complaints?: number;
  active_enrollments?: number;
  unfinished_pilots?: number;
  auto_paused?: boolean;
  pause_reason?: string | null;
};

type ResetResult = {
  success?: boolean;
  reason?: string;
  message?: string;
  auto_paused?: boolean;
  recovered_at?: string;
};

function safeString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export async function resetSafetyRecoveryAction(formData: FormData) {
  const confirmation = safeString(formData.get("confirmation"));
  const note = safeString(formData.get("note"));

  // ------------------------------------------------------------
  // 1. Require exact manual confirmation
  // ------------------------------------------------------------

  if (confirmation !== "RESET SAFETY") {
    redirect(
      "/admin/monitoring/safety?recovery_error=confirmation_required"
    );
  }

  // ------------------------------------------------------------
  // 2. Require a recovery note
  // ------------------------------------------------------------

  if (note.length < 5) {
    redirect("/admin/monitoring/safety?recovery_error=note_required");
  }

  const supabase = await createServerSupabase();

  // ------------------------------------------------------------
  // 3. Re-check recovery readiness immediately before reset
  // ------------------------------------------------------------

  const {
    data: readinessData,
    error: readinessError,
  } = await supabase.rpc("email_safety_recovery_readiness");

  if (readinessError) {
    console.error(
      "SAFETY RECOVERY READINESS ERROR:",
      readinessError
    );

    redirect(
      "/admin/monitoring/safety?recovery_error=readiness_check_failed"
    );
  }

  const readiness =
    (readinessData ?? {}) as RecoveryReadiness;

  if (readiness.ready !== true) {
    const reason =
      readiness.reason || "recovery_requirements_not_met";

    redirect(
      `/admin/monitoring/safety?recovery_error=${encodeURIComponent(
        reason
      )}`
    );
  }

  // ------------------------------------------------------------
  // 4. Execute the EXACT database recovery function
  //
  // Database signature:
  //
  // reset_email_safety_after_recovery(
  //   p_confirmation text,
  //   p_note text
  // )
  // ------------------------------------------------------------

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

  if (resetError) {
    console.error(
      "RESET EMAIL SAFETY AFTER RECOVERY ERROR:",
      resetError
    );

    redirect(
      "/admin/monitoring/safety?recovery_error=reset_failed"
    );
  }

  const result =
    (resetData ?? {}) as ResetResult;

  // ------------------------------------------------------------
  // 5. Database function can reject recovery even without
  //    returning a PostgreSQL error.
  // ------------------------------------------------------------

  if (result.success !== true) {
    const reason =
      result.reason ||
      result.message ||
      "reset_rejected";

    console.error(
      "SAFETY RESET REJECTED:",
      result
    );

    redirect(
      `/admin/monitoring/safety?recovery_error=${encodeURIComponent(
        reason
      )}`
    );
  }

  // ------------------------------------------------------------
  // 6. Refresh production dashboards
  // ------------------------------------------------------------

  revalidatePath("/admin/monitoring/safety");
  revalidatePath("/admin/monitoring");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/pilot");
  revalidatePath("/admin/dashboard");

  // ------------------------------------------------------------
  // IMPORTANT:
  // This ONLY clears the automatic safety lock.
  //
  // It does NOT:
  // - enable Master Sending
  // - restart stopped enrollments
  // - create a pilot
  // - send any email
  // ------------------------------------------------------------

  redirect(
    "/admin/monitoring/safety?recovery_success=1"
  );
}