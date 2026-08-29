import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { resetSafetyRecoveryAction } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  recovery_success?: string;
  recovery_error?: string;
}>;

type SafetyStatus = {
  auto_paused?: boolean;
  pause_reason?: string | null;
  paused_at?: string | null;
  last_evaluated_at?: string | null;

  sends_in_window?: number | null;
  bounces_in_window?: number | null;
  failures_in_window?: number | null;
  complaints_in_window?: number | null;
};

type RecoveryReadiness = {
  success?: boolean;

  ready?: boolean;
  reason?: string;

  auto_paused?: boolean;
  pause_reason?: string | null;

  paused_at?: string | null;
  last_evaluated_at?: string | null;

  sends?: number;
  bounces?: number;
  failures?: number;
  complaints?: number;

  bounce_rate?: number;
  bounce_limit?: number;

  failure_rate?: number;
  failure_limit?: number;

  complaint_rate?: number;
  complaint_limit?: number;

  active_enrollments?: number;
  unfinished_pilots?: number;
};

type RecoveryEvent = {
  id: string | number;

  event_type: string;

  previous_pause_reason: string | null;

  note: string | null;

  snapshot?: unknown;

  created_at: string;
};

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function numberValue(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function formatReason(value?: string | null) {
  if (!value) {
    return "None";
  }

  const labels: Record<string, string> = {
    bounce_rate_exceeded:
      "Bounce Rate Exceeded",

    failure_rate_exceeded:
      "Failure Rate Exceeded",

    complaint_rate_exceeded:
      "Complaint Rate Exceeded",

    ready_for_manual_recovery:
      "Ready for Manual Recovery",

    active_enrollments_must_be_stopped:
      "Active Enrollments Must Be Stopped",

    unfinished_pilot_must_be_cancelled:
      "Unfinished Pilot Must Be Cancelled",

    bounce_rate_still_too_high:
      "Bounce Rate Still Too High",

    failure_rate_still_too_high:
      "Failure Rate Still Too High",

    complaint_rate_still_too_high:
      "Complaint Rate Still Too High",

    safety_not_currently_paused:
      "Safety Is Not Currently Paused",

    confirmation_required:
      "Confirmation Required",

    readiness_check_failed:
      "Readiness Check Failed",

    reset_failed:
      "Safety Reset Failed",

    reset_blocked:
      "Safety Reset Blocked",

    not_ready:
      "Recovery Requirements Not Passed",
  };

  if (labels[value]) {
    return labels[value];
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function calculatePercentage(
  numerator: number,
  denominator: number
) {
  if (denominator <= 0) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

/*
 * ============================================================
 * METRIC CARD
 * ============================================================
 */

function MetricCard({
  label,
  value,
  detail,
  danger = false,
  success = false,
}: {
  label: string;
  value: string | number;
  detail?: string;
  danger?: boolean;
  success?: boolean;
}) {
  let classes =
    "border-zinc-800 bg-[#111315]";

  let valueClasses =
    "text-white";

  if (danger) {
    classes =
      "border-red-900/70 bg-red-950/20";

    valueClasses =
      "text-red-400";
  }

  if (success) {
    classes =
      "border-emerald-900/70 bg-emerald-950/20";

    valueClasses =
      "text-emerald-400";
  }

  return (
    <div
      className={`rounded-2xl border p-5 ${classes}`}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>

      <div
        className={`mt-3 text-2xl font-bold ${valueClasses}`}
      >
        {value}
      </div>

      {detail ? (
        <div className="mt-2 text-xs text-zinc-500">
          {detail}
        </div>
      ) : null}
    </div>
  );
}

/*
 * ============================================================
 * PAGE
 * ============================================================
 */

export default async function SafetyCenterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  /*
   * ==========================================================
   * SUPABASE
   * ==========================================================
   */

  const supabase = await createServerSupabase();

  /*
   * ==========================================================
   * SAFETY STATUS
   * ==========================================================
   */

  const {
    data: safetyRows,
    error: safetyError,
  } = await supabase
    .from("email_safety_status")
    .select(
      `
        auto_paused,
        pause_reason,
        paused_at,
        last_evaluated_at,
        sends_in_window,
        bounces_in_window,
        failures_in_window,
        complaints_in_window
      `
    )
    .order("last_evaluated_at", {
      ascending: false,
    })
    .limit(1);

  if (safetyError) {
    console.error(
      "SAFETY STATUS LOAD ERROR:",
      safetyError
    );
  }

  const safety =
    (safetyRows?.[0] as
      | SafetyStatus
      | undefined) || {};

  /*
   * ==========================================================
   * RECOVERY READINESS
   * ==========================================================
   */

  const {
    data: readinessRaw,
    error: readinessError,
  } = await supabase.rpc(
    "email_safety_recovery_readiness"
  );

  if (readinessError) {
    console.error(
      "RECOVERY READINESS LOAD ERROR:",
      readinessError
    );
  }

  const readiness =
    (readinessRaw as
      | RecoveryReadiness
      | null) || {};

  /*
   * ==========================================================
   * RECOVERY HISTORY
   * ==========================================================
   */

  const {
    data: recoveryEventsRaw,
    error: recoveryEventsError,
  } = await supabase
    .from("email_safety_recovery_events")
    .select(
      `
        id,
        event_type,
        previous_pause_reason,
        note,
        snapshot,
        created_at
      `
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(10);

  if (recoveryEventsError) {
    console.error(
      "RECOVERY EVENTS LOAD ERROR:",
      recoveryEventsError
    );
  }

  const recoveryEvents =
    (recoveryEventsRaw ||
      []) as RecoveryEvent[];

  /*
   * ==========================================================
   * METRICS
   * ==========================================================
   */

  const sends = numberValue(
    readiness.sends ??
      safety.sends_in_window
  );

  const bounces = numberValue(
    readiness.bounces ??
      safety.bounces_in_window
  );

  const failures = numberValue(
    readiness.failures ??
      safety.failures_in_window
  );

  const complaints = numberValue(
    readiness.complaints ??
      safety.complaints_in_window
  );

  /*
   * Use readiness rates where available.
   * Otherwise calculate them.
   */

  const bounceRate =
    typeof readiness.bounce_rate ===
    "number"
      ? readiness.bounce_rate
      : calculatePercentage(
          bounces,
          sends
        );

  const failureRate =
    typeof readiness.failure_rate ===
    "number"
      ? readiness.failure_rate
      : calculatePercentage(
          failures,
          sends
        );

  const complaintRate =
    typeof readiness.complaint_rate ===
    "number"
      ? readiness.complaint_rate
      : calculatePercentage(
          complaints,
          sends
        );

  /*
   * Current production limits.
   */

  const bounceLimit =
    typeof readiness.bounce_limit ===
    "number"
      ? readiness.bounce_limit
      : 5;

  const failureLimit =
    typeof readiness.failure_limit ===
    "number"
      ? readiness.failure_limit
      : 10;

  const complaintLimit =
    typeof readiness.complaint_limit ===
    "number"
      ? readiness.complaint_limit
      : 0.3;

  /*
   * ==========================================================
   * RECOVERY STATE
   * ==========================================================
   */

  const autoPaused =
    readiness.auto_paused ??
    safety.auto_paused ??
    false;

  const ready =
    readiness.ready === true;

  const activeEnrollments =
    numberValue(
      readiness.active_enrollments
    );

  const unfinishedPilots =
    numberValue(
      readiness.unfinished_pilots
    );

  /*
   * ==========================================================
   * URL MESSAGES
   * ==========================================================
   */

  const recoverySuccess =
    params.recovery_success === "1";

  const recoveryError =
    params.recovery_error || null;

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <div className="space-y-7">
      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-red-400">
            Production Protection
          </div>

          <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
            Safety Center
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Automatic protection for SlateLane
            outbound email. Safety checks monitor
            bounce, failure and complaint activity
            before production automation is allowed
            to continue.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/monitoring"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
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

      {/* ====================================================
          SUCCESS MESSAGE
      ==================================================== */}

      {recoverySuccess ? (
        <div className="rounded-2xl border border-emerald-800 bg-emerald-950/30 px-5 py-4">
          <div className="font-semibold text-emerald-300">
            Safety lock successfully cleared.
          </div>

          <div className="mt-1 text-sm text-emerald-200/70">
            Master Sending was NOT enabled.
            Stopped enrollments remain stopped and
            production remains under manual launch
            control.
          </div>
        </div>
      ) : null}

      {/* ====================================================
          ERROR MESSAGE
      ==================================================== */}

      {recoveryError ? (
        <div className="rounded-2xl border border-red-900 bg-red-950/30 px-5 py-4">
          <div className="font-semibold text-red-300">
            Recovery action blocked
          </div>

          <div className="mt-1 text-sm text-red-200/70">
            {formatReason(recoveryError)}
          </div>
        </div>
      ) : null}

      {/* ====================================================
          AUTOMATIC SAFETY STATUS
      ==================================================== */}

      <section
        className={`rounded-2xl border p-6 ${
          autoPaused
            ? "border-red-800 bg-red-950/20"
            : "border-emerald-800 bg-emerald-950/20"
        }`}
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Automatic Safety
            </div>

            <div
              className={`mt-2 text-3xl font-black ${
                autoPaused
                  ? "text-red-400"
                  : "text-emerald-400"
              }`}
            >
              {autoPaused
                ? "AUTO-PAUSED"
                : "PROTECTION CLEAR"}
            </div>

            <p className="mt-2 text-sm text-zinc-400">
              {autoPaused
                ? "Outbound automation is currently safety-locked."
                : "The global automatic safety lock is currently clear."}
            </p>
          </div>

          <div className="grid gap-x-10 gap-y-3 text-sm sm:grid-cols-2 xl:min-w-[420px]">
            <div className="text-zinc-500">
              Protection
            </div>

            <div className="font-semibold text-white sm:text-right">
              ENABLED
            </div>

            <div className="text-zinc-500">
              Reason
            </div>

            <div className="font-semibold text-white sm:text-right">
              {formatReason(
                readiness.pause_reason ??
                  safety.pause_reason
              )}
            </div>

            <div className="text-zinc-500">
              Paused
            </div>

            <div className="font-semibold text-white sm:text-right">
              {formatDate(
                readiness.paused_at ??
                  safety.paused_at
              )}
            </div>

            <div className="text-zinc-500">
              Last evaluated
            </div>

            <div className="font-semibold text-white sm:text-right">
              {formatDate(
                readiness.last_evaluated_at ??
                  safety.last_evaluated_at
              )}
            </div>
          </div>
        </div>

        {autoPaused ? (
          <div className="mt-6 rounded-xl border border-red-800/70 bg-red-950/30 p-4 text-sm leading-6 text-red-200">
            <strong>
              Outbound sending is safety-locked.
            </strong>{" "}
            Investigate the deliverability problem
            and complete all recovery checks before
            clearing this incident.
          </div>
        ) : null}
      </section>

      {/* ====================================================
          WINDOW METRICS
      ==================================================== */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Sends In Window"
          value={sends}
        />

        <MetricCard
          label="Bounces"
          value={bounces}
          detail={`Rate ${bounceRate.toFixed(
            2
          )}%`}
          danger={
            bounceRate > bounceLimit
          }
        />

        <MetricCard
          label="Failures"
          value={failures}
          detail={`Rate ${failureRate.toFixed(
            2
          )}%`}
          danger={
            failureRate >
            failureLimit
          }
        />

        <MetricCard
          label="Complaints"
          value={complaints}
          detail={`Rate ${complaintRate.toFixed(
            3
          )}%`}
          danger={
            complaintRate >
            complaintLimit
          }
        />
      </div>

      {/* ====================================================
          DELIVERABILITY PROTECTION
      ==================================================== */}

      <section className="rounded-2xl border border-zinc-800 bg-[#101214] p-6">
        <h2 className="text-xl font-bold text-white">
          Deliverability Protection
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          Current rolling metrics compared with
          automatic shutdown thresholds.
        </p>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {/* BOUNCE */}

          <div
            className={`rounded-2xl border p-5 ${
              bounceRate > bounceLimit
                ? "border-red-800 bg-red-950/20"
                : "border-zinc-800 bg-[#111315]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-white">
                Bounce Rate
              </div>

              <div
                className={`text-xl font-bold ${
                  bounceRate >
                  bounceLimit
                    ? "text-red-400"
                    : "text-emerald-400"
                }`}
              >
                {bounceRate.toFixed(2)}%
              </div>
            </div>

            <div className="mt-1 text-xs text-zinc-500">
              {bounces} events
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-900">
              <div
                className={`h-full ${
                  bounceRate >
                  bounceLimit
                    ? "bg-red-500"
                    : "bg-emerald-500"
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    bounceLimit > 0
                      ? (bounceRate /
                          bounceLimit) *
                          100
                      : 0
                  )}%`,
                }}
              />
            </div>

            <div className="mt-3 flex justify-between text-xs text-zinc-500">
              <span>
                Current{" "}
                {bounceRate.toFixed(2)}%
              </span>

              <span>
                Limit{" "}
                {bounceLimit.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* FAILURE */}

          <div
            className={`rounded-2xl border p-5 ${
              failureRate >
              failureLimit
                ? "border-red-800 bg-red-950/20"
                : "border-zinc-800 bg-[#111315]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-white">
                Failure Rate
              </div>

              <div
                className={`text-xl font-bold ${
                  failureRate >
                  failureLimit
                    ? "text-red-400"
                    : "text-emerald-400"
                }`}
              >
                {failureRate.toFixed(2)}%
              </div>
            </div>

            <div className="mt-1 text-xs text-zinc-500">
              {failures} events
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-900">
              <div
                className={`h-full ${
                  failureRate >
                  failureLimit
                    ? "bg-red-500"
                    : "bg-emerald-500"
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    failureLimit > 0
                      ? (failureRate /
                          failureLimit) *
                          100
                      : 0
                  )}%`,
                }}
              />
            </div>

            <div className="mt-3 flex justify-between text-xs text-zinc-500">
              <span>
                Current{" "}
                {failureRate.toFixed(
                  2
                )}
                %
              </span>

              <span>
                Limit{" "}
                {failureLimit.toFixed(
                  2
                )}
                %
              </span>
            </div>
          </div>

          {/* COMPLAINT */}

          <div
            className={`rounded-2xl border p-5 ${
              complaintRate >
              complaintLimit
                ? "border-red-800 bg-red-950/20"
                : "border-zinc-800 bg-[#111315]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-white">
                Complaint Rate
              </div>

              <div
                className={`text-xl font-bold ${
                  complaintRate >
                  complaintLimit
                    ? "text-red-400"
                    : "text-emerald-400"
                }`}
              >
                {complaintRate.toFixed(
                  3
                )}
                %
              </div>
            </div>

            <div className="mt-1 text-xs text-zinc-500">
              {complaints} events
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-900">
              <div
                className={`h-full ${
                  complaintRate >
                  complaintLimit
                    ? "bg-red-500"
                    : "bg-emerald-500"
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    complaintLimit > 0
                      ? (complaintRate /
                          complaintLimit) *
                          100
                      : 0
                  )}%`,
                }}
              />
            </div>

            <div className="mt-3 flex justify-between text-xs text-zinc-500">
              <span>
                Current{" "}
                {complaintRate.toFixed(
                  3
                )}
                %
              </span>

              <span>
                Limit{" "}
                {complaintLimit.toFixed(
                  3
                )}
                %
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================
          RECOVERY READINESS
      ==================================================== */}

      <section className="rounded-2xl border border-zinc-800 bg-[#101214] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
              Phase 021 Recovery
            </div>

            <h2 className="mt-2 text-2xl font-bold text-white">
              Recovery Readiness
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Recovery is only permitted after
              active campaign enrollments are
              stopped, unfinished pilots are
              removed and production safety checks
              are acceptable.
            </p>
          </div>

          <div
            className={`rounded-full border px-4 py-2 text-xs font-bold ${
              ready
                ? "border-emerald-700 bg-emerald-950 text-emerald-300"
                : "border-amber-700 bg-amber-950 text-amber-300"
            }`}
          >
            {ready
              ? "READY FOR RECOVERY"
              : "RECOVERY BLOCKED"}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Active Enrollments"
            value={
              activeEnrollments
            }
            danger={
              activeEnrollments > 0
            }
            success={
              activeEnrollments === 0
            }
          />

          <MetricCard
            label="Unfinished Pilots"
            value={
              unfinishedPilots
            }
            danger={
              unfinishedPilots > 0
            }
            success={
              unfinishedPilots === 0
            }
          />

          <MetricCard
            label="Bounce Rate"
            value={`${bounceRate.toFixed(
              2
            )}%`}
            detail={`Maximum ${bounceLimit.toFixed(
              2
            )}%`}
            danger={
              bounceRate > bounceLimit
            }
          />

          <MetricCard
            label="Recovery Decision"
            value={
              ready
                ? "PASS"
                : "BLOCKED"
            }
            detail={formatReason(
              readiness.reason
            )}
            danger={!ready}
            success={ready}
          />
        </div>

        <div
          className={`mt-6 rounded-xl border px-5 py-4 ${
            ready
              ? "border-emerald-900 bg-emerald-950/20"
              : "border-amber-900 bg-amber-950/20"
          }`}
        >
          <div
            className={`font-semibold ${
              ready
                ? "text-emerald-300"
                : "text-amber-300"
            }`}
          >
            {ready
              ? "Recovery requirements passed."
              : "Recovery cannot continue yet."}
          </div>

          <p className="mt-1 text-sm text-zinc-400">
            {formatReason(
              readiness.reason
            )}
          </p>
        </div>
      </section>

      {/* ====================================================
          MANUAL SAFETY RESET
      ==================================================== */}

      {autoPaused ? (
        <section
          className={`rounded-2xl border p-6 ${
            ready
              ? "border-emerald-800 bg-emerald-950/10"
              : "border-zinc-800 bg-[#101214]"
          }`}
        >
          <div className="max-w-3xl">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
              Protected Recovery Action
            </div>

            <h2 className="mt-2 text-2xl font-bold text-white">
              Clear Automatic Safety Lock
            </h2>

            <p className="mt-3 text-sm leading-6 text-zinc-400">
              This operation clears only the
              automatic global safety pause. It
              does not enable Master Sending,
              restart stopped enrollments, create
              a new pilot or transmit any email.
            </p>
          </div>

          {ready ? (
            <form
              action={
                resetSafetyRecoveryAction
              }
              className="mt-6 max-w-3xl space-y-5"
            >
              <div>
                <label
                  htmlFor="note"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Recovery note
                </label>

                <textarea
                  id="note"
                  name="note"
                  rows={3}
                  placeholder="Old pilot cancelled, active enrollments stopped and recovery checks passed."
                  className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmation"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Type{" "}
                  <span className="font-bold text-white">
                    RESET SAFETY
                  </span>{" "}
                  exactly
                </label>

                <input
                  id="confirmation"
                  name="confirmation"
                  type="text"
                  autoComplete="off"
                  placeholder="RESET SAFETY"
                  required
                  className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-emerald-600"
                />
              </div>

              <div className="rounded-xl border border-amber-900/70 bg-amber-950/20 p-4 text-sm leading-6 text-amber-200">
                <strong>
                  Important:
                </strong>{" "}
                clearing the safety lock does not
                authorize production sending.
                Master Sending should remain OFF
                until a new controlled recovery
                pilot is ready.
              </div>

              <button
                type="submit"
                className="rounded-xl border border-emerald-700 bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-600"
              >
                Clear Safety Lock
              </button>
            </form>
          ) : (
            <div className="mt-6 rounded-xl border border-zinc-800 bg-black/30 p-5 text-sm text-zinc-400">
              The reset control remains disabled
              until all recovery readiness checks
              pass.
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-6">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
            Recovery Complete
          </div>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Automatic Safety Lock Is Clear
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            SlateLane is no longer globally
            auto-paused. Stopped enrollments remain
            stopped. Prepare a new small verified
            recovery pilot before resuming
            production outreach.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/admin/pilot"
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Prepare Recovery Pilot →
            </Link>

            <Link
              href="/admin/settings"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Launch Controls
            </Link>
          </div>
        </section>
      )}

      {/* ====================================================
          RECOVERY AUDIT HISTORY
      ==================================================== */}

      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#101214]">
        <div className="border-b border-zinc-800 px-6 py-5">
          <h2 className="text-xl font-bold text-white">
            Recovery Audit History
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Protected recovery operations and
            safety reset history.
          </p>
        </div>

        {recoveryEvents.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            No recovery events recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {recoveryEvents.map(
              (event) => (
                <div
                  key={String(
                    event.id
                  )}
                  className="grid gap-3 px-6 py-5 md:grid-cols-[180px_1fr_220px]"
                >
                  <div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${
                        event.event_type ===
                        "reset"
                          ? "border-emerald-800 bg-emerald-950 text-emerald-300"
                          : "border-zinc-700 bg-zinc-900 text-zinc-300"
                      }`}
                    >
                      {
                        event.event_type
                      }
                    </span>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-white">
                      {formatReason(
                        event.previous_pause_reason
                      )}
                    </div>

                    {event.note ? (
                      <div className="mt-1 text-sm text-zinc-500">
                        {
                          event.note
                        }
                      </div>
                    ) : (
                      <div className="mt-1 text-sm text-zinc-600">
                        No recovery
                        note.
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-zinc-500 md:text-right">
                    {formatDate(
                      event.created_at
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {/* ====================================================
          PRODUCTION RULE
      ==================================================== */}

      <div className="rounded-2xl border border-zinc-800 bg-black/20 p-5">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
          Production Rule
        </div>

        <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">
          Safety recovery never authorizes sending
          by itself. Production outreach still
          requires verified carrier eligibility,
          pilot controls, Master Sending approval,
          scheduler limits and the final pre-send
          safety gate.
        </p>
      </div>
    </div>
  );
}