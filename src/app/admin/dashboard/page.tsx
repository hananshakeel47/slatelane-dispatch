import Link from "next/link";
import { unstable_cache } from "next/cache";

import {
  createServerSupabase,
} from "@/lib/supabase/server";

export const dynamic =
  "force-dynamic";

type DashboardMetrics = {
  total_leads: number;
  interested_leads: number;
  follow_up_leads: number;
  clients: number;
  not_interested: number;
  open_replies: number;
  overdue_tasks: number;
  tasks_next_24h: number;
  active_sequences: number;
  sent_last_24h: number;
  delivered_last_24h: number;
  bounced_last_24h: number;
  failed_last_24h: number;
  complained_last_24h: number;
};

type LaunchSettings = {
  sending_enabled: boolean;
  daily_send_cap: number;
  max_batch_size: number;
  sending_hour_start: number;
  sending_hour_end: number;
  sending_timezone: string;
  minimum_carrier_score: number;
} | null;

type OutreachSettings = {
  enabled: boolean;
  target_new_carriers_per_day: number;
  followups_first: boolean;
  max_concurrent_enrollments: number;
} | null;

type SafetyState = {
  auto_paused: boolean;
  pause_reason: string | null;
  last_evaluated_at: string | null;
  sends_in_window: number;
  bounce_rate: number;
  failure_rate: number;
  complaint_rate: number;
} | null;

type VerificationState = {
  provider: string;
  enabled: boolean;
  send_ready_candidates: number;
  waiting_for_external_verification: number;
  last_job_date: string | null;
  last_job_status: string | null;
  last_job_requested: number;
  last_job_deliverable: number;
  last_job_risky: number;
  last_job_undeliverable: number;
  last_job_unknown: number;
  completed_at: string | null;
} | null;

type TodayOutreach = {
  operational_date: string;
  status: string | null;
  daily_send_cap: number;
  sends_already_today: number;
  existing_reserved_today: number;
  new_slots_available: number;
  candidates_available: number;
  created_leads: number;
  created_enrollments: number;
  first_send_at: string | null;
  last_send_at: string | null;
  completed_at: string | null;
} | null;

type LinkedinStatus = {
  enabled: boolean;
  daily_connection_target: number;
  daily_followup_target: number;
  new_prospects: number;
  pending_connections: number;
  active_conversations: number;
  replies: number;
  qualified: number;
  followups_due: number;
  connections_requested_today: number;
  messages_sent_today: number;
  connected: number;
  messaged: number;
} | null;

type Opportunity = {
  lead_id: string;
  company_name: string | null;
  contact_name: string | null;
  lead_status: string | null;
  latest_reply_classification:
    string | null;
  latest_reply_requires_attention:
    boolean | null;
  latest_reply_received_at:
    string | null;
  open_task_title:
    string | null;
  open_task_priority:
    string | null;
  open_task_due_at:
    string | null;
  task_overdue:
    boolean | null;
  opportunity_score:
    number | null;
};

type PriorityTask = {
  id: string;
  lead_id: string | null;
  task_type: string | null;
  title: string | null;
  priority: string | null;
  due_at: string | null;
  company_name: string | null;
  contact_name: string | null;
};

type RecentReply = {
  id: string;
  lead_id: string | null;
  subject: string | null;
  text_body: string | null;
  classification: string | null;
  requires_attention: boolean;
  handled: boolean;
  received_at: string | null;
  company_name: string | null;
  contact_name: string | null;
};

type DashboardData = {
  generated_at: string;
  operational_date: string;
  metrics: DashboardMetrics;
  launch: LaunchSettings;
  outreach_settings: OutreachSettings;
  safety: SafetyState;
  verification: VerificationState;
  today_outreach: TodayOutreach;
  linkedin: LinkedinStatus;
  top_opportunities: Opportunity[];
  priority_tasks: PriorityTask[];
  recent_replies: RecentReply[];
};

const getDashboardData =
  unstable_cache(
    async (): Promise<DashboardData> => {
      const supabase =
        createServerSupabase();

      const {
        data,
        error,
      } =
        await supabase.rpc(
          "get_admin_dashboard_summary",
        );

      if (error) {
        throw new Error(
          `Dashboard data failed: ${error.message}`,
        );
      }

      return data as DashboardData;
    },
    [
      "slatelane-admin-dashboard-v2",
    ],
    {
      revalidate: 15,
    },
  );

function number(
  value:
    | number
    | null
    | undefined,
) {
  return (
    value ?? 0
  ).toLocaleString();
}

function percent(
  value:
    | number
    | null
    | undefined,
  digits = 1,
) {
  const numeric =
    Number(value ?? 0);

  return `${numeric.toFixed(
    digits,
  )}%`;
}

function safePercent(
  value: number,
) {
  if (
    !Number.isFinite(
      value,
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      value,
    ),
  );
}

function formatDate(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        "America/Chicago",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(
    new Date(value),
  );
}

function formatTime(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        "America/Chicago",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(
    new Date(value),
  );
}

function preview(
  text:
    | string
    | null
    | undefined,
) {
  if (!text) {
    return "No message preview.";
  }

  const cleaned =
    text
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  if (
    cleaned.length <=
    145
  ) {
    return cleaned;
  }

  return `${cleaned.slice(
    0,
    145,
  )}…`;
}

function classificationLabel(
  value:
    | string
    | null,
) {
  switch (value) {
    case "interested":
      return "Interested";

    case "need_rates":
      return "Need Rates";

    case "call_me":
      return "Call Me";

    case "not_interested":
      return "Not Interested";

    case "wrong_contact":
      return "Wrong Contact";

    case "unsubscribe":
      return "Unsubscribe";

    default:
      return "Reply";
  }
}

function classificationClass(
  value:
    | string
    | null,
) {
  switch (value) {
    case "interested":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";

    case "need_rates":
      return "border-blue-500/20 bg-blue-500/10 text-blue-300";

    case "call_me":
      return "border-violet-500/20 bg-violet-500/10 text-violet-300";

    case "not_interested":
      return "border-red-500/20 bg-red-500/10 text-red-300";

    default:
      return "border-white/10 bg-white/[0.04] text-zinc-300";
  }
}

function priorityClass(
  priority:
    | string
    | null,
) {
  switch (
    priority
  ) {
    case "urgent":
      return "border-red-500/20 bg-red-500/10 text-red-300";

    case "high":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";

    default:
      return "border-blue-500/20 bg-blue-500/10 text-blue-300";
  }
}

function Dot({
  color,
}: {
  color:
    | "green"
    | "blue"
    | "amber"
    | "red"
    | "violet";
}) {
  const colors = {
    green:
      "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.45)]",

    blue:
      "bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,.45)]",

    amber:
      "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,.45)]",

    red:
      "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,.45)]",

    violet:
      "bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,.45)]",
  };

  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colors[color]}`}
    />
  );
}

function Progress({
  value,
}: {
  value: number;
}) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.055]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-400 transition-all duration-500"
        style={{
          width: `${safePercent(
            value,
          )}%`,
        }}
      />
    </div>
  );
}

export default async function DashboardPage() {
  const data =
    await getDashboardData();

  const {
    metrics,
    launch,
    outreach_settings:
      outreachSettings,
    safety,
    verification,
    today_outreach:
      todayOutreach,
    linkedin,
    top_opportunities:
      opportunities,
    priority_tasks:
      priorityTasks,
    recent_replies:
      recentReplies,
  } = data;

  const deliveryRate =
    metrics.sent_last_24h >
    0
      ? (
          metrics.delivered_last_24h /
          metrics.sent_last_24h
        ) *
        100
      : 100;

  const sequenceCapacity =
    outreachSettings
      ?.max_concurrent_enrollments ??
    0;

  const sequenceLoad =
    sequenceCapacity > 0
      ? (
          metrics.active_sequences /
          sequenceCapacity
        ) *
        100
      : 0;

  const dailyNewTarget =
    outreachSettings
      ?.target_new_carriers_per_day ??
    25;

  const newToday =
    todayOutreach
      ?.created_enrollments ??
    0;

  const newCarrierProgress =
    dailyNewTarget > 0
      ? (
          newToday /
          dailyNewTarget
        ) *
        100
      : 0;

  const connectionTarget =
    linkedin
      ?.daily_connection_target ??
    20;

  const connectionsToday =
    linkedin
      ?.connections_requested_today ??
    0;

  const linkedinProgress =
    connectionTarget > 0
      ? (
          connectionsToday /
          connectionTarget
        ) *
        100
      : 0;

  const systemHealthy =
    Boolean(
      launch?.sending_enabled,
    ) &&
    !safety?.auto_paused;

  const safe =
    !safety?.auto_paused;

  return (
    <div className="space-y-7">

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="relative overflow-hidden rounded-[24px] border border-white/[0.075] bg-[linear-gradient(135deg,rgba(20,25,34,.94),rgba(10,14,20,.94))] px-7 py-7 shadow-[0_20px_70px_rgba(0,0,0,.2)]">

        <div className="pointer-events-none absolute -right-28 -top-36 h-80 w-80 rounded-full bg-blue-500/[0.07] blur-3xl" />

        <div className="pointer-events-none absolute bottom-[-160px] left-[25%] h-72 w-72 rounded-full bg-sky-500/[0.035] blur-3xl" />

        <div className="relative flex flex-col gap-7 xl:flex-row xl:items-center xl:justify-between">

          <div className="max-w-3xl">

            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-400">
              <Dot color="blue" />
              Operations Command Center
            </div>

            <h1 className="mt-4 text-[34px] font-semibold tracking-[-0.045em] text-white md:text-[40px]">
              Good operations start here.
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Live carrier acquisition, reply handling,
              automation health and sales opportunities
              across SlateLane.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">

              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium ${
                systemHealthy
                  ? "border-emerald-500/15 bg-emerald-500/[0.07] text-emerald-300"
                  : "border-red-500/20 bg-red-500/[0.08] text-red-300"
              }`}>
                <Dot
                  color={
                    systemHealthy
                      ? "green"
                      : "red"
                  }
                />

                {systemHealthy
                  ? "All systems operational"
                  : "Automation attention required"}
              </div>

              <div className="rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[11px] text-zinc-500">
                Chicago ops date:{" "}
                <span className="text-zinc-300">
                  {data.operational_date}
                </span>
              </div>

              <div className="rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[11px] text-zinc-500">
                Refreshes every ~15s
              </div>

            </div>

          </div>

          <div className="flex flex-wrap gap-2">

            <Link
              href="/admin/replies?handling=open"
              className="inline-flex h-10 items-center rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 text-[12px] font-semibold text-zinc-200 hover:bg-white/[0.065]"
            >
              Open inbox
            </Link>

            <Link
              href="/admin/tasks"
              className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-[12px] font-semibold text-black shadow-[0_8px_24px_rgba(255,255,255,.08)] hover:bg-zinc-200"
            >
              Action tasks
              <span className="ml-2">
                →
              </span>
            </Link>

          </div>

        </div>

      </section>

      {/* =====================================================
          EXECUTIVE KPIs
      ===================================================== */}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

        <Link
          href="/admin/replies?handling=open"
          className="group rounded-[18px] border border-white/[0.07] bg-white/[0.025] p-5 hover:border-amber-400/20 hover:bg-white/[0.04]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Action inbox
            </span>

            <Dot
              color={
                metrics.open_replies >
                0
                  ? "amber"
                  : "green"
              }
            />
          </div>

          <div className="mt-4 text-[32px] font-semibold tracking-[-0.04em] text-white">
            {number(
              metrics.open_replies,
            )}
          </div>

          <div className="mt-1 text-[11px] text-zinc-500">
            Replies waiting for review
          </div>
        </Link>

        <Link
          href="/admin/leads"
          className="group rounded-[18px] border border-white/[0.07] bg-white/[0.025] p-5 hover:border-emerald-400/20 hover:bg-white/[0.04]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Hot opportunities
            </span>

            <Dot color="green" />
          </div>

          <div className="mt-4 text-[32px] font-semibold tracking-[-0.04em] text-white">
            {number(
              metrics.interested_leads,
            )}
          </div>

          <div className="mt-1 text-[11px] text-zinc-500">
            Interested carriers
          </div>
        </Link>

        <Link
          href="/admin/tasks"
          className="group rounded-[18px] border border-white/[0.07] bg-white/[0.025] p-5 hover:border-red-400/20 hover:bg-white/[0.04]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Overdue work
            </span>

            <Dot
              color={
                metrics.overdue_tasks >
                0
                  ? "red"
                  : "green"
              }
            />
          </div>

          <div className="mt-4 text-[32px] font-semibold tracking-[-0.04em] text-white">
            {number(
              metrics.overdue_tasks,
            )}
          </div>

          <div className="mt-1 text-[11px] text-zinc-500">
            Tasks needing immediate action
          </div>
        </Link>

        <Link
          href="/admin/monitoring"
          className="group rounded-[18px] border border-white/[0.07] bg-white/[0.025] p-5 hover:border-blue-400/20 hover:bg-white/[0.04]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Delivery
            </span>

            <Dot
              color={
                deliveryRate >= 98
                  ? "green"
                  : "amber"
              }
            />
          </div>

          <div className="mt-4 text-[32px] font-semibold tracking-[-0.04em] text-white">
            {deliveryRate.toFixed(
              1,
            )}
            <span className="ml-1 text-base font-medium text-zinc-500">
              %
            </span>
          </div>

          <div className="mt-1 text-[11px] text-zinc-500">
            {number(
              metrics.delivered_last_24h,
            )}{" "}
            /{" "}
            {number(
              metrics.sent_last_24h,
            )}{" "}
            delivered
          </div>
        </Link>

      </div>

      {/* =====================================================
          MAIN OPERATIONS GRID
      ===================================================== */}

      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">

        {/* HOT OPPORTUNITIES */}

        <section className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.022]">

          <div className="flex items-center justify-between border-b border-white/[0.065] px-5 py-4">

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                First client pipeline
              </div>

              <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.025em] text-white">
                Highest-priority opportunities
              </h2>
            </div>

            <Link
              href="/admin/leads"
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300"
            >
              All leads →
            </Link>

          </div>

          <div className="divide-y divide-white/[0.055]">

            {opportunities.length >
            0 ? (
              opportunities.map(
                (
                  opportunity,
                  index,
                ) => (
                  <Link
                    key={
                      opportunity.lead_id
                    }
                    href={`/admin/leads/${opportunity.lead_id}`}
                    className="group flex flex-col gap-4 px-5 py-4 transition hover:bg-white/[0.02] md:flex-row md:items-center"
                  >

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-[11px] font-bold text-zinc-300">
                      {String(
                        index + 1,
                      ).padStart(
                        2,
                        "0",
                      )}
                    </div>

                    <div className="min-w-0 flex-1">

                      <div className="flex flex-wrap items-center gap-2">

                        <div className="truncate text-[13px] font-semibold text-zinc-100">
                          {opportunity.company_name ??
                            opportunity.contact_name ??
                            "Carrier opportunity"}
                        </div>

                        {opportunity.task_overdue ? (
                          <span className="rounded-full border border-red-500/15 bg-red-500/[0.07] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-300">
                            Overdue
                          </span>
                        ) : null}

                      </div>

                      <div className="mt-1.5 truncate text-[11px] text-zinc-500">
                        {opportunity.open_task_title ??
                          "Carrier requires follow-up"}
                      </div>

                    </div>

                    <div className="flex items-center gap-5">

                      <div className="text-right">

                        <div className="text-[9px] uppercase tracking-[0.12em] text-zinc-600">
                          Score
                        </div>

                        <div className="mt-1 text-lg font-semibold text-emerald-300">
                          {number(
                            opportunity.opportunity_score,
                          )}
                        </div>

                      </div>

                      <span className="text-zinc-600 transition group-hover:translate-x-1 group-hover:text-zinc-300">
                        →
                      </span>

                    </div>

                  </Link>
                ),
              )
            ) : (
              <div className="px-5 py-12 text-center text-sm text-zinc-500">
                No hot opportunities yet.
              </div>
            )}

          </div>

        </section>

        {/* OUTREACH */}

        <section className="rounded-[20px] border border-white/[0.07] bg-white/[0.022] p-5">

          <div className="flex items-center justify-between">

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Daily acquisition
              </div>

              <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.025em] text-white">
                Outreach engine
              </h2>
            </div>

            <div className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide ${
              launch?.sending_enabled &&
              !safety?.auto_paused
                ? "border-emerald-500/15 bg-emerald-500/[0.07] text-emerald-300"
                : "border-red-500/20 bg-red-500/[0.08] text-red-300"
            }`}>
              <Dot
                color={
                  launch?.sending_enabled &&
                  !safety?.auto_paused
                    ? "green"
                    : "red"
                }
              />

              {launch?.sending_enabled &&
              !safety?.auto_paused
                ? "Live"
                : "Paused"}
            </div>

          </div>

          <div className="mt-6">

            <div className="flex items-end justify-between">

              <div>
                <div className="text-[28px] font-semibold tracking-[-0.04em] text-white">
                  {newToday}
                  <span className="text-base font-medium text-zinc-600">
                    /{dailyNewTarget}
                  </span>
                </div>

                <div className="mt-1 text-[11px] text-zinc-500">
                  New carriers enrolled today
                </div>
              </div>

              <div className="text-[11px] font-semibold text-blue-300">
                {Math.round(
                  safePercent(
                    newCarrierProgress,
                  ),
                )}
                %
              </div>

            </div>

            <div className="mt-3">
              <Progress
                value={
                  newCarrierProgress
                }
              />
            </div>

          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">

            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
              <div className="text-[9px] uppercase tracking-[0.11em] text-zinc-600">
                Daily cap
              </div>

              <div className="mt-2 text-lg font-semibold text-zinc-200">
                {number(
                  launch?.daily_send_cap,
                )}
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
              <div className="text-[9px] uppercase tracking-[0.11em] text-zinc-600">
                Batch size
              </div>

              <div className="mt-2 text-lg font-semibold text-zinc-200">
                {number(
                  launch?.max_batch_size,
                )}
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
              <div className="text-[9px] uppercase tracking-[0.11em] text-zinc-600">
                Verified ready
              </div>

              <div className="mt-2 text-lg font-semibold text-emerald-300">
                {number(
                  verification?.send_ready_candidates,
                )}
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
              <div className="text-[9px] uppercase tracking-[0.11em] text-zinc-600">
                Send window
              </div>

              <div className="mt-2 text-sm font-semibold text-zinc-200">
                {launch
                  ? `${launch.sending_hour_start}:00–${launch.sending_hour_end}:00`
                  : "—"}
              </div>
            </div>

          </div>

          <Link
            href="/admin/acquisition"
            className="mt-4 flex h-10 items-center justify-center rounded-xl border border-white/[0.075] bg-white/[0.025] text-[11px] font-semibold text-zinc-300 hover:bg-white/[0.05]"
          >
            Open Acquisition Center
          </Link>

        </section>

      </div>

      {/* =====================================================
          SYSTEM HEALTH ROW
      ===================================================== */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

        <section className="rounded-[18px] border border-white/[0.07] bg-white/[0.022] p-4">

          <div className="flex items-center justify-between">

            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Sequence capacity
            </span>

            <Dot
              color={
                sequenceLoad <
                90
                  ? "green"
                  : "amber"
              }
            />

          </div>

          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-white">
              {number(
                metrics.active_sequences,
              )}
            </span>

            <span className="text-xs text-zinc-600">
              /
              {number(
                sequenceCapacity,
              )}
            </span>
          </div>

          <div className="mt-3">
            <Progress
              value={
                sequenceLoad
              }
            />
          </div>

          <div className="mt-2 text-[10px] text-zinc-600">
            {Math.round(
              sequenceLoad,
            )}
            % utilized
          </div>

        </section>

        <section className="rounded-[18px] border border-white/[0.07] bg-white/[0.022] p-4">

          <div className="flex items-center justify-between">

            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Email safety
            </span>

            <Dot
              color={
                safe
                  ? "green"
                  : "red"
              }
            />

          </div>

          <div className="mt-3 text-2xl font-semibold text-white">
            {safe
              ? "Protected"
              : "Paused"}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">

            <div>
              <div className="text-xs font-semibold text-zinc-300">
                {percent(
                  safety?.bounce_rate,
                )}
              </div>
              <div className="mt-1 text-[8px] uppercase tracking-wide text-zinc-600">
                Bounce
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-zinc-300">
                {percent(
                  safety?.failure_rate,
                )}
              </div>
              <div className="mt-1 text-[8px] uppercase tracking-wide text-zinc-600">
                Failure
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-zinc-300">
                {percent(
                  safety?.complaint_rate,
                )}
              </div>
              <div className="mt-1 text-[8px] uppercase tracking-wide text-zinc-600">
                Complaint
              </div>
            </div>

          </div>

        </section>

        <section className="rounded-[18px] border border-white/[0.07] bg-white/[0.022] p-4">

          <div className="flex items-center justify-between">

            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Verification
            </span>

            <Dot
              color={
                verification?.last_job_status ===
                "completed"
                  ? "green"
                  : "amber"
              }
            />

          </div>

          <div className="mt-3 text-2xl font-semibold text-white">
            {number(
              verification?.last_job_deliverable,
            )}
            <span className="ml-1 text-xs font-medium text-zinc-600">
              deliverable
            </span>
          </div>

          <div className="mt-2 text-[10px] text-zinc-500">
            Last batch:{" "}
            {number(
              verification?.last_job_requested,
            )}{" "}
            checked •{" "}
            {number(
              verification?.last_job_undeliverable,
            )}{" "}
            rejected
          </div>

        </section>

        <Link
          href="/admin/linkedin"
          className="rounded-[18px] border border-white/[0.07] bg-white/[0.022] p-4 hover:border-blue-400/20 hover:bg-white/[0.035]"
        >

          <div className="flex items-center justify-between">

            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              LinkedIn
            </span>

            <Dot color="blue" />

          </div>

          <div className="mt-3 text-2xl font-semibold text-white">
            {connectionsToday}
            <span className="ml-1 text-xs font-medium text-zinc-600">
              /{connectionTarget}
            </span>
          </div>

          <div className="mt-3">
            <Progress
              value={
                linkedinProgress
              }
            />
          </div>

          <div className="mt-2 text-[10px] text-zinc-600">
            {number(
              linkedin?.pending_connections,
            )}{" "}
            pending •{" "}
            {number(
              linkedin?.new_prospects,
            )}{" "}
            new
          </div>

        </Link>

      </div>

      {/* =====================================================
          TASKS + REPLIES
      ===================================================== */}

      <div className="grid gap-5 2xl:grid-cols-2">

        {/* TASKS */}

        <section className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.022]">

          <div className="flex items-center justify-between border-b border-white/[0.065] px-5 py-4">

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Priority queue
              </div>

              <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.025em] text-white">
                Next actions
              </h2>
            </div>

            <Link
              href="/admin/tasks"
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300"
            >
              All tasks →
            </Link>

          </div>

          <div className="divide-y divide-white/[0.05]">

            {priorityTasks.length >
            0 ? (
              priorityTasks.map(
                (task) => (
                  <Link
                    key={
                      task.id
                    }
                    href={
                      task.lead_id
                        ? `/admin/leads/${task.lead_id}`
                        : "/admin/tasks"
                    }
                    className="group flex items-start gap-4 px-5 py-4 transition hover:bg-white/[0.02]"
                  >

                    <div className="mt-1">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.09em] ${priorityClass(
                          task.priority,
                        )}`}
                      >
                        {task.priority ??
                          "normal"}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">

                      <div className="truncate text-[12px] font-semibold text-zinc-200">
                        {task.title ??
                          "Follow-up task"}
                      </div>

                      <div className="mt-1 text-[10px] text-zinc-600">
                        {task.company_name ??
                          task.contact_name ??
                          "Carrier"}
                      </div>

                    </div>

                    <div className="shrink-0 text-right">

                      <div className="text-[8px] uppercase tracking-[0.1em] text-zinc-700">
                        Due
                      </div>

                      <div className="mt-1 text-[10px] text-zinc-500">
                        {formatDate(
                          task.due_at,
                        )}
                      </div>

                    </div>

                  </Link>
                ),
              )
            ) : (
              <div className="px-5 py-12 text-center text-sm text-zinc-500">
                No tasks waiting.
              </div>
            )}

          </div>

        </section>

        {/* REPLIES */}

        <section className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.022]">

          <div className="flex items-center justify-between border-b border-white/[0.065] px-5 py-4">

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Carrier inbox
              </div>

              <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.025em] text-white">
                Recent replies
              </h2>
            </div>

            <Link
              href="/admin/replies"
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300"
            >
              Open inbox →
            </Link>

          </div>

          <div className="divide-y divide-white/[0.05]">

            {recentReplies.length >
            0 ? (
              recentReplies.map(
                (reply) => (
                  <Link
                    key={
                      reply.id
                    }
                    href={
                      reply.lead_id
                        ? `/admin/leads/${reply.lead_id}`
                        : "/admin/replies"
                    }
                    className="group block px-5 py-4 transition hover:bg-white/[0.02]"
                  >

                    <div className="flex items-start gap-4">

                      <div
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          reply.requires_attention &&
                          !reply.handled
                            ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,.35)]"
                            : "bg-zinc-700"
                        }`}
                      />

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-wrap items-center gap-2">

                          <div className="truncate text-[12px] font-semibold text-zinc-200">
                            {reply.company_name ??
                              reply.contact_name ??
                              "Carrier reply"}
                          </div>

                          <span
                            className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold ${classificationClass(
                              reply.classification,
                            )}`}
                          >
                            {classificationLabel(
                              reply.classification,
                            )}
                          </span>

                        </div>

                        <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-zinc-500">
                          {preview(
                            reply.text_body,
                          )}
                        </p>

                      </div>

                      <div className="shrink-0 text-[9px] text-zinc-600">
                        {formatDate(
                          reply.received_at,
                        )}
                      </div>

                    </div>

                  </Link>
                ),
              )
            ) : (
              <div className="px-5 py-12 text-center text-sm text-zinc-500">
                No replies yet.
              </div>
            )}

          </div>

        </section>

      </div>

      {/* =====================================================
          PIPELINE + AUTOMATION
      ===================================================== */}

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">

        <section className="rounded-[20px] border border-white/[0.07] bg-white/[0.022] p-5">

          <div className="flex items-center justify-between">

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Sales pipeline
              </div>

              <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.025em] text-white">
                Lead distribution
              </h2>
            </div>

            <Link
              href="/admin/leads"
              className="text-[11px] font-semibold text-blue-400"
            >
              Explore →
            </Link>

          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">

            <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.045] p-4">
              <div className="text-[9px] uppercase tracking-wide text-zinc-600">
                Interested
              </div>

              <div className="mt-2 text-2xl font-semibold text-emerald-300">
                {number(
                  metrics.interested_leads,
                )}
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/10 bg-blue-500/[0.04] p-4">
              <div className="text-[9px] uppercase tracking-wide text-zinc-600">
                Follow-up
              </div>

              <div className="mt-2 text-2xl font-semibold text-blue-300">
                {number(
                  metrics.follow_up_leads,
                )}
              </div>
            </div>

            <div className="rounded-xl border border-violet-500/10 bg-violet-500/[0.04] p-4">
              <div className="text-[9px] uppercase tracking-wide text-zinc-600">
                Clients
              </div>

              <div className="mt-2 text-2xl font-semibold text-violet-300">
                {number(
                  metrics.clients,
                )}
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <div className="text-[9px] uppercase tracking-wide text-zinc-600">
                Total leads
              </div>

              <div className="mt-2 text-2xl font-semibold text-zinc-200">
                {number(
                  metrics.total_leads,
                )}
              </div>
            </div>

          </div>

        </section>

        <section className="rounded-[20px] border border-white/[0.07] bg-white/[0.022] p-5">

          <div className="flex items-center justify-between">

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Automation
              </div>

              <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.025em] text-white">
                System health
              </h2>
            </div>

            <Link
              href="/admin/monitoring"
              className="text-[11px] font-semibold text-blue-400"
            >
              Monitoring →
            </Link>

          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">

            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <div className="flex items-center gap-2">
                <Dot color="green" />

                <span className="text-[10px] font-semibold text-zinc-300">
                  Scheduler
                </span>
              </div>

              <div className="mt-2 text-[10px] text-zinc-600">
                Automatic processing active
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <div className="flex items-center gap-2">
                <Dot color="green" />

                <span className="text-[10px] font-semibold text-zinc-300">
                  Reply detection
                </span>
              </div>

              <div className="mt-2 text-[10px] text-zinc-600">
                Classification running
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <div className="flex items-center gap-2">
                <Dot color="green" />

                <span className="text-[10px] font-semibold text-zinc-300">
                  Auto-stop
                </span>
              </div>

              <div className="mt-2 text-[10px] text-zinc-600">
                Replied leads protected
              </div>
            </div>

          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.055] pt-4 text-[10px] text-zinc-600">

            <span>
              Emails 24h:{" "}
              <strong className="font-semibold text-zinc-300">
                {number(
                  metrics.sent_last_24h,
                )}
              </strong>
            </span>

            <span>
              Bounce:{" "}
              <strong className="font-semibold text-zinc-300">
                {number(
                  metrics.bounced_last_24h,
                )}
              </strong>
            </span>

            <span>
              Failed:{" "}
              <strong className="font-semibold text-zinc-300">
                {number(
                  metrics.failed_last_24h,
                )}
              </strong>
            </span>

            <span>
              Complaints:{" "}
              <strong className="font-semibold text-zinc-300">
                {number(
                  metrics.complained_last_24h,
                )}
              </strong>
            </span>

          </div>

        </section>

      </div>

      {/* =====================================================
          FOOTER STATUS
      ===================================================== */}

      <div className="flex flex-col gap-2 border-t border-white/[0.055] pt-5 text-[10px] text-zinc-700 sm:flex-row sm:items-center sm:justify-between">

        <span>
          SlateLane Dispatch Operations OS
        </span>

        <span>
          Last data snapshot:{" "}
          <span className="text-zinc-500">
            {formatDate(
              data.generated_at,
            )}{" "}
            Chicago
          </span>
        </span>

      </div>

    </div>
  );
}