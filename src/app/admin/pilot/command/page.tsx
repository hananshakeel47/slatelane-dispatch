import Link from "next/link";
import { createAdminSupabase } from "@/lib/supabase/admin";
import AutoRefresh from "./AutoRefresh";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CommandCenter = {
  batch_id: string;
  pilot_status: string | null;

  requested_count: number | null;
  prepared_count: number | null;
  minimum_score: number | null;

  created_at: string | null;
  prepared_at: string | null;
  armed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;

  completion_outcome: string | null;
  completion_reason: string | null;

  member_count: number | null;

  active_enrollments: number | null;
  paused_enrollments: number | null;
  completed_enrollments: number | null;
  stopped_enrollments: number | null;

  step_1_count: number | null;
  step_2_count: number | null;
  step_3_count: number | null;

  next_scheduled_send: string | null;
  last_scheduled_send: string | null;

  sent_count: number | null;
  delivered_count: number | null;
  bounced_count: number | null;
  failed_count: number | null;

  total_replies: number | null;
  replied_leads: number | null;
  interested_leads: number | null;
  attention_replies: number | null;
  handled_replies: number | null;

  delivery_rate: number | string | null;
  bounce_rate: number | string | null;
  reply_rate: number | string | null;
  interested_rate: number | string | null;

  command_state: string | null;
};

type MemberProgress = {
  batch_id: string;
  pilot_status: string | null;

  pilot_member_id: string;
  carrier_id: number | null;
  lead_id: string | null;
  enrollment_id: string | null;
  dot_number: number | null;
  email: string | null;

  enrollment_status: string | null;
  current_step: number | null;
  next_send_at: string | null;

  emails_recorded: number | null;
  sent_count: number | null;
  delivered_count: number | null;
  bounced_count: number | null;
  failed_count: number | null;

  complained: boolean | null;
  lead_bounced: boolean | null;
  opted_out: boolean | null;

  progress_state: string | null;
};

type AuditRecord = {
  id: string;
  batch_id: string;
  previous_status: string | null;
  new_status: string | null;

  member_count: number | null;
  completed_count: number | null;
  stopped_count: number | null;

  sent_count: number | null;
  delivered_count: number | null;
  bounced_count: number | null;
  failed_count: number | null;
  complaint_count: number | null;

  outcome: string | null;
  reason: string | null;
  created_at: string | null;
};

function number(value: number | null | undefined) {
  return Number(value ?? 0);
}

function percent(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed)) {
    return "0.00%";
  }

  return `${parsed.toFixed(2)}%`;
}

function dateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function stateLabel(state: string | null | undefined) {
  switch (state) {
    case "running":
      return "PILOT RUNNING";

    case "ready_to_complete":
      return "READY TO COMPLETE";

    case "completed":
      return "PILOT COMPLETE";

    case "attention_required":
      return "ATTENTION REQUIRED";

    case "cancelled":
      return "PILOT CANCELLED";

    default:
      return (state ?? "WAITING").replaceAll("_", " ").toUpperCase();
  }
}

function stateClasses(state: string | null | undefined) {
  switch (state) {
    case "completed":
    case "ready_to_complete":
      return "border-emerald-800 bg-emerald-950/30 text-emerald-300";

    case "attention_required":
      return "border-red-800 bg-red-950/30 text-red-300";

    case "cancelled":
      return "border-zinc-700 bg-zinc-900 text-zinc-400";

    default:
      return "border-cyan-900 bg-cyan-950/20 text-cyan-300";
  }
}

function memberStateClasses(state: string | null | undefined) {
  switch (state) {
    case "completed":
      return "border-emerald-800 bg-emerald-950/30 text-emerald-300";

    case "stopped":
      return "border-zinc-700 bg-zinc-900 text-zinc-300";

    case "paused":
      return "border-amber-800 bg-amber-950/30 text-amber-300";

    case "running":
      return "border-cyan-800 bg-cyan-950/30 text-cyan-300";

    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-400";
  }
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#111315] p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </div>

      <div className="mt-3 text-3xl font-black tracking-tight text-white">
        {value}
      </div>

      {subtitle ? (
        <div className="mt-2 text-xs text-zinc-500">{subtitle}</div>
      ) : null}
    </div>
  );
}

export default async function PilotCommandCenterPage() {
  const supabase = createAdminSupabase();

  const { data: commandData, error: commandError } = await supabase
    .from("email_pilot_command_center")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const command = commandData as CommandCenter | null;

  let members: MemberProgress[] = [];
  let audits: AuditRecord[] = [];

  if (command?.batch_id) {
    const [memberResult, auditResult] = await Promise.all([
      supabase
        .from("email_pilot_member_progress")
        .select("*")
        .eq("batch_id", command.batch_id)
        .order("email", { ascending: true }),

      supabase
        .from("email_pilot_completion_audit")
        .select("*")
        .eq("batch_id", command.batch_id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    members = (memberResult.data ?? []) as MemberProgress[];
    audits = (auditResult.data ?? []) as AuditRecord[];
  }

  if (commandError) {
    return (
      <main className="min-h-screen bg-[#07090a] p-8 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-red-900 bg-red-950/20 p-6">
            <h1 className="text-xl font-bold">Command Center unavailable</h1>

            <p className="mt-2 text-sm text-red-300">
              {commandError.message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!command) {
    return (
      <main className="min-h-screen bg-[#07090a] p-8 text-white">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-black">Pilot Command Center</h1>

          <div className="mt-8 rounded-2xl border border-zinc-800 bg-[#111315] p-8">
            <p className="text-zinc-400">No pilot exists yet.</p>

            <Link
              href="/admin/pilot"
              className="mt-5 inline-block rounded-xl bg-white px-5 py-3 text-sm font-bold text-black"
            >
              Open Pilot Launch
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const memberCount = number(command.member_count);

  const active = number(command.active_enrollments);
  const paused = number(command.paused_enrollments);
  const completed = number(command.completed_enrollments);
  const stopped = number(command.stopped_enrollments);

  const terminal = completed + stopped;

  const progressPercent =
    memberCount > 0 ? Math.min(100, (terminal / memberCount) * 100) : 0;

  const dangerousEvents =
    number(command.bounced_count) + number(command.failed_count);

  const healthy = dangerousEvents === 0 && paused === 0;

  return (
    <main className="min-h-screen bg-[#07090a] px-6 py-8 text-white lg:px-10">
      <AutoRefresh />

      <div className="mx-auto max-w-[1500px]">
        {/* HEADER */}

        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-400">
              Production Intelligence
            </div>

            <h1 className="mt-2 text-4xl font-black tracking-tight">
              Pilot Command Center
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Live operational view of the current SlateLane carrier pilot.
              Enrollment progress, delivery health and automatic completion
              readiness refresh every 15 seconds.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/pilot"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800"
            >
              ← Pilot Launch
            </Link>

            <Link
              href="/admin/pilot/ramp"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800"
            >
              Ramp Control →
            </Link>
          </div>
        </div>

        {/* PRIMARY STATUS */}

        <section
          className={`mt-8 rounded-3xl border p-6 ${stateClasses(
            command.command_state
          )}`}
        >
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.22em] opacity-70">
                Current Pilot State
              </div>

              <div className="mt-2 text-3xl font-black">
                {stateLabel(command.command_state)}
              </div>

              <div className="mt-2 text-sm opacity-75">
                Batch {command.batch_id}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
              <div>
                <div className="text-xs uppercase text-zinc-500">Pilot</div>
                <div className="mt-1 font-bold text-white">
                  {(command.pilot_status ?? "unknown").toUpperCase()}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase text-zinc-500">Members</div>
                <div className="mt-1 font-bold text-white">{memberCount}</div>
              </div>

              <div>
                <div className="text-xs uppercase text-zinc-500">Min Score</div>
                <div className="mt-1 font-bold text-white">
                  {number(command.minimum_score)}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase text-zinc-500">Health</div>
                <div
                  className={`mt-1 font-bold ${
                    healthy ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {healthy ? "CLEAR" : "REVIEW"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROGRESS */}

        <section className="mt-6 rounded-3xl border border-zinc-800 bg-[#0f1113] p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Automatic Pilot Completion
              </div>

              <h2 className="mt-2 text-2xl font-bold">
                {terminal} / {memberCount} terminal enrollments
              </h2>
            </div>

            <div className="text-3xl font-black text-white">
              {progressPercent.toFixed(0)}%
            </div>
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div className="rounded-xl border border-cyan-950 bg-cyan-950/20 p-3">
              <span className="text-zinc-500">Active</span>
              <span className="float-right font-bold text-cyan-300">
                {active}
              </span>
            </div>

            <div className="rounded-xl border border-amber-950 bg-amber-950/20 p-3">
              <span className="text-zinc-500">Paused</span>
              <span className="float-right font-bold text-amber-300">
                {paused}
              </span>
            </div>

            <div className="rounded-xl border border-emerald-950 bg-emerald-950/20 p-3">
              <span className="text-zinc-500">Completed</span>
              <span className="float-right font-bold text-emerald-300">
                {completed}
              </span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
              <span className="text-zinc-500">Stopped</span>
              <span className="float-right font-bold text-zinc-200">
                {stopped}
              </span>
            </div>
          </div>
        </section>

        {/* KPI GRID */}

        <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-8">
          <StatCard title="Sent" value={number(command.sent_count)} />

          <StatCard
            title="Delivered"
            value={number(command.delivered_count)}
            subtitle={percent(command.delivery_rate)}
          />

          <StatCard
            title="Bounced"
            value={number(command.bounced_count)}
            subtitle={percent(command.bounce_rate)}
          />

          <StatCard title="Failed" value={number(command.failed_count)} />

          <StatCard
            title="Replies"
            value={number(command.total_replies)}
            subtitle={percent(command.reply_rate)}
          />

          <StatCard
            title="Replied Leads"
            value={number(command.replied_leads)}
          />

          <StatCard
            title="Interested"
            value={number(command.interested_leads)}
            subtitle={percent(command.interested_rate)}
          />

          <StatCard
            title="Need Attention"
            value={number(command.attention_replies)}
          />
        </section>

        {/* SCHEDULE */}

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-[#111315] p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Earliest Next Follow-Up
            </div>

            <div className="mt-3 text-xl font-bold">
              {dateTime(command.next_scheduled_send)}
            </div>

            <div className="mt-1 text-xs text-zinc-500">
              America/Chicago
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#111315] p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Latest Next Follow-Up
            </div>

            <div className="mt-3 text-xl font-bold">
              {dateTime(command.last_scheduled_send)}
            </div>

            <div className="mt-1 text-xs text-zinc-500">
              America/Chicago
            </div>
          </div>
        </section>

        {/* MEMBERS */}

        <section className="mt-6 overflow-hidden rounded-3xl border border-zinc-800 bg-[#0f1113]">
          <div className="border-b border-zinc-800 p-6">
            <h2 className="text-xl font-bold">Pilot Members</h2>

            <p className="mt-1 text-sm text-zinc-500">
              Live enrollment and delivery state for every carrier in this
              pilot.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-zinc-800 bg-black/30 text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-4">Email</th>
                  <th className="px-5 py-4">DOT</th>
                  <th className="px-5 py-4">State</th>
                  <th className="px-5 py-4">Step</th>
                  <th className="px-5 py-4">Emails</th>
                  <th className="px-5 py-4">Delivered</th>
                  <th className="px-5 py-4">Bounce</th>
                  <th className="px-5 py-4">Next Send</th>
                </tr>
              </thead>

              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.pilot_member_id}
                    className="border-b border-zinc-900 last:border-0"
                  >
                    <td className="px-5 py-4 font-medium text-white">
                      {member.email ?? "—"}
                    </td>

                    <td className="px-5 py-4 text-zinc-400">
                      {member.dot_number ?? "—"}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${memberStateClasses(
                          member.progress_state
                        )}`}
                      >
                        {(member.progress_state ?? "unknown").toUpperCase()}
                      </span>
                    </td>

                    <td className="px-5 py-4 font-bold text-zinc-200">
                      {member.current_step ?? "—"}
                    </td>

                    <td className="px-5 py-4 text-zinc-300">
                      {number(member.emails_recorded)}
                    </td>

                    <td className="px-5 py-4 text-emerald-400">
                      {number(member.delivered_count)}
                    </td>

                    <td
                      className={`px-5 py-4 font-bold ${
                        number(member.bounced_count) > 0
                          ? "text-red-400"
                          : "text-zinc-500"
                      }`}
                    >
                      {number(member.bounced_count)}
                    </td>

                    <td className="px-5 py-4 text-zinc-400">
                      {dateTime(member.next_send_at)}
                    </td>
                  </tr>
                ))}

                {members.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-12 text-center text-zinc-500"
                    >
                      No pilot members found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {/* COMPLETION RESULT */}

        {command.pilot_status === "completed" ? (
          <section className="mt-6 rounded-3xl border border-emerald-800 bg-emerald-950/20 p-6">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
              Automatic Completion
            </div>

            <h2 className="mt-2 text-2xl font-black">
              Pilot completed automatically
            </h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase text-zinc-500">
                  Outcome
                </div>

                <div className="mt-1 font-bold uppercase text-emerald-300">
                  {command.completion_outcome ?? "unknown"}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase text-zinc-500">
                  Completed
                </div>

                <div className="mt-1 font-bold">
                  {dateTime(command.completed_at)}
                </div>
              </div>
            </div>

            {command.completion_reason ? (
              <p className="mt-5 text-sm leading-6 text-zinc-300">
                {command.completion_reason}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* AUDIT */}

        <section className="mt-6 rounded-3xl border border-zinc-800 bg-[#0f1113] p-6">
          <h2 className="text-xl font-bold">Completion Audit</h2>

          <p className="mt-1 text-sm text-zinc-500">
            Immutable automatic pilot-completion events.
          </p>

          {audits.length === 0 ? (
            <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/50 p-5 text-sm text-zinc-500">
              No completion event yet. This is expected while the pilot is
              running.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {audits.map((audit) => (
                <div
                  key={audit.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row">
                    <div className="font-bold text-white">
                      {(audit.outcome ?? "unknown").toUpperCase()}
                    </div>

                    <div className="text-xs text-zinc-500">
                      {dateTime(audit.created_at)}
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-zinc-400">
                    {audit.reason ?? "No reason recorded."}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-6 rounded-2xl border border-emerald-950 bg-emerald-950/10 p-5 text-sm text-zinc-400">
          <strong className="text-emerald-400">
            Production protection:
          </strong>{" "}
          this Command Center is read-only. It does not enable Master Sending,
          alter sequence timing, create pilots or transmit email.
        </div>
      </div>
    </main>
  );
}