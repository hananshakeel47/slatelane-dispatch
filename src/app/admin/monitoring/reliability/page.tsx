import Link from "next/link";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";


export const dynamic =
  "force-dynamic";


type HealthRow = {
  observed_at:
    string | null;

  last_send_at:
    string | null;

  last_webhook_at:
    string | null;

  last_reply_at:
    string | null;

  active_enrollments:
    number | string | null;

  paused_enrollments:
    number | string | null;

  stopped_enrollments:
    number | string | null;

  unhandled_replies:
    number | string | null;

  attention_required:
    number | string | null;

  sends_last_24h:
    number | string | null;

  delivered_last_24h:
    number | string | null;

  bounced_last_24h:
    number | string | null;

  failed_last_24h:
    number | string | null;

  replies_last_24h:
    number | string | null;

  webhook_events_last_24h:
    number | string | null;

  overdue_tasks:
    number | string | null;
};


type BadSendRow = {
  id:
    string;

  lead_id:
    string | null;

  to_email:
    string | null;

  subject:
    string | null;

  status:
    string;

  error_message:
    string | null;

  created_at:
    string;

  updated_at:
    string;
};


type WebhookRow = {
  svix_id:
    string;

  event_type:
    string;

  resend_email_id:
    string | null;

  received_at:
    string;
};


type TaskRow = {
  id:
    string;

  lead_id:
    string;

  title:
    string;

  task_type:
    string;

  priority:
    string;

  due_at:
    string | null;

  status:
    string;
};


type ExpiredLinkRow = {
  id:
    string;

  onboarding_id:
    string;

  document_type:
    string;

  recipient_email:
    string | null;

  status:
    string;

  expires_at:
    string;

  last_opened_at:
    string | null;

  created_at:
    string;
};


type OnboardingRow = {
  id:
    string;

  lead_id:
    string | null;

  company_name:
    string;

  dot_number:
    number | null;

  status:
    string;

  agreement_status:
    string;

  load_board_access_status:
    string;

  updated_at:
    string;
};


type ReadinessRow = {
  onboarding_id:
    string;

  company_name:
    string;

  dot_number:
    number | null;

  ready_for_dispatch:
    boolean;

  missing_requirements:
    string[] | null;

  active_truck_count:
    number | null;

  available_truck_count:
    number | null;
};


function numberValue(
  value:
    number |
    string |
    null |
    undefined,
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


function formatDate(
  value:
    string |
    null |
    undefined,
) {
  if (!value) {
    return "No activity";
  }


  const date =
    new Date(
      value,
    );


  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Unknown";
  }


  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        "America/Chicago",

      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",
    },
  ).format(
    date,
  );
}


function relativeAge(
  value:
    string |
    null |
    undefined,
) {
  if (!value) {
    return "never";
  }


  const timestamp =
    new Date(
      value,
    ).getTime();


  if (
    Number.isNaN(
      timestamp,
    )
  ) {
    return "unknown";
  }


  const difference =
    Date.now() -
    timestamp;


  const minutes =
    Math.max(
      0,
      Math.floor(
        difference /
          60000,
      ),
    );


  if (
    minutes <
    60
  ) {
    return `${minutes}m ago`;
  }


  const hours =
    Math.floor(
      minutes /
        60,
    );


  if (
    hours <
    24
  ) {
    return `${hours}h ago`;
  }


  const days =
    Math.floor(
      hours /
        24,
    );


  return `${days}d ago`;
}


function pretty(
  value:
    string |
    null |
    undefined,
) {
  if (!value) {
    return "—";
  }


  return value
    .replace(
      /_/g,
      " ",
    )
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character.toUpperCase(),
    );
}


function requirementLabel(
  value:
    string,
) {
  switch (
    value
  ) {
    case "company_name":
      return "Company";

    case "dot_number":
      return "USDOT";

    case "primary_contact":
      return "Primary Contact";

    case "signed_dispatch_agreement":
      return "Signed Agreement";

    case "load_board_access":
      return "Load Board";

    case "dispatch_fee":
      return "Dispatch Fee";

    case "active_truck":
      return "Active Truck";

    default:
      return pretty(
        value,
      );
  }
}


function severityClasses(
  severity:
    "healthy" |
    "warning" |
    "critical",
) {
  if (
    severity ===
    "critical"
  ) {
    return "border-red-500/20 bg-red-500/[0.06] text-red-300";
  }


  if (
    severity ===
    "warning"
  ) {
    return "border-amber-500/20 bg-amber-500/[0.05] text-amber-300";
  }


  return "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300";
}


function badgeClasses(
  status:
    string,
) {
  if (
    status ===
      "failed" ||
    status ===
      "complained"
  ) {
    return "border-red-500/20 bg-red-500/[0.06] text-red-300";
  }


  if (
    status ===
    "bounced"
  ) {
    return "border-amber-500/20 bg-amber-500/[0.05] text-amber-300";
  }


  if (
    status ===
      "email.delivered" ||
    status ===
      "email.sent"
  ) {
    return "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300";
  }


  return "border-white/[0.07] bg-white/[0.025] text-zinc-500";
}


function Metric({
  label,
  value,
  detail,
  severity =
    "healthy",
}: {
  label:
    string;

  value:
    string |
    number;

  detail:
    string;

  severity?:
    "healthy" |
    "warning" |
    "critical";
}) {
  return (
    <div className="rounded-[17px] border border-white/[0.065] bg-black/15 p-4">

      <div className="text-[7px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
        {label}
      </div>


      <div className="mt-2 flex items-end justify-between gap-3">

        <div className="text-[24px] font-semibold tracking-tight text-zinc-100">
          {value}
        </div>


        <span
          className={`rounded-full border px-2 py-1 text-[7px] font-semibold uppercase ${severityClasses(
            severity,
          )}`}
        >
          {severity}
        </span>

      </div>


      <div className="mt-2 text-[8px] leading-4 text-zinc-600">
        {detail}
      </div>

    </div>
  );
}


export default async function ReliabilityPage() {
  const supabase =
    createAdminSupabase();


  const now =
    new Date();


  const dayAgo =
    new Date(
      now.getTime() -
        24 *
          60 *
          60 *
          1000,
    ).toISOString();


  const stalledCutoff =
    new Date(
      now.getTime() -
        48 *
          60 *
          60 *
          1000,
    ).toISOString();


  const [
    healthResult,
    badSendResult,
    webhookResult,
    overdueTaskResult,
    expiredLinkResult,
    stalledOnboardingResult,
    blockedCarrierResult,
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
          "email_sends",
        )
        .select(`
          id,
          lead_id,
          to_email,
          subject,
          status,
          error_message,
          created_at,
          updated_at
        `)
        .in(
          "status",
          [
            "failed",
            "bounced",
            "complained",
          ],
        )
        .gte(
          "created_at",
          dayAgo,
        )
        .order(
          "updated_at",
          {
            ascending:
              false,
          },
        )
        .limit(
          20,
        ),

      supabase
        .from(
          "email_webhook_events",
        )
        .select(`
          svix_id,
          event_type,
          resend_email_id,
          received_at
        `)
        .order(
          "received_at",
          {
            ascending:
              false,
          },
        )
        .limit(
          20,
        ),

      supabase
        .from(
          "lead_tasks",
        )
        .select(`
          id,
          lead_id,
          title,
          task_type,
          priority,
          due_at,
          status
        `)
        .eq(
          "status",
          "open",
        )
        .lt(
          "due_at",
          now.toISOString(),
        )
        .order(
          "due_at",
          {
            ascending:
              true,
          },
        )
        .limit(
          20,
        ),

      supabase
        .from(
          "carrier_onboarding_links",
        )
        .select(`
          id,
          onboarding_id,
          document_type,
          recipient_email,
          status,
          expires_at,
          last_opened_at,
          created_at
        `)
        .lt(
          "expires_at",
          now.toISOString(),
        )
        .is(
          "completed_at",
          null,
        )
        .is(
          "revoked_at",
          null,
        )
        .order(
          "expires_at",
          {
            ascending:
              true,
          },
        )
        .limit(
          20,
        ),

      supabase
        .from(
          "carrier_onboardings",
        )
        .select(`
          id,
          lead_id,
          company_name,
          dot_number,
          status,
          agreement_status,
          load_board_access_status,
          updated_at
        `)
        .in(
          "status",
          [
            "draft",
            "paperwork_pending",
            "load_board_pending",
            "ready",
            "paused",
          ],
        )
        .lt(
          "updated_at",
          stalledCutoff,
        )
        .order(
          "updated_at",
          {
            ascending:
              true,
          },
        )
        .limit(
          20,
        ),

      supabase
        .from(
          "carrier_onboarding_readiness",
        )
        .select(`
          onboarding_id,
          company_name,
          dot_number,
          ready_for_dispatch,
          missing_requirements,
          active_truck_count,
          available_truck_count
        `)
        .eq(
          "status",
          "active",
        )
        .eq(
          "ready_for_dispatch",
          false,
        )
        .limit(
          20,
        ),
    ]);


  if (
    healthResult.error ||
    !healthResult.data
  ) {
    throw new Error(
      healthResult.error
        ?.message ||
        "Could not load production health.",
    );
  }


  const health =
    healthResult.data as HealthRow;


  const badSends =
    (
      badSendResult.data ??
      []
    ) as BadSendRow[];


  const webhooks =
    (
      webhookResult.data ??
      []
    ) as WebhookRow[];


  const overdueTasks =
    (
      overdueTaskResult.data ??
      []
    ) as TaskRow[];


  const expiredLinks =
    (
      expiredLinkResult.data ??
      []
    ) as ExpiredLinkRow[];


  const stalledOnboardings =
    (
      stalledOnboardingResult.data ??
      []
    ) as OnboardingRow[];


  const blockedCarriers =
    (
      blockedCarrierResult.data ??
      []
    ) as ReadinessRow[];


  const sends =
    numberValue(
      health.sends_last_24h,
    );


  const delivered =
    numberValue(
      health.delivered_last_24h,
    );


  const bounced =
    numberValue(
      health.bounced_last_24h,
    );


  const failed =
    numberValue(
      health.failed_last_24h,
    );


  const attention =
    numberValue(
      health.attention_required,
    );


  const overdue =
    numberValue(
      health.overdue_tasks,
    );


  const webhookCount =
    numberValue(
      health.webhook_events_last_24h,
    );


  const complained =
    badSends.filter(
      (
        send,
      ) =>
        send.status ===
        "complained",
    ).length;


  const criticalSignals =
    failed +
    complained;


  const warningSignals =
    bounced +
    attention +
    overdue +
    expiredLinks.length +
    stalledOnboardings.length +
    blockedCarriers.length;


  const overallSeverity:
    | "healthy"
    | "warning"
    | "critical" =
    criticalSignals >
    0
      ? "critical"
      : warningSignals >
          0
        ? "warning"
        : "healthy";


  const deliveryRate =
    sends >
    0
      ? (
          delivered /
          sends
        ) *
        100
      : 100;


  return (
    <div className="space-y-6">

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="overflow-hidden rounded-[22px] border border-cyan-500/10 bg-[linear-gradient(135deg,rgba(10,20,27,.98),rgba(7,10,15,.98))]">

        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <div className="text-[9px] font-semibold uppercase tracking-[0.17em] text-cyan-400">
              Phase 3G · Production Reliability
            </div>


            <h1 className="mt-2 text-[24px] font-semibold tracking-tight text-white">
              Reliability Command Center
            </h1>


            <p className="mt-2 max-w-3xl text-[9px] leading-5 text-zinc-600">
              One place to identify failures, neglected sales
              work, stale onboarding flows and operational
              readiness problems before they become customer
              issues.
            </p>

          </div>


          <div className="flex flex-wrap items-center gap-2">

            <span
              className={`rounded-full border px-3 py-2 text-[8px] font-bold uppercase tracking-[0.08em] ${severityClasses(
                overallSeverity,
              )}`}
            >
              Overall {overallSeverity}
            </span>


            <Link
              href="/admin/monitoring"
              className="inline-flex h-9 items-center rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 text-[8px] font-semibold text-zinc-400 hover:bg-white/[0.05]"
            >
              Monitoring
            </Link>


            <Link
              href="/admin/monitoring/safety"
              className="inline-flex h-9 items-center rounded-lg border border-red-500/15 bg-red-500/[0.04] px-3 text-[8px] font-semibold text-red-300 hover:bg-red-500/[0.08]"
            >
              Safety Center
            </Link>

          </div>

        </div>


        <div className="grid border-t border-white/[0.05] md:grid-cols-3">

          <div className="border-b border-white/[0.05] p-4 md:border-b-0 md:border-r">

            <div className="text-[7px] uppercase tracking-[0.1em] text-zinc-700">
              Last Send
            </div>

            <div className="mt-1 text-[9px] font-medium text-zinc-300">
              {formatDate(
                health.last_send_at,
              )}
            </div>

            <div className="mt-1 text-[7px] text-zinc-700">
              {relativeAge(
                health.last_send_at,
              )}
            </div>

          </div>


          <div className="border-b border-white/[0.05] p-4 md:border-b-0 md:border-r">

            <div className="text-[7px] uppercase tracking-[0.1em] text-zinc-700">
              Last Webhook
            </div>

            <div className="mt-1 text-[9px] font-medium text-zinc-300">
              {formatDate(
                health.last_webhook_at,
              )}
            </div>

            <div className="mt-1 text-[7px] text-zinc-700">
              {relativeAge(
                health.last_webhook_at,
              )}
            </div>

          </div>


          <div className="p-4">

            <div className="text-[7px] uppercase tracking-[0.1em] text-zinc-700">
              Snapshot
            </div>

            <div className="mt-1 text-[9px] font-medium text-zinc-300">
              {formatDate(
                health.observed_at,
              )}
            </div>

            <div className="mt-1 text-[7px] text-zinc-700">
              Live database health
            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          CORE RELIABILITY
      ===================================================== */}

      <section>

        <div className="mb-3">

          <h2 className="text-[13px] font-semibold text-zinc-200">
            Production Signals
          </h2>

          <p className="mt-1 text-[8px] text-zinc-700">
            Signals that require operational attention.
          </p>

        </div>


        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

          <Metric
            label="Delivery"
            value={`${deliveryRate.toFixed(
              1,
            )}%`}
            detail={`${delivered} of ${sends} sends delivered in 24h.`}
            severity={
              failed >
                0
                ? "critical"
                : bounced >
                    0
                  ? "warning"
                  : "healthy"
            }
          />


          <Metric
            label="Failed / Complaints"
            value={
              failed +
              complained
            }
            detail={`${failed} failed • ${complained} complaint(s)`}
            severity={
              failed +
                complained >
              0
                ? "critical"
                : "healthy"
            }
          />


          <Metric
            label="Reply Attention"
            value={
              attention
            }
            detail="Carrier replies still requiring human action."
            severity={
              attention >
              0
                ? "warning"
                : "healthy"
            }
          />


          <Metric
            label="Overdue Tasks"
            value={
              overdue
            }
            detail="Open sales tasks whose due date has passed."
            severity={
              overdue >
              0
                ? "warning"
                : "healthy"
            }
          />


          <Metric
            label="Webhook Events"
            value={
              webhookCount
            }
            detail="Verified email events received in the last 24h."
            severity="healthy"
          />


          <Metric
            label="Expired Onboarding Links"
            value={
              expiredLinks.length
            }
            detail="Incomplete links that have already expired."
            severity={
              expiredLinks.length >
              0
                ? "warning"
                : "healthy"
            }
          />


          <Metric
            label="Stalled Onboardings"
            value={
              stalledOnboardings.length
            }
            detail="Non-active onboarding records unchanged for 48h+."
            severity={
              stalledOnboardings.length >
              0
                ? "warning"
                : "healthy"
            }
          />


          <Metric
            label="Active Carrier Blocks"
            value={
              blockedCarriers.length
            }
            detail="Activated clients currently failing dispatch readiness."
            severity={
              blockedCarriers.length >
              0
                ? "warning"
                : "healthy"
            }
          />

        </div>

      </section>


      {/* =====================================================
          ACTION QUEUE
      ===================================================== */}

      <section className="grid gap-5 xl:grid-cols-2">

        {/* OVERDUE TASKS */}

        <div className="overflow-hidden rounded-[18px] border border-white/[0.065] bg-white/[0.018]">

          <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">

            <div>

              <div className="text-[11px] font-semibold text-zinc-200">
                Overdue Sales Work
              </div>

              <div className="mt-1 text-[8px] text-zinc-700">
                Work requiring immediate human follow-up.
              </div>

            </div>


            <Link
              href="/admin/tasks"
              className="text-[8px] font-semibold text-blue-400 hover:text-blue-300"
            >
              All Tasks →
            </Link>

          </div>


          {overdueTasks.length >
          0 ? (
            <div className="divide-y divide-white/[0.045]">

              {overdueTasks.map(
                (
                  task,
                ) => (
                  <div
                    key={
                      task.id
                    }
                    className="flex items-start justify-between gap-4 px-5 py-4"
                  >

                    <div className="min-w-0">

                      <div className="truncate text-[9px] font-medium text-zinc-300">
                        {task.title}
                      </div>


                      <div className="mt-1 text-[7px] text-zinc-700">
                        {pretty(
                          task.task_type,
                        )}
                        {" • "}
                        {pretty(
                          task.priority,
                        )}
                        {" • due "}
                        {relativeAge(
                          task.due_at,
                        )}
                      </div>

                    </div>


                    <Link
                      href={`/admin/leads/${task.lead_id}`}
                      className="shrink-0 text-[8px] text-blue-400"
                    >
                      Lead →
                    </Link>

                  </div>
                ),
              )}

            </div>
          ) : (
            <div className="p-5 text-[9px] text-zinc-700">
              No overdue tasks.
            </div>
          )}

        </div>


        {/* BAD SENDS */}

        <div className="overflow-hidden rounded-[18px] border border-white/[0.065] bg-white/[0.018]">

          <div className="border-b border-white/[0.05] px-5 py-4">

            <div className="text-[11px] font-semibold text-zinc-200">
              Delivery Exceptions — 24h
            </div>

            <div className="mt-1 text-[8px] text-zinc-700">
              Failed, bounced or complained email records.
            </div>

          </div>


          {badSends.length >
          0 ? (
            <div className="divide-y divide-white/[0.045]">

              {badSends.map(
                (
                  send,
                ) => (
                  <div
                    key={
                      send.id
                    }
                    className="px-5 py-4"
                  >

                    <div className="flex items-start justify-between gap-3">

                      <div className="min-w-0">

                        <div className="truncate text-[9px] font-medium text-zinc-300">
                          {send.to_email ||
                            "Unknown recipient"}
                        </div>

                        <div className="mt-1 truncate text-[8px] text-zinc-700">
                          {send.subject ||
                            "No subject"}
                        </div>

                      </div>


                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-[7px] font-semibold uppercase ${badgeClasses(
                          send.status,
                        )}`}
                      >
                        {send.status}
                      </span>

                    </div>


                    {send.error_message ? (
                      <div className="mt-2 rounded-lg border border-red-500/10 bg-red-500/[0.025] px-3 py-2 text-[7px] leading-4 text-red-300/70">
                        {send.error_message}
                      </div>
                    ) : null}


                    <div className="mt-2 flex items-center justify-between text-[7px] text-zinc-700">

                      <span>
                        {formatDate(
                          send.updated_at,
                        )}
                      </span>


                      {send.lead_id ? (
                        <Link
                          href={`/admin/leads/${send.lead_id}`}
                          className="text-blue-400"
                        >
                          Lead 360 →
                        </Link>
                      ) : null}

                    </div>

                  </div>
                ),
              )}

            </div>
          ) : (
            <div className="p-5">

              <div className="text-[9px] font-medium text-emerald-300">
                No delivery exceptions in the last 24 hours.
              </div>

              <div className="mt-1 text-[8px] text-zinc-700">
                Current email delivery is clean.
              </div>

            </div>
          )}

        </div>

      </section>


      {/* =====================================================
          ONBOARDING RELIABILITY
      ===================================================== */}

      <section className="grid gap-5 xl:grid-cols-2">

        {/* EXPIRED LINKS */}

        <div className="overflow-hidden rounded-[18px] border border-white/[0.065] bg-white/[0.018]">

          <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">

            <div>

              <div className="text-[11px] font-semibold text-zinc-200">
                Expired Onboarding Links
              </div>

              <div className="mt-1 text-[8px] text-zinc-700">
                Incomplete secure links that can no longer be used.
              </div>

            </div>


            <Link
              href="/admin/onboarding"
              className="text-[8px] font-semibold text-violet-400"
            >
              Onboarding →
            </Link>

          </div>


          {expiredLinks.length >
          0 ? (
            <div className="divide-y divide-white/[0.045]">

              {expiredLinks.map(
                (
                  link,
                ) => (
                  <div
                    key={
                      link.id
                    }
                    className="px-5 py-4"
                  >

                    <div className="flex items-start justify-between gap-3">

                      <div>

                        <div className="text-[9px] font-medium text-zinc-300">
                          {pretty(
                            link.document_type,
                          )}
                        </div>

                        <div className="mt-1 text-[8px] text-zinc-700">
                          {link.recipient_email ||
                            "No recipient"}
                        </div>

                      </div>


                      <span className="rounded-full border border-amber-500/15 bg-amber-500/[0.04] px-2 py-1 text-[7px] font-semibold text-amber-300">
                        EXPIRED
                      </span>

                    </div>


                    <div className="mt-2 flex flex-wrap gap-3 text-[7px] text-zinc-700">

                      <span>
                        Expired{" "}
                        {formatDate(
                          link.expires_at,
                        )}
                      </span>

                      <span>
                        Last opened{" "}
                        {link.last_opened_at
                          ? relativeAge(
                              link.last_opened_at,
                            )
                          : "never"}
                      </span>

                    </div>


                    <Link
                      href={`/admin/onboarding/${link.onboarding_id}/documents`}
                      className="mt-3 inline-flex text-[8px] font-semibold text-violet-400"
                    >
                      Open Document Vault →
                    </Link>

                  </div>
                ),
              )}

            </div>
          ) : (
            <div className="p-5 text-[9px] text-emerald-300">
              No expired incomplete onboarding links.
            </div>
          )}

        </div>


        {/* STALLED ONBOARDING */}

        <div className="overflow-hidden rounded-[18px] border border-white/[0.065] bg-white/[0.018]">

          <div className="border-b border-white/[0.05] px-5 py-4">

            <div className="text-[11px] font-semibold text-zinc-200">
              Stalled Onboarding
            </div>

            <div className="mt-1 text-[8px] text-zinc-700">
              Incomplete onboarding records without updates for 48+ hours.
            </div>

          </div>


          {stalledOnboardings.length >
          0 ? (
            <div className="divide-y divide-white/[0.045]">

              {stalledOnboardings.map(
                (
                  onboarding,
                ) => (
                  <div
                    key={
                      onboarding.id
                    }
                    className="px-5 py-4"
                  >

                    <div className="flex items-start justify-between gap-3">

                      <div>

                        <div className="text-[9px] font-medium text-zinc-300">
                          {onboarding.company_name}
                        </div>

                        <div className="mt-1 text-[7px] text-zinc-700">
                          {onboarding.dot_number
                            ? `DOT ${onboarding.dot_number} • `
                            : ""}

                          {pretty(
                            onboarding.status,
                          )}
                        </div>

                      </div>


                      <span className="text-[7px] text-amber-300">
                        {relativeAge(
                          onboarding.updated_at,
                        )}
                      </span>

                    </div>


                    <div className="mt-3 grid grid-cols-2 gap-2">

                      <div className="rounded-lg border border-white/[0.05] bg-black/15 p-2">

                        <div className="text-[6px] uppercase text-zinc-700">
                          Agreement
                        </div>

                        <div className="mt-1 text-[8px] text-zinc-400">
                          {pretty(
                            onboarding.agreement_status,
                          )}
                        </div>

                      </div>


                      <div className="rounded-lg border border-white/[0.05] bg-black/15 p-2">

                        <div className="text-[6px] uppercase text-zinc-700">
                          Load Board
                        </div>

                        <div className="mt-1 text-[8px] text-zinc-400">
                          {pretty(
                            onboarding.load_board_access_status,
                          )}
                        </div>

                      </div>

                    </div>


                    <div className="mt-3 flex gap-3">

                      <Link
                        href={`/admin/onboarding/${onboarding.id}/documents`}
                        className="text-[8px] font-semibold text-violet-400"
                      >
                        Vault →
                      </Link>


                      {onboarding.lead_id ? (
                        <Link
                          href={`/admin/leads/${onboarding.lead_id}`}
                          className="text-[8px] font-semibold text-blue-400"
                        >
                          Lead 360 →
                        </Link>
                      ) : null}

                    </div>

                  </div>
                ),
              )}

            </div>
          ) : (
            <div className="p-5 text-[9px] text-emerald-300">
              No stalled onboarding records.
            </div>
          )}

        </div>

      </section>


      {/* =====================================================
          ACTIVE CARRIER READINESS
      ===================================================== */}

      <section className="overflow-hidden rounded-[18px] border border-white/[0.065] bg-white/[0.018]">

        <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">

          <div>

            <div className="text-[11px] font-semibold text-zinc-200">
              Active Carrier Readiness Exceptions
            </div>

            <div className="mt-1 text-[8px] text-zinc-700">
              Clients that are activated but currently cannot enter load-search operations.
            </div>

          </div>


          <Link
            href="/admin/operations"
            className="text-[8px] font-semibold text-emerald-400"
          >
            Carrier Operations →
          </Link>

        </div>


        {blockedCarriers.length >
        0 ? (
          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">

            {blockedCarriers.map(
              (
                carrier,
              ) => (
                <div
                  key={
                    carrier.onboarding_id
                  }
                  className="rounded-xl border border-amber-500/10 bg-amber-500/[0.025] p-4"
                >

                  <div className="text-[9px] font-medium text-zinc-300">
                    {carrier.company_name}
                  </div>


                  <div className="mt-1 text-[7px] text-zinc-700">
                    {carrier.dot_number
                      ? `DOT ${carrier.dot_number}`
                      : "No DOT"}
                    {" • "}
                    {carrier.active_truck_count ??
                      0} active truck(s)
                  </div>


                  <div className="mt-3 flex flex-wrap gap-1.5">

                    {(carrier.missing_requirements ??
                      []).map(
                      (
                        requirement,
                      ) => (
                        <span
                          key={
                            requirement
                          }
                          className="rounded-full border border-amber-500/15 px-2 py-1 text-[7px] text-amber-300"
                        >
                          {requirementLabel(
                            requirement,
                          )}
                        </span>
                      ),
                    )}

                  </div>


                  <Link
                    href={`/admin/onboarding/${carrier.onboarding_id}/documents`}
                    className="mt-3 inline-flex text-[8px] font-semibold text-violet-400"
                  >
                    Review Carrier →
                  </Link>

                </div>
              ),
            )}

          </div>
        ) : (
          <div className="p-5">

            <div className="text-[9px] font-medium text-emerald-300">
              No active carrier readiness exceptions.
            </div>

            <div className="mt-1 text-[8px] text-zinc-700">
              No activated client is currently blocked by the readiness model.
            </div>

          </div>
        )}

      </section>


      {/* =====================================================
          WEBHOOK AUDIT
      ===================================================== */}

      <section className="overflow-hidden rounded-[18px] border border-white/[0.065] bg-white/[0.018]">

        <div className="border-b border-white/[0.05] px-5 py-4">

          <div className="text-[11px] font-semibold text-zinc-200">
            Recent Email Webhook Activity
          </div>

          <div className="mt-1 text-[8px] text-zinc-700">
            Latest verified Resend lifecycle events stored by SlateLane.
          </div>

        </div>


        {webhooks.length >
        0 ? (
          <div className="overflow-x-auto p-5">

            <table className="w-full min-w-[760px] text-left">

              <thead>

                <tr className="border-b border-white/[0.05] text-[7px] uppercase tracking-[0.08em] text-zinc-700">

                  <th className="pb-3 pr-4">
                    Event
                  </th>

                  <th className="pb-3 pr-4">
                    Resend ID
                  </th>

                  <th className="pb-3 pr-4">
                    Svix ID
                  </th>

                  <th className="pb-3 text-right">
                    Received
                  </th>

                </tr>

              </thead>


              <tbody>

                {webhooks.map(
                  (
                    event,
                  ) => (
                    <tr
                      key={
                        event.svix_id
                      }
                      className="border-b border-white/[0.04] last:border-b-0"
                    >

                      <td className="py-3 pr-4">

                        <span
                          className={`rounded-full border px-2 py-1 text-[7px] font-semibold ${badgeClasses(
                            event.event_type,
                          )}`}
                        >
                          {event.event_type}
                        </span>

                      </td>


                      <td className="max-w-[240px] truncate py-3 pr-4 font-mono text-[7px] text-zinc-600">
                        {event.resend_email_id ||
                          "—"}
                      </td>


                      <td className="max-w-[240px] truncate py-3 pr-4 font-mono text-[7px] text-zinc-700">
                        {event.svix_id}
                      </td>


                      <td className="py-3 text-right text-[7px] text-zinc-700">
                        {relativeAge(
                          event.received_at,
                        )}
                      </td>

                    </tr>
                  ),
                )}

              </tbody>

            </table>

          </div>
        ) : (
          <div className="p-5 text-[9px] text-zinc-700">
            No webhook events recorded.
          </div>
        )}

      </section>


      {/* =====================================================
          FOOTER
      ===================================================== */}

      <section className="rounded-[18px] border border-cyan-500/10 bg-cyan-500/[0.025] p-5">

        <div className="text-[9px] font-semibold text-cyan-300">
          Reliability model
        </div>


        <p className="mt-2 max-w-4xl text-[8px] leading-5 text-zinc-600">
          A healthy email pipeline does not automatically mean
          the CRM is healthy. SlateLane now also checks human
          reply handling, overdue sales work, onboarding link
          expiration, onboarding stagnation and active-carrier
          readiness.
        </p>

      </section>

    </div>
  );
}