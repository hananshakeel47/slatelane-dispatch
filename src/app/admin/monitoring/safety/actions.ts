"use server";

import "server-only";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";


/*
 * ============================================================
 * TYPES
 * ============================================================
 */

type RecoveryReadiness = {
  success?: boolean;

  ready?: boolean;

  reason?: string | null;

  auto_paused?: boolean;

  pause_reason?: string | null;

  active_enrollments?: number;

  unfinished_pilots?: number;

  sends?: number;

  bounces?: number;

  failures?: number;

  complaints?: number;
};


type ResetResult = {
  success?: boolean;

  reason?: string | null;

  message?: string | null;

  previous_pause_reason?: string | null;

  recovered_at?: string | null;
};


/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function getFormValue(
  formData: FormData,
  key: string
) {
  return String(
    formData.get(key) ?? ""
  ).trim();
}


function recoveryUrl(
  error?: string
) {
  if (!error) {
    return "/admin/monitoring/safety";
  }

  return (
    "/admin/monitoring/safety" +
    `?recovery_error=${encodeURIComponent(
      error
    )}`
  );
}


/*
 * ============================================================
 * RESET SAFETY RECOVERY ACTION
 * ============================================================
 */

export async function resetSafetyRecoveryAction(
  formData: FormData
) {
  /*
   * ----------------------------------------------------------
   * 1. READ FORM VALUES
   * ----------------------------------------------------------
   */

  const confirmation =
    getFormValue(
      formData,
      "confirmation"
    );

  const note =
    getFormValue(
      formData,
      "note"
    );


  /*
   * ----------------------------------------------------------
   * 2. REQUIRE MANUAL CONFIRMATION
   * ----------------------------------------------------------
   */

  if (
    confirmation !==
    "RESET SAFETY"
  ) {
    redirect(
      recoveryUrl(
        "confirmation_required"
      )
    );
  }


  /*
   * ----------------------------------------------------------
   * 3. REQUIRE RECOVERY NOTE
   * ----------------------------------------------------------
   */

  if (
    note.length < 5
  ) {
    redirect(
      recoveryUrl(
        "note_required"
      )
    );
  }


  /*
   * ----------------------------------------------------------
   * 4. USE ADMIN SUPABASE
   *
   * This is a protected server-only recovery operation.
   *
   * Do NOT use createServerSupabase here.
   * ----------------------------------------------------------
   */

  const supabase =
    createAdminSupabase();


  /*
   * ----------------------------------------------------------
   * 5. RE-CHECK RECOVERY READINESS
   *
   * Never trust only the state that was rendered in browser.
   * Check again immediately before reset.
   * ----------------------------------------------------------
   */

  const {
    data: readinessRaw,
    error: readinessError,
  } = await supabase.rpc(
    "email_safety_recovery_readiness"
  );


  if (
    readinessError
  ) {
    console.error(
      "SAFETY RECOVERY READINESS RPC ERROR:",
      readinessError
    );

    redirect(
      recoveryUrl(
        "readiness_check_failed"
      )
    );
  }


  const readiness =
    (
      readinessRaw as
        | RecoveryReadiness
        | null
    ) ?? {};


  /*
   * ----------------------------------------------------------
   * 6. BLOCK RESET IF SAFETY REQUIREMENTS CHANGED
   * ----------------------------------------------------------
   */

  if (
    readiness.ready !==
    true
  ) {
    console.error(
      "SAFETY RECOVERY BLOCKED:",
      readiness
    );

    redirect(
      recoveryUrl(
        readiness.reason ||
          "not_ready"
      )
    );
  }


  /*
   * ----------------------------------------------------------
   * 7. EXECUTE PROTECTED RESET
   *
   * PostgreSQL signature:
   *
   * reset_email_safety_after_recovery(
   *   p_confirmation text,
   *   p_note text
   * )
   *
   * Parameter names must match exactly.
   * ----------------------------------------------------------
   */

  const {
    data: resetRaw,
    error: resetError,
  } = await supabase.rpc(
    "reset_email_safety_after_recovery",
    {
      p_confirmation:
        confirmation,

      p_note:
        note,
    }
  );


  /*
   * ----------------------------------------------------------
   * 8. RPC / DATABASE FAILURE
   * ----------------------------------------------------------
   */

  if (
    resetError
  ) {
    console.error(
      "RESET EMAIL SAFETY RPC ERROR:",
      {
        message:
          resetError.message,

        details:
          resetError.details,

        hint:
          resetError.hint,

        code:
          resetError.code,
      }
    );

    redirect(
      recoveryUrl(
        "reset_failed"
      )
    );
  }


  /*
   * ----------------------------------------------------------
   * 9. CHECK FUNCTION RESULT
   * ----------------------------------------------------------
   */

  const result =
    (
      resetRaw as
        | ResetResult
        | null
    ) ?? {};


  console.log(
    "SAFETY RESET RESULT:",
    result
  );


  if (
    result.success !==
    true
  ) {
    console.error(
      "SAFETY RESET REJECTED:",
      result
    );

    redirect(
      recoveryUrl(
        result.reason ||
          result.message ||
          "reset_blocked"
      )
    );
  }


  /*
   * ----------------------------------------------------------
   * 10. REVALIDATE PRODUCTION ADMIN PAGES
   * ----------------------------------------------------------
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
   * ----------------------------------------------------------
   * 11. SUCCESS
   *
   * IMPORTANT:
   *
   * This does NOT:
   *
   * - enable Master Sending
   * - restart stopped enrollments
   * - create a new pilot
   * - send any email
   *
   * It only clears the automatic safety lock.
   * ----------------------------------------------------------
   */

  redirect(
    "/admin/monitoring/safety?recovery_success=1"
  );
}