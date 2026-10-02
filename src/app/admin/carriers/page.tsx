import type {
  ReactNode,
} from "react";

import Link from "next/link";

import {
  notFound,
  redirect,
} from "next/navigation";

import {
  revalidatePath,
} from "next/cache";

import {
  createServerSupabase,
} from "@/lib/supabase/server";

import {
  enrichCarrierAuthority,
} from "@/lib/fmcsa/motus";


export const dynamic =
  "force-dynamic";


const BUSINESS_TIMEZONE =
  "America/Chicago";


type Props = {
  params:
    Promise<{
      dot: string;
    }>;
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


function show(
  value:
    unknown,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return String(
    value,
  );
}


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


function formatDateOnly(
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
    return value;
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
    },
  ).format(
    date,
  );
}


function formatPhone(
  phone:
    string |
    null |
    undefined,
) {
  if (!phone) {
    return "—";
  }

  const digits =
    phone.replace(
      /\D/g,
      "",
    );

  if (
    digits.length ===
    10
  ) {
    return `(${digits.slice(
      0,
      3,
    )}) ${digits.slice(
      3,
      6,
    )}-${digits.slice(
      6,
    )}`;
  }

  return phone;
}


function scoreClasses(
  score:
    number,
) {
  if (
    score >=
    80
  ) {
    return "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300";
  }

  if (
    score >=
    60
  ) {
    return "border-amber-500/20 bg-amber-500/[0.08] text-amber-300";
  }

  return "border-white/[0.08] bg-white/[0.03] text-zinc-400";
}


function leadStatusClasses(
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


function healthClasses(
  value:
    string |
    null |
    undefined,
) {
  const normalized =
    value
      ?.toLowerCase() ??
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


function activityToneClasses(
  tone:
    ActivityTone,
) {
  switch (tone) {
    case "emerald":
      return "bg-emerald-400";

    case "blue":
      return "bg-blue-400";

    case "amber":
      return "bg-amber-400";

    case "red":
      return "bg-red-400";

    case "violet":
      return "bg-violet-400";

    default:
      return "bg-zinc-500";
  }
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


export default async function CarrierDetailPage({
  params,
}: Props) {
  const {
    dot,
  } =
    await params;


  const dotNumber =
    Number(
      dot,
    );


  if (
    !Number.isFinite(
      dotNumber,
    ) ||
    dotNumber <=
      0
  ) {
    notFound();
  }


  const supabase =
    createServerSupabase();


  /* ==========================================================
     CARRIER
  ========================================================== */

  const {
    data:
      carrier,

    error:
      carrierError,
  } =
    await supabase
      .from(
        "carriers",
      )
      .select(`
        id,
        dot_number,

        mc_number,
        mx_number,
        ff_number,

        legal_name,
        dba_name,
        owner_name,

        phone,
        cell_phone,
        email,
        website,

        street,
        city,
        state,
        zip,
        county,

        status_code,
        entity_type,
        classification,
        carrier_operation,
        business_type,
        equipment,

        power_units,
        truck_units,
        bus_units,
        drivers,
        total_cdl,

        safety_rating,
        safety_rating_date,
        review_date,

        hazmat,
        cargo,

        add_date,
        mcs150_date,

        authority_date,
        authority_age,
        authority_age_days,
        authority_docket,
        authority_type,
        authority_status,
        authority_reason,
        authority_enriched_at,

        motus_authority_event_date,
        motus_authority_reason,

        lead_score,
        dispatcher_probability,
        lead_status,

        contacted,
        meeting_booked,
        client,

        notes,

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
        created_at,
        updated_at
      `)
      .eq(
        "dot_number",
        dotNumber,
      )
      .maybeSingle();


  if (
    carrierError
  ) {
    return (
      <div className="space-y-6">

        <Link
          href="/admin/carriers"
          className="text-sm text-zinc-500 hover:text-white"
        >
          ← Back to carriers
        </Link>

        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-6">

          <h1 className="text-xl font-semibold text-red-300">
            Carrier database error
          </h1>

          <p className="mt-3 font-mono text-sm text-red-200">
            {carrierError.message}
          </p>

        </div>

      </div>
    );
  }


  if (
    !carrier
  ) {
    notFound();
  }


  /*
   * Preserve the current Add-to-Leads action.
   * Snapshot values so TypeScript keeps them non-null
   * inside the nested Server Action.
   */
  const carrierForLead = {
    owner_name:
      carrier.owner_name,

    legal_name:
      carrier.legal_name,

    email:
      carrier.email,

    phone:
      carrier.phone,

    dot_number:
      carrier.dot_number,

    mc_number:
      carrier.mc_number,
  };


  /* ==========================================================
     LINKED LEAD
  ========================================================== */

  const {
    data:
      existingLead,

    error:
      leadCheckError,
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

        carrier_dot_number,
        mc_number,

        source,
        status,

        email_opt_out,
        email_bounced,
        email_complained,

        last_email_sent_at,

        has_replied,
        reply_count,
        last_reply_at,
        last_reply_subject,
        last_reply_classification,
        reply_requires_attention,

        created_at,
        updated_at
      `)
      .eq(
        "carrier_dot_number",
        dotNumber,
      )
      .maybeSingle();


  if (
    leadCheckError
  ) {
    console.error(
      "CARRIER 360 LEAD ERROR:",
      leadCheckError.message,
    );
  }


  /* ==========================================================
     EXISTING ADD TO LEADS ACTION — PRESERVED
  ========================================================== */

  async function addToLeads() {
    "use server";


    const db =
      createServerSupabase();


    const {
      data:
        existing,

      error:
        existingError,
    } =
      await db
        .from(
          "leads",
        )
        .select(
          "id",
        )
        .eq(
          "carrier_dot_number",
          dotNumber,
        )
        .maybeSingle();


    if (
      existingError
    ) {
      throw new Error(
        `Could not check lead: ${existingError.message}`,
      );
    }


    if (
      !existing
    ) {
      const {
        error:
          insertError,
      } =
        await db
          .from(
            "leads",
          )
          .insert({
            name:
              carrierForLead.owner_name ||
              carrierForLead.legal_name,

            company_name:
              carrierForLead.legal_name,

            email:
              carrierForLead.email,

            phone:
              carrierForLead.phone,

            message:
              "FMCSA carrier prospect added from SlateLane CRM.",

            carrier_dot_number:
              carrierForLead.dot_number,

            mc_number:
              carrierForLead.mc_number,

            source:
              "fmcsa",

            status:
              "new",

            notes:
              null,

            updated_at:
              new Date()
                .toISOString(),
          });


      if (
        insertError &&
        insertError.code !==
          "23505"
      ) {
        throw new Error(
          `Could not add carrier to leads: ${insertError.message}`,
        );
      }
    }


    /*
     * Preserve automatic MOTUS enrichment.
     * A MOTUS failure must never undo lead creation.
     */
    try {
      console.log(
        `Starting automatic MOTUS enrichment for USDOT ${dotNumber}`,
      );


      const authority =
        await enrichCarrierAuthority(
          dotNumber,
        );


      console.log(
        `MOTUS enrichment successful for USDOT ${dotNumber}`,
        authority,
      );
    } catch (
      motusError
    ) {
      console.error(
        `MOTUS enrichment failed for USDOT ${dotNumber}:`,
        motusError,
      );
    }


    revalidatePath(
      "/admin/leads",
    );

    revalidatePath(
      "/admin/carriers",
    );

    revalidatePath(
      `/admin/carriers/${dotNumber}`,
    );


    redirect(
      `/admin/leads?carrier=${dotNumber}`,
    );
  }


  /* ==========================================================
     CRM DATA
  ========================================================== */

  let enrollment:
    any =
      null;

  let tasks:
    any[] =
      [];

  let emailSends:
    any[] =
      [];

  let emailReplies:
    any[] =
      [];

  let onboarding:
    any =
      null;


  if (
    existingLead
  ) {
    const [
      enrollmentResult,
      taskResult,
      sendResult,
      replyResult,
      onboardingResult,
    ] =
      await Promise.all([

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
            existingLead.id,
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
            existingLead.id,
          )
          .order(
            "created_at",
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
            "email_sends",
          )
          .select(`
            id,
            subject,
            status,
            to_email,
            sent_at,
            delivered_at,
            bounced_at,
            complained_at,
            failed_at,
            created_at
          `)
          .eq(
            "lead_id",
            existingLead.id,
          )
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

        supabase
          .from(
            "email_replies",
          )
          .select(`
            id,
            from_email,
            subject,
            text_body,
            classification,
            requires_attention,
            handled,
            received_at,
            created_at
          `)
          .eq(
            "lead_id",
            existingLead.id,
          )
          .order(
            "received_at",
            {
              ascending:
                false,
            },
          )
          .limit(
            10,
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
            existingLead.id,
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
      enrollmentResult.error
    ) {
      console.error(
        "CARRIER 360 ENROLLMENT ERROR:",
        enrollmentResult.error.message,
      );
    }


    if (
      taskResult.error
    ) {
      console.error(
        "CARRIER 360 TASK ERROR:",
        taskResult.error.message,
      );
    }


    if (
      sendResult.error
    ) {
      console.error(
        "CARRIER 360 SEND ERROR:",
        sendResult.error.message,
      );
    }


    if (
      replyResult.error
    ) {
      console.error(
        "CARRIER 360 REPLY ERROR:",
        replyResult.error.message,
      );
    }


    if (
      onboardingResult.error
    ) {
      console.error(
        "CARRIER 360 ONBOARDING ERROR:",
        onboardingResult.error.message,
      );
    }


    enrollment =
      enrollmentResult.data;

    tasks =
      taskResult.data ??
      [];

    emailSends =
      sendResult.data ??
      [];

    emailReplies =
      replyResult.data ??
      [];

    onboarding =
      onboardingResult.data;
  }


  /*
   * Fallback for onboardings that were linked directly
   * to the carrier but do not have lead_id populated.
   */
  if (
    !onboarding
  ) {
    const {
      data:
        carrierOnboarding,

      error:
        carrierOnboardingError,
    } =
      await supabase
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
          "carrier_id",
          carrier.id,
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
        .maybeSingle();


    if (
      carrierOnboardingError
    ) {
      console.error(
        "CARRIER 360 ONBOARDING FALLBACK ERROR:",
        carrierOnboardingError.message,
      );
    }


    onboarding =
      carrierOnboarding;
  }


  /* ==========================================================
     DOCUMENT VAULT STATUS
  ========================================================== */

  let vaultStatus:
    any =
      null;


  if (
    onboarding?.id
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "carrier_document_vault_status",
        )
        .select(`
          onboarding_id,
          carrier_id,

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
        .maybeSingle();


    if (
      error
    ) {
      console.error(
        "CARRIER 360 VAULT ERROR:",
        error.message,
      );
    }


    vaultStatus =
      data;
  }


  /* ==========================================================
     COMPUTED STATE
  ========================================================== */

  const score =
    carrier.lead_score ??
    0;


  const cargo:
    string[] =
      Array.isArray(
        carrier.cargo,
      )
        ? carrier.cargo
        : [];


  const location =
    [
      carrier.city,
      carrier.state,
    ]
      .filter(
        Boolean,
      )
      .join(
        ", ",
      ) ||
    "—";


  const openTasks =
    tasks
      .filter(
        (
          task,
        ) =>
          task.status ===
          "open",
      )
      .sort(
        (
          a,
          b,
        ) => {
          const aTime =
            a.due_at
              ? new Date(
                  a.due_at,
                ).getTime()
              : Number.MAX_SAFE_INTEGER;

          const bTime =
            b.due_at
              ? new Date(
                  b.due_at,
                ).getTime()
              : Number.MAX_SAFE_INTEGER;

          return (
            aTime -
            bTime
          );
        },
      );


  const nextTask =
    openTasks[0] ??
    null;


  const latestSend =
    emailSends[0] ??
    null;


  const latestReply =
    emailReplies[0] ??
    null;


  const onboardingEligible =
    existingLead
      ? [
          "interested",
          "follow_up",
          "meeting",
          "client",
        ].includes(
          existingLead.status ??
            "",
        )
      : false;


  let automationBlockReason:
    string |
    null =
      null;


  if (
    existingLead
  ) {
    if (
      !existingLead.email
    ) {
      automationBlockReason =
        "No email address";
    } else if (
      existingLead.email_opt_out
    ) {
      automationBlockReason =
        "Lead unsubscribed";
    } else if (
      existingLead.email_bounced
    ) {
      automationBlockReason =
        "Email has bounced";
    } else if (
      existingLead.email_complained
    ) {
      automationBlockReason =
        "Spam complaint received";
    } else if (
      existingLead.has_replied
    ) {
      automationBlockReason =
        "Carrier replied — automated outreach must remain stopped";
    } else if (
      existingLead.status ===
      "client"
    ) {
      automationBlockReason =
        "Client status blocks prospecting automation";
    } else if (
      existingLead.status ===
      "not_interested"
    ) {
      automationBlockReason =
        "Not interested status blocks automation";
    }
  }


  /* ==========================================================
     ACTIVITY TIMELINE
  ========================================================== */

  const activity:
    ActivityItem[] =
      [];


  if (
    carrier.created_at
  ) {
    activity.push({
      id:
        `carrier-${carrier.id}`,

      date:
        carrier.created_at,

      title:
        "Carrier added",

      detail:
        "Carrier entered the SlateLane FMCSA database.",

      meta:
        `USDOT ${carrier.dot_number}`,

      tone:
        "neutral",
    });
  }


  if (
    carrier.source_first_seen_at
  ) {
    activity.push({
      id:
        `source-first-${carrier.id}`,

      date:
        carrier.source_first_seen_at,

      title:
        "Acquisition source recorded",

      detail:
        carrier.acquisition_source
          ? prettyStatus(
              carrier.acquisition_source,
            )
          : "Carrier acquisition source recorded.",

      meta:
        null,

      tone:
        "blue",
    });
  }


  if (
    carrier.authority_enriched_at
  ) {
    activity.push({
      id:
        `motus-${carrier.id}`,

      date:
        carrier.authority_enriched_at,

      title:
        "MOTUS authority enriched",

      detail:
        carrier.authority_reason ||
        carrier.motus_authority_reason ||
        "Authority data refreshed.",

      meta:
        carrier.authority_status
          ? prettyStatus(
              carrier.authority_status,
            )
          : null,

      tone:
        "blue",
    });
  }


  if (
    existingLead?.created_at
  ) {
    activity.push({
      id:
        `lead-${existingLead.id}`,

      date:
        existingLead.created_at,

      title:
        "Converted to CRM lead",

      detail:
        `Lead status: ${prettyStatus(
          existingLead.status,
        )}`,

      meta:
        existingLead.source
          ? prettyStatus(
              existingLead.source,
            )
          : null,

      tone:
        "violet",
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
        "failed",
        "bounced",
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
        "SlateLane outreach email",

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
      !task.created_at
    ) {
      continue;
    }


    activity.push({
      id:
        `task-${task.id}`,

      date:
        task.created_at,

      title:
        `Task • ${prettyStatus(
          task.task_type,
        )}`,

      detail:
        task.title,

      meta:
        task.status ===
        "open"
          ? task.due_at
            ? `Due ${formatDate(
                task.due_at,
              )}`
            : prettyStatus(
                task.priority,
              )
          : prettyStatus(
              task.status,
            ),

      tone:
        task.status ===
        "completed"
          ? "emerald"
          : task.priority ===
              "urgent"
            ? "red"
            : task.priority ===
                "high"
              ? "amber"
              : "violet",
    });
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
        "Onboarding started",

      detail:
        onboarding.company_name ||
        carrier.legal_name,

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
        "Carrier completed the dispatch agreement.",

      meta:
        "Signed",

      tone:
        "emerald",
    });
  }


  if (
    onboarding?.activated_at
  ) {
    activity.push({
      id:
        `active-${onboarding.id}`,

      date:
        onboarding.activated_at,

      title:
        "Carrier activated",

      detail:
        "Carrier became operational in SlateLane.",

      meta:
        "Active",

      tone:
        "emerald",
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
      35,
    );


  return (
    <div className="space-y-6">

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-[linear-gradient(135deg,rgba(18,23,31,.95),rgba(9,13,18,.96))] px-6 py-6 shadow-[0_18px_60px_rgba(0,0,0,.16)]">

        <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-blue-500/[0.045] blur-3xl" />

        <div className="relative">

          <Link
            href="/admin/carriers"
            className="text-[10px] font-medium text-zinc-600 transition hover:text-zinc-300"
          >
            ← Back to Carrier Intelligence
          </Link>


          <div className="mt-5 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">

            <div className="min-w-0">

              <div className="flex flex-wrap items-center gap-2">

                <span
                  className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${
                    carrier.status_code ===
                    "A"
                      ? "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300"
                      : "border-white/[0.08] bg-white/[0.03] text-zinc-400"
                  }`}
                >
                  {carrier.status_code ===
                  "A"
                    ? "Active Authority"
                    : `FMCSA ${show(
                        carrier.status_code,
                      )}`}
                </span>


                <span
                  className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${scoreClasses(
                    score,
                  )}`}
                >
                  Score{" "}
                  {score}/100
                </span>


                {existingLead ? (
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${leadStatusClasses(
                      existingLead.status,
                    )}`}
                  >
                    {prettyStatus(
                      existingLead.status,
                    )}
                  </span>
                ) : null}


                {carrier.client ? (
                  <span className="rounded-full border border-violet-500/20 bg-violet-500/[0.07] px-2.5 py-1 text-[9px] font-semibold text-violet-300">
                    Client
                  </span>
                ) : null}

              </div>


              <h1 className="mt-4 text-[30px] font-semibold tracking-[-0.045em] text-white md:text-[38px]">
                {carrier.legal_name ||
                  "Unnamed Carrier"}
              </h1>


              {carrier.dba_name ? (
                <div className="mt-1 text-[11px] text-zinc-500">
                  DBA{" "}
                  {carrier.dba_name}
                </div>
              ) : null}


              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-600">

                <span>
                  USDOT{" "}
                  {carrier.dot_number}
                </span>

                {carrier.mc_number ? (
                  <>
                    <span>
                      •
                    </span>

                    <span>
                      {carrier.mc_number}
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

                {carrier.owner_name ? (
                  <>
                    <span>
                      •
                    </span>

                    <span>
                      {carrier.owner_name}
                    </span>
                  </>
                ) : null}

              </div>

            </div>


            <div className="flex flex-wrap gap-2">

              {existingLead ? (
                <Link
                  href={`/admin/leads/${existingLead.id}`}
                  className="inline-flex h-10 items-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 text-[10px] font-semibold text-emerald-300 transition hover:bg-emerald-500/[0.11]"
                >
                  Open Lead 360
                </Link>
              ) : (
                <form
                  action={
                    addToLeads
                  }
                >
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-[10px] font-semibold text-black transition hover:bg-zinc-200"
                  >
                    + Add to Leads
                  </button>
                </form>
              )}


              {onboarding ? (
                <Link
                  href={`/admin/onboarding/${onboarding.id}/documents`}
                  className="inline-flex h-10 items-center rounded-xl border border-violet-500/20 bg-violet-500/[0.07] px-4 text-[10px] font-semibold text-violet-300 transition hover:bg-violet-500/[0.11]"
                >
                  Document Vault
                </Link>
              ) : onboardingEligible &&
                existingLead ? (
                <Link
                  href={`/admin/onboarding/new?lead=${existingLead.id}`}
                  className="inline-flex h-10 items-center rounded-xl border border-blue-500/20 bg-blue-500/[0.07] px-4 text-[10px] font-semibold text-blue-300 transition hover:bg-blue-500/[0.11]"
                >
                  Start Onboarding
                </Link>
              ) : null}


              {carrier.email ? (
                <a
                  href={`mailto:${carrier.email}`}
                  className="inline-flex h-10 items-center rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-[10px] font-semibold text-zinc-300 transition hover:bg-white/[0.05]"
                >
                  Manual Email
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
          label="Lead Score"
          value={
            <span
              className={
                score >=
                80
                  ? "text-emerald-300"
                  : score >=
                      60
                    ? "text-amber-300"
                    : "text-zinc-300"
              }
            >
              {score}/100
            </span>
          }
          detail={
            carrier.dispatcher_probability !==
              null &&
            carrier.dispatcher_probability !==
              undefined
              ? `${carrier.dispatcher_probability}% dispatcher probability`
              : "Dispatcher probability unavailable"
          }
        />


        <MetricCard
          label="Fleet"
          value={
            `${(
              carrier.power_units ??
              0
            ).toLocaleString()} units`
          }
          detail={
            `${(
              carrier.drivers ??
              0
            ).toLocaleString()} drivers`
          }
        />


        <MetricCard
          label="Authority"
          value={
            <span
              className={
                carrier.authority_status
                  ?.toLowerCase()
                  .includes(
                    "active",
                  )
                  ? "text-emerald-300"
                  : "text-zinc-200"
              }
            >
              {prettyStatus(
                carrier.authority_status,
              )}
            </span>
          }
          detail={
            carrier.authority_age_days !==
              null &&
            carrier.authority_age_days !==
              undefined
              ? `${carrier.authority_age_days.toLocaleString()} days old`
              : formatDateOnly(
                  carrier.authority_date,
                )
          }
        />


        <MetricCard
          label="CRM"
          value={
            existingLead ? (
              <span className="text-zinc-100">
                {prettyStatus(
                  existingLead.status,
                )}
              </span>
            ) : (
              <span className="text-zinc-500">
                Prospect
              </span>
            )
          }
          detail={
            existingLead
              ? existingLead.has_replied
                ? `${existingLead.reply_count ?? 1} carrier reply${
                    (
                      existingLead.reply_count ??
                      1
                    ) ===
                    1
                      ? ""
                      : "ies"
                  }`
                : "No reply yet"
              : "Not yet added to Leads"
          }
        />


        <MetricCard
          label="Next Action"
          value={
            nextTask ? (
              <span
                className={
                  nextTask.priority ===
                    "urgent"
                    ? "text-red-300"
                    : nextTask.priority ===
                        "high"
                      ? "text-amber-300"
                      : "text-zinc-200"
                }
              >
                {nextTask.title}
              </span>
            ) : onboarding ? (
              vaultStatus?.broker_packet_ready ? (
                <span className="text-emerald-300">
                  Packet Ready
                </span>
              ) : (
                "Continue onboarding"
              )
            ) : existingLead ? (
              "Manage lead"
            ) : (
              "Add to Leads"
            )
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
          360 GRID
      ===================================================== */}

      <div className="grid gap-5 2xl:grid-cols-[350px_minmax(0,1fr)]">

        {/* LEFT */}

        <aside className="space-y-5">

          <Panel
            title="Contact"
            subtitle="Primary carrier identity and contact channels."
          >

            <InfoRow
              label="Owner"
              value={
                show(
                  carrier.owner_name,
                )
              }
            />

            <InfoRow
              label="Phone"
              value={
                carrier.phone ? (
                  <a
                    href={`tel:${carrier.phone}`}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    {formatPhone(
                      carrier.phone,
                    )}
                  </a>
                ) : (
                  "—"
                )
              }
            />

            <InfoRow
              label="Cell"
              value={
                carrier.cell_phone ? (
                  <a
                    href={`tel:${carrier.cell_phone}`}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    {formatPhone(
                      carrier.cell_phone,
                    )}
                  </a>
                ) : (
                  "—"
                )
              }
            />

            <InfoRow
              label="Email"
              value={
                carrier.email ? (
                  <a
                    href={`mailto:${carrier.email}`}
                    className="break-all text-blue-400 hover:text-blue-300"
                  >
                    {carrier.email}
                  </a>
                ) : (
                  "—"
                )
              }
            />

            <InfoRow
              label="Website"
              value={
                show(
                  carrier.website,
                )
              }
            />

            <InfoRow
              label="Location"
              value={
                location
              }
            />

            <InfoRow
              label="Street"
              value={
                show(
                  carrier.street,
                )
              }
            />

            <InfoRow
              label="ZIP"
              value={
                show(
                  carrier.zip,
                )
              }
            />

            <InfoRow
              label="County"
              value={
                show(
                  carrier.county,
                )
              }
            />

          </Panel>


          <Panel
            title="Email intelligence"
            subtitle="Verification and delivery-health signals."
          >

            <div className="mb-4 flex flex-wrap gap-2">

              <span
                className={`rounded-full border px-2.5 py-1 text-[8px] font-semibold ${healthClasses(
                  carrier.email_verification_status,
                )}`}
              >
                Verification:{" "}
                {prettyStatus(
                  carrier.email_verification_status,
                )}
              </span>


              <span
                className={`rounded-full border px-2.5 py-1 text-[8px] font-semibold ${healthClasses(
                  carrier.email_health_status,
                )}`}
              >
                Health:{" "}
                {prettyStatus(
                  carrier.email_health_status,
                )}
              </span>

            </div>


            <InfoRow
              label="Risk score"
              value={
                carrier.email_risk_score ??
                "—"
              }
            />

            <InfoRow
              label="Domain"
              value={
                show(
                  carrier.email_domain,
                )
              }
            />

            <InfoRow
              label="Role based"
              value={
                carrier.email_role_based ===
                  null ||
                carrier.email_role_based ===
                  undefined
                  ? "—"
                  : carrier.email_role_based
                    ? "Yes"
                    : "No"
              }
            />

            <InfoRow
              label="Disposable"
              value={
                carrier.email_disposable ===
                  null ||
                carrier.email_disposable ===
                  undefined
                  ? "—"
                  : carrier.email_disposable
                    ? "Yes"
                    : "No"
              }
            />

            <InfoRow
              label="Free provider"
              value={
                carrier.email_free_provider ===
                  null ||
                carrier.email_free_provider ===
                  undefined
                  ? "—"
                  : carrier.email_free_provider
                    ? "Yes"
                    : "No"
              }
            />

            <InfoRow
              label="Checked"
              value={
                formatDate(
                  carrier.email_verification_checked_at,
                )
              }
            />


            {carrier.email_verification_reason ? (
              <div className="mt-4 rounded-xl border border-white/[0.055] bg-black/15 p-3">

                <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                  Verification reason
                </div>

                <p className="mt-2 text-[9px] leading-4 text-zinc-500">
                  {carrier.email_verification_reason}
                </p>

              </div>
            ) : null}


            {carrier.email_health_reason ? (
              <div className="mt-3 rounded-xl border border-white/[0.055] bg-black/15 p-3">

                <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                  Health reason
                </div>

                <p className="mt-2 text-[9px] leading-4 text-zinc-500">
                  {carrier.email_health_reason}
                </p>

              </div>
            ) : null}

          </Panel>


          <Panel
            title="CRM relationship"
            subtitle={
              existingLead
                ? "Linked SlateLane sales record."
                : "Carrier has not been converted into a sales lead."
            }
            action={
              existingLead ? (
                <Link
                  href={`/admin/leads/${existingLead.id}`}
                  className="text-[9px] font-medium text-emerald-400 hover:text-emerald-300"
                >
                  Lead 360 →
                </Link>
              ) : null
            }
          >

            {existingLead ? (
              <>

                <InfoRow
                  label="Lead status"
                  value={
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold ${leadStatusClasses(
                        existingLead.status,
                      )}`}
                    >
                      {prettyStatus(
                        existingLead.status,
                      )}
                    </span>
                  }
                />

                <InfoRow
                  label="Replied"
                  value={
                    existingLead.has_replied ? (
                      <span className="text-emerald-300">
                        Yes
                      </span>
                    ) : (
                      "No"
                    )
                  }
                />

                <InfoRow
                  label="Replies"
                  value={
                    existingLead.reply_count ??
                    0
                  }
                />

                <InfoRow
                  label="Classification"
                  value={
                    prettyStatus(
                      existingLead.last_reply_classification,
                    )
                  }
                />

                <InfoRow
                  label="Last reply"
                  value={
                    formatDate(
                      existingLead.last_reply_at,
                    )
                  }
                />

                <InfoRow
                  label="Last email"
                  value={
                    formatDate(
                      existingLead.last_email_sent_at,
                    )
                  }
                />


                {automationBlockReason ? (
                  <div className="mt-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.045] p-3">

                    <div className="text-[9px] font-semibold text-amber-300">
                      Automation blocked
                    </div>

                    <div className="mt-1 text-[8px] leading-4 text-zinc-600">
                      {automationBlockReason}
                    </div>

                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.045] p-3">

                    <div className="text-[9px] font-semibold text-emerald-300">
                      Automation eligible
                    </div>

                    <div className="mt-1 text-[8px] leading-4 text-zinc-600">
                      No lead-level outreach block is currently present.
                    </div>

                  </div>
                )}

              </>
            ) : (
              <>

                <div className="rounded-xl border border-white/[0.055] bg-black/15 p-4">

                  <div className="text-[10px] font-semibold text-zinc-300">
                    Prospect only
                  </div>

                  <p className="mt-1 text-[9px] leading-4 text-zinc-600">
                    Add this carrier to Leads before starting sales outreach or onboarding.
                  </p>

                </div>

                <form
                  action={
                    addToLeads
                  }
                >
                  <button
                    type="submit"
                    className="mt-3 inline-flex h-9 items-center rounded-lg bg-white px-4 text-[9px] font-semibold text-black hover:bg-zinc-200"
                  >
                    + Add to Leads
                  </button>
                </form>

              </>
            )}

          </Panel>


          <Panel
            title="Onboarding"
            subtitle="Conversion, documents and broker-packet readiness."
            action={
              onboarding ? (
                <Link
                  href={`/admin/onboarding/${onboarding.id}/documents`}
                  className="text-[9px] font-medium text-violet-400 hover:text-violet-300"
                >
                  Vault →
                </Link>
              ) : null
            }
          >

            {onboarding ? (
              <>

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

                <InfoRow
                  label="Insurance"
                  value={
                    show(
                      onboarding.insurance_company,
                    )
                  }
                />

                <InfoRow
                  label="Factoring"
                  value={
                    show(
                      onboarding.factoring_company,
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
                      Missing
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

              </>
            ) : (
              <>

                <div className="rounded-xl border border-white/[0.055] bg-black/15 p-4">

                  <div className="text-[10px] font-semibold text-zinc-300">
                    Not onboarded
                  </div>

                  <p className="mt-1 text-[9px] leading-4 text-zinc-600">
                    {onboardingEligible
                      ? "The linked Lead is eligible to enter the onboarding workflow."
                      : existingLead
                        ? "Move the Lead to Interested, Follow Up, Meeting or Client before onboarding."
                        : "Create a Lead before starting onboarding."}
                  </p>

                </div>


                {onboardingEligible &&
                existingLead ? (
                  <Link
                    href={`/admin/onboarding/new?lead=${existingLead.id}`}
                    className="mt-3 inline-flex h-9 items-center rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-3 text-[9px] font-semibold text-emerald-300 hover:bg-emerald-500/[0.11]"
                  >
                    Start onboarding
                  </Link>
                ) : null}

              </>
            )}

          </Panel>

        </aside>


        {/* MAIN */}

        <main className="min-w-0 space-y-5">

          {/* FMCSA / AUTHORITY */}

          <Panel
            title="FMCSA intelligence"
            subtitle="Registration, authority, safety and operating profile."
          >

            <div className="grid gap-x-8 lg:grid-cols-2">

              <InfoRow
                label="USDOT"
                value={
                  carrier.dot_number
                }
              />

              <InfoRow
                label="MC"
                value={
                  show(
                    carrier.mc_number,
                  )
                }
              />

              <InfoRow
                label="MX"
                value={
                  show(
                    carrier.mx_number,
                  )
                }
              />

              <InfoRow
                label="FF"
                value={
                  show(
                    carrier.ff_number,
                  )
                }
              />

              <InfoRow
                label="Entity"
                value={
                  show(
                    carrier.entity_type,
                  )
                }
              />

              <InfoRow
                label="Classification"
                value={
                  show(
                    carrier.classification,
                  )
                }
              />

              <InfoRow
                label="Operation"
                value={
                  show(
                    carrier.carrier_operation,
                  )
                }
              />

              <InfoRow
                label="Business type"
                value={
                  show(
                    carrier.business_type,
                  )
                }
              />

              <InfoRow
                label="Equipment"
                value={
                  show(
                    carrier.equipment,
                  )
                }
              />

              <InfoRow
                label="Hazmat"
                value={
                  carrier.hazmat
                    ? "Yes"
                    : "No"
                }
              />

            </div>

          </Panel>


          <Panel
            title="Operating authority"
            subtitle="MOTUS authority enrichment and operating history."
          >

            <div className="grid gap-x-8 lg:grid-cols-2">

              <InfoRow
                label="Status"
                value={
                  prettyStatus(
                    carrier.authority_status,
                  )
                }
              />

              <InfoRow
                label="Type"
                value={
                  show(
                    carrier.authority_type,
                  )
                }
              />

              <InfoRow
                label="Docket"
                value={
                  show(
                    carrier.authority_docket,
                  )
                }
              />

              <InfoRow
                label="Authority date"
                value={
                  formatDateOnly(
                    carrier.authority_date,
                  )
                }
              />

              <InfoRow
                label="Authority age"
                value={
                  carrier.authority_age !==
                    null &&
                  carrier.authority_age !==
                    undefined
                    ? `${carrier.authority_age} years`
                    : "—"
                }
              />

              <InfoRow
                label="Age days"
                value={
                  carrier.authority_age_days !==
                    null &&
                  carrier.authority_age_days !==
                    undefined
                    ? `${carrier.authority_age_days.toLocaleString()} days`
                    : "—"
                }
              />

              <InfoRow
                label="Event date"
                value={
                  formatDateOnly(
                    carrier.motus_authority_event_date,
                  )
                }
              />

              <InfoRow
                label="Enriched"
                value={
                  formatDate(
                    carrier.authority_enriched_at,
                  )
                }
              />

            </div>


            {carrier.authority_reason ||
            carrier.motus_authority_reason ? (
              <div className="mt-4 rounded-xl border border-white/[0.055] bg-black/15 p-4">

                <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                  Authority intelligence
                </div>

                <p className="mt-2 text-[10px] leading-5 text-zinc-500">
                  {carrier.authority_reason ||
                    carrier.motus_authority_reason}
                </p>

              </div>
            ) : null}

          </Panel>


          {/* FLEET */}

          <Panel
            title="Fleet & operating capacity"
            subtitle="Current FMCSA fleet and driver footprint."
          >

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">

              <MetricCard
                label="Power Units"
                value={
                  (
                    carrier.power_units ??
                    0
                  ).toLocaleString()
                }
              />

              <MetricCard
                label="Truck Units"
                value={
                  (
                    carrier.truck_units ??
                    0
                  ).toLocaleString()
                }
              />

              <MetricCard
                label="Bus Units"
                value={
                  (
                    carrier.bus_units ??
                    0
                  ).toLocaleString()
                }
              />

              <MetricCard
                label="Drivers"
                value={
                  (
                    carrier.drivers ??
                    0
                  ).toLocaleString()
                }
              />

              <MetricCard
                label="CDL Drivers"
                value={
                  (
                    carrier.total_cdl ??
                    0
                  ).toLocaleString()
                }
              />

            </div>

          </Panel>


          {/* CARGO */}

          <Panel
            title="Cargo profile"
            subtitle="FMCSA cargo categories associated with this carrier."
          >

            {cargo.length >
            0 ? (
              <div className="flex flex-wrap gap-2">

                {cargo.map(
                  (
                    item,
                    index,
                  ) => (
                    <span
                      key={`${item}-${index}`}
                      className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[9px] capitalize text-zinc-400"
                    >
                      {String(
                        item,
                      )
                        .replace(
                          /^other:/,
                          "Other: ",
                        )
                        .replace(
                          /_/g,
                          " ",
                        )}
                    </span>
                  ),
                )}

              </div>
            ) : (
              <div className="text-[10px] text-zinc-600">
                No cargo information available.
              </div>
            )}

          </Panel>


          {/* SAFETY */}

          <Panel
            title="Safety & FMCSA activity"
            subtitle="Safety rating and regulatory update history."
          >

            <div className="grid gap-x-8 lg:grid-cols-2">

              <InfoRow
                label="Safety rating"
                value={
                  carrier.safety_rating ||
                  "Not Rated"
                }
              />

              <InfoRow
                label="Rating date"
                value={
                  formatDateOnly(
                    carrier.safety_rating_date,
                  )
                }
              />

              <InfoRow
                label="Review date"
                value={
                  formatDateOnly(
                    carrier.review_date,
                  )
                }
              />

              <InfoRow
                label="MCS-150"
                value={
                  formatDateOnly(
                    carrier.mcs150_date,
                  )
                }
              />

              <InfoRow
                label="FMCSA add date"
                value={
                  formatDateOnly(
                    carrier.add_date,
                  )
                }
              />

              <InfoRow
                label="Last sync"
                value={
                  formatDate(
                    carrier.last_fmcsa_sync,
                  )
                }
              />

            </div>

          </Panel>


          {/* SALES / SEQUENCE */}

          {existingLead ? (
            <Panel
              title="Sales & outreach"
              subtitle="Current Lead, sequence, reply and task state."
              action={
                <Link
                  href={`/admin/leads/${existingLead.id}`}
                  className="text-[9px] font-medium text-emerald-400 hover:text-emerald-300"
                >
                  Open Lead 360 →
                </Link>
              }
            >

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

                <div className="rounded-xl border border-white/[0.06] bg-black/15 p-4">

                  <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                    Pipeline
                  </div>

                  <div className="mt-3">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${leadStatusClasses(
                        existingLead.status,
                      )}`}
                    >
                      {prettyStatus(
                        existingLead.status,
                      )}
                    </span>
                  </div>

                </div>


                <div className="rounded-xl border border-white/[0.06] bg-black/15 p-4">

                  <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                    Sequence
                  </div>

                  <div className="mt-3">

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${sequenceClasses(
                        enrollment?.status,
                      )}`}
                    >
                      {enrollment
                        ? prettyStatus(
                            enrollment.status,
                          )
                        : "Not Enrolled"}
                    </span>

                  </div>

                  {enrollment ? (
                    <div className="mt-2 text-[8px] text-zinc-700">
                      Step{" "}
                      {enrollment.current_step}
                      {" • "}
                      Next{" "}
                      {formatDate(
                        enrollment.next_send_at,
                      )}
                    </div>
                  ) : null}

                </div>


                <div className="rounded-xl border border-white/[0.06] bg-black/15 p-4">

                  <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                    Replies
                  </div>

                  <div
                    className={`mt-3 text-[18px] font-semibold ${
                      existingLead.has_replied
                        ? "text-emerald-300"
                        : "text-zinc-300"
                    }`}
                  >
                    {existingLead.reply_count ??
                      0}
                  </div>

                  <div className="mt-1 text-[8px] text-zinc-700">
                    {prettyStatus(
                      existingLead.last_reply_classification,
                    )}
                  </div>

                </div>


                <div className="rounded-xl border border-white/[0.06] bg-black/15 p-4">

                  <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                    Open Tasks
                  </div>

                  <div className="mt-3 text-[18px] font-semibold text-zinc-200">
                    {openTasks.length}
                  </div>

                  <div className="mt-1 text-[8px] text-zinc-700">
                    {nextTask
                      ? `Next: ${nextTask.title}`
                      : "No pending action"}
                  </div>

                </div>

              </div>


              {nextTask ? (
                <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                    <div>

                      <div className="flex flex-wrap gap-2">

                        <span
                          className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold ${priorityClasses(
                            nextTask.priority,
                          )}`}
                        >
                          {prettyStatus(
                            nextTask.priority,
                          )}
                        </span>

                        <span className="rounded-full border border-white/[0.07] px-2 py-0.5 text-[8px] text-zinc-500">
                          {prettyStatus(
                            nextTask.task_type,
                          )}
                        </span>

                      </div>

                      <div className="mt-3 text-[11px] font-semibold text-zinc-300">
                        {nextTask.title}
                      </div>

                      {nextTask.note ? (
                        <p className="mt-1.5 text-[9px] leading-4 text-zinc-600">
                          {nextTask.note}
                        </p>
                      ) : null}

                    </div>

                    <div className="shrink-0 text-[9px] text-zinc-600">
                      {formatDate(
                        nextTask.due_at,
                      )}
                    </div>

                  </div>

                </div>
              ) : null}


              {latestReply ? (
                <div className="mt-4 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.035] p-4">

                  <div className="flex flex-wrap items-center justify-between gap-3">

                    <div>

                      <div className="text-[9px] font-semibold text-emerald-300">
                        Latest carrier reply
                      </div>

                      <div className="mt-1 text-[10px] font-medium text-zinc-300">
                        {latestReply.subject ||
                          "(No subject)"}
                      </div>

                    </div>

                    <div className="text-[8px] text-zinc-600">
                      {formatDate(
                        latestReply.received_at ||
                          latestReply.created_at,
                      )}
                    </div>

                  </div>

                </div>
              ) : latestSend ? (
                <div className="mt-4 rounded-xl border border-blue-500/15 bg-blue-500/[0.03] p-4">

                  <div className="text-[9px] font-semibold text-blue-300">
                    Latest outbound email
                  </div>

                  <div className="mt-1 text-[10px] font-medium text-zinc-300">
                    {latestSend.subject ||
                      "(No subject)"}
                  </div>

                  <div className="mt-1 text-[8px] text-zinc-600">
                    {prettyStatus(
                      latestSend.status,
                    )}
                    {" • "}
                    {formatDate(
                      latestSend.sent_at ||
                        latestSend.created_at,
                    )}
                  </div>

                </div>
              ) : null}

            </Panel>
          ) : null}


          {/* ONBOARDING ECONOMICS */}

          {onboarding ? (
            <Panel
              title="Dispatch relationship"
              subtitle="Commercial and operating preferences captured during onboarding."
            >

              <div className="grid gap-x-8 lg:grid-cols-2">

                <InfoRow
                  label="Fee type"
                  value={
                    prettyStatus(
                      onboarding.dispatch_fee_type,
                    )
                  }
                />

                <InfoRow
                  label="Fee value"
                  value={
                    onboarding.dispatch_fee_value !==
                      null &&
                    onboarding.dispatch_fee_value !==
                      undefined
                      ? String(
                          onboarding.dispatch_fee_value,
                        )
                      : "—"
                  }
                />

                <InfoRow
                  label="Minimum RPM"
                  value={
                    onboarding.minimum_rate_per_mile !==
                      null &&
                    onboarding.minimum_rate_per_mile !==
                      undefined
                      ? `$${onboarding.minimum_rate_per_mile}`
                      : "—"
                  }
                />

                <InfoRow
                  label="Target RPM"
                  value={
                    onboarding.target_rate_per_mile !==
                      null &&
                    onboarding.target_rate_per_mile !==
                      undefined
                      ? `$${onboarding.target_rate_per_mile}`
                      : "—"
                  }
                />

                <InfoRow
                  label="Weekly target"
                  value={
                    onboarding.weekly_revenue_target !==
                      null &&
                    onboarding.weekly_revenue_target !==
                      undefined
                      ? `$${Number(
                          onboarding.weekly_revenue_target,
                        ).toLocaleString()}`
                      : "—"
                  }
                />

                <InfoRow
                  label="Load board"
                  value={
                    onboarding.load_board_provider
                      ? `${onboarding.load_board_provider} • ${prettyStatus(
                          onboarding.load_board_access_status,
                        )}`
                      : prettyStatus(
                          onboarding.load_board_access_status,
                        )
                  }
                />

                <InfoRow
                  label="Insurance expiry"
                  value={
                    formatDateOnly(
                      onboarding.insurance_expiration,
                    )
                  }
                />

                <InfoRow
                  label="Activated"
                  value={
                    formatDate(
                      onboarding.activated_at,
                    )
                  }
                />

              </div>

            </Panel>
          ) : null}


          {/* ACTIVITY */}

          <Panel
            title="Carrier activity"
            subtitle="FMCSA, CRM, email, task and onboarding history."
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
                No carrier activity recorded yet.
              </div>
            )}

          </Panel>


          {/* SOURCE / RECORD */}

          <Panel
            title="Source & record details"
            subtitle="Acquisition and database provenance."
          >

            <div className="grid gap-x-8 lg:grid-cols-2">

              <InfoRow
                label="Acquisition"
                value={
                  carrier.acquisition_source
                    ? prettyStatus(
                        carrier.acquisition_source,
                      )
                    : "FMCSA"
                }
              />

              <InfoRow
                label="First seen"
                value={
                  formatDate(
                    carrier.source_first_seen_at,
                  )
                }
              />

              <InfoRow
                label="Last seen"
                value={
                  formatDate(
                    carrier.source_last_seen_at,
                  )
                }
              />

              <InfoRow
                label="Carrier ID"
                value={
                  carrier.id
                }
              />

              <InfoRow
                label="Created"
                value={
                  formatDate(
                    carrier.created_at,
                  )
                }
              />

              <InfoRow
                label="Updated"
                value={
                  formatDate(
                    carrier.updated_at,
                  )
                }
              />

            </div>


            {carrier.notes ? (
              <div className="mt-4 rounded-xl border border-white/[0.055] bg-black/15 p-4">

                <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                  Carrier notes
                </div>

                <p className="mt-2 whitespace-pre-wrap text-[10px] leading-5 text-zinc-500">
                  {carrier.notes}
                </p>

              </div>
            ) : null}

          </Panel>

        </main>

      </div>

    </div>
  );
}