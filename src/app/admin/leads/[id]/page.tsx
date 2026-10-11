import type {
  ReactNode,
} from "react";

import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import {
  createServerSupabase,
} from "@/lib/supabase/server";


export const dynamic =
  "force-dynamic";


const BUSINESS_TIMEZONE =
  "America/Chicago";


type Props = {
  params:
    Promise<{
      id: string;
    }>;
};


type ConversationItem =
  | {
      id: string;
      type: "outgoing";
      date: string;
      subject: string | null;
      status: string;
      email: string;
      error: string | null;
    }
  | {
      id: string;
      type: "reply";
      date: string;
      subject: string | null;
      text: string | null;
      email: string;
      attachments: number;
      classification: string | null;
      confidence: number | null;
      requiresAttention: boolean;
      handled: boolean;
    };


type ActivityTone =
  | "neutral"
  | "blue"
  | "emerald"
  | "amber"
  | "red"
  | "violet";


type ActivityItem = {
  id: string;
  date: string;
  title: string;
  detail: string | null;
  meta: string | null;
  tone: ActivityTone;
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
        char,
      ) =>
        char.toUpperCase(),
    );
}


function sourceLabel(
  source:
    string |
    null |
    undefined,
) {
  switch (source) {
    case "fmcsa_daily_auto":
      return "Daily Auto";

    case "fmcsa_pilot":
      return "Pilot";

    case "fmcsa_ramp_20":
      return "Ramp";

    case "fmcsa_ramp_20_verified_relaunch":
      return "Verified Ramp";

    case "fmcsa":
      return "FMCSA";

    case "website":
      return "Website";

    case "email_test":
      return "Test";

    default:
      return source
        ? prettyStatus(
            source,
          )
        : "Unknown";
  }
}


function sourceClasses(
  source:
    string |
    null |
    undefined,
) {
  if (
    source?.startsWith(
      "fmcsa",
    )
  ) {
    return "border-blue-500/15 bg-blue-500/[0.055] text-blue-300";
  }

  if (
    source ===
    "website"
  ) {
    return "border-violet-500/15 bg-violet-500/[0.055] text-violet-300";
  }

  return "border-white/[0.07] bg-white/[0.025] text-zinc-500";
}


function statusClasses(
  status:
    string |
    null |
    undefined,
) {
  switch (status) {
    case "client":
      return "border-violet-500/20 bg-violet-500/[0.08] text-violet-300";

    case "interested":
      return "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300";

    case "meeting":
      return "border-blue-500/20 bg-blue-500/[0.08] text-blue-300";

    case "follow_up":
      return "border-amber-500/20 bg-amber-500/[0.08] text-amber-300";

    case "contacted":
      return "border-sky-500/20 bg-sky-500/[0.08] text-sky-300";

    case "not_interested":
      return "border-red-500/20 bg-red-500/[0.08] text-red-300";

    default:
      return "border-white/[0.08] bg-white/[0.03] text-zinc-400";
  }
}


function sequenceClasses(
  status:
    string |
    null |
    undefined,
) {
  switch (status) {
    case "active":
      return "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300";

    case "completed":
      return "border-blue-500/20 bg-blue-500/[0.07] text-blue-300";

    case "paused":
      return "border-amber-500/20 bg-amber-500/[0.07] text-amber-300";

    case "stopped":
      return "border-red-500/20 bg-red-500/[0.07] text-red-300";

    default:
      return "border-white/[0.08] bg-white/[0.03] text-zinc-500";
  }
}


function emailStatusClasses(
  status:
    string |
    null |
    undefined,
) {
  switch (status) {
    case "delivered":
      return "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300";

    case "sent":
      return "border-blue-500/20 bg-blue-500/[0.07] text-blue-300";

    case "scheduled":
      return "border-violet-500/20 bg-violet-500/[0.07] text-violet-300";

    case "bounced":
    case "failed":
    case "complained":
    case "suppressed":
      return "border-red-500/20 bg-red-500/[0.07] text-red-300";

    default:
      return "border-white/[0.08] bg-white/[0.03] text-zinc-500";
  }
}


function classificationClasses(
  value:
    string |
    null |
    undefined,
) {
  switch (value) {
    case "interested":
      return "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300";

    case "call_me":
      return "border-violet-500/20 bg-violet-500/[0.07] text-violet-300";

    case "need_rates":
      return "border-blue-500/20 bg-blue-500/[0.07] text-blue-300";

    case "not_interested":
    case "unsubscribe":
      return "border-red-500/20 bg-red-500/[0.07] text-red-300";

    default:
      return "border-white/[0.08] bg-white/[0.03] text-zinc-400";
  }
}


function priorityClasses(
  priority:
    string |
    null |
    undefined,
) {
  switch (priority) {
    case "urgent":
      return "border-red-500/20 bg-red-500/[0.07] text-red-300";

    case "high":
      return "border-amber-500/20 bg-amber-500/[0.07] text-amber-300";

    case "low":
      return "border-white/[0.08] bg-white/[0.025] text-zinc-500";

    default:
      return "border-blue-500/20 bg-blue-500/[0.07] text-blue-300";
  }
}


function healthClasses(
  value:
    string |
    null |
    undefined,
) {
  const normalized =
    value?.toLowerCase() ??
    "";

  if (
    [
      "valid",
      "verified",
      "good",
      "healthy",
      "safe",
      "deliverable",
    ].includes(
      normalized,
    )
  ) {
    return "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300";
  }

  if (
    [
      "risky",
      "unknown",
      "catch_all",
    ].includes(
      normalized,
    )
  ) {
    return "border-amber-500/20 bg-amber-500/[0.07] text-amber-300";
  }

  if (
    [
      "invalid",
      "bounced",
      "complained",
      "blocked",
      "unsafe",
      "undeliverable",
    ].includes(
      normalized,
    )
  ) {
    return "border-red-500/20 bg-red-500/[0.07] text-red-300";
  }

  return "border-white/[0.08] bg-white/[0.03] text-zinc-500";
}


function activityToneClasses(
  tone:
    ActivityTone,
) {
  switch (tone) {
    case "emerald":
      return "border-emerald-500/30 bg-emerald-400";

    case "blue":
      return "border-blue-500/30 bg-blue-400";

    case "amber":
      return "border-amber-500/30 bg-amber-400";

    case "red":
      return "border-red-500/30 bg-red-400";

    case "violet":
      return "border-violet-500/30 bg-violet-400";

    default:
      return "border-white/20 bg-zinc-500";
  }
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


function formatNumber(
  value:
    number |
    null |
    undefined,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  return value.toLocaleString(
    "en-US",
  );
}


function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="rounded-[17px] border border-white/[0.07] bg-white/[0.022] p-4">

      <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-zinc-600">
        {label}
      </div>

      <div className="mt-3 text-lg font-semibold text-zinc-100">
        {value}
      </div>

      {detail ? (
        <div className="mt-1.5 text-[9px] leading-4 text-zinc-600">
          {detail}
        </div>
      ) : null}

    </div>
  );
}


function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[19px] border border-white/[0.07] bg-white/[0.018]">

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


function InfoRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.045] py-3 last:border-b-0">

      <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.09em] text-zinc-700">
        {label}
      </span>

      <div className="min-w-0 text-right text-[10px] leading-5 text-zinc-300">
        {value}
      </div>

    </div>
  );
}


export default async function LeadDetailPage({
  params,
}: Props) {
  const {
    id,
  } =
    await params;


  const supabase =
    createServerSupabase();


  /* ==========================================================
     LEAD
  ========================================================== */

  const {
    data:
      lead,

    error:
      leadError,
  } =
    await supabase
      .from(
        "leads",
      )
      .select(`
        id,
        name,
        company_name,
        email,
        phone,
        message,
        notes,

        carrier_dot_number,
        mc_number,

        source,
        status,

        email_opt_out,
        unsubscribed_at,
        email_bounced,
        email_complained,

        last_email_sent_at,

        has_replied,
        reply_count,
        last_reply_at,
        last_reply_from,
        last_reply_subject,
        last_reply_classification,
        reply_requires_attention,

        created_at,
        updated_at
      `)
      .eq(
        "id",
        id,
      )
      .maybeSingle();


  if (
    leadError ||
    !lead
  ) {
    notFound();
  }


  /* ==========================================================
     CARRIER
  ========================================================== */

  let carrier:
    any =
      null;


  if (
    lead.carrier_dot_number
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "carriers",
        )
        .select(`
          id,
          dot_number,
          mc_number,

          legal_name,
          dba_name,
          owner_name,

          phone,
          cell_phone,
          email,
          website,

          city,
          state,

          status_code,
          equipment,

          power_units,
          truck_units,
          drivers,

          safety_rating,

          authority_date,
          authority_age,
          authority_age_days,
          authority_status,
          authority_type,

          lead_score,
          dispatcher_probability,

          contacted,
          meeting_booked,
          client,

          email_health_status,
          email_health_reason,
          email_health_updated_at,

          email_last_bounced_at,
          email_last_complained_at,

          email_verification_status,
          email_risk_score,
          email_verification_reason,
          email_domain,
          email_role_based,
          email_disposable,
          email_free_provider,
          email_verification_checked_at,

          acquisition_source,
          source_first_seen_at,
          source_last_seen_at,

          last_fmcsa_sync,
          updated_at
        `)
        .eq(
          "dot_number",
          lead.carrier_dot_number,
        )
        .maybeSingle();


    if (error) {
      console.error(
        "LEAD 360 CARRIER ERROR:",
        error.message,
      );
    }

    carrier =
      data;
  }


  /* ==========================================================
     RELATED CRM DATA
  ========================================================== */

  const [
    emailSendResult,
    replyResult,
    enrollmentResult,
    taskResult,
    onboardingResult,
  ] =
    await Promise.all([

      supabase
        .from(
          "email_sends",
        )
        .select(`
          id,
          to_email,
          from_email,
          subject,
          status,

          scheduled_at,
          sent_at,
          delivered_at,
          bounced_at,
          complained_at,
          failed_at,

          error_message,
          created_at
        `)
        .eq(
          "lead_id",
          lead.id,
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          },
        ),

      supabase
        .from(
          "email_replies",
        )
        .select(`
          id,
          from_email,
          to_email,
          subject,
          text_body,

          attachment_count,

          received_at,
          created_at,

          classification,
          classification_confidence,
          classification_reason,
          classified_at,

          requires_attention,
          handled,
          handled_at,
          handled_action,
          handled_note
        `)
        .eq(
          "lead_id",
          lead.id,
        )
        .order(
          "received_at",
          {
            ascending:
              true,
          },
        ),

      supabase
        .from(
          "email_sequence_enrollments",
        )
        .select(`
          id,
          sequence_id,
          status,
          current_step,
          next_send_at,
          started_at,
          completed_at,
          stopped_at,
          created_at,
          updated_at
        `)
        .eq(
          "lead_id",
          lead.id,
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          },
        )
        .limit(
          1,
        )
        .maybeSingle(),

      supabase
        .from(
          "lead_tasks",
        )
        .select(`
          id,
          lead_id,
          source_reply_id,

          task_type,
          title,
          note,

          status,
          priority,

          due_at,
          completed_at,

          created_at,
          updated_at
        `)
        .eq(
          "lead_id",
          lead.id,
        )
        .order(
          "due_at",
          {
            ascending:
              true,
            nullsFirst:
              false,
          },
        )
        .limit(
          30,
        ),

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

          primary_contact_name,
          primary_contact_email,
          primary_contact_phone,

          status,

          agreement_status,
          agreement_signed_at,

          load_board_access_status,
          load_board_provider,

          dispatch_fee_type,
          dispatch_fee_value,

          minimum_rate_per_mile,
          target_rate_per_mile,
          weekly_revenue_target,

          factoring_company,

          insurance_company,
          insurance_expiration,

          onboarding_completed_at,
          activated_at,

          created_at,
          updated_at
        `)
        .eq(
          "lead_id",
          lead.id,
        )
        .order(
          "created_at",
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
    emailSendResult.error
  ) {
    console.error(
      "LEAD 360 SEND ERROR:",
      emailSendResult.error.message,
    );
  }


  if (
    replyResult.error
  ) {
    console.error(
      "LEAD 360 REPLY ERROR:",
      replyResult.error.message,
    );
  }


  if (
    enrollmentResult.error
  ) {
    console.error(
      "LEAD 360 ENROLLMENT ERROR:",
      enrollmentResult.error.message,
    );
  }


  if (
    taskResult.error
  ) {
    console.error(
      "LEAD 360 TASK ERROR:",
      taskResult.error.message,
    );
  }


  if (
    onboardingResult.error
  ) {
    console.error(
      "LEAD 360 ONBOARDING ERROR:",
      onboardingResult.error.message,
    );
  }


  const emailSends =
    emailSendResult.data ??
    [];


  const emailReplies =
    replyResult.data ??
    [];


  const enrollment =
    enrollmentResult.data;


  const tasks =
    taskResult.data ??
    [];


  const onboarding =
    onboardingResult.data;


  /* ==========================================================
     DOCUMENT VAULT
  ========================================================== */

  let vaultStatus:
    any =
      null;


  let documentEvents:
    any[] =
      [];


  if (
    onboarding?.id
  ) {
    const [
      vaultResult,
      documentEventResult,
    ] =
      await Promise.all([

        supabase
          .from(
            "carrier_document_vault_status",
          )
          .select(`
            onboarding_id,
            carrier_id,

            company_name,
            dot_number,
            mc_number,

            agreement_status,

            dispatch_agreement_status,
            carrier_packet_status,

            w9_status,
            w8_status,
            coi_status,
            authority_status,
            factoring_noa_status,

            coi_expires_at,

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
          .eq(
            "onboarding_id",
            onboarding.id,
          )
          .maybeSingle(),

        supabase
          .from(
            "carrier_document_events",
          )
          .select(`
            id,
            onboarding_id,
            document_id,

            event_type,

            from_status,
            to_status,

            actor,
            note,

            created_at
          `)
          .eq(
            "onboarding_id",
            onboarding.id,
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          )
          .limit(
            30,
          ),
      ]);


    if (
      vaultResult.error
    ) {
      console.error(
        "LEAD 360 VAULT ERROR:",
        vaultResult.error.message,
      );
    }


    if (
      documentEventResult.error
    ) {
      console.error(
        "LEAD 360 DOCUMENT EVENT ERROR:",
        documentEventResult.error.message,
      );
    }


    vaultStatus =
      vaultResult.data;


    documentEvents =
      documentEventResult.data ??
      [];
  }


  /* ==========================================================
     COMPUTED CRM STATE
  ========================================================== */

  const displayName =
    lead.company_name ||
    carrier?.legal_name ||
    lead.name ||
    lead.email ||
    "Lead";


  const contactName =
    lead.name ||
    carrier?.owner_name ||
    "—";


  const location =
    [
      carrier?.city,
      carrier?.state,
    ]
      .filter(
        Boolean,
      )
      .join(
        ", ",
      ) ||
    "—";


  const openTasks =
    tasks.filter(
      (
        task,
      ) =>
        task.status ===
        "open",
    );


  const nextTask =
    openTasks[0] ??
    null;


  const onboardingEligible =
    [
      "interested",
      "follow_up",
      "meeting",
      "client",
    ].includes(
      lead.status ??
        "",
    );


  const manualEmailAllowed =
    Boolean(
      lead.email,
    ) &&
    !lead.email_opt_out &&
    !lead.email_bounced &&
    !lead.email_complained;


  let automationBlockReason:
    string |
    null =
      null;


  if (
    !lead.email
  ) {
    automationBlockReason =
      "No email address";
  } else if (
    lead.email_opt_out
  ) {
    automationBlockReason =
      "Lead unsubscribed";
  } else if (
    lead.email_bounced
  ) {
    automationBlockReason =
      "Email has bounced";
  } else if (
    lead.email_complained
  ) {
    automationBlockReason =
      "Spam complaint received";
  } else if (
    lead.has_replied
  ) {
    automationBlockReason =
      "Carrier replied — automated outreach must remain stopped";
  } else if (
    lead.status ===
    "client"
  ) {
    automationBlockReason =
      "Client status blocks prospecting automation";
  } else if (
    lead.status ===
    "not_interested"
  ) {
    automationBlockReason =
      "Not interested status blocks automation";
  }


  const latestReply =
    emailReplies.length >
    0
      ? emailReplies[
          emailReplies.length -
            1
        ]
      : null;


  const latestClassification =
    lead.last_reply_classification ||
    latestReply?.classification ||
    null;


  const replyNeedsAttention =
    Boolean(
      lead.reply_requires_attention ||
      latestReply?.requires_attention,
    );


  const nextAction =
    nextTask
      ? nextTask.title
      : replyNeedsAttention
        ? "Review carrier reply"
        : onboarding
          ? vaultStatus?.broker_packet_ready
            ? "Broker packet ready"
            : "Continue carrier onboarding"
          : onboardingEligible
            ? "Start carrier onboarding"
            : lead.has_replied
              ? "Review conversation"
              : "No open task";


  /* ==========================================================
     CONVERSATION
  ========================================================== */

  const conversation:
    ConversationItem[] =
      [];


  for (
    const send
    of emailSends
  ) {
    const date =
      send.sent_at ||
      send.created_at;


    if (!date) {
      continue;
    }


    conversation.push({
      id:
        send.id,

      type:
        "outgoing",

      date,

      subject:
        send.subject,

      status:
        send.status,

      email:
        send.to_email,

      error:
        send.error_message,
    });
  }


  for (
    const reply
    of emailReplies
  ) {
    const date =
      reply.received_at ||
      reply.created_at;


    if (!date) {
      continue;
    }


    conversation.push({
      id:
        reply.id,

      type:
        "reply",

      date,

      subject:
        reply.subject,

      text:
        reply.text_body,

      email:
        reply.from_email,

      attachments:
        reply.attachment_count ??
        0,

      classification:
        reply.classification,

      confidence:
        reply.classification_confidence ===
          null ||
        reply.classification_confidence ===
          undefined
          ? null
          : Number(
              reply.classification_confidence,
            ),

      requiresAttention:
        Boolean(
          reply.requires_attention,
        ),

      handled:
        Boolean(
          reply.handled,
        ),
    });
  }


  conversation.sort(
    (
      a,
      b,
    ) =>
      new Date(
        a.date,
      ).getTime() -
      new Date(
        b.date,
      ).getTime(),
  );


  /* ==========================================================
     ACTIVITY TIMELINE
  ========================================================== */

  const activity:
    ActivityItem[] =
      [];


  if (
    lead.created_at
  ) {
    activity.push({
      id:
        `lead-${lead.id}`,

      date:
        lead.created_at,

      title:
        "Lead created",

      detail:
        `${displayName} entered the SlateLane CRM.`,

      meta:
        sourceLabel(
          lead.source,
        ),

      tone:
        "neutral",
    });
  }


  for (
    const send
    of emailSends
  ) {
    const date =
      send.sent_at ||
      send.created_at;


    if (!date) {
      continue;
    }


    const failed =
      [
        "bounced",
        "failed",
        "complained",
        "suppressed",
      ].includes(
        send.status,
      );


    activity.push({
      id:
        `send-${send.id}`,

      date,

      title:
        `Email ${prettyStatus(
          send.status,
        )}`,

      detail:
        send.subject ||
        "Outbound SlateLane email",

      meta:
        send.to_email,

      tone:
        failed
          ? "red"
          : send.status ===
              "delivered"
            ? "emerald"
            : "blue",
    });
  }


  for (
    const reply
    of emailReplies
  ) {
    const date =
      reply.received_at ||
      reply.created_at;


    if (!date) {
      continue;
    }


    activity.push({
      id:
        `reply-${reply.id}`,

      date,

      title:
        reply.classification
          ? `Carrier replied • ${prettyStatus(
              reply.classification,
            )}`
          : "Carrier replied",

      detail:
        reply.subject ||
        reply.text_body?.slice(
          0,
          180,
        ) ||
        "Inbound carrier reply",

      meta:
        reply.requires_attention
          ? "Needs attention"
          : reply.handled
            ? "Handled"
            : "Reply received",

      tone:
        reply.requires_attention
          ? "amber"
          : "emerald",
    });
  }


  for (
    const task
    of tasks
  ) {
    if (
      task.created_at
    ) {
      activity.push({
        id:
          `task-created-${task.id}`,

        date:
          task.created_at,

        title:
          `Task created • ${prettyStatus(
            task.task_type,
          )}`,

        detail:
          task.title,

        meta:
          task.due_at
            ? `Due ${formatDate(
                task.due_at,
              )}`
            : prettyStatus(
                task.priority,
              ),

        tone:
          task.priority ===
            "urgent"
            ? "red"
            : task.priority ===
                "high"
              ? "amber"
              : "violet",
      });
    }


    if (
      task.completed_at
    ) {
      activity.push({
        id:
          `task-completed-${task.id}`,

        date:
          task.completed_at,

        title:
          "Task completed",

        detail:
          task.title,

        meta:
          prettyStatus(
            task.task_type,
          ),

        tone:
          "emerald",
      });
    }
  }


  if (
    onboarding?.created_at
  ) {
    activity.push({
      id:
        `onboarding-${onboarding.id}`,

      date:
        onboarding.created_at,

      title:
        "Carrier onboarding started",

      detail:
        onboarding.company_name ||
        displayName,

      meta:
        prettyStatus(
          onboarding.status,
        ),

      tone:
        "violet",
    });
  }


  if (
    onboarding?.agreement_signed_at
  ) {
    activity.push({
      id:
        `agreement-${onboarding.id}`,

      date:
        onboarding.agreement_signed_at,

      title:
        "Dispatch agreement signed",

      detail:
        onboarding.company_name ||
        displayName,

      meta:
        "Signed",

      tone:
        "emerald",
    });
  }


  if (
    onboarding?.onboarding_completed_at
  ) {
    activity.push({
      id:
        `onboarding-completed-${onboarding.id}`,

      date:
        onboarding.onboarding_completed_at,

      title:
        "Onboarding completed",

      detail:
        onboarding.company_name ||
        displayName,

      meta:
        "Completed",

      tone:
        "emerald",
    });
  }


  if (
    onboarding?.activated_at
  ) {
    activity.push({
      id:
        `activated-${onboarding.id}`,

      date:
        onboarding.activated_at,

      title:
        "Carrier activated",

      detail:
        "Carrier account became operational.",

      meta:
        "Active",

      tone:
        "emerald",
    });
  }


  for (
    const event
    of documentEvents
  ) {
    if (
      !event.created_at
    ) {
      continue;
    }


    activity.push({
      id:
        `document-${event.id}`,

      date:
        event.created_at,

      title:
        `Document • ${prettyStatus(
          event.event_type,
        )}`,

      detail:
        event.note ||
        (
          event.to_status
            ? `Status changed to ${prettyStatus(
                event.to_status,
              )}.`
            : "Carrier document activity."
        ),

      meta:
        event.actor ||
        null,

      tone:
        event.to_status ===
          "approved" ||
        event.to_status ===
          "signed"
          ? "emerald"
          : event.to_status ===
              "rejected"
            ? "red"
            : "blue",
    });
  }


  activity.sort(
    (
      a,
      b,
    ) =>
      new Date(
        b.date,
      ).getTime() -
      new Date(
        a.date,
      ).getTime(),
  );


  const recentActivity =
    activity.slice(
      0,
      40,
    );


  return (
    <div className="space-y-6">

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-[linear-gradient(135deg,rgba(18,23,31,.95),rgba(9,13,18,.96))] px-6 py-6 shadow-[0_18px_60px_rgba(0,0,0,.16)]">

        <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-emerald-500/[0.045] blur-3xl" />

        <div className="relative">

          <Link
            href="/admin/leads"
            className="text-[10px] font-medium text-zinc-600 transition hover:text-zinc-300"
          >
            ← Back to Lead workspace
          </Link>


          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">

            <div className="min-w-0">

              <div className="flex flex-wrap items-center gap-2">

                <span
                  className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${statusClasses(
                    lead.status,
                  )}`}
                >
                  {prettyStatus(
                    lead.status,
                  )}
                </span>


                <span
                  className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${sourceClasses(
                    lead.source,
                  )}`}
                >
                  {sourceLabel(
                    lead.source,
                  )}
                </span>


                {replyNeedsAttention ? (
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/[0.07] px-2.5 py-1 text-[9px] font-semibold text-amber-300">
                    Reply needs attention
                  </span>
                ) : null}

              </div>


              <h1 className="mt-4 text-[30px] font-semibold tracking-[-0.045em] text-white md:text-[38px]">
                {displayName}
              </h1>


              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-600">

                <span>
                  {contactName}
                </span>

                <span>
                  •
                </span>

                <span>
                  DOT{" "}
                  {lead.carrier_dot_number ??
                    "—"}
                </span>

                {lead.mc_number ? (
                  <>
                    <span>
                      •
                    </span>

                    <span>
                      {lead.mc_number}
                    </span>
                  </>
                ) : null}

                {location !==
                "—" ? (
                  <>
                    <span>
                      •
                    </span>

                    <span>
                      {location}
                    </span>
                  </>
                ) : null}

              </div>

            </div>


            <div className="flex flex-wrap gap-2">

              {lead.carrier_dot_number ? (
                <Link
                  href={`/admin/carriers/${lead.carrier_dot_number}`}
                  className="inline-flex h-10 items-center rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-[10px] font-semibold text-zinc-300 transition hover:bg-white/[0.05]"
                >
                  Carrier intelligence
                </Link>
              ) : null}


              {lead.has_replied ? (
                <Link
                  href="/admin/replies?handling=open"
                  className="inline-flex h-10 items-center rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-4 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-500/[0.11]"
                >
                  Open Inbox
                </Link>
              ) : null}


              {onboarding ? (
                <Link
                  href={`/admin/onboarding/${onboarding.id}/documents`}
                  className="inline-flex h-10 items-center rounded-xl border border-violet-500/20 bg-violet-500/[0.07] px-4 text-[10px] font-semibold text-violet-300 transition hover:bg-violet-500/[0.11]"
                >
                  Document Vault
                </Link>
              ) : onboardingEligible ? (
                <Link
                  href={`/admin/onboarding/new?lead=${lead.id}`}
                  className="inline-flex h-10 items-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 text-[10px] font-semibold text-emerald-300 transition hover:bg-emerald-500/[0.11]"
                >
                  Start Onboarding
                </Link>
              ) : null}


              {manualEmailAllowed ? (
                <a
                  href={`mailto:${lead.email}`}
                  className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-[10px] font-semibold text-black transition hover:bg-zinc-200"
                >
                  Send Manual Email
                </a>
              ) : null}

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          KPI STRIP
      ===================================================== */}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">

        <MetricCard
          label="Pipeline"
          value={
            <span className="text-zinc-100">
              {prettyStatus(
                lead.status,
              )}
            </span>
          }
          detail={
            `Created ${formatDate(
              lead.created_at,
            )}`
          }
        />


        <MetricCard
          label="Replies"
          value={
            <span
              className={
                lead.has_replied
                  ? "text-emerald-300"
                  : "text-zinc-300"
              }
            >
              {lead.reply_count ??
                0}
            </span>
          }
          detail={
            latestClassification
              ? prettyStatus(
                  latestClassification,
                )
              : lead.has_replied
                ? "Carrier replied"
                : "No reply yet"
          }
        />


        <MetricCard
          label="Sequence"
          value={
            <span
              className={
                enrollment?.status ===
                "active"
                  ? "text-emerald-300"
                  : "text-zinc-200"
              }
            >
              {enrollment
                ? prettyStatus(
                    enrollment.status,
                  )
                : "Not enrolled"}
            </span>
          }
          detail={
            enrollment
              ? `Step ${enrollment.current_step} • Next ${formatDate(
                  enrollment.next_send_at,
                )}`
              : automationBlockReason ||
                "Eligible state shown below"
          }
        />


        <MetricCard
          label="Carrier Score"
          value={
            carrier?.lead_score !==
              null &&
            carrier?.lead_score !==
              undefined ? (
              <span
                className={
                  carrier.lead_score >=
                  80
                    ? "text-emerald-300"
                    : carrier.lead_score >=
                        60
                      ? "text-amber-300"
                      : "text-zinc-300"
                }
              >
                {carrier.lead_score}
                /100
              </span>
            ) : (
              "—"
            )
          }
          detail={
            carrier?.dispatcher_probability !==
              null &&
            carrier?.dispatcher_probability !==
              undefined
              ? `${carrier.dispatcher_probability}% dispatcher probability`
              : "Carrier scoring unavailable"
          }
        />


        <MetricCard
          label="Next Action"
          value={
            <span
              className={
                replyNeedsAttention
                  ? "text-amber-300"
                  : "text-zinc-200"
              }
            >
              {nextAction}
            </span>
          }
          detail={
            nextTask?.due_at
              ? `Due ${formatDate(
                  nextTask.due_at,
                )}`
              : `${openTasks.length} open task${
                  openTasks.length ===
                  1
                    ? ""
                    : "s"
                }`
          }
        />

      </div>


      {/* =====================================================
          MAIN CRM GRID
      ===================================================== */}

      <div className="grid gap-5 2xl:grid-cols-[330px_minmax(0,1fr)]">

        {/* ===================================================
            LEFT RAIL
        =================================================== */}

        <aside className="space-y-5">

          {/* CONTACT */}

          <Panel
            title="Lead identity"
            subtitle="Primary CRM and carrier contact details."
          >

            <div>

              <InfoRow
                label="Contact"
                value={
                  contactName
                }
              />


              <InfoRow
                label="Company"
                value={
                  displayName
                }
              />


              <InfoRow
                label="Email"
                value={
                  lead.email ? (
                    <span className="break-all">
                      {lead.email}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />


              <InfoRow
                label="Phone"
                value={
                  lead.phone ||
                  carrier?.phone ||
                  "—"
                }
              />


              <InfoRow
                label="USDOT"
                value={
                  lead.carrier_dot_number ??
                  "—"
                }
              />


              <InfoRow
                label="MC"
                value={
                  lead.mc_number ||
                  carrier?.mc_number ||
                  "—"
                }
              />


              <InfoRow
                label="Location"
                value={
                  location
                }
              />


              <InfoRow
                label="Source"
                value={
                  sourceLabel(
                    lead.source,
                  )
                }
              />

            </div>


            {lead.notes ? (
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-3">

                <div className="text-[8px] font-semibold uppercase tracking-[0.11em] text-zinc-700">
                  CRM Notes
                </div>

                <p className="mt-2 whitespace-pre-wrap text-[10px] leading-5 text-zinc-400">
                  {lead.notes}
                </p>

              </div>
            ) : null}

          </Panel>


          {/* EMAIL SAFETY */}

          <Panel
            title="Email safety"
            subtitle="Matches the safeguards used by SlateLane automation."
          >

            <div
              className={`mb-4 rounded-xl border p-3 ${
                automationBlockReason
                  ? lead.has_replied &&
                    !lead.email_opt_out &&
                    !lead.email_bounced &&
                    !lead.email_complained
                    ? "border-amber-500/15 bg-amber-500/[0.045]"
                    : "border-red-500/15 bg-red-500/[0.045]"
                  : "border-emerald-500/15 bg-emerald-500/[0.045]"
              }`}
            >

              <div
                className={`text-[10px] font-semibold ${
                  automationBlockReason
                    ? lead.has_replied &&
                      !lead.email_opt_out &&
                      !lead.email_bounced &&
                      !lead.email_complained
                      ? "text-amber-300"
                      : "text-red-300"
                    : "text-emerald-300"
                }`}
              >
                {automationBlockReason
                  ? "Automation blocked"
                  : "Automation eligible"}
              </div>

              <div className="mt-1 text-[9px] leading-4 text-zinc-600">
                {automationBlockReason ||
                  "No lead-level safety block is currently present."}
              </div>

            </div>


            <InfoRow
              label="Replied"
              value={
                <span
                  className={
                    lead.has_replied
                      ? "text-emerald-300"
                      : "text-zinc-500"
                  }
                >
                  {lead.has_replied
                    ? "Yes"
                    : "No"}
                </span>
              }
            />


            <InfoRow
              label="Opt-out"
              value={
                <span
                  className={
                    lead.email_opt_out
                      ? "text-red-300"
                      : "text-zinc-500"
                  }
                >
                  {lead.email_opt_out
                    ? "Yes"
                    : "No"}
                </span>
              }
            />


            <InfoRow
              label="Bounce"
              value={
                <span
                  className={
                    lead.email_bounced
                      ? "text-red-300"
                      : "text-zinc-500"
                  }
                >
                  {lead.email_bounced
                    ? "Yes"
                    : "No"}
                </span>
              }
            />


            <InfoRow
              label="Complaint"
              value={
                <span
                  className={
                    lead.email_complained
                      ? "text-red-300"
                      : "text-zinc-500"
                  }
                >
                  {lead.email_complained
                    ? "Yes"
                    : "No"}
                </span>
              }
            />


            <InfoRow
              label="Last email"
              value={
                formatDate(
                  lead.last_email_sent_at,
                )
              }
            />


            <InfoRow
              label="Last reply"
              value={
                formatDate(
                  lead.last_reply_at,
                )
              }
            />

          </Panel>


          {/* CARRIER INTELLIGENCE */}

          <Panel
            title="Carrier intelligence"
            subtitle={
              carrier
                ? "FMCSA and SlateLane carrier intelligence."
                : "No linked carrier record was found."
            }
            action={
              lead.carrier_dot_number ? (
                <Link
                  href={`/admin/carriers/${lead.carrier_dot_number}`}
                  className="text-[9px] font-medium text-blue-400 hover:text-blue-300"
                >
                  Full profile →
                </Link>
              ) : null
            }
          >

            {carrier ? (
              <div>

                <InfoRow
                  label="Lead score"
                  value={
                    carrier.lead_score !==
                      null &&
                    carrier.lead_score !==
                      undefined
                      ? `${carrier.lead_score}/100`
                      : "—"
                  }
                />


                <InfoRow
                  label="Probability"
                  value={
                    carrier.dispatcher_probability !==
                      null &&
                    carrier.dispatcher_probability !==
                      undefined
                      ? `${carrier.dispatcher_probability}%`
                      : "—"
                  }
                />


                <InfoRow
                  label="Power units"
                  value={
                    formatNumber(
                      carrier.power_units,
                    )
                  }
                />


                <InfoRow
                  label="Drivers"
                  value={
                    formatNumber(
                      carrier.drivers,
                    )
                  }
                />


                <InfoRow
                  label="Authority"
                  value={
                    prettyStatus(
                      carrier.authority_status,
                    )
                  }
                />


                <InfoRow
                  label="Authority age"
                  value={
                    carrier.authority_age_days !==
                      null &&
                    carrier.authority_age_days !==
                      undefined
                      ? `${formatNumber(
                          carrier.authority_age_days,
                        )} days`
                      : "—"
                  }
                />


                <InfoRow
                  label="Safety"
                  value={
                    carrier.safety_rating ||
                    "Not Rated"
                  }
                />


                <div className="mt-4 border-t border-white/[0.05] pt-4">

                  <div className="mb-3 text-[8px] font-semibold uppercase tracking-[0.11em] text-zinc-700">
                    Email Intelligence
                  </div>


                  <div className="flex flex-wrap gap-2">

                    <span
                      className={`rounded-full border px-2 py-1 text-[8px] font-semibold ${healthClasses(
                        carrier.email_verification_status,
                      )}`}
                    >
                      Verification:{" "}
                      {prettyStatus(
                        carrier.email_verification_status,
                      )}
                    </span>


                    <span
                      className={`rounded-full border px-2 py-1 text-[8px] font-semibold ${healthClasses(
                        carrier.email_health_status,
                      )}`}
                    >
                      Health:{" "}
                      {prettyStatus(
                        carrier.email_health_status,
                      )}
                    </span>

                  </div>


                  {carrier.email_risk_score !==
                    null &&
                  carrier.email_risk_score !==
                    undefined ? (
                    <div className="mt-3 text-[9px] text-zinc-600">
                      Risk score:{" "}
                      <span className="text-zinc-400">
                        {carrier.email_risk_score}
                      </span>
                    </div>
                  ) : null}


                  {carrier.email_verification_reason ? (
                    <p className="mt-2 text-[9px] leading-4 text-zinc-600">
                      {carrier.email_verification_reason}
                    </p>
                  ) : null}

                </div>

              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.055] bg-black/15 p-4 text-[10px] leading-5 text-zinc-600">
                This lead does not currently have a matching carrier intelligence record.
              </div>
            )}

          </Panel>


          {/* ONBOARDING */}

          <Panel
            title="Onboarding"
            subtitle="Carrier conversion and broker-packet readiness."
            action={
              onboarding ? (
                <Link
                  href={`/admin/onboarding/${onboarding.id}/documents`}
                  className="text-[9px] font-medium text-violet-400 hover:text-violet-300"
                >
                  Vault →
                </Link>
              ) : onboardingEligible ? (
                <Link
                  href={`/admin/onboarding/new?lead=${lead.id}`}
                  className="text-[9px] font-medium text-emerald-400 hover:text-emerald-300"
                >
                  Start →
                </Link>
              ) : null
            }
          >

            {onboarding ? (
              <div>

                <InfoRow
                  label="Status"
                  value={
                    prettyStatus(
                      onboarding.status,
                    )
                  }
                />


                <InfoRow
                  label="Agreement"
                  value={
                    prettyStatus(
                      onboarding.agreement_status,
                    )
                  }
                />


                <InfoRow
                  label="Signed"
                  value={
                    formatDate(
                      onboarding.agreement_signed_at,
                    )
                  }
                />


                <InfoRow
                  label="Documents"
                  value={
                    vaultStatus?.document_count ??
                    "—"
                  }
                />


                <InfoRow
                  label="Broker packet"
                  value={
                    vaultStatus?.broker_packet_ready ? (
                      <span className="font-semibold text-emerald-300">
                        Ready
                      </span>
                    ) : (
                      <span className="text-amber-300">
                        Incomplete
                      </span>
                    )
                  }
                />


                {Array.isArray(
                  vaultStatus?.missing_documents,
                ) &&
                vaultStatus.missing_documents.length >
                  0 ? (
                  <div className="mt-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-3">

                    <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-amber-400">
                      Missing documents
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">

                      {vaultStatus.missing_documents.map(
                        (
                          document:
                            string,
                        ) => (
                          <span
                            key={
                              document
                            }
                            className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1 text-[8px] text-zinc-500"
                          >
                            {prettyStatus(
                              document,
                            )}
                          </span>
                        ),
                      )}

                    </div>

                  </div>
                ) : null}

              </div>
            ) : (
              <div>

                <div className="rounded-xl border border-white/[0.055] bg-black/15 p-4">

                  <div className="text-[10px] font-semibold text-zinc-300">
                    Onboarding not started
                  </div>

                  <p className="mt-1.5 text-[9px] leading-4 text-zinc-600">
                    {onboardingEligible
                      ? "This lead is eligible to enter the existing SlateLane onboarding workflow."
                      : "Move the lead to Interested, Follow Up, Meeting or Client before starting onboarding."}
                  </p>

                </div>

                {onboardingEligible ? (
                  <Link
                    href={`/admin/onboarding/new?lead=${lead.id}`}
                    className="mt-3 inline-flex h-9 items-center rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-3 text-[9px] font-semibold text-emerald-300 hover:bg-emerald-500/[0.11]"
                  >
                    Start carrier onboarding
                  </Link>
                ) : null}

              </div>
            )}

          </Panel>

        </aside>


        {/* ===================================================
            MAIN COLUMN
        =================================================== */}

        <main className="min-w-0 space-y-5">

          {/* NEXT ACTION / TASKS */}

          <Panel
            title="Next action"
            subtitle="Open CRM work for this carrier."
            action={
              <Link
                href="/admin/tasks"
                className="text-[9px] font-medium text-blue-400 hover:text-blue-300"
              >
                Task center →
              </Link>
            }
          >

            {nextTask ? (
              <div className="rounded-[15px] border border-white/[0.07] bg-black/20 p-4">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                  <div className="min-w-0">

                    <div className="flex flex-wrap gap-2">

                      <span
                        className={`rounded-full border px-2 py-1 text-[8px] font-semibold ${priorityClasses(
                          nextTask.priority,
                        )}`}
                      >
                        {prettyStatus(
                          nextTask.priority,
                        )}
                      </span>

                      <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[8px] font-medium text-zinc-500">
                        {prettyStatus(
                          nextTask.task_type,
                        )}
                      </span>

                    </div>


                    <h3 className="mt-3 text-[15px] font-semibold text-zinc-100">
                      {nextTask.title}
                    </h3>


                    {nextTask.note ? (
                      <p className="mt-2 max-w-3xl whitespace-pre-wrap text-[10px] leading-5 text-zinc-500">
                        {nextTask.note}
                      </p>
                    ) : null}

                  </div>


                  <div className="shrink-0 text-left sm:text-right">

                    <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                      Due
                    </div>

                    <div className="mt-1 text-[10px] font-medium text-zinc-300">
                      {formatDate(
                        nextTask.due_at,
                      )}
                    </div>

                  </div>

                </div>

              </div>
            ) : (
              <div className="rounded-[15px] border border-white/[0.06] bg-black/15 p-4">

                <div className="text-[11px] font-semibold text-zinc-300">
                  {nextAction}
                </div>

                <div className="mt-1 text-[9px] leading-4 text-zinc-600">
                  No open task is currently assigned to this lead.
                </div>

              </div>
            )}


            {tasks.length >
            0 ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2">

                {tasks
                  .slice(
                    0,
                    6,
                  )
                  .map(
                    (
                      task,
                    ) => (
                      <div
                        key={
                          task.id
                        }
                        className="rounded-xl border border-white/[0.055] bg-white/[0.015] p-3"
                      >

                        <div className="flex items-center justify-between gap-3">

                          <span
                            className={`rounded-full border px-2 py-0.5 text-[7px] font-semibold ${
                              task.status ===
                              "completed"
                                ? "border-emerald-500/15 bg-emerald-500/[0.06] text-emerald-300"
                                : task.status ===
                                    "cancelled"
                                  ? "border-red-500/15 bg-red-500/[0.06] text-red-300"
                                  : priorityClasses(
                                      task.priority,
                                    )
                            }`}
                          >
                            {task.status ===
                            "open"
                              ? prettyStatus(
                                  task.priority,
                                )
                              : prettyStatus(
                                  task.status,
                                )}
                          </span>

                          <span className="text-[8px] text-zinc-700">
                            {formatDate(
                              task.due_at,
                            )}
                          </span>

                        </div>

                        <div className="mt-2 truncate text-[10px] font-medium text-zinc-300">
                          {task.title}
                        </div>

                      </div>
                    ),
                  )}

              </div>
            ) : null}

          </Panel>


          {/* REPLY INTELLIGENCE */}

          {lead.has_replied ? (
            <Panel
              title="Reply intelligence"
              subtitle="Latest inbound response and handling state."
              action={
                <Link
                  href="/admin/replies?handling=open"
                  className="text-[9px] font-medium text-amber-400 hover:text-amber-300"
                >
                  Open inbox →
                </Link>
              }
            >

              <div className="grid gap-3 md:grid-cols-3">

                <div className="rounded-xl border border-white/[0.06] bg-black/15 p-4">

                  <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                    Classification
                  </div>

                  <div className="mt-3">

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${classificationClasses(
                        latestClassification,
                      )}`}
                    >
                      {latestClassification
                        ? prettyStatus(
                            latestClassification,
                          )
                        : "Replied"}
                    </span>

                  </div>

                </div>


                <div className="rounded-xl border border-white/[0.06] bg-black/15 p-4">

                  <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                    Attention
                  </div>

                  <div
                    className={`mt-3 text-[11px] font-semibold ${
                      replyNeedsAttention
                        ? "text-amber-300"
                        : "text-emerald-300"
                    }`}
                  >
                    {replyNeedsAttention
                      ? "Needs review"
                      : "No urgent flag"}
                  </div>

                </div>


                <div className="rounded-xl border border-white/[0.06] bg-black/15 p-4">

                  <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                    Latest reply
                  </div>

                  <div className="mt-3 text-[10px] font-medium text-zinc-300">
                    {formatDate(
                      lead.last_reply_at,
                    )}
                  </div>

                </div>

              </div>


              {lead.last_reply_subject ? (
                <div className="mt-4 rounded-xl border border-white/[0.055] bg-white/[0.015] p-4">

                  <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                    Subject
                  </div>

                  <div className="mt-2 text-[11px] text-zinc-300">
                    {lead.last_reply_subject}
                  </div>

                </div>
              ) : null}

            </Panel>
          ) : null}


          {/* CRM ACTIVITY */}

          <Panel
            title="CRM activity"
            subtitle="Sales, email, task, onboarding and document events in one timeline."
          >

            {recentActivity.length >
            0 ? (
              <div className="relative">

                <div className="absolute bottom-2 left-[5px] top-2 w-px bg-white/[0.055]" />

                <div className="space-y-5">

                  {recentActivity.map(
                    (
                      item,
                    ) => (
                      <div
                        key={
                          item.id
                        }
                        className="relative flex gap-4"
                      >

                        <div
                          className={`relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-[3px] border-[#0d1117] ${activityToneClasses(
                            item.tone,
                          )}`}
                        />


                        <div className="min-w-0 flex-1 border-b border-white/[0.04] pb-5">

                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">

                            <div className="min-w-0">

                              <div className="text-[10px] font-semibold text-zinc-300">
                                {item.title}
                              </div>

                              {item.detail ? (
                                <div className="mt-1 max-w-3xl text-[9px] leading-4 text-zinc-600">
                                  {item.detail}
                                </div>
                              ) : null}

                              {item.meta ? (
                                <div className="mt-1 text-[8px] text-zinc-700">
                                  {item.meta}
                                </div>
                              ) : null}

                            </div>

                            <div className="shrink-0 text-[8px] text-zinc-700">
                              {formatDate(
                                item.date,
                              )}
                            </div>

                          </div>

                        </div>

                      </div>
                    ),
                  )}

                </div>

              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.055] bg-black/15 p-5 text-[10px] text-zinc-600">
                No CRM activity has been recorded yet.
              </div>
            )}

          </Panel>


          {/* CONVERSATION */}

          <Panel
            title="Conversation"
            subtitle={`${conversation.length} email event${
              conversation.length ===
              1
                ? ""
                : "s"
            } in the SlateLane conversation history.`}
            action={
              lead.has_replied ? (
                <span className="rounded-full border border-emerald-500/15 bg-emerald-500/[0.06] px-2.5 py-1 text-[8px] font-semibold text-emerald-300">
                  Automated outreach stopped
                </span>
              ) : enrollment?.status ===
                "active" ? (
                <span className="rounded-full border border-blue-500/15 bg-blue-500/[0.06] px-2.5 py-1 text-[8px] font-semibold text-blue-300">
                  Sequence active
                </span>
              ) : null
            }
          >

            {conversation.length >
            0 ? (
              <div className="space-y-5">

                {conversation.map(
                  (
                    item,
                  ) => {
                    if (
                      item.type ===
                      "reply"
                    ) {
                      return (
                        <div
                          key={
                            `reply-${item.id}`
                          }
                          className="flex justify-start"
                        >

                          <div className="max-w-[92%] rounded-[16px] rounded-tl-md border border-emerald-500/15 bg-emerald-500/[0.035] p-4 md:max-w-[82%]">

                            <div className="flex flex-wrap items-center gap-2">

                              <span className="text-[10px] font-semibold text-emerald-300">
                                Carrier Reply
                              </span>


                              {item.classification ? (
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[7px] font-semibold ${classificationClasses(
                                    item.classification,
                                  )}`}
                                >
                                  {prettyStatus(
                                    item.classification,
                                  )}
                                </span>
                              ) : null}


                              {item.requiresAttention ? (
                                <span className="rounded-full border border-amber-500/15 bg-amber-500/[0.06] px-2 py-0.5 text-[7px] font-semibold text-amber-300">
                                  Attention
                                </span>
                              ) : null}


                              {item.handled ? (
                                <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-0.5 text-[7px] text-zinc-500">
                                  Handled
                                </span>
                              ) : null}

                            </div>


                            <div className="mt-2 text-[8px] text-zinc-700">
                              From{" "}
                              {item.email}
                              {" • "}
                              {formatDate(
                                item.date,
                              )}
                            </div>


                            {item.subject ? (
                              <div className="mt-4 text-[11px] font-semibold text-zinc-200">
                                {item.subject}
                              </div>
                            ) : null}


                            <div className="mt-3 whitespace-pre-wrap break-words text-[10px] leading-6 text-zinc-400">
                              {item.text ||
                                "Reply contained no plain-text body."}
                            </div>


                            {item.attachments >
                            0 ? (
                              <div className="mt-3 text-[8px] text-zinc-600">
                                {item.attachments} attachment
                                {item.attachments ===
                                1
                                  ? ""
                                  : "s"}
                              </div>
                            ) : null}

                          </div>

                        </div>
                      );
                    }


                    return (
                      <div
                        key={
                          `send-${item.id}`
                        }
                        className="flex justify-end"
                      >

                        <div className="max-w-[92%] rounded-[16px] rounded-tr-md border border-blue-500/15 bg-blue-500/[0.03] p-4 md:max-w-[82%]">

                          <div className="flex flex-wrap items-center gap-2">

                            <span className="text-[10px] font-semibold text-blue-300">
                              SlateLane
                            </span>


                            <span
                              className={`rounded-full border px-2 py-0.5 text-[7px] font-semibold ${emailStatusClasses(
                                item.status,
                              )}`}
                            >
                              {prettyStatus(
                                item.status,
                              )}
                            </span>

                          </div>


                          <div className="mt-2 text-[8px] text-zinc-700">
                            To{" "}
                            {item.email}
                            {" • "}
                            {formatDate(
                              item.date,
                            )}
                          </div>


                          <div className="mt-4 text-[11px] font-semibold text-zinc-200">
                            {item.subject ||
                              "(No subject)"}
                          </div>


                          {item.error ? (
                            <div className="mt-3 rounded-lg border border-red-500/15 bg-red-500/[0.04] p-3 text-[9px] leading-4 text-red-300">
                              {item.error}
                            </div>
                          ) : null}

                        </div>

                      </div>
                    );
                  },
                )}

              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.055] bg-black/15 p-5">

                <div className="text-[10px] font-semibold text-zinc-300">
                  No email history yet
                </div>

                <div className="mt-1 text-[9px] leading-4 text-zinc-600">
                  SlateLane has not recorded an outbound email or inbound reply for this lead.
                </div>

              </div>
            )}

          </Panel>


          {/* RECORD DETAILS */}

          <Panel
            title="Record details"
            subtitle="Underlying CRM record timestamps and acquisition metadata."
          >

            <div className="grid gap-x-8 md:grid-cols-2">

              <InfoRow
                label="Lead ID"
                value={
                  <span className="break-all font-mono text-[9px]">
                    {lead.id}
                  </span>
                }
              />


              <InfoRow
                label="Created"
                value={
                  formatDate(
                    lead.created_at,
                  )
                }
              />


              <InfoRow
                label="Updated"
                value={
                  formatDate(
                    lead.updated_at,
                  )
                }
              />


              <InfoRow
                label="Acquisition"
                value={
                  carrier?.acquisition_source
                    ? prettyStatus(
                        carrier.acquisition_source,
                      )
                    : sourceLabel(
                        lead.source,
                      )
                }
              />


              <InfoRow
                label="First seen"
                value={
                  formatDate(
                    carrier?.source_first_seen_at,
                  )
                }
              />


              <InfoRow
                label="Last FMCSA sync"
                value={
                  formatDate(
                    carrier?.last_fmcsa_sync,
                  )
                }
              />

            </div>

          </Panel>

        </main>

      </div>

    </div>
  );
}