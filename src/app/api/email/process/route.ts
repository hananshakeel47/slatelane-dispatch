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


function toBoolean(
  value: unknown
) {
  if (
    value === true ||
    value === "true"
  ) {
    return true;
  }

  return false;
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
   * 09:00 → 17:00
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
   * 22:00 → 06:00
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
   * Same start and end is treated
   * as an invalid/closed window.
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
   *
   * Inspect active enrollments even when
   * their next send time is still in the future.
   *
   * LIVE RUN:
   *
   * Only inspect enrollments actually due now.
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
 * These reasons represent temporary state changes
 * rather than permanently unsafe email addresses.
 *
 * We must NOT permanently stop an enrollment merely
 * because the global Safety Center is temporarily locked.
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
      snapshot.settings;


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
    // SAFETY CENTER STATUS
    // ========================================================

    const safetyStatus =
      await getSafetyStatus();


    // ========================================================
    // DRY RUN
    //
    // Critical:
    // - sends nothing
    // - stops nothing
    // - changes nothing
    //
    // It only reports what the safety gate WOULD do.
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
          allowedCount += 1;
        } else {
          blockedCount += 1;
        }


        reasons[reason] =
          (
            reasons[reason] ??
            0
          ) +
          1;


        /*
         * Do not expose unnecessary carrier data.
         * We only return IDs + safety result.
         */
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

        masterSending:
          Boolean(
            settings.sending_enabled
          ),

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
    // LIVE PRODUCTION GUARDS
    // ========================================================

    if (
      !settings.sending_enabled
    ) {
      return NextResponse.json({
        success: true,

        blocked: true,

        reason:
          "sending_disabled",

        message:
          "Automated sending is disabled by the production master switch.",

        sentToday,

        effectiveCap,

        remainingToday,

        processed: 0,

        results: [],
      });
    }


    /*
     * Global emergency lock.
     *
     * IMPORTANT:
     * We do not stop enrollments here because
     * auto-pause may later be investigated/reset.
     */
    if (
      safetyStatus.auto_paused
    ) {
      return NextResponse.json({
        success: true,

        blocked: true,

        reason:
          "global_safety_auto_paused",

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


    if (
      !insideWindow
    ) {
      return NextResponse.json({
        success: true,

        blocked: true,

        reason:
          "outside_sending_window",

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


    if (
      remainingToday <=
      0
    ) {
      return NextResponse.json({
        success: true,

        blocked: true,

        reason:
          "daily_cap_reached",

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
    // DETERMINE SAFE BATCH SIZE
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
        processed: 0,
        results: [],
      });
    }


    // ========================================================
    // LOAD ALL CURRENTLY DUE ENROLLMENTS
    //
    // We inspect more than the requested batch so that if an
    // unsafe enrollment gets stopped, the sequence processor
    // cannot simply pull another unchecked due enrollment.
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
    // PHASE 020 PRE-SEND SAFETY PREFLIGHT
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


      /*
       * Safety Center might have triggered
       * between the first status read and now.
       */
      if (
        reason ===
        "global_safety_auto_paused"
      ) {
        return NextResponse.json({
          success: true,

          blocked: true,

          reason:
            "global_safety_auto_paused",

          message:
            "Safety Center triggered during the final send-time preflight. No email was processed.",

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


      /*
       * Enrollment may have been stopped by
       * a webhook/reply while this request was running.
       */
      if (
        isTemporarySafetyReason(
          reason
        )
      ) {
        continue;
      }


      /*
       * Permanent carrier/lead/email safety failure.
       *
       * Stop enrollment and save an audit record.
       */
      await permanentlyBlockEnrollment(
        enrollment.id,
        reason,
        safety
      );


      safetyBlocked +=
        1;


      blockedReasons[reason] =
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
    // RECHECK GLOBAL CONTROLS IMMEDIATELY BEFORE PROCESSING
    // ========================================================

    const finalSnapshot =
      await getLaunchSnapshot();


    const finalSafetyStatus =
      await getSafetyStatus();


    if (
      !finalSnapshot
        .settings
        .sending_enabled
    ) {
      return NextResponse.json({
        success: true,

        blocked: true,

        reason:
          "sending_disabled_before_send",

        message:
          "Master Sending was disabled during the safety preflight. No email was processed.",

        safetyChecked:
          dueEnrollments.length,

        safetyBlocked,

        processed: 0,

        results: [],
      });
    }


    if (
      finalSafetyStatus
        .auto_paused
    ) {
      return NextResponse.json({
        success: true,

        blocked: true,

        reason:
          "global_safety_auto_paused_before_send",

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


    // ========================================================
    // ACTUAL EMAIL PROCESSOR
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
        "020B-send-time-safety",

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
     *
     * Any unexpected preflight error prevents processing.
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