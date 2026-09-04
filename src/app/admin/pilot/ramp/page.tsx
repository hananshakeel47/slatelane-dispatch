import Link from "next/link";
import type { ReactNode } from "react";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";

import AutoRefresh from "./AutoRefresh";


export const dynamic =
  "force-dynamic";


// ============================================================
// TYPES
// ============================================================

type RampStatus = {
  ramp_stage?: number | null;
  ramp_target?: number | null;

  pilot_limit?: number | null;
  daily_send_cap?: number | null;
  max_batch_size?: number | null;

  sending_enabled?: boolean | null;

  ready_for_20?: boolean | null;
  readiness_reason?: string | null;
};


type PreparedStatus = {
  batch_id?: string | null;

  status?: string | null;

  ramp_target?: number | null;
  prepared_count?: number | null;

  operator_note?: string | null;

  created_at?: string | null;
  cancelled_at?: string | null;
};


type PilotBatch = {
  id?: string | null;

  status?: string | null;

  requested_count?: number | null;
  prepared_count?: number | null;

  armed_at?: string | null;
  cancelled_at?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
};


type ReplyIntegrity = {
  replied_leads?: number | null;

  safely_stopped_replied_leads?:
    number | null;

  replied_leads_still_running?:
    number | null;

  stored_replies?: number | null;

  auto_stop_events?: number | null;
};


// ============================================================
// HELPERS
// ============================================================

function numberValue(
  value: unknown
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


function formatDate(
  value:
    string | null | undefined
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    "en-US",
    {
      dateStyle:
        "medium",

      timeStyle:
        "medium",
    }
  );
}


function readableReason(
  value:
    string | null | undefined
) {
  if (!value) {
    return "No blocking reason";
  }

  return value
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (
        letter
      ) =>
        letter.toUpperCase()
    );
}


function batchClasses(
  status:
    string | null | undefined
) {
  switch (
    status
  ) {
    case "prepared":
      return "border-blue-800 bg-blue-950/40 text-blue-300";

    case "armed":
      return "border-amber-700 bg-amber-950/40 text-amber-300";

    case "completed":
      return "border-emerald-800 bg-emerald-950/40 text-emerald-300";

    case "cancelled":
      return "border-zinc-700 bg-zinc-900 text-zinc-400";

    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
  }
}


function StatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: ReactNode;
  subtext?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#101214] p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>

      <div className="mt-2 text-3xl font-black text-white">
        {value}
      </div>

      {subtext ? (
        <div className="mt-2 text-xs text-zinc-500">
          {subtext}
        </div>
      ) : null}
    </div>
  );
}


// ============================================================
// PAGE
// ============================================================

export default async function RampControlPage() {

  const supabase =
    createAdminSupabase();


  // ==========================================================
  // CURRENT RAMP STATUS
  // ==========================================================

  const {
    data:
      rampData,
    error:
      rampError,
  } = await supabase
    .from(
      "email_ramp_status"
    )
    .select("*")
    .maybeSingle();


  // ==========================================================
  // PREPARED 20-CARRIER BATCH STATUS
  // ==========================================================

  const {
    data:
      preparedData,
    error:
      preparedError,
  } = await supabase
    .from(
      "email_ramp_20_prepared_status"
    )
    .select("*")
    .maybeSingle();


  // ==========================================================
  // CURRENT / LATEST PILOT
  // ==========================================================

  const {
    data:
      pilotData,
    error:
      pilotError,
  } = await supabase
    .from(
      "email_pilot_batches"
    )
    .select(`
      id,
      status,
      requested_count,
      prepared_count,
      armed_at,
      cancelled_at,
      created_at,
      updated_at
    `)
    .order(
      "created_at",
      {
        ascending:
          false,
      }
    )
    .limit(1)
    .maybeSingle();


  // ==========================================================
  // REPLY AUTO-STOP INTEGRITY
  // ==========================================================

  const {
    data:
      replyData,
    error:
      replyError,
  } = await supabase
    .from(
      "email_reply_integrity_status"
    )
    .select("*")
    .maybeSingle();


  // ==========================================================
  // 20-CARRIER PREFLIGHT
  // ==========================================================

  const {
    data:
      preflightData,
    error:
      preflightError,
  } = await supabase
    .rpc(
      "email_ramp_20_preflight"
    );


  // ==========================================================
  // SAFE TYPE CASTS
  // ==========================================================

  const ramp =
    rampData as RampStatus | null;

  const prepared =
    preparedData as PreparedStatus | null;

  const currentPilot =
    pilotData as PilotBatch | null;

  const replyIntegrity =
    replyData as ReplyIntegrity | null;


  // ==========================================================
  // ERROR SUMMARY
  // ==========================================================

  const errors =
    [
      rampError
        ? `Ramp status: ${rampError.message}`
        : null,

      preparedError
        ? `Prepared status: ${preparedError.message}`
        : null,

      pilotError
        ? `Pilot status: ${pilotError.message}`
        : null,

      replyError
        ? `Reply integrity: ${replyError.message}`
        : null,

      preflightError
        ? `Preflight: ${preflightError.message}`
        : null,
    ].filter(
      Boolean
    ) as string[];


  // ==========================================================
  // DERIVED VALUES
  // ==========================================================

  const rampStage =
    numberValue(
      ramp?.ramp_stage
    );

  const rampTarget =
    numberValue(
      ramp?.ramp_target
    );

  const pilotLimit =
    numberValue(
      ramp?.pilot_limit
    );

  const dailyCap =
    numberValue(
      ramp?.daily_send_cap
    );

  const maxBatch =
    numberValue(
      ramp?.max_batch_size
    );

  const sendingEnabled =
    ramp?.sending_enabled ===
    true;

  const readyFor20 =
    ramp?.ready_for_20 ===
    true;

  const preparedCount =
    numberValue(
      prepared
        ?.prepared_count
    );

  const requestedCount =
    numberValue(
      currentPilot
        ?.requested_count
    );

  const pilotPreparedCount =
    numberValue(
      currentPilot
        ?.prepared_count
    );


  const repliedLeads =
    numberValue(
      replyIntegrity
        ?.replied_leads
    );

  const safelyStopped =
    numberValue(
      replyIntegrity
        ?.safely_stopped_replied_leads
    );

  const unsafeReplies =
    numberValue(
      replyIntegrity
        ?.replied_leads_still_running
    );

  const storedReplies =
    numberValue(
      replyIntegrity
        ?.stored_replies
    );


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <main className="min-h-screen bg-[#07090a] px-6 py-8 text-white lg:px-10">

      <AutoRefresh />


      <div className="mx-auto max-w-[1500px]">

        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">

          <div>

            <div className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-400">
              Phase 027C · Production Ramp
            </div>


            <h1 className="mt-2 text-4xl font-black tracking-tight">
              Production Ramp Control
            </h1>


            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Live operational view of SlateLane outbound capacity,
              pilot completion, reply protection and the protected
              20-carrier preparation state.
            </p>

          </div>


          <div className="flex flex-wrap gap-3">

            <Link
              href="/admin/pilot/command"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-bold hover:bg-zinc-800"
            >
              ← Command Center
            </Link>


            <Link
              href="/admin/pilot"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-bold hover:bg-zinc-800"
            >
              Pilot Launch →
            </Link>

          </div>

        </div>


        {/* ==================================================
            ERRORS
        ================================================== */}

        {errors.length > 0 ? (

          <section className="mt-8 rounded-2xl border border-red-900 bg-red-950/25 p-5">

            <div className="font-bold text-red-300">
              Ramp data warning
            </div>


            <div className="mt-3 space-y-1 text-sm text-red-200/80">

              {errors.map(
                (
                  message
                ) => (

                  <div
                    key={
                      message
                    }
                  >
                    {message}
                  </div>

                )
              )}

            </div>

          </section>

        ) : null}


        {/* ==================================================
            PRIMARY RAMP STATUS
        ================================================== */}

        <section className="mt-8 rounded-3xl border border-zinc-800 bg-[#0e1113] p-6">

          <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">

            <div>

              <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                Current Production Stage
              </div>


              <div className="mt-2 text-3xl font-black">
                Stage{" "}
                {rampStage || "—"}
                {" — "}
                {rampTarget || pilotLimit || "—"}
                {" Carrier Capacity"}
              </div>


              <div className="mt-2 text-sm text-zinc-400">
                {readableReason(
                  ramp?.readiness_reason
                )}
              </div>

            </div>


            <div
              className={`rounded-full border px-5 py-2 text-sm font-black ${
                sendingEnabled
                  ? "border-red-700 bg-red-950/40 text-red-300"
                  : "border-emerald-700 bg-emerald-950/40 text-emerald-300"
              }`}
            >
              {sendingEnabled
                ? "MASTER SENDING ON"
                : "MASTER SENDING OFF — SAFE"}
            </div>

          </div>


          <div className="mt-7 h-3 overflow-hidden rounded-full bg-zinc-900">

            <div
              className="h-full rounded-full bg-cyan-400 transition-all"
              style={{
                width:
                  rampStage >= 2
                    ? "50%"
                    : "25%",
              }}
            />

          </div>


          <div className="mt-2 flex justify-between text-xs text-zinc-600">

            <span>
              5
            </span>

            <span>
              20
            </span>

            <span>
              50
            </span>

            <span>
              100+
            </span>

          </div>

        </section>


        {/* ==================================================
            STATS
        ================================================== */}

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">

          <StatCard
            label="Ramp Target"
            value={
              rampTarget ||
              "—"
            }
          />


          <StatCard
            label="Pilot Limit"
            value={
              pilotLimit ||
              "—"
            }
          />


          <StatCard
            label="Daily Send Cap"
            value={
              dailyCap ||
              "—"
            }
          />


          <StatCard
            label="Processor Batch"
            value={
              maxBatch ||
              "—"
            }
          />


          <StatCard
            label="Prepared"
            value={
              preparedCount
            }
            subtext="20-carrier protected batch"
          />


          <StatCard
            label="Ready for 20"
            value={
              readyFor20
                ? "YES"
                : "NO"
            }
            subtext={
              readableReason(
                ramp
                  ?.readiness_reason
              )
            }
          />

        </div>


        {/* ==================================================
            20-CARRIER PREPARATION
        ================================================== */}

        <section className="mt-6 rounded-3xl border border-blue-900/60 bg-blue-950/10 p-6">

          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">

            <div>

              <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
                Protected 20-Carrier Preparation
              </div>


              <h2 className="mt-2 text-2xl font-black">
                {prepared
                  ? "Batch Prepared"
                  : "No Prepared 20-Carrier Batch"}
              </h2>


              {prepared
                ?.batch_id ? (

                <div className="mt-2 font-mono text-sm text-zinc-400">
                  {prepared.batch_id}
                </div>

              ) : null}

            </div>


            {prepared
              ?.status ? (

              <span
                className={`rounded-full border px-4 py-2 text-xs font-bold uppercase ${batchClasses(
                  prepared.status
                )}`}
              >
                {prepared.status}
              </span>

            ) : null}

          </div>


          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

            <StatCard
              label="Ramp Target"
              value={
                numberValue(
                  prepared
                    ?.ramp_target
                ) || "—"
              }
            />


            <StatCard
              label="Prepared Count"
              value={
                preparedCount
              }
            />


            <StatCard
              label="Created"
              value={
                formatDate(
                  prepared
                    ?.created_at
                )
              }
            />


            <StatCard
              label="Cancelled"
              value={
                prepared
                  ?.cancelled_at
                  ? "YES"
                  : "NO"
              }
            />

          </div>


          {prepared
            ?.operator_note ? (

            <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">

              <div className="text-xs uppercase text-zinc-500">
                Operator Note
              </div>


              <div className="mt-2 text-sm text-zinc-300">
                {prepared.operator_note}
              </div>

            </div>

          ) : null}

        </section>


        {/* ==================================================
            CURRENT PILOT
        ================================================== */}

        <section className="mt-6 rounded-3xl border border-zinc-800 bg-[#0f1113] p-6">

          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">

            <div>

              <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                Latest Pilot
              </div>


              <h2 className="mt-2 text-2xl font-black">
                {currentPilot
                  ?.status
                  ?.toUpperCase() ||
                  "NO PILOT"}
              </h2>


              {currentPilot
                ?.id ? (

                <div className="mt-2 font-mono text-sm text-zinc-500">
                  {currentPilot.id}
                </div>

              ) : null}

            </div>


            {currentPilot
              ?.status ? (

              <span
                className={`rounded-full border px-4 py-2 text-xs font-bold uppercase ${batchClasses(
                  currentPilot.status
                )}`}
              >
                {currentPilot.status}
              </span>

            ) : null}

          </div>


          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

            <StatCard
              label="Requested"
              value={
                requestedCount
              }
            />


            <StatCard
              label="Prepared"
              value={
                pilotPreparedCount
              }
            />


            <StatCard
              label="Armed At"
              value={
                formatDate(
                  currentPilot
                    ?.armed_at
                )
              }
            />


            <StatCard
              label="Last Updated"
              value={
                formatDate(
                  currentPilot
                    ?.updated_at
                )
              }
            />

          </div>

        </section>


        {/* ==================================================
            REPLY PROTECTION
        ================================================== */}

        <section
          className={`mt-6 rounded-3xl border p-6 ${
            unsafeReplies === 0
              ? "border-emerald-900/70 bg-emerald-950/10"
              : "border-red-800 bg-red-950/20"
          }`}
        >

          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">

            <div>

              <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                Reply Protection
              </div>


              <h2 className="mt-2 text-2xl font-black">

                {unsafeReplies ===
                0
                  ? "AUTO-STOP INTEGRITY CLEAR"
                  : "ATTENTION REQUIRED"}

              </h2>

            </div>


            <div
              className={`rounded-full border px-4 py-2 text-xs font-bold ${
                unsafeReplies ===
                0
                  ? "border-emerald-800 text-emerald-300"
                  : "border-red-800 text-red-300"
              }`}
            >

              {unsafeReplies ===
              0
                ? "PROTECTED"
                : `${unsafeReplies} UNSAFE`}

            </div>

          </div>


          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

            <StatCard
              label="Replied Leads"
              value={
                repliedLeads
              }
            />


            <StatCard
              label="Safely Stopped"
              value={
                safelyStopped
              }
            />


            <StatCard
              label="Still Running"
              value={
                unsafeReplies
              }
            />


            <StatCard
              label="Stored Replies"
              value={
                storedReplies
              }
            />


            <StatCard
              label="Auto-stop Events"
              value={
                numberValue(
                  replyIntegrity
                    ?.auto_stop_events
                )
              }
            />

          </div>

        </section>


        {/* ==================================================
            PREFLIGHT
        ================================================== */}

        <section className="mt-6 rounded-3xl border border-zinc-800 bg-[#0f1113] p-6">

          <div className="flex flex-wrap items-center justify-between gap-4">

            <div>

              <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                Phase 027C Preflight
              </div>


              <h2 className="mt-2 text-2xl font-black">
                20-Carrier Ramp Validation
              </h2>

            </div>


            <span
              className={`rounded-full border px-4 py-2 text-xs font-bold ${
                preflightError
                  ? "border-red-800 bg-red-950 text-red-300"
                  : "border-emerald-800 bg-emerald-950 text-emerald-300"
              }`}
            >
              {preflightError
                ? "ERROR"
                : "AVAILABLE"}
            </span>

          </div>


          <pre className="mt-5 max-h-[420px] overflow-auto rounded-2xl border border-zinc-800 bg-black/40 p-5 text-xs leading-6 text-zinc-300">
            {JSON.stringify(
              preflightData ??
                {
                  message:
                    "No preflight result returned.",
                },
              null,
              2
            )}
          </pre>

        </section>


        {/* ==================================================
            PROTECTION NOTICE
        ================================================== */}

        <div className="mt-6 rounded-2xl border border-emerald-950 bg-emerald-950/10 p-5 text-sm leading-6 text-zinc-400">

          <strong className="text-emerald-400">
            Production protection:
          </strong>
          {" "}

          this page is operationally read-only. It does not enable
          Master Sending, change the existing pilot, create leads,
          create sequence enrollments or transmit email.

        </div>

      </div>

    </main>
  );
}