"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

type RecoveryResult = {
  success?: boolean;
  reset?: boolean;
  reason?: string;
  message?: string;
};

type RecoveryReadiness = {
  ready?: boolean;
  reason?: string;
  auto_paused?: boolean;
  pause_reason?: string | null;
  active_enrollments?: number;
  unfinished_pilots?: number;
};

function cleanMessage(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, 500);
}

export async function resetSafetyRecoveryAction(formData: FormData) {
  const confirmation = cleanMessage(formData.get("confirmation"));
  const note = cleanMessage(formData.get("note"));

  /*
   * ==========================================================
   * CONFIRMATION
   * ==========================================================
   */

  if (confirmation !== "RESET SAFETY") {
    redirect(
      "/admin/monitoring/safety?recovery_error=confirmation_required"
    );
  }

  /*
   * ==========================================================
   * SUPABASE
   * ==========================================================
   */

  const supabase = await createServerSupabase();

  /*
   * ==========================================================
   * SERVER-SIDE READINESS CHECK
   * ==========================================================
   */

  const {
    data: readinessRaw,
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
    readinessRaw as RecoveryReadiness | null;

  if (!readiness?.ready) {
    const reason =
      readiness?.reason || "not_ready";

    redirect(
      `/admin/monitoring/safety?recovery_error=${encodeURIComponent(
        reason
      )}`
    );
  }

  /*
   * ==========================================================
   * PROTECTED DATABASE RESET
   * ==========================================================
   *
   * This should NOT:
   * - Enable Master Sending
   * - Resume stopped enrollments
   * - Send an email
   * - Create a pilot
   *
   * It clears only the automatic safety pause.
   */

  const {
    data: resultRaw,
    error: resetError,
  } = await supabase.rpc(
    "reset_email_safety_after_recovery",
    {
      p_confirmation: confirmation,
      p_note: note || null,
    }
  );

  if (resetError) {
    console.error(
      "RESET EMAIL SAFETY ERROR:",
      resetError
    );

    redirect(
      "/admin/monitoring/safety?recovery_error=reset_failed"
    );
  }

  const result =
    resultRaw as RecoveryResult | null;

  if (!result?.success || !result?.reset) {
    const reason =
      result?.reason || "reset_blocked";

    redirect(
      `/admin/monitoring/safety?recovery_error=${encodeURIComponent(
        reason
      )}`
    );
  }

  /*
   * ==========================================================
   * REFRESH PRODUCTION UI
   * ==========================================================
   */

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/monitoring");
  revalidatePath("/admin/monitoring/safety");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/pilot");

  /*
   * ==========================================================
   * SUCCESS
   * ==========================================================
   */

  redirect(
    "/admin/monitoring/safety?recovery_success=1"
  );
}