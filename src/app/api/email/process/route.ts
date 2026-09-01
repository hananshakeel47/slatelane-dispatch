import { NextResponse } from "next/server";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";

import {
  processDueEmailEnrollments,
} from "@/lib/email/sequences";

import {
  getLaunchSnapshot,
} from "@/lib/email/launch-controls";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";


type SafetyResult = {
  allowed?: boolean | string;
  reason?: string;
  enrollment_id?: string;
  lead_id?: string;
  carrier_id?: number;
  dot_number?: number;
  email?: string;
};


type SafetyStatus = {
  auto_paused: boolean;
  pause_reason: string | null;
};


type PilotBypassState = {
  valid: boolean;
  reason: string | null;

  pilotMode: boolean;
  pilotLimit: number;

  armedBatchCount: number;
  batchId: string | null;

  requestedCount: number;
  preparedCount: number;

  memberEnrollmentIds: string[];

  activeEnrollmentCount: number;
  pilotActiveEnrollmentCount: number;
  nonPilotActiveEnrollmentCount: number;
};


function toBoolean(
  value: unknown
) {
  return (
    value === true ||
    value === "true"
  );
}


function clampInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed)
  ) {
    return fallback;
  }

  return Math.max(
    minimum,
    Math.min(
      maximum,
      Math.floor(parsed)
    )
  );
}


function getCurrentHourInTimeZone(
  timeZone: string
) {
  try {
    const formatter =
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone,
          hour: "2-digit",
          hourCycle: "h23",
        }
      );


    const hourPart =
      formatter
        .formatToParts(
          new Date()
        )
        .find(
          (part) =>
            part.type === "hour"
        );


    const hour =
      Number(
        hourPart?.value
      );


    if (
      Number.isFinite(hour)
    ) {
      return hour;
    }

  } catch (
    error
  ) {
    console.error(
      "Could not calculate scheduler timezone hour:",
      error
    );
  }


  return null;
}


function isInsideSendingWindow(
  startHour: number,
  endHour: number,
  timeZone: string
) {
  const currentHour =
    getCurrentHourInTimeZone(
      timeZone
    );


  if (
    currentHour === null
  ) {
    /*
     * Fail closed.
     *
     * If timezone evaluation fails,
     * automated email must not send.
     */
    return false;
  }


  /*
   * Normal daytime window.
   *
   * Example:
   * 09:00 -> 17:00
   */
  if (
    startHour < endHour
  ) {
    return (
      currentHour >= startHour &&
      currentHour < endHour
    );
  }


  /*
   * Overnight window.
   *
   * Example:
   * 22:00 -> 06:00
   */
  if (
    startHour > endHour
  ) {
    return (
      currentHour >= startHour ||
      currentHour < endHour
    );
  }


  /*
   * Same start and end means closed.
   */
  return false;
}


async function getSafetyStatus() {
  const supabase =
    createAdminSupabase();


  const {
    data,
    error,
  } = await supabase
    .from(
      "email_safety_status"
    )
    .select(`
      auto_paused,
      pause_reason
    `)
    .limit(1)
    .maybeSingle();


  if (
    error
  ) {
    throw new Error(
      `Could not read email safety status: ${error.message}`
    );
  }


  const result:
    SafetyStatus = {
      auto_paused:
        Boolean(
          data?.auto_paused
        ),

      pause_reason:
        data?.pause_reason ??
        null,
    };


  return result;
}


async function getCandidateEnrollments(
  dryRun: boolean
) {
  const supabase =
    createAdminSupabase();


  const now =
    new Date()
      .toISOString();


  let query =
    supabase
      .from(
        "email_sequence_enrollments"
      )
      .select(`
        id,
        lead_id,
        status,
        current_step,
        next_send_at
      `)
      .eq(
        "status",
        "active"
      )
      .not(
        "next_send_at",
        "is",
        null
      )
      .order(
        "next_send_at",
        {
          ascending: true,
        }
      )
      .limit(250);


  /*
   * DRY RUN:
   * inspect active enrollments even when future scheduled.
   *
   * LIVE:
   * only enrollments that are due now.
   */
  if (
    !dryRun
  ) {
    query =
      query.lte(
        "next_send_at",
        now
      );
  }


  const {
    data,
    error,
  } =
    await query;


  if (
    error
  ) {
    throw new Error(
      `Could not load email enrollments for safety preflight: ${error.message}`
    );
  }


  return data ?? [];
}


async function runEnrollmentSafetyCheck(
  enrollmentId: string
) {
  const supabase =
    createAdminSupabase();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "email_enrollment_send_eligibility",
      {
        p_enrollment_id:
          enrollmentId,
      }
    );


  if (
    error
  ) {
    throw new Error(
      `Safety eligibility RPC failed for enrollment ${enrollmentId}: ${error.message}`
    );
  }


  return (
    data ??
    {}
  ) as SafetyResult;
}


async function permanentlyBlockEnrollment(
  enrollmentId: string,
  reason: string,
  eligibility: SafetyResult
) {
  const supabase =
    createAdminSupabase();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "block_unsafe_email_enrollment",
      {
        p_enrollment_id:
          enrollmentId,

        p_reason:
          reason,

        p_eligibility:
          eligibility,
      }
    );


  if (
    error
  ) {
    throw new Error(
      `Could not safety-block enrollment ${enrollmentId}: ${error.message}`
    );
  }


  return data;
}


/*
 * Temporary conditions must not permanently
 * destroy an enrollment.
 */
function isTemporarySafetyReason(
  reason: string
) {
  return [
    "global_safety_auto_paused",
    "enrollment_not_active",
  ].includes(
    reason
  );
}


/*
 * ============================================================
 * ARMED PILOT BYPASS
 * ============================================================
 *
 * Master Sending can stay OFF while an explicitly armed pilot
 * continues.
 *
 * Fail-closed requirements:
 *
 * 1. pilot_mode must be ON
 * 2. exactly ONE pilot batch must be ARMED
 * 3. pilot must contain enrollment IDs
 * 4. pilot size must not exceed pilot_limit
 * 5. prepared/member counts must agree
 * 6. EVERY active enrollment in the database must belong to
 *    this armed pilot
 *
 * Requirement #6 is especially important because the existing
 * sequence processor accepts a numeric limit, not a list of
 * explicit enrollment IDs.
 *
 * Therefore we refuse pilot bypass if even one unrelated active
 * enrollment exists.
 */
async function getPilotBypassState(
  settings: Record<
    string,
    unknown
  >
): Promise<PilotBypassState> {

  const supabase =
    createAdminSupabase();


  const pilotMode =
    toBoolean(
      settings.pilot_mode
    );


  const pilotLimit =
    clampInteger(
      settings.pilot_limit,
      0,
      0,
      1000
    );


  const emptyState:
    PilotBypassState = {
      valid: false,
      reason: null,

      pilotMode,
      pilotLimit,

      armedBatchCount: 0,
      batchId: null,

      requestedCount: 0,
      preparedCount: 0,

      memberEnrollmentIds: [],

      activeEnrollmentCount: 0,
      pilotActiveEnrollmentCount: 0,
      nonPilotActiveEnrollmentCount: 0,
    };


  if (
    !pilotMode
  ) {
    return {
      ...emptyState,
      reason:
        "pilot_mode_disabled",
    };
  }


  if (
    pilotLimit <=
    0
  ) {
    return {
      ...emptyState,
      reason:
        "invalid_pilot_limit",
    };
  }


  const {
    data: armedBatches,
    error: armedError,
  } =
    await supabase
      .from(
        "email_pilot_batches"
      )
      .select(`
        id,
        status,
        requested_count,
        prepared_count,
        created_at
      `)
      .eq(
        "status",
        "armed"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(2);


  if (
    armedError
  ) {
    throw new Error(
      `Could not inspect armed pilot batches: ${armedError.message}`
    );
  }


  const armedBatchCount =
    armedBatches?.length ??
    0;


  if (
    armedBatchCount ===
    0
  ) {
    return {
      ...emptyState,
      armedBatchCount,
      reason:
        "no_armed_pilot",
    };
  }


  if (
    armedBatchCount !==
    1
  ) {
    return {
      ...emptyState,
      armedBatchCount,
      reason:
        "multiple_armed_pilots",
    };
  }


  const batch =
    armedBatches![0];


  const batchId =
    String(
      batch.id
    );


  const requestedCount =
    Math.max(
      0,
      Number(
        batch.requested_count ??
        0
      )
    );


  const preparedCount =
    Math.max(
      0,
      Number(
        batch.prepared_count ??
        0
      )
    );


  const {
    data: members,
    error: membersError,
  } =
    await supabase
      .from(
        "email_pilot_members"
      )
      .select(`
        enrollment_id
      `)
      .eq(
        "batch_id",
        batchId
      );


  if (
    membersError
  ) {
    throw new Error(
      `Could not inspect armed pilot members: ${membersError.message}`
    );
  }


  const memberEnrollmentIds =
    Array.from(
      new Set(
        (
          members ??
          []
        )
          .map(
            (member) =>
              member.enrollment_id
          )
          .filter(
            (
              value
            ): value is string =>
              typeof value ===
                "string" &&
              value.length >
                0
          )
      )
    );


  const baseState:
    PilotBypassState = {
      ...emptyState,

      armedBatchCount,
      batchId,

      requestedCount,
      preparedCount,

      memberEnrollmentIds,
    };


  if (
    memberEnrollmentIds.length ===
    0
  ) {
    return {
      ...baseState,
      reason:
        "armed_pilot_has_no_enrollments",
    };
  }


  if (
    memberEnrollmentIds.length >
    pilotLimit
  ) {
    return {
      ...baseState,
      reason:
        "armed_pilot_exceeds_pilot_limit",
    };
  }


  /*
   * Prepared count should describe the same
   * immutable pilot membership we are about
   * to authorize.
   */
  if (
    preparedCount !==
    memberEnrollmentIds.length
  ) {
    return {
      ...baseState,
      reason:
        "pilot_member_count_mismatch",
    };
  }


  const {
    count:
      activeEnrollmentCountRaw,

    error:
      activeEnrollmentCountError,
  } =
    await supabase
      .from(
        "email_sequence_enrollments"
      )
      .select(
        "id",
        {
          count: "exact",
          head: true,
        }
      )
      .eq(
        "status",
        "active"
      );


  if (
    activeEnrollmentCountError
  ) {
    throw new Error(
      `Could not count active enrollments: ${activeEnrollmentCountError.message}`
    );
  }


  const {
    count:
      pilotActiveEnrollmentCountRaw,

    error:
      pilotActiveEnrollmentCountError,
  } =
    await supabase
      .from(
        "email_sequence_enrollments"
      )
      .select(
        "id",
        {
          count: "exact",
          head: true,
        }
      )
      .eq(
        "status",
        "active"
      )
      .in(
        "id",
        memberEnrollmentIds
      );


  if (
    pilotActiveEnrollmentCountError
  ) {
    throw new Error(
      `Could not count active pilot enrollments: ${pilotActiveEnrollmentCountError.message}`
    );
  }


  const activeEnrollmentCount =
    activeEnrollmentCountRaw ??
    0;


  const pilotActiveEnrollmentCount =
    pilotActiveEnrollmentCountRaw ??
    0;


  const nonPilotActiveEnrollmentCount =
    Math.max(
      0,
      activeEnrollmentCount -
      pilotActiveEnrollmentCount
    );


  const isolationState:
    PilotBypassState = {
      ...baseState,

      activeEnrollmentCount,

      pilotActiveEnrollmentCount,

      nonPilotActiveEnrollmentCount,
    };


  /*
   * Critical isolation rule.
   *
   * Because processDueEmailEnrollments() receives only
   * a limit, not explicit enrollment IDs, we permit the
   * bypass only if there is ZERO unrelated active work.
   */
  if (
    nonPilotActiveEnrollmentCount >
    0
  ) {
    return {
      ...isolationState,
      reason:
        "non_pilot_active_enrollments_present",
    };
  }


  /*
   * An armed pilot with no active enrollments may simply
   * be waiting for the automatic completion watcher.
   *
   * There is nothing to send, so no bypass is needed.
   */
  if (
    activeEnrollmentCount ===
    0
  ) {
    return {
      ...isolationState,
      reason:
        "armed_pilot_has_no_active_enrollments",
    };
  }


  return {
    ...isolationState,

    valid: true,
    reason: null,
  };
}


export async function POST(
  request: Request
) {
  try {

    // ========================================================
    // AUTHENTICATION
    // ========================================================

    const secret =
      process.env
        .EMAIL_PROCESS_SECRET;


    if (
      !secret
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "EMAIL_PROCESS_SECRET is not configured.",
        },
        {
          status: 500,
        }
      );
    }


    const authorization =
      request.headers.get(
        "authorization"
      );


    if (
      authorization !==
      `Bearer ${secret}`
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }


    // ========================================================
    // REQUEST BODY
    // ========================================================

    let requestedLimit =
      10;

    let dryRun =
      false;


    try {
      const body =
        await request.json();


      requestedLimit =
        clampInteger(
          body?.limit,
          10,
          1,
          100
        );


      dryRun =
        body?.dryRun ===
        true;

    } catch {
      /*
       * Body is optional.
       */
    }


    // ========================================================
    // CURRENT PRODUCTION SNAPSHOT
    // ========================================================

    const snapshot =
      await getLaunchSnapshot();


    const settings =
      snapshot.settings as
        Record<
          string,
          unknown
        >;


    const masterSending =
      toBoolean(
        settings.sending_enabled
      );


    const maxBatchSize =
      clampInteger(
        settings.max_batch_size,
        10,
        1,
        100
      );


    const remainingToday =
      Math.max(
        0,
        Number(
          snapshot.remainingToday ??
          0
        )
      );


    const effectiveCap =
      Math.max(
        0,
        Number(
          snapshot.effectiveCap ??
          0
        )
      );


    const sentToday =
      Math.max(
        0,
        Number(
          snapshot.sentToday ??
          0
        )
      );


    const sendingTimezone =
      String(
        settings.sending_timezone ||
        "America/Chicago"
      );


    const sendingHourStart =
      clampInteger(
        settings.sending_hour_start,
        9,
        0,
        23
      );


    const sendingHourEnd =
      clampInteger(
        settings.sending_hour_end,
        17,
        0,
        23
      );


    const insideWindow =
      isInsideSendingWindow(
        sendingHourStart,
        sendingHourEnd,
        sendingTimezone
      );


    // ========================================================
    // SAFETY CENTER
    // ========================================================

    const safetyStatus =
      await getSafetyStatus();


    // ========================================================
    // PILOT BYPASS PREFLIGHT
    // ========================================================

    let pilotBypass:
      PilotBypassState | null =
      null;


    /*
     * We only need the special pilot path while the
     * production Master Sending switch is OFF.
     */
    if (
      !masterSending
    ) {
      pilotBypass =
        await getPilotBypassState(
          settings
        );
    }


    // ========================================================
    // DRY RUN
    // ========================================================

    if (
      dryRun
    ) {

      const candidates =
        await getCandidateEnrollments(
          true
        );


      let allowedCount =
        0;

      let blockedCount =
        0;


      const reasons:
        Record<
          string,
          number
        > = {};


      const checks:
        Array<{
          enrollmentId: string;
          allowed: boolean;
          reason: string;
        }> = [];


      for (
        const enrollment
        of candidates
      ) {

        const safety =
          await runEnrollmentSafetyCheck(
            enrollment.id
          );


        const allowed =
          toBoolean(
            safety.allowed
          );


        const reason =
          String(
            safety.reason ||
            (
              allowed
                ? "eligible"
                : "unknown_safety_reason"
            )
          );


        if (
          allowed
        ) {
          allowedCount +=
            1;
        } else {
          blockedCount +=
            1;
        }


        reasons[reason] =
          (
            reasons[
              reason
            ] ??
            0
          ) +
          1;


        if (
          checks.length <
          25
        ) {
          checks.push({
            enrollmentId:
              enrollment.id,

            allowed,

            reason,
          });
        }
      }


      return NextResponse.json({
        success: true,

        dryRun: true,

        message:
          "Safety dry run completed. No email was sent and no enrollment was changed.",

        masterSending,

        pilotBypassEligible:
          masterSending
            ? false
            : Boolean(
                pilotBypass?.valid
              ),

        pilotBypassReason:
          masterSending
            ? "master_sending_enabled"
            : pilotBypass?.reason ??
              null,

        armedPilotBatchId:
          pilotBypass?.batchId ??
          null,

        armedPilotMembers:
          pilotBypass
            ?.memberEnrollmentIds
            .length ??
          0,

        activeEnrollmentCount:
          pilotBypass
            ?.activeEnrollmentCount ??
          candidates.length,

        nonPilotActiveEnrollmentCount:
          pilotBypass
            ?.nonPilotActiveEnrollmentCount ??
          null,

        safetyAutoPaused:
          safetyStatus.auto_paused,

        safetyPauseReason:
          safetyStatus.pause_reason,

        insideSendingWindow:
          insideWindow,

        sendingTimezone,

        sentToday,

        effectiveCap,

        remainingToday,

        activeEnrollmentsChecked:
          candidates.length,

        allowedCount,

        blockedCount,

        reasons,

        checks,
      });
    }


    // ========================================================
    // MASTER SENDING / ARMED PILOT AUTHORIZATION
    // ========================================================

    let operatingMode:
      "production" |
      "armed_pilot";


    if (
      masterSending
    ) {
      operatingMode =
        "production";

    } else {

      if (
        !pilotBypass?.valid
      ) {
        return NextResponse.json({
          success: true,

          blocked: true,

          reason:
            "sending_disabled",

          pilotBypassReason:
            pilotBypass?.reason ??
            "pilot_bypass_unavailable",

          message:
            "Master Sending is OFF and no safely isolated armed pilot is authorized for processing.",

          armedPilotBatchId:
            pilotBypass?.batchId ??
            null,

          activeEnrollmentCount:
            pilotBypass
              ?.activeEnrollmentCount ??
            0,

          nonPilotActiveEnrollmentCount:
            pilotBypass
              ?.nonPilotActiveEnrollmentCount ??
            0,

          sentToday,

          effectiveCap,

          remainingToday,

          processed: 0,

          results: [],
        });
      }


      operatingMode =
        "armed_pilot";
    }


    // ========================================================
    // GLOBAL SAFETY LOCK
    // ========================================================

    if (
      safetyStatus.auto_paused
    ) {
      return NextResponse.json({
        success: true,

        blocked: true,

        reason:
          "global_safety_auto_paused",

        operatingMode,

        safetyPauseReason:
          safetyStatus.pause_reason,

        message:
          "The Safety Center has automatically paused outbound email.",

        sentToday,

        effectiveCap,

        remainingToday,

        processed: 0,

        results: [],
      });
    }


    // ========================================================
    // SENDING WINDOW
    // ========================================================

    if (
      !insideWindow
    ) {
      return NextResponse.json({
        success: true,

        blocked: true,

        reason:
          "outside_sending_window",

        operatingMode,

        message:
          "Current time is outside the configured production sending window.",

        sendingTimezone,

        sendingHourStart,

        sendingHourEnd,

        sentToday,

        effectiveCap,

        remainingToday,

        processed: 0,

        results: [],
      });
    }


    // ========================================================
    // DAILY CAP
    // ========================================================

    if (
      remainingToday <=
      0
    ) {
      return NextResponse.json({
        success: true,

        blocked: true,

        reason:
          "daily_cap_reached",

        operatingMode,

        message:
          "The daily production email cap has been reached.",

        sentToday,

        effectiveCap,

        remainingToday: 0,

        processed: 0,

        results: [],
      });
    }


    // ========================================================
    // SAFE BATCH SIZE
    // ========================================================

    const batchLimit =
      Math.max(
        0,
        Math.min(
          requestedLimit,
          maxBatchSize,
          remainingToday
        )
      );


    if (
      batchLimit <=
      0
    ) {
      return NextResponse.json({
        success: true,

        operatingMode,

        processed: 0,
        results: [],
      });
    }


    // ========================================================
    // LOAD CURRENTLY DUE ENROLLMENTS
    // ========================================================

    const dueEnrollments =
      await getCandidateEnrollments(
        false
      );


    if (
      dueEnrollments.length ===
      0
    ) {
      return NextResponse.json({
        success: true,

        blocked: false,

        operatingMode,

        message:
          "No email sequence enrollment is currently due.",

        sentToday,

        effectiveCap,

        remainingToday,

        safetyChecked: 0,

        safetyBlocked: 0,

        processed: 0,

        results: [],
      });
    }


    // ========================================================
    // PILOT DUE-ENROLLMENT ISOLATION
    // ========================================================

    if (
      operatingMode ===
      "armed_pilot"
    ) {

      const pilotIds =
        new Set(
          pilotBypass!
            .memberEnrollmentIds
        );


      const foreignDueEnrollment =
        dueEnrollments.find(
          (enrollment) =>
            !pilotIds.has(
              enrollment.id
            )
        );


      if (
        foreignDueEnrollment
      ) {
        return NextResponse.json({
          success: true,

          blocked: true,

          reason:
            "non_pilot_due_enrollment_detected",

          operatingMode,

          message:
            "Pilot processing was blocked because a due active enrollment exists outside the armed pilot.",

          armedPilotBatchId:
            pilotBypass?.batchId,

          safetyChecked: 0,

          processed: 0,

          results: [],
        });
      }
    }


    // ========================================================
    // FINAL ENROLLMENT SAFETY PREFLIGHT
    // ========================================================

    let safeDueCount =
      0;

    let safetyBlocked =
      0;


    const blockedReasons:
      Record<
        string,
        number
      > = {};


    for (
      const enrollment
      of dueEnrollments
    ) {

      const safety =
        await runEnrollmentSafetyCheck(
          enrollment.id
        );


      const allowed =
        toBoolean(
          safety.allowed
        );


      const reason =
        String(
          safety.reason ||
          (
            allowed
              ? "eligible"
              : "unknown_safety_reason"
          )
        );


      if (
        allowed
      ) {
        safeDueCount +=
          1;

        continue;
      }


      if (
        reason ===
        "global_safety_auto_paused"
      ) {
        return NextResponse.json({
          success: true,

          blocked: true,

          reason:
            "global_safety_auto_paused",

          operatingMode,

          message:
            "Safety Center triggered during final send-time preflight. No email was processed.",

          sentToday,

          effectiveCap,

          remainingToday,

          safetyChecked:
            dueEnrollments.length,

          safetyBlocked,

          processed: 0,

          results: [],
        });
      }


      if (
        isTemporarySafetyReason(
          reason
        )
      ) {
        continue;
      }


      await permanentlyBlockEnrollment(
        enrollment.id,
        reason,
        safety
      );


      safetyBlocked +=
        1;


      blockedReasons[
        reason
      ] =
        (
          blockedReasons[
            reason
          ] ??
          0
        ) +
        1;
    }


    // ========================================================
    // NOTHING SAFE LEFT
    // ========================================================

    if (
      safeDueCount <=
      0
    ) {
      return NextResponse.json({
        success: true,

        blocked: true,

        reason:
          "no_safe_due_enrollments",

        operatingMode,

        message:
          "All currently due enrollments were rejected by the final safety gate.",

        sentToday,

        effectiveCap,

        remainingToday,

        safetyChecked:
          dueEnrollments.length,

        safetyBlocked,

        blockedReasons,

        processed: 0,

        results: [],
      });
    }


    // ========================================================
    // FINAL GLOBAL CONTROL RECHECK
    // ========================================================

    const finalSnapshot =
      await getLaunchSnapshot();


    const finalSettings =
      finalSnapshot.settings as
        Record<
          string,
          unknown
        >;


    const finalMasterSending =
      toBoolean(
        finalSettings.sending_enabled
      );


    const finalSafetyStatus =
      await getSafetyStatus();


    if (
      finalSafetyStatus.auto_paused
    ) {
      return NextResponse.json({
        success: true,

        blocked: true,

        reason:
          "global_safety_auto_paused_before_send",

        operatingMode,

        safetyPauseReason:
          finalSafetyStatus.pause_reason,

        message:
          "Safety Center locked outbound email during the final pre-send check.",

        safetyChecked:
          dueEnrollments.length,

        safetyBlocked,

        processed: 0,

        results: [],
      });
    }


    /*
     * If we're operating under the armed-pilot exception,
     * revalidate the entire exception immediately before send.
     */
    if (
      operatingMode ===
      "armed_pilot" &&
      !finalMasterSending
    ) {

      const finalPilotBypass =
        await getPilotBypassState(
          finalSettings
        );


      if (
        !finalPilotBypass.valid
      ) {
        return NextResponse.json({
          success: true,

          blocked: true,

          reason:
            "pilot_authorization_changed_before_send",

          operatingMode,

          pilotBypassReason:
            finalPilotBypass.reason,

          message:
            "Armed pilot authorization changed during preflight. No email was processed.",

          safetyChecked:
            dueEnrollments.length,

          safetyBlocked,

          processed: 0,

          results: [],
        });
      }


      if (
        finalPilotBypass
          .batchId !==
        pilotBypass?.batchId
      ) {
        return NextResponse.json({
          success: true,

          blocked: true,

          reason:
            "armed_pilot_changed_before_send",

          operatingMode,

          message:
            "The armed pilot batch changed during preflight. No email was processed.",

          safetyChecked:
            dueEnrollments.length,

          safetyBlocked,

          processed: 0,

          results: [],
        });
      }
    }


    /*
     * Normal production mode must still have
     * Master Sending ON at the exact send point.
     */
    if (
      operatingMode ===
        "production" &&
      !finalMasterSending
    ) {
      return NextResponse.json({
        success: true,

        blocked: true,

        reason:
          "sending_disabled_before_send",

        operatingMode,

        message:
          "Master Sending was disabled during preflight. No email was processed.",

        safetyChecked:
          dueEnrollments.length,

        safetyBlocked,

        processed: 0,

        results: [],
      });
    }


    // ========================================================
    // ACTUAL PROCESSOR
    // ========================================================

    const finalLimit =
      Math.max(
        0,
        Math.min(
          batchLimit,
          safeDueCount
        )
      );


    if (
      finalLimit ===
      0
    ) {
      return NextResponse.json({
        success: true,

        operatingMode,

        safetyChecked:
          dueEnrollments.length,

        safetyBlocked,

        blockedReasons,

        processed: 0,

        results: [],
      });
    }


    const result =
      await processDueEmailEnrollments(
        finalLimit
      );


    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json({
      success: true,

      phase:
        "025-armed-pilot-processing",

      operatingMode,

      masterSending:
        finalMasterSending,

      armedPilotBatchId:
        operatingMode ===
          "armed_pilot"
          ? pilotBypass?.batchId
          : null,

      safetyChecked:
        dueEnrollments.length,

      safetyBlocked,

      blockedReasons,

      safeDueCount,

      requestedLimit,

      finalLimit,

      sentToday,

      effectiveCap,

      remainingToday,

      ...result,
    });

  } catch (
    error
  ) {

    console.error(
      "EMAIL PROCESS ERROR:",
      error
    );


    /*
     * FAIL CLOSED.
     */
    return NextResponse.json(
      {
        success: false,

        blocked: true,

        reason:
          "email_process_error",

        message:
          error instanceof Error
            ? error.message
            : "Unknown email processing error.",

        processed: 0,
      },
      {
        status: 500,
      }
    );
  }
}