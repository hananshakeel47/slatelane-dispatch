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


export async function GET() {
  try {
    const supabase =
      createAdminSupabase();


    const [
      healthResult,
      safetyResult,
      unresolvedResult,
      criticalResult,
      latestEventResult,
    ] =
      await Promise.all([
        supabase
          .from(
            "production_health_snapshot",
          )
          .select(
            "*",
          )
          .single(),

        supabase
          .from(
            "email_safety_state",
          )
          .select(`
            auto_paused,
            pause_reason,
            paused_at,
            last_evaluated_at,
            sends_in_window,
            bounces_in_window,
            failures_in_window,
            complaints_in_window,
            bounce_rate,
            failure_rate,
            complaint_rate,
            updated_at
          `)
          .limit(
            1,
          )
          .maybeSingle(),

        supabase
          .from(
            "reliability_events",
          )
          .select(
            "id",
            {
              count:
                "exact",

              head:
                true,
            },
          )
          .is(
            "resolved_at",
            null,
          ),

        supabase
          .from(
            "reliability_events",
          )
          .select(
            "id",
            {
              count:
                "exact",

              head:
                true,
            },
          )
          .is(
            "resolved_at",
            null,
          )
          .in(
            "severity",
            [
              "error",
              "critical",
            ],
          ),

        supabase
          .from(
            "reliability_events",
          )
          .select(`
            id,
            source,
            event_type,
            severity,
            message,
            entity_type,
            entity_id,
            occurred_at,
            resolved_at
          `)
          .order(
            "occurred_at",
            {
              ascending:
                false,
            },
          )
          .limit(
            1,
          )
          .maybeSingle(),
      ]);


    if (
      healthResult.error
    ) {
      throw new Error(
        healthResult.error
          .message,
      );
    }


    if (
      safetyResult.error
    ) {
      throw new Error(
        safetyResult.error
          .message,
      );
    }


    if (
      unresolvedResult.error
    ) {
      throw new Error(
        unresolvedResult.error
          .message,
      );
    }


    if (
      criticalResult.error
    ) {
      throw new Error(
        criticalResult.error
          .message,
      );
    }


    if (
      latestEventResult.error
    ) {
      throw new Error(
        latestEventResult.error
          .message,
      );
    }


    return NextResponse.json(
      {
        success:
          true,

        environment:
          "production",

        canonical_url:
          "https://www.slatelanedispatch.com",

        checked_at:
          new Date()
            .toISOString(),

        health:
          healthResult.data,

        email_safety:
          safetyResult.data,

        reliability: {
          unresolved_events:
            unresolvedResult.count ??
            0,

          unresolved_critical:
            criticalResult.count ??
            0,

          latest_event:
            latestEventResult.data ??
            null,
        },
      },
      {
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  } catch (
    error
  ) {
    console.error(
      "ADMIN HEALTH ENDPOINT ERROR:",
      error,
    );


    return NextResponse.json(
      {
        success:
          false,

        message:
          "Could not load production health.",
      },
      {
        status:
          500,

        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  }
}