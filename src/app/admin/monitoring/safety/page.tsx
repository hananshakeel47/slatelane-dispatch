import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

import {
  resetSafetyLockAction,
  runSafetyCheckAction,
} from "./actions";

export const dynamic = "force-dynamic";

type SafetyStatus = {
  auto_paused: boolean;
  pause_reason: string | null;
  paused_at: string | null;
  last_evaluated_at: string | null;

  sends_in_window: number | string | null;
  bounces_in_window: number | string | null;
  failures_in_window: number | string | null;
  complaints_in_window: number | string | null;

  bounce_rate: number | string | null;
  failure_rate: number | string | null;
  complaint_rate: number | string | null;

  safety_enabled: boolean;

  window_hours: number | string | null;
  minimum_sample_size: number | string | null;

  max_bounce_rate: number | string | null;
  max_failure_rate: number | string | null;
  max_complaint_rate: number | string | null;
  max_complaints_absolute: number | string | null;

  reset_at: string | null;
  updated_at: string | null;
};

type SafetyEvent = {
  id: string;
  event_type: string;
  reason: string | null;

  sends_in_window: number | string | null;
  bounces_in_window: number | string | null;
  failures_in_window: number | string | null;
  complaints_in_window: number | string | null;

  bounce_rate: number | string | null;
  failure_rate: number | string | null;
  complaint_rate: number | string | null;

  metadata: Record<string, unknown> | null;
  created_at: string;
};

function numberValue(
  value: number | string | null | undefined
) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function percent(
  value: number | string | null | undefined,
  digits = 2
) {
  return `${numberValue(value).toFixed(digits)}%`;
}

function formatDate(
  value: string | null | undefined
) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "America/Chicago",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function prettyReason(
  value: string | null | undefined
) {
  if (!value) {
    return "None";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function prettyEvent(
  value: string
) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function MetricCard({
  label,
  value,
  subtext,
  danger = false,
  warning = false,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  danger?: boolean;
  warning?: boolean;
}) {
  let valueClass =
    "text-white";

  if (danger) {
    valueClass =
      "text-red-400";
  } else if (warning) {
    valueClass =
      "text-amber-300";
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#111315] p-5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>

      <div
        className={`mt-3 text-3xl font-bold ${valueClass}`}
      >
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

function RateBlock({
  title,
  current,
  maximum,
  count,
}: {
  title: string;
  current: number;
  maximum: number;
  count: number;
}) {
  const exceeded =
    current >= maximum;

  const ratio =
    maximum > 0
      ? Math.min(
          100,
          (current / maximum) * 100
        )
      : 0;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        exceeded
          ? "border-red-900/80 bg-red-950/20"
          : "border-zinc-800 bg-[#111315]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white">
            {title}
          </div>

          <div className="mt-1 text-xs text-zinc-500">
            {count} event
            {count === 1
              ? ""
              : "s"}
          </div>
        </div>

        <div
          className={`text-right text-xl font-bold ${
            exceeded
              ? "text-red-400"
              : "text-emerald-400"
          }`}
        >
          {current.toFixed(2)}%
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-900">
        <div
          className={
            exceeded
              ? "h-full rounded-full bg-red-500"
              : "h-full rounded-full bg-emerald-500"
          }
          style={{
            width: `${ratio}%`,
          }}
        />
      </div>

      <div className="mt-3 flex justify-between text-xs text-zinc-500">
        <span>
          Current {current.toFixed(2)}%
        </span>

        <span>
          Limit {maximum.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

export default async function SafetyCenterPage() {
  const supabase =
    createServerSupabase();

  const [
    safetyResponse,
    eventResponse,
  ] = await Promise.all([
    supabase
      .from("email_safety_status")
      .select("*")
      .maybeSingle(),

    supabase
      .from("email_safety_events")
      .select(
        `
        id,
        event_type,
        reason,
        sends_in_window,
        bounces_in_window,
        failures_in_window,
        complaints_in_window,
        bounce_rate,
        failure_rate,
        complaint_rate,
        metadata,
        created_at
        `
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(20),
  ]);

  if (safetyResponse.error) {
    throw new Error(
      `Could not load safety status: ${safetyResponse.error.message}`
    );
  }

  if (eventResponse.error) {
    throw new Error(
      `Could not load safety history: ${eventResponse.error.message}`
    );
  }

  const status =
    safetyResponse.data as SafetyStatus | null;

  const events =
    (eventResponse.data ??
      []) as SafetyEvent[];

  if (!status) {
    return (
      <section className="space-y-6">
        <h1 className="text-3xl font-bold">
          Safety Center
        </h1>

        <div className="rounded-2xl border border-red-900 bg-red-950/30 p-6 text-red-300">
          Email safety configuration was not found.
          Confirm Migration 017 has been applied.
        </div>
      </section>
    );
  }

  const sends =
    numberValue(
      status.sends_in_window
    );

  const bounces =
    numberValue(
      status.bounces_in_window
    );

  const failures =
    numberValue(
      status.failures_in_window
    );

  const complaints =
    numberValue(
      status.complaints_in_window
    );

  const bounceRate =
    numberValue(
      status.bounce_rate
    );

  const failureRate =
    numberValue(
      status.failure_rate
    );

  const complaintRate =
    numberValue(
      status.complaint_rate
    );

  const bounceLimit =
    numberValue(
      status.max_bounce_rate
    );

  const failureLimit =
    numberValue(
      status.max_failure_rate
    );

  const complaintLimit =
    numberValue(
      status.max_complaint_rate
    );

  const isLocked =
    Boolean(
      status.auto_paused
    );

  const safetyEnabled =
    Boolean(
      status.safety_enabled
    );

  return (
    <section className="space-y-8">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">
            Production Protection
          </div>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Safety Center
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Automatic protection for SlateLane outbound
            email. The safety system checks bounce,
            failure and complaint activity before the
            production scheduler is allowed to continue.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/monitoring"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-semibold transition hover:bg-zinc-800"
          >
            ← Monitoring
          </Link>

          <Link
            href="/admin/settings"
            className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Launch Controls →
          </Link>
        </div>
      </div>

      {/* =====================================================
          MAIN SAFETY STATUS
      ====================================================== */}

      <div
        className={`rounded-2xl border p-6 ${
          isLocked
            ? "border-red-800 bg-red-950/30"
            : "border-emerald-800 bg-emerald-950/20"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Automatic Safety
            </div>

            <div
              className={`mt-2 text-4xl font-black ${
                isLocked
                  ? "text-red-400"
                  : "text-emerald-400"
              }`}
            >
              {isLocked
                ? "AUTO-PAUSED"
                : "HEALTHY"}
            </div>

            <div className="mt-3 text-sm text-zinc-300">
              {isLocked ? (
                <>
                  Outbound automation has been
                  safety-locked.
                </>
              ) : (
                <>
                  No active automatic safety lock.
                </>
              )}
            </div>
          </div>

          <div className="min-w-[260px] space-y-2 text-sm">
            <div className="flex justify-between gap-8">
              <span className="text-zinc-500">
                Protection
              </span>

              <span
                className={
                  safetyEnabled
                    ? "font-semibold text-emerald-400"
                    : "font-semibold text-red-400"
                }
              >
                {safetyEnabled
                  ? "ENABLED"
                  : "DISABLED"}
              </span>
            </div>

            <div className="flex justify-between gap-8">
              <span className="text-zinc-500">
                Reason
              </span>

              <span className="font-semibold text-white">
                {prettyReason(
                  status.pause_reason
                )}
              </span>
            </div>

            <div className="flex justify-between gap-8">
              <span className="text-zinc-500">
                Window
              </span>

              <span className="font-semibold text-white">
                {numberValue(
                  status.window_hours
                )}{" "}
                hours
              </span>
            </div>
          </div>
        </div>

        {isLocked ? (
          <div className="mt-6 rounded-xl border border-red-800/70 bg-red-950/50 px-4 py-4 text-sm leading-6 text-red-200">
            <strong>
              Outbound sending is safety-locked.
            </strong>{" "}
            Investigate the deliverability problem before
            clearing this incident. Resetting the safety
            lock will NOT automatically turn Master
            Sending back on.
          </div>
        ) : null}
      </div>

      {/* =====================================================
          CURRENT COUNTERS
      ====================================================== */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Sends In Window"
          value={sends}
          subtext={`Minimum sample: ${numberValue(
            status.minimum_sample_size
          )}`}
        />

        <MetricCard
          label="Bounces"
          value={bounces}
          danger={
            bounceRate >=
            bounceLimit
          }
          subtext={`Rate ${percent(
            bounceRate
          )}`}
        />

        <MetricCard
          label="Failures"
          value={failures}
          danger={
            failureRate >=
            failureLimit
          }
          subtext={`Rate ${percent(
            failureRate
          )}`}
        />

        <MetricCard
          label="Complaints"
          value={complaints}
          danger={
            complaints >=
              numberValue(
                status.max_complaints_absolute
              ) ||
            complaintRate >=
              complaintLimit
          }
          subtext={`Rate ${percent(
            complaintRate,
            3
          )}`}
        />
      </div>

      {/* =====================================================
          RATE PROTECTION
      ====================================================== */}

      <div className="rounded-2xl border border-zinc-800 bg-[#0d0f11] p-6">
        <div>
          <h2 className="text-xl font-bold">
            Deliverability Protection
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Current rolling metrics compared with the
            automatic shutdown thresholds.
          </p>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          <RateBlock
            title="Bounce Rate"
            current={bounceRate}
            maximum={bounceLimit}
            count={bounces}
          />

          <RateBlock
            title="Failure Rate"
            current={failureRate}
            maximum={failureLimit}
            count={failures}
          />

          <RateBlock
            title="Complaint Rate"
            current={
              complaintRate
            }
            maximum={
              complaintLimit
            }
            count={complaints}
          />
        </div>
      </div>

      {/* =====================================================
          SAFETY DETAILS
      ====================================================== */}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-[#111315] p-6">
          <h2 className="text-lg font-bold">
            Safety Details
          </h2>

          <div className="mt-5 space-y-4 text-sm">
            <div className="flex justify-between gap-5 border-b border-zinc-800 pb-3">
              <span className="text-zinc-500">
                Last safety evaluation
              </span>

              <span className="text-right font-medium">
                {formatDate(
                  status.last_evaluated_at
                )}
              </span>
            </div>

            <div className="flex justify-between gap-5 border-b border-zinc-800 pb-3">
              <span className="text-zinc-500">
                Auto-paused at
              </span>

              <span className="text-right font-medium">
                {formatDate(
                  status.paused_at
                )}
              </span>
            </div>

            <div className="flex justify-between gap-5 border-b border-zinc-800 pb-3">
              <span className="text-zinc-500">
                Last manual reset
              </span>

              <span className="text-right font-medium">
                {formatDate(
                  status.reset_at
                )}
              </span>
            </div>

            <div className="flex justify-between gap-5">
              <span className="text-zinc-500">
                Absolute complaint limit
              </span>

              <span className="text-right font-medium">
                {numberValue(
                  status.max_complaints_absolute
                )}
              </span>
            </div>
          </div>
        </div>

        {/* ===================================================
            RUN CHECK
        ==================================================== */}

        <div className="rounded-2xl border border-zinc-800 bg-[#111315] p-6">
          <h2 className="text-lg font-bold">
            Run Safety Evaluation
          </h2>

          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Immediately evaluate current production
            sending metrics using the same safety rules
            used by the scheduler.
          </p>

          <form
            action={
              runSafetyCheckAction
            }
            className="mt-6"
          >
            <button
              type="submit"
              className="rounded-xl border border-zinc-600 bg-zinc-900 px-5 py-3 text-sm font-bold transition hover:bg-zinc-800"
            >
              Run Safety Check Now
            </button>
          </form>
        </div>
      </div>

      {/* =====================================================
          RESET SAFETY LOCK
      ====================================================== */}

      <div className="rounded-2xl border border-red-900/70 bg-red-950/10 p-6">
        <div className="max-w-3xl">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-red-400">
            Protected Action
          </div>

          <h2 className="mt-2 text-xl font-bold">
            Reset Safety Lock
          </h2>

          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Use this only after the cause of the incident
            has been reviewed. This clears the safety
            incident but deliberately leaves Master
            Sending unchanged.
          </p>
        </div>

        <form
          action={
            resetSafetyLockAction
          }
          className="mt-6 grid max-w-3xl gap-4"
        >
          <div>
            <label
              htmlFor="note"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500"
            >
              Investigation Note
            </label>

            <input
              id="note"
              name="note"
              type="text"
              placeholder="Example: Removed invalid carrier emails and reviewed bounce causes"
              className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
            />
          </div>

          <div>
            <label
              htmlFor="confirmation"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-red-400"
            >
              Type RESET to confirm
            </label>

            <input
              id="confirmation"
              name="confirmation"
              type="text"
              autoComplete="off"
              placeholder="RESET"
              className="w-full rounded-xl border border-red-900 bg-black px-4 py-3 text-sm outline-none transition focus:border-red-600"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={
                !isLocked
              }
              className="rounded-xl border border-red-800 bg-red-950 px-5 py-3 text-sm font-bold text-red-200 transition hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLocked
                ? "Reset Safety Lock"
                : "No Active Safety Lock"}
            </button>
          </div>
        </form>
      </div>

      {/* =====================================================
          INCIDENT HISTORY
      ====================================================== */}

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0f11]">
        <div className="border-b border-zinc-800 px-6 py-5">
          <h2 className="text-xl font-bold">
            Safety Incident History
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Latest automatic pauses and manual safety
            resets.
          </p>
        </div>

        {events.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            No safety incidents recorded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="border-b border-zinc-800 bg-zinc-950/70">
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="px-6 py-4">
                    Event
                  </th>

                  <th className="px-4 py-4">
                    Reason
                  </th>

                  <th className="px-4 py-4">
                    Sends
                  </th>

                  <th className="px-4 py-4">
                    Bounces
                  </th>

                  <th className="px-4 py-4">
                    Bounce Rate
                  </th>

                  <th className="px-4 py-4">
                    Failures
                  </th>

                  <th className="px-4 py-4">
                    Complaints
                  </th>

                  <th className="px-6 py-4">
                    Time
                  </th>
                </tr>
              </thead>

              <tbody>
                {events.map(
                  (event) => {
                    const automaticPause =
                      event.event_type ===
                      "automatic_pause";

                    return (
                      <tr
                        key={
                          event.id
                        }
                        className="border-b border-zinc-900 text-sm last:border-0"
                      >
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              automaticPause
                                ? "border-red-900 bg-red-950 text-red-300"
                                : "border-blue-900 bg-blue-950 text-blue-300"
                            }`}
                          >
                            {prettyEvent(
                              event.event_type
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-zinc-300">
                          {prettyReason(
                            event.reason
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {numberValue(
                            event.sends_in_window
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {numberValue(
                            event.bounces_in_window
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {percent(
                            event.bounce_rate
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {numberValue(
                            event.failures_in_window
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {numberValue(
                            event.complaints_in_window
                          )}
                        </td>

                        <td className="px-6 py-4 text-zinc-400">
                          {formatDate(
                            event.created_at
                          )}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}