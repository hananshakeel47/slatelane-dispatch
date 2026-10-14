import Link from "next/link";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";

import LoadBoardClient, {
  type LoadBoardSession,
  type LoadBoardSource,
  type LoadBoardTruck,
} from "./loadboard-client";


export const dynamic =
  "force-dynamic";


export default async function LoadBoardPage() {
  const supabase =
    createAdminSupabase();


  const [
    sourcesResult,
    trucksResult,
    sessionsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "loadboard_source_status",
        )
        .select(
          "*",
        )
        .order(
          "display_name",
          {
            ascending:
              true,
          },
        ),

      supabase
        .from(
          "truck_dispatch_board",
        )
        .select(
          "*",
        )
        .order(
          "ready_for_load_search",
          {
            ascending:
              false,
          },
        )
        .order(
          "last_operational_update",
          {
            ascending:
              false,
          },
        ),

      supabase
        .from(
          "load_search_sessions",
        )
        .select(`
          id,
          truck_id,
          onboarding_id,
          status,
          origin_city,
          origin_state,
          destination_city,
          destination_state,
          equipment_type,
          requested_source_codes,
          result_count,
          started_at,
          completed_at,
          expires_at
        `)
        .order(
          "created_at",
          {
            ascending:
              false,
          },
        )
        .limit(
          10,
        ),
    ]);


  if (
    sourcesResult.error
  ) {
    throw new Error(
      sourcesResult.error
        .message,
    );
  }


  if (
    trucksResult.error
  ) {
    throw new Error(
      trucksResult.error
        .message,
    );
  }


  if (
    sessionsResult.error
  ) {
    throw new Error(
      sessionsResult.error
        .message,
    );
  }


  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-500/20 bg-sky-500/[0.05] p-5">
        <div>
          <p className="font-semibold text-zinc-100">Pre-client freight research</p>
          <p className="mt-1 text-sm text-zinc-400">
            Record carrier requirements and public load research before onboarding.
          </p>
        </div>
        <Link href="/admin/loadboard/prospects"
          className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-600">
          Prospect Research →
        </Link>
      </div>
    <LoadBoardClient
      initialSources={
        (
          sourcesResult.data ??
          []
        ) as LoadBoardSource[]
      }
      initialTrucks={
        (
          trucksResult.data ??
          []
        ) as LoadBoardTruck[]
      }
      initialSessions={
        (
          sessionsResult.data ??
          []
        ) as LoadBoardSession[]
      }
    />
    </div>
  );
}