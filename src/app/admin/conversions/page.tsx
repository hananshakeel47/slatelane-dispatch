import Link from "next/link";

import {
  createServerSupabase,
} from "@/lib/supabase/server";


export const dynamic =
  "force-dynamic";


const BUSINESS_TIMEZONE =
  "America/Chicago";


type LeadRow = {
  id: string;

  name:
    string |
    null;

  company_name:
    string |
    null;

  email:
    string |
    null;

  phone:
    string |
    null;

  carrier_dot_number:
    number |
    null;

  mc_number:
    string |
    null;

  source:
    string |
    null;

  status:
    string |
    null;

  has_replied:
    boolean |
    null;

  reply_count:
    number |
    null;

  last_reply_at:
    string |
    null;

  last_reply_subject:
    string |
    null;

  last_reply_classification:
    string |
    null;

  reply_requires_attention:
    boolean |
    null;

  last_email_sent_at:
    string |
    null;

  created_at:
    string |
    null;

  updated_at:
    string |
    null;
};


type TaskRow = {
  id: string;

  lead_id:
    string;

  task_type:
    string;

  title:
    string;

  note:
    string |
    null;

  status:
    string;

  priority:
    string;

  due_at:
    string;

  created_at:
    string;
};


type OnboardingRow = {
  id: string;

  lead_id:
    string |
    null;

  carrier_id:
    number |
    null;

  company_name:
    string;

  dot_number:
    number |
    null;

  mc_number:
    string |
    null;

  status:
    string;

  agreement_status:
    string;

  agreement_signed_at:
    string |
    null;

  onboarding_completed_at:
    string |
    null;

  activated_at:
    string |
    null;

  created_at:
    string;
};


type VaultRow = {
  onboarding_id:
    string;

  document_count:
    number |
    null;

  agreement_ready:
    boolean |
    null;

  carrier_packet_ready:
    boolean |
    null;

  tax_form_ready:
    boolean |
    null;

  insurance_ready:
    boolean |
    null;

  authority_ready:
    boolean |
    null;

  factoring_ready:
    boolean |
    null;

  missing_documents:
    string[] |
    null;

  broker_packet_ready:
    boolean |
    null;
};


function prettyStatus(
  value:
    string |
    null |
    undefined,
) {
  if (!value) {
    return "Unknown";
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


function formatDate(
  value:
    string |
    null |
    undefined,
) {
  if (!value) {
    return "—";
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
    return "—";
  }


  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        BUSINESS_TIMEZONE,

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


function number(
  value:
    number |
    null |
    undefined,
) {
  return (
    value ??
    0
  ).toLocaleString();
}


function percentage(
  numerator:
    number,

  denominator:
    number,
) {
  if (
    denominator <=
    0
  ) {
    return 0;
  }


  return Math.min(
    100,
    Math.max(
      0,
      (
        numerator /
        denominator
      ) *
        100,
    ),
  );
}


function percentageLabel(
  numerator:
    number,

  denominator:
    number,
) {
  return `${percentage(
    numerator,
    denominator,
  ).toFixed(
    1,
  )}%`;
}


function stageClasses(
  key:
    string,
) {
  switch (key) {
    case "emailed":
      return "border-blue-500/20 bg-blue-500/[0.05] text-blue-300";

    case "replied":
      return "border-sky-500/20 bg-sky-500/[0.05] text-sky-300";

    case "positive":
      return "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300";

    case "engaged":
      return "border-amber-500/20 bg-amber-500/[0.05] text-amber-300";

    case "meeting":
      return "border-violet-500/20 bg-violet-500/[0.05] text-violet-300";

    case "client":
      return "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200";

    default:
      return "border-white/[0.07] bg-white/[0.025] text-zinc-400";
  }
}


function statusClasses(
  value:
    string |
    null,
) {
  switch (value) {
    case "client":
      return "border-violet-500/20 bg-violet-500/[0.07] text-violet-300";

    case "meeting":
      return "border-blue-500/20 bg-blue-500/[0.07] text-blue-300";

    case "follow_up":
      return "border-amber-500/20 bg-amber-500/[0.07] text-amber-300";

    case "interested":
      return "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300";

    case "not_interested":
      return "border-red-500/20 bg-red-500/[0.07] text-red-300";

    default:
      return "border-white/[0.07] bg-white/[0.025] text-zinc-500";
  }
}


function priorityClasses(
  value:
    string |
    null,
) {
  switch (value) {
    case "urgent":
      return "border-red-500/20 bg-red-500/[0.07] text-red-300";

    case "high":
      return "border-amber-500/20 bg-amber-500/[0.07] text-amber-300";

    case "low":
      return "border-white/[0.07] bg-white/[0.02] text-zinc-500";

    default:
      return "border-blue-500/20 bg-blue-500/[0.06] text-blue-300";
  }
}


function MetricCard({
  label,
  value,
  detail,
  href,
}: {
  label:
    string;

  value:
    string;

  detail:
    string;

  href?:
    string;
}) {
  const body =
    (
      <>
        <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
          {label}
        </div>

        <div className="mt-3 text-[25px] font-semibold tracking-[-0.04em] text-white">
          {value}
        </div>

        <div className="mt-1 text-[9px] leading-4 text-zinc-600">
          {detail}
        </div>
      </>
    );


  if (
    href
  ) {
    return (
      <Link
        href={
          href
        }
        className="rounded-[17px] border border-white/[0.07] bg-white/[0.022] p-4 transition hover:border-white/[0.12] hover:bg-white/[0.035]"
      >
        {body}
      </Link>
    );
  }


  return (
    <div className="rounded-[17px] border border-white/[0.07] bg-white/[0.022] p-4">
      {body}
    </div>
  );
}


function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title:
    string;

  subtitle?:
    string;

  action?:
    React.ReactNode;

  children:
    React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.018]">

      <div className="flex items-start justify-between gap-4 border-b border-white/[0.055] px-5 py-4">

        <div>

          <h2 className="text-[13px] font-semibold text-zinc-200">
            {title}
          </h2>

          {subtitle ? (
            <p className="mt-1 text-[9px] leading-4 text-zinc-600">
              {subtitle}
            </p>
          ) : null}

        </div>

        {action}

      </div>


      <div className="p-5">
        {children}
      </div>

    </section>
  );
}


function FunnelBar({
  value,
}: {
  value:
    number;
}) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">

      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-400"
        style={{
          width:
            `${Math.max(
              value >
              0
                ? 3
                : 0,

              Math.min(
                100,
                value,
              ),
            )}%`,
        }}
      />

    </div>
  );
}


export default async function ConversionDashboardPage() {
  const supabase =
    createServerSupabase();


  const now =
    new Date();


  const nowIso =
    now.toISOString();


  const staleCutoff =
    new Date(
      now.getTime() -
        48 *
          60 *
          60 *
          1000,
    ).toISOString();


  const [
    totalResult,
    emailedResult,
    repliedResult,
    positiveResult,

    interestedResult,
    followUpResult,
    meetingResult,
    clientResult,

    notInterestedResult,

    attentionResult,

    openTasksResult,
    overdueTasksResult,

    onboardingResult,
    activeOnboardingResult,
    brokerPacketResult,

    hotLeadsResult,
    stalledLeadsResult,
    tasksResult,
    recentOnboardingResult,
  ] =
    await Promise.all([

      /* TOTAL LEADS */

      supabase
        .from(
          "leads",
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        ),

      /* EMAILED LEADS */

      supabase
        .from(
          "leads",
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
        .not(
          "last_email_sent_at",
          "is",
          null,
        ),

      /* REPLIED LEADS */

      supabase
        .from(
          "leads",
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
        .eq(
          "has_replied",
          true,
        ),

      /* POSITIVE REPLY LEADS */

      supabase
        .from(
          "leads",
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
        .in(
          "last_reply_classification",
          [
            "interested",
            "need_rates",
            "call_me",
          ],
        ),

      /* INTERESTED */

      supabase
        .from(
          "leads",
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
        .eq(
          "status",
          "interested",
        ),

      /* FOLLOW UP */

      supabase
        .from(
          "leads",
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
        .eq(
          "status",
          "follow_up",
        ),

      /* MEETING */

      supabase
        .from(
          "leads",
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
        .eq(
          "status",
          "meeting",
        ),

      /* CLIENT */

      supabase
        .from(
          "leads",
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
        .eq(
          "status",
          "client",
        ),

      /* NOT INTERESTED */

      supabase
        .from(
          "leads",
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
        .eq(
          "status",
          "not_interested",
        ),

      /* REPLIES NEEDING ATTENTION */

      supabase
        .from(
          "leads",
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
        .eq(
          "reply_requires_attention",
          true,
        ),

      /* OPEN TASKS */

      supabase
        .from(
          "lead_tasks",
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
        .eq(
          "status",
          "open",
        ),

      /* OVERDUE TASKS */

      supabase
        .from(
          "lead_tasks",
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
        .eq(
          "status",
          "open",
        )
        .lt(
          "due_at",
          nowIso,
        ),

      /* TOTAL ONBOARDINGS */

      supabase
        .from(
          "carrier_onboardings",
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        ),

      /* ACTIVE ONBOARDING PIPELINE */

      supabase
        .from(
          "carrier_onboardings",
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
        .in(
          "status",
          [
            "draft",
            "paperwork_pending",
            "load_board_pending",
            "ready",
            "active",
          ],
        ),

      /* BROKER PACKET READY */

      supabase
        .from(
          "carrier_document_vault_status",
        )
        .select(
          "onboarding_id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .eq(
          "broker_packet_ready",
          true,
        ),

      /* HOT CONVERSION LEADS */

      supabase
        .from(
          "leads",
        )
        .select(`
          id,
          name,
          company_name,
          email,
          phone,
          carrier_dot_number,
          mc_number,
          source,
          status,
          has_replied,
          reply_count,
          last_reply_at,
          last_reply_subject,
          last_reply_classification,
          reply_requires_attention,
          last_email_sent_at,
          created_at,
          updated_at
        `)
        .in(
          "status",
          [
            "interested",
            "follow_up",
            "meeting",
            "client",
          ],
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

      /* STALLED CONVERSION LEADS */

      supabase
        .from(
          "leads",
        )
        .select(`
          id,
          name,
          company_name,
          email,
          phone,
          carrier_dot_number,
          mc_number,
          source,
          status,
          has_replied,
          reply_count,
          last_reply_at,
          last_reply_subject,
          last_reply_classification,
          reply_requires_attention,
          last_email_sent_at,
          created_at,
          updated_at
        `)
        .in(
          "status",
          [
            "interested",
            "follow_up",
            "meeting",
          ],
        )
        .lt(
          "updated_at",
          staleCutoff,
        )
        .order(
          "updated_at",
          {
            ascending:
              true,
          },
        )
        .limit(
          12,
        ),

      /* PRIORITY TASKS */

      supabase
        .from(
          "lead_tasks",
        )
        .select(`
          id,
          lead_id,
          task_type,
          title,
          note,
          status,
          priority,
          due_at,
          created_at
        `)
        .eq(
          "status",
          "open",
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

      /* RECENT ONBOARDINGS */

      supabase
        .from(
          "carrier_onboardings",
        )
        .select(`
          id,
          lead_id,
          carrier_id,
          company_name,
          dot_number,
          mc_number,
          status,
          agreement_status,
          agreement_signed_at,
          onboarding_completed_at,
          activated_at,
          created_at
        `)
        .order(
          "created_at",
          {
            ascending:
              false,
          },
        )
        .limit(
          12,
        ),
    ]);


  const totalLeads =
    totalResult.count ??
    0;


  const emailedLeads =
    emailedResult.count ??
    0;


  const repliedLeads =
    repliedResult.count ??
    0;


  const positiveLeads =
    positiveResult.count ??
    0;


  const interestedLeads =
    interestedResult.count ??
    0;


  const followUpLeads =
    followUpResult.count ??
    0;


  const meetingLeads =
    meetingResult.count ??
    0;


  const clients =
    clientResult.count ??
    0;


  const notInterested =
    notInterestedResult.count ??
    0;


  const needsAttention =
    attentionResult.count ??
    0;


  const openTasks =
    openTasksResult.count ??
    0;


  const overdueTasks =
    overdueTasksResult.count ??
    0;


  const onboardingCount =
    onboardingResult.count ??
    0;


  const activeOnboarding =
    activeOnboardingResult.count ??
    0;


  const brokerPacketsReady =
    brokerPacketResult.count ??
    0;


  /*
   * Engaged is cumulative:
   * Interested + Follow Up + Meeting + Client.
   */
  const engagedLeads =
    interestedLeads +
    followUpLeads +
    meetingLeads +
    clients;


  const followUpOrBetter =
    followUpLeads +
    meetingLeads +
    clients;


  const meetingOrBetter =
    meetingLeads +
    clients;


  const hotLeads =
    (
      hotLeadsResult.data ??
      []
    ) as LeadRow[];


  const stalledLeads =
    (
      stalledLeadsResult.data ??
      []
    ) as LeadRow[];


  const tasks =
    (
      tasksResult.data ??
      []
    ) as TaskRow[];


  const onboardings =
    (
      recentOnboardingResult.data ??
      []
    ) as OnboardingRow[];


  /*
   * Build task → lead lookup without a database join.
   */
  const taskLeadIds =
    [
      ...new Set(
        tasks.map(
          (
            task,
          ) =>
            task.lead_id,
        ),
      ),
    ];


  const taskLeadMap =
    new Map<
      string,
      {
        id:
          string;

        name:
          string |
          null;

        company_name:
          string |
          null;

        carrier_dot_number:
          number |
          null;

        status:
          string |
          null;
      }
    >();


  if (
    taskLeadIds.length >
    0
  ) {
    const {
      data:
        taskLeads,

      error:
        taskLeadError,
    } =
      await supabase
        .from(
          "leads",
        )
        .select(`
          id,
          name,
          company_name,
          carrier_dot_number,
          status
        `)
        .in(
          "id",
          taskLeadIds,
        );


    if (
      taskLeadError
    ) {
      console.error(
        "CONVERSION TASK LEAD ERROR:",
        taskLeadError.message,
      );
    }


    for (
      const lead
      of taskLeads ??
      []
    ) {
      taskLeadMap.set(
        lead.id,
        lead,
      );
    }
  }


  /*
   * Load Document Vault readiness only
   * for onboarding rows displayed here.
   */
  const onboardingIds =
    onboardings.map(
      (
        onboarding,
      ) =>
        onboarding.id,
    );


  const vaultMap =
    new Map<
      string,
      VaultRow
    >();


  if (
    onboardingIds.length >
    0
  ) {
    const {
      data:
        vaultRows,

      error:
        vaultError,
    } =
      await supabase
        .from(
          "carrier_document_vault_status",
        )
        .select(`
          onboarding_id,
          document_count,
          agreement_ready,
          carrier_packet_ready,
          tax_form_ready,
          insurance_ready,
          authority_ready,
          factoring_ready,
          missing_documents,
          broker_packet_ready
        `)
        .in(
          "onboarding_id",
          onboardingIds,
        );


    if (
      vaultError
    ) {
      console.error(
        "CONVERSION VAULT ERROR:",
        vaultError.message,
      );
    }


    for (
      const row
      of (
        vaultRows ??
        []
      ) as VaultRow[]
    ) {
      vaultMap.set(
        row.onboarding_id,
        row,
      );
    }
  }


  const funnel =
    [
      {
        key:
          "emailed",

        label:
          "Emailed",

        count:
          emailedLeads,

        rate:
          100,

        detail:
          "Leads reached by outbound email",
      },

      {
        key:
          "replied",

        label:
          "Replied",

        count:
          repliedLeads,

        rate:
          percentage(
            repliedLeads,
            emailedLeads,
          ),

        detail:
          `${percentageLabel(
            repliedLeads,
            emailedLeads,
          )} of emailed leads`,
      },

      {
        key:
          "positive",

        label:
          "Positive Reply",

        count:
          positiveLeads,

        rate:
          percentage(
            positiveLeads,
            emailedLeads,
          ),

        detail:
          "Interested, Need Rates or Call Me",
      },

      {
        key:
          "engaged",

        label:
          "Sales Pipeline",

        count:
          engagedLeads,

        rate:
          percentage(
            engagedLeads,
            emailedLeads,
          ),

        detail:
          "Interested through Client",
      },

      {
        key:
          "meeting",

        label:
          "Meeting+",

        count:
          meetingOrBetter,

        rate:
          percentage(
            meetingOrBetter,
            emailedLeads,
          ),

        detail:
          "Meeting or Client",
      },

      {
        key:
          "client",

        label:
          "Clients",

        count:
          clients,

        rate:
          percentage(
            clients,
            emailedLeads,
          ),

        detail:
          `${percentageLabel(
            clients,
            repliedLeads,
          )} reply-to-client`,
      },
    ];


  return (
    <div className="space-y-6">

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[linear-gradient(135deg,rgba(17,23,31,.96),rgba(8,12,18,.97))] px-6 py-6">

        <div className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-emerald-500/[0.055] blur-3xl" />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">

          <div>

            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
              Phase 3D · Revenue Conversion
            </div>

            <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.045em] text-white md:text-[38px]">
              Conversion Dashboard
            </h1>

            <p className="mt-2 max-w-2xl text-[11px] leading-5 text-zinc-500">
              Track carriers from first outreach through reply,
              sales qualification, meeting, client conversion and
              onboarding.
            </p>

          </div>


          <div className="flex flex-wrap gap-2">

            <Link
              href="/admin/dashboard"
              className="inline-flex h-9 items-center rounded-lg border border-white/[0.08] bg-white/[0.025] px-4 text-[9px] font-semibold text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
            >
              Main Dashboard
            </Link>

            <Link
              href="/admin/replies?view=attention"
              className="inline-flex h-9 items-center rounded-lg border border-amber-500/15 bg-amber-500/[0.05] px-4 text-[9px] font-semibold text-amber-300 hover:bg-amber-500/[0.1]"
            >
              Replies Needing Attention
            </Link>

            <Link
              href="/admin/leads"
              className="inline-flex h-9 items-center rounded-lg border border-blue-500/15 bg-blue-500/[0.05] px-4 text-[9px] font-semibold text-blue-300 hover:bg-blue-500/[0.1]"
            >
              Lead Workspace
            </Link>

          </div>

        </div>

      </section>


      {/* =====================================================
          TOP KPIs
      ===================================================== */}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">

        <MetricCard
          label="Total Leads"
          value={
            number(
              totalLeads,
            )
          }
          detail="All CRM lead records"
          href="/admin/leads"
        />

        <MetricCard
          label="Reply Rate"
          value={
            percentageLabel(
              repliedLeads,
              emailedLeads,
            )
          }
          detail={`${number(
            repliedLeads,
          )} replied / ${number(
            emailedLeads,
          )} emailed`}
          href="/admin/replies"
        />

        <MetricCard
          label="Engaged"
          value={
            number(
              engagedLeads,
            )
          }
          detail="Interested → Client"
          href="/admin/leads"
        />

        <MetricCard
          label="Clients"
          value={
            number(
              clients,
            )
          }
          detail={`${percentageLabel(
            clients,
            repliedLeads,
          )} of replied leads`}
          href="/admin/leads"
        />

        <MetricCard
          label="Open Tasks"
          value={
            number(
              openTasks,
            )
          }
          detail={`${number(
            overdueTasks,
          )} overdue`}
          href="/admin/tasks"
        />

        <MetricCard
          label="Onboarding"
          value={
            number(
              activeOnboarding,
            )
          }
          detail={`${number(
            brokerPacketsReady,
          )} broker packet ready`}
          href="/admin/onboarding"
        />

      </div>


      {/* =====================================================
          FUNNEL
      ===================================================== */}

      <Panel
        title="Revenue Conversion Funnel"
        subtitle="Lead-level funnel generated directly from current CRM records."
      >

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">

          {funnel.map(
            (
              stage,
              index,
            ) => (
              <div
                key={
                  stage.key
                }
                className={`rounded-[16px] border p-4 ${stageClasses(
                  stage.key,
                )}`}
              >

                <div className="flex items-center justify-between gap-3">

                  <div className="text-[8px] font-semibold uppercase tracking-[0.11em] opacity-80">
                    {stage.label}
                  </div>

                  <div className="text-[8px] opacity-50">
                    {index + 1}
                  </div>

                </div>


                <div className="mt-3 text-[24px] font-semibold tracking-[-0.04em] text-white">
                  {number(
                    stage.count,
                  )}
                </div>


                <div className="mt-2">
                  <FunnelBar
                    value={
                      stage.rate
                    }
                  />
                </div>


                <div className="mt-2 text-[8px] leading-4 opacity-65">
                  {stage.detail}
                </div>

              </div>
            ),
          )}

        </div>


        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-xl border border-white/[0.055] bg-black/15 p-4">

            <div className="text-[8px] uppercase tracking-[0.1em] text-zinc-700">
              Reply → Positive
            </div>

            <div className="mt-2 text-[17px] font-semibold text-emerald-300">
              {percentageLabel(
                positiveLeads,
                repliedLeads,
              )}
            </div>

            <div className="mt-1 text-[8px] text-zinc-700">
              Positive reply share
            </div>

          </div>


          <div className="rounded-xl border border-white/[0.055] bg-black/15 p-4">

            <div className="text-[8px] uppercase tracking-[0.1em] text-zinc-700">
              Engaged → Follow Up+
            </div>

            <div className="mt-2 text-[17px] font-semibold text-amber-300">
              {percentageLabel(
                followUpOrBetter,
                engagedLeads,
              )}
            </div>

            <div className="mt-1 text-[8px] text-zinc-700">
              Progressed beyond Interested
            </div>

          </div>


          <div className="rounded-xl border border-white/[0.055] bg-black/15 p-4">

            <div className="text-[8px] uppercase tracking-[0.1em] text-zinc-700">
              Engaged → Meeting+
            </div>

            <div className="mt-2 text-[17px] font-semibold text-blue-300">
              {percentageLabel(
                meetingOrBetter,
                engagedLeads,
              )}
            </div>

            <div className="mt-1 text-[8px] text-zinc-700">
              Meeting-stage conversion
            </div>

          </div>


          <div className="rounded-xl border border-white/[0.055] bg-black/15 p-4">

            <div className="text-[8px] uppercase tracking-[0.1em] text-zinc-700">
              Reply → Client
            </div>

            <div className="mt-2 text-[17px] font-semibold text-violet-300">
              {percentageLabel(
                clients,
                repliedLeads,
              )}
            </div>

            <div className="mt-1 text-[8px] text-zinc-700">
              Current sales conversion
            </div>

          </div>

        </div>

      </Panel>


      {/* =====================================================
          PIPELINE STATE
      ===================================================== */}

      <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">

        <Panel
          title="Active Conversion Pipeline"
          subtitle="Current sales-stage distribution."
          action={
            <Link
              href="/admin/leads"
              className="text-[9px] font-medium text-blue-400 hover:text-blue-300"
            >
              All Leads →
            </Link>
          }
        >

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4">

              <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-emerald-500">
                Interested
              </div>

              <div className="mt-2 text-[23px] font-semibold text-white">
                {number(
                  interestedLeads,
                )}
              </div>

            </div>


            <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4">

              <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-amber-500">
                Follow Up
              </div>

              <div className="mt-2 text-[23px] font-semibold text-white">
                {number(
                  followUpLeads,
                )}
              </div>

            </div>


            <div className="rounded-xl border border-blue-500/15 bg-blue-500/[0.04] p-4">

              <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-blue-500">
                Meeting
              </div>

              <div className="mt-2 text-[23px] font-semibold text-white">
                {number(
                  meetingLeads,
                )}
              </div>

            </div>


            <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.04] p-4">

              <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-violet-500">
                Client
              </div>

              <div className="mt-2 text-[23px] font-semibold text-white">
                {number(
                  clients,
                )}
              </div>

            </div>

          </div>


          <div className="mt-4 rounded-xl border border-white/[0.055] bg-black/15 px-4 py-3">

            <div className="flex flex-wrap items-center justify-between gap-3 text-[9px]">

              <span className="text-zinc-600">
                Closed / Not Interested
              </span>

              <span className="font-semibold text-red-300">
                {number(
                  notInterested,
                )}
              </span>

            </div>

          </div>

        </Panel>


        <Panel
          title="Action Pressure"
          subtitle="Items that can delay a carrier conversion."
        >

          <div className="space-y-3">

            <Link
              href="/admin/replies?view=attention"
              className="flex items-center justify-between rounded-xl border border-amber-500/15 bg-amber-500/[0.035] p-4 hover:bg-amber-500/[0.065]"
            >

              <div>

                <div className="text-[9px] font-semibold text-amber-300">
                  Replies needing attention
                </div>

                <div className="mt-1 text-[8px] text-zinc-600">
                  Carrier responses waiting for an operator
                </div>

              </div>

              <div className="text-[22px] font-semibold text-white">
                {number(
                  needsAttention,
                )}
              </div>

            </Link>


            <Link
              href="/admin/tasks"
              className="flex items-center justify-between rounded-xl border border-red-500/15 bg-red-500/[0.03] p-4 hover:bg-red-500/[0.06]"
            >

              <div>

                <div className="text-[9px] font-semibold text-red-300">
                  Overdue tasks
                </div>

                <div className="mt-1 text-[8px] text-zinc-600">
                  Follow-ups already past due
                </div>

              </div>

              <div className="text-[22px] font-semibold text-white">
                {number(
                  overdueTasks,
                )}
              </div>

            </Link>


            <div className="flex items-center justify-between rounded-xl border border-white/[0.055] bg-black/15 p-4">

              <div>

                <div className="text-[9px] font-semibold text-zinc-300">
                  Stalled 48h+
                </div>

                <div className="mt-1 text-[8px] text-zinc-600">
                  Engaged leads without recent CRM movement
                </div>

              </div>

              <div className="text-[22px] font-semibold text-white">
                {number(
                  stalledLeads.length,
                )}
              </div>

            </div>

          </div>

        </Panel>

      </div>


      {/* =====================================================
          HOT LEADS
      ===================================================== */}

      <Panel
        title="Hot Conversion Opportunities"
        subtitle="Interested, Follow Up, Meeting and Client leads sorted by latest CRM activity."
      >

        {hotLeads.length >
        0 ? (
          <div className="overflow-x-auto">

            <table className="w-full min-w-[850px] text-left">

              <thead>

                <tr className="border-b border-white/[0.055] text-[8px] uppercase tracking-[0.1em] text-zinc-700">

                  <th className="pb-3 pr-4 font-semibold">
                    Carrier
                  </th>

                  <th className="pb-3 pr-4 font-semibold">
                    Stage
                  </th>

                  <th className="pb-3 pr-4 font-semibold">
                    Reply
                  </th>

                  <th className="pb-3 pr-4 font-semibold">
                    Last Reply
                  </th>

                  <th className="pb-3 pr-4 font-semibold">
                    Updated
                  </th>

                  <th className="pb-3 text-right font-semibold">
                    Action
                  </th>

                </tr>

              </thead>


              <tbody>

                {hotLeads.map(
                  (
                    lead,
                  ) => {
                    const displayName =
                      lead.company_name ||
                      lead.name ||
                      lead.email ||
                      "Lead";


                    return (
                      <tr
                        key={
                          lead.id
                        }
                        className="border-b border-white/[0.04] last:border-b-0"
                      >

                        <td className="py-4 pr-4">

                          <div className="text-[10px] font-semibold text-zinc-200">
                            {displayName}
                          </div>

                          <div className="mt-1 text-[8px] text-zinc-700">
                            {lead.carrier_dot_number
                              ? `USDOT ${lead.carrier_dot_number}`
                              : "No USDOT"}
                            {lead.mc_number
                              ? ` • ${lead.mc_number}`
                              : ""}
                          </div>

                        </td>


                        <td className="py-4 pr-4">

                          <span
                            className={`rounded-full border px-2 py-1 text-[8px] font-semibold ${statusClasses(
                              lead.status,
                            )}`}
                          >
                            {prettyStatus(
                              lead.status,
                            )}
                          </span>

                        </td>


                        <td className="py-4 pr-4">

                          <div className="text-[9px] text-zinc-400">
                            {lead.has_replied
                              ? prettyStatus(
                                  lead.last_reply_classification,
                                )
                              : "No reply"}
                          </div>

                          {lead.reply_requires_attention ? (
                            <div className="mt-1 text-[8px] font-medium text-amber-400">
                              Needs attention
                            </div>
                          ) : null}

                        </td>


                        <td className="py-4 pr-4 text-[9px] text-zinc-600">
                          {formatDate(
                            lead.last_reply_at,
                          )}
                        </td>


                        <td className="py-4 pr-4 text-[9px] text-zinc-600">
                          {formatDate(
                            lead.updated_at,
                          )}
                        </td>


                        <td className="py-4 text-right">

                          <Link
                            href={`/admin/leads/${lead.id}`}
                            className="inline-flex h-8 items-center rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 text-[8px] font-semibold text-blue-300 hover:bg-white/[0.05]"
                          >
                            Open 360 →
                          </Link>

                        </td>

                      </tr>
                    );
                  },
                )}

              </tbody>

            </table>

          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.055] bg-black/15 p-5 text-[10px] text-zinc-600">
            No active conversion opportunities yet.
          </div>
        )}

      </Panel>


      {/* =====================================================
          STALLED + TASKS
      ===================================================== */}

      <div className="grid gap-5 xl:grid-cols-2">

        <Panel
          title="Stalled Conversion Leads"
          subtitle="Interested, Follow Up or Meeting leads unchanged for more than 48 hours."
        >

          {stalledLeads.length >
          0 ? (
            <div className="space-y-2">

              {stalledLeads.map(
                (
                  lead,
                ) => (
                  <Link
                    key={
                      lead.id
                    }
                    href={`/admin/leads/${lead.id}`}
                    className="block rounded-xl border border-white/[0.055] bg-black/15 p-4 transition hover:border-amber-500/15 hover:bg-amber-500/[0.025]"
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div className="min-w-0">

                        <div className="truncate text-[10px] font-semibold text-zinc-300">
                          {lead.company_name ||
                            lead.name ||
                            lead.email ||
                            "Lead"}
                        </div>

                        <div className="mt-1 text-[8px] text-zinc-700">
                          Last movement{" "}
                          {formatDate(
                            lead.updated_at,
                          )}
                        </div>

                      </div>


                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-[7px] font-semibold ${statusClasses(
                          lead.status,
                        )}`}
                      >
                        {prettyStatus(
                          lead.status,
                        )}
                      </span>

                    </div>

                  </Link>
                ),
              )}

            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.025] p-5">

              <div className="text-[10px] font-semibold text-emerald-300">
                No stalled conversion leads
              </div>

              <div className="mt-1 text-[9px] text-zinc-600">
                No engaged lead has been idle for more than 48 hours.
              </div>

            </div>
          )}

        </Panel>


        <Panel
          title="Priority Follow-ups"
          subtitle="Open sales tasks ordered by due time."
          action={
            <Link
              href="/admin/tasks"
              className="text-[9px] font-medium text-blue-400 hover:text-blue-300"
            >
              Task Center →
            </Link>
          }
        >

          {tasks.length >
          0 ? (
            <div className="space-y-2">

              {tasks
                .slice(
                  0,
                  10,
                )
                .map(
                  (
                    task,
                  ) => {
                    const lead =
                      taskLeadMap.get(
                        task.lead_id,
                      );


                    const overdue =
                      new Date(
                        task.due_at,
                      ).getTime() <
                      now.getTime();


                    return (
                      <Link
                        href={`/admin/leads/${task.lead_id}`}
                        key={
                          task.id
                        }
                        className={[
                          "block rounded-xl border p-4 transition",
                          overdue
                            ? "border-red-500/15 bg-red-500/[0.025] hover:bg-red-500/[0.05]"
                            : "border-white/[0.055] bg-black/15 hover:bg-white/[0.025]",
                        ].join(
                          " ",
                        )}
                      >

                        <div className="flex items-start justify-between gap-4">

                          <div className="min-w-0">

                            <div className="flex flex-wrap items-center gap-2">

                              <span
                                className={`rounded-full border px-2 py-0.5 text-[7px] font-semibold ${priorityClasses(
                                  task.priority,
                                )}`}
                              >
                                {prettyStatus(
                                  task.priority,
                                )}
                              </span>

                              {overdue ? (
                                <span className="text-[7px] font-semibold text-red-300">
                                  OVERDUE
                                </span>
                              ) : null}

                            </div>


                            <div className="mt-2 truncate text-[10px] font-semibold text-zinc-300">
                              {task.title}
                            </div>

                            <div className="mt-1 text-[8px] text-zinc-700">
                              {lead?.company_name ||
                                lead?.name ||
                                "Lead"}
                              {" • "}
                              {prettyStatus(
                                lead?.status,
                              )}
                            </div>

                          </div>


                          <div
                            className={[
                              "shrink-0 text-right text-[8px]",
                              overdue
                                ? "text-red-300"
                                : "text-zinc-600",
                            ].join(
                              " ",
                            )}
                          >
                            {formatDate(
                              task.due_at,
                            )}
                          </div>

                        </div>

                      </Link>
                    );
                  },
                )}

            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.055] bg-black/15 p-5 text-[10px] text-zinc-600">
              No open conversion tasks.
            </div>
          )}

        </Panel>

      </div>


      {/* =====================================================
          ONBOARDING CONVERSION
      ===================================================== */}

      <Panel
        title="Client → Onboarding"
        subtitle={`${number(
          onboardingCount,
        )} total onboarding record${
          onboardingCount ===
          1
            ? ""
            : "s"
        } with live Document Vault readiness.`}
        action={
          <Link
            href="/admin/onboarding"
            className="text-[9px] font-medium text-violet-400 hover:text-violet-300"
          >
            Onboarding Hub →
          </Link>
        }
      >

        {onboardings.length >
        0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">

            {onboardings.map(
              (
                onboarding,
              ) => {
                const vault =
                  vaultMap.get(
                    onboarding.id,
                  );


                const missingCount =
                  Array.isArray(
                    vault?.missing_documents,
                  )
                    ? vault?.missing_documents
                        .length ??
                      0
                    : 0;


                return (
                  <Link
                    key={
                      onboarding.id
                    }
                    href={`/admin/onboarding/${onboarding.id}/documents`}
                    className="rounded-[16px] border border-white/[0.06] bg-black/15 p-4 transition hover:border-violet-500/20 hover:bg-violet-500/[0.025]"
                  >

                    <div className="flex items-start justify-between gap-3">

                      <div className="min-w-0">

                        <div className="truncate text-[11px] font-semibold text-zinc-200">
                          {onboarding.company_name}
                        </div>

                        <div className="mt-1 text-[8px] text-zinc-700">
                          {onboarding.dot_number
                            ? `USDOT ${onboarding.dot_number}`
                            : "No USDOT"}
                        </div>

                      </div>


                      <span
                        className={[
                          "rounded-full border px-2 py-1 text-[7px] font-semibold",
                          vault?.broker_packet_ready
                            ? "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300"
                            : "border-amber-500/20 bg-amber-500/[0.06] text-amber-300",
                        ].join(
                          " ",
                        )}
                      >
                        {vault?.broker_packet_ready
                          ? "Packet Ready"
                          : prettyStatus(
                              onboarding.status,
                            )}
                      </span>

                    </div>


                    <div className="mt-4 grid grid-cols-2 gap-2">

                      <div className="rounded-lg border border-white/[0.05] bg-white/[0.018] p-2.5">

                        <div className="text-[7px] uppercase tracking-[0.08em] text-zinc-700">
                          Agreement
                        </div>

                        <div className="mt-1 text-[9px] font-medium text-zinc-400">
                          {prettyStatus(
                            onboarding.agreement_status,
                          )}
                        </div>

                      </div>


                      <div className="rounded-lg border border-white/[0.05] bg-white/[0.018] p-2.5">

                        <div className="text-[7px] uppercase tracking-[0.08em] text-zinc-700">
                          Documents
                        </div>

                        <div className="mt-1 text-[9px] font-medium text-zinc-400">
                          {vault?.document_count ??
                            0}
                        </div>

                      </div>

                    </div>


                    <div className="mt-3 flex items-center justify-between text-[8px]">

                      <span className="text-zinc-700">
                        {missingCount >
                        0
                          ? `${missingCount} missing requirement${
                              missingCount ===
                              1
                                ? ""
                                : "s"
                            }`
                          : "No missing requirements reported"}
                      </span>

                      <span className="font-medium text-violet-300">
                        Vault →
                      </span>

                    </div>

                  </Link>
                );
              },
            )}

          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.055] bg-black/15 p-5">

            <div className="text-[10px] font-semibold text-zinc-300">
              No onboarding records yet
            </div>

            <div className="mt-1 text-[9px] text-zinc-600">
              Converted clients will appear here as soon as onboarding begins.
            </div>

          </div>
        )}

      </Panel>


      {/* =====================================================
          FOOTER SUMMARY
      ===================================================== */}

      <section className="rounded-[18px] border border-white/[0.06] bg-black/15 px-5 py-4">

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <div className="text-[9px] font-semibold text-zinc-400">
              Conversion health
            </div>

            <div className="mt-1 text-[8px] leading-4 text-zinc-700">
              Metrics are calculated from live Lead, Task,
              Reply and Onboarding records whenever this page loads.
            </div>

          </div>


          <div className="flex flex-wrap gap-2 text-[8px]">

            <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-zinc-500">
              {number(
                positiveLeads,
              )} positive replies
            </span>

            <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-zinc-500">
              {number(
                notInterested,
              )} closed
            </span>

            <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-zinc-500">
              {number(
                activeOnboarding,
              )} onboarding
            </span>

            <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-zinc-500">
              Chicago operations time
            </span>

          </div>

        </div>

      </section>

    </div>
  );
}