import {
  NextResponse,
} from "next/server";

import {
  processDueEmailEnrollments,
} from "@/lib/email/sequences";

import {
  getLaunchSnapshot,
} from "@/lib/email/launch-controls";


export const runtime =
  "nodejs";


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


    if (!secret) {
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
    // REQUESTED LIMIT
    // ========================================================

    let requestedLimit =
      10;


    try {
      const body =
        await request.json();


      if (
        Number.isFinite(
          Number(
            body?.limit
          )
        )
      ) {
        requestedLimit =
          Math.floor(
            Number(
              body.limit
            )
          );
      }

    } catch {
      // Body is optional.
    }


    requestedLimit =
      Math.max(
        1,
        Math.min(
          100,
          requestedLimit
        )
      );


    // ========================================================
    // PRODUCTION LAUNCH CONTROLS
    // ========================================================

    const snapshot =
      await getLaunchSnapshot();


    const {
      settings,
      sentToday,
      effectiveCap,
      remainingToday,
      withinSendingWindow,
    } = snapshot;


    // ========================================================
    // MASTER SWITCH
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


    // ========================================================
    // SENDING HOURS
    // ========================================================

    if (
      !withinSendingWindow
    ) {
      return NextResponse.json({
        success: true,

        blocked: true,

        reason:
          "outside_sending_window",

        message:
          `Sending is allowed only from ${settings.sending_hour_start}:00 to ${settings.sending_hour_end}:00 in ${settings.sending_timezone}.`,

        sentToday,

        effectiveCap,

        remainingToday,

        processed: 0,

        results: [],
      });
    }


    // ========================================================
    // DAILY LIMIT
    // ========================================================

    if (
      remainingToday <= 0
    ) {
      return NextResponse.json({
        success: true,

        blocked: true,

        reason:
          "daily_cap_reached",

        message:
          "The production daily email cap has been reached.",

        sentToday,

        effectiveCap,

        remainingToday: 0,

        processed: 0,

        results: [],
      });
    }


    // ========================================================
    // EFFECTIVE BATCH SIZE
    // ========================================================

    const finalLimit =
      Math.max(
        0,
        Math.min(
          requestedLimit,
          settings.max_batch_size,
          remainingToday
        )
      );


    if (
      finalLimit <= 0
    ) {
      return NextResponse.json({
        success: true,

        blocked: true,

        reason:
          "no_send_capacity",

        sentToday,

        effectiveCap,

        remainingToday,

        processed: 0,

        results: [],
      });
    }


    // ========================================================
    // PROCESS DUE ENROLLMENTS
    // ========================================================

    const result =
      await processDueEmailEnrollments(
        finalLimit
      );


    return NextResponse.json({
      success: true,

      blocked: false,

      pilotMode:
        settings.pilot_mode,

      requestedLimit,

      enforcedBatchLimit:
        finalLimit,

      sentBeforeRun:
        sentToday,

      effectiveDailyCap:
        effectiveCap,

      remainingBeforeRun:
        remainingToday,

      ...result,
    });

  } catch (error) {

    console.error(
      "EMAIL PROCESS ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Unknown email processing error.",
      },
      {
        status: 500,
      }
    );
  }
}