import {
  NextResponse,
} from "next/server";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";


export const runtime =
  "nodejs";


export const dynamic =
  "force-dynamic";


function numberValue(
  value:
    unknown,
) {
  const parsed =
    Number(
      value ?? 0,
    );


  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}


export async function GET() {
  const checkedAt =
    new Date()
      .toISOString();


  try {
    const supabase =
      createAdminSupabase();


    const [
      healthResult,
      safetyResult,
    ] =
      await Promise.all([
        supabase
          .from(
            "production_health_snapshot",
          )
          .select(`
            failed_last_24h,
            bounced_last_24h
          `)
          .single(),

        supabase
          .from(
            "email_safety_state",
          )
          .select(`
            auto_paused
          `)
          .limit(
            1,
          )
          .maybeSingle(),
      ]);


    if (
      healthResult.error
    ) {
      console.error(
        "PUBLIC HEALTH SNAPSHOT ERROR:",
        healthResult.error.message,
      );


      return NextResponse.json(
        {
          service:
            "SlateLane Dispatch",

          status:
            "unhealthy",

          checked_at:
            checkedAt,
        },
        {
          status:
            503,

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }


    if (
      safetyResult.error
    ) {
      console.error(
        "PUBLIC SAFETY STATE ERROR:",
        safetyResult.error.message,
      );


      return NextResponse.json(
        {
          service:
            "SlateLane Dispatch",

          status:
            "unhealthy",

          checked_at:
            checkedAt,
        },
        {
          status:
            503,

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }


    const failed =
      numberValue(
        healthResult.data
          ?.failed_last_24h,
      );


    const bounced =
      numberValue(
        healthResult.data
          ?.bounced_last_24h,
      );


    const autoPaused =
      safetyResult.data
        ?.auto_paused ===
      true;


    const degraded =
      autoPaused ||
      failed >
        0 ||
      bounced >=
        3;


    return NextResponse.json(
      {
        service:
          "SlateLane Dispatch",

        status:
          degraded
            ? "degraded"
            : "healthy",

        checks: {
          database:
            "ok",

          email_automation:
            autoPaused
              ? "paused"
              : degraded
                ? "degraded"
                : "ok",
        },

        checked_at:
          checkedAt,
      },
      {
        status:
          200,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (
    error
  ) {
    console.error(
      "PUBLIC HEALTH ENDPOINT ERROR:",
      error,
    );


    return NextResponse.json(
      {
        service:
          "SlateLane Dispatch",

        status:
          "unhealthy",

        checked_at:
          checkedAt,
      },
      {
        status:
          503,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }
}