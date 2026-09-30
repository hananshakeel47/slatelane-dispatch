import Link from "next/link";

import {
  revalidatePath,
} from "next/cache";

import {
  createServerSupabase,
} from "@/lib/supabase/server";

import {
  enrollLeadInSequence,
  processEmailEnrollment,
} from "@/lib/email/sequences";

import {
  DEFAULT_SEQUENCE_NAME,
} from "@/lib/email/templates";

export const dynamic =
  "force-dynamic";

const PAGE_SIZE = 50;

const STATUSES = [
  "new",
  "contacted",
  "interested",
  "follow_up",
  "meeting",
  "client",
  "not_interested",
] as const;

type LeadStatus =
  (typeof STATUSES)[number];

type SearchParams =
  Record<
    string,
    string |
      string[] |
      undefined
  >;

type Props = {
  searchParams:
    Promise<SearchParams>;
};

type LeadRow = {
  id: string;
  name:
    string | null;
  company_name:
    string | null;
  email:
    string | null;
  phone:
    string | null;
  carrier_dot_number:
    number | null;
  mc_number:
    string | null;
  source:
    string | null;
  status:
    string | null;

  email_opt_out:
    boolean | null;
  email_bounced:
    boolean | null;
  email_complained:
    boolean | null;

  last_email_sent_at:
    string | null;

  has_replied:
    boolean | null;
  reply_count:
    number | null;
  last_reply_at:
    string | null;
  last_reply_classification:
    string | null;
  reply_requires_attention:
    boolean | null;

  created_at:
    string | null;
  updated_at:
    string | null;
};

type EnrollmentRow = {
  id: string;
  lead_id: string;
  status: string;
  current_step: number;
  next_send_at:
    string | null;
};

function param(
  params:
    SearchParams,

  key: string,
) {
  const value =
    params[key];

  if (
    Array.isArray(
      value,
    )
  ) {
    return (
      value[0] ??
      ""
    );
  }

  return value ?? "";
}

function cleanSearch(
  value: string,
) {
  return value
    .trim()
    .replace(
      /[(),"]/g,
      " ",
    )
    .slice(
      0,
      120,
    );
}

function buildUrl(
  current:
    URLSearchParams,

  changes:
    Record<
      string,
      string |
        number |
        null |
        undefined
    >,
) {
  const next =
    new URLSearchParams(
      current,
    );

  for (
    const [
      key,
      value,
    ] of Object.entries(
      changes,
    )
  ) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      next.delete(
        key,
      );
    } else {
      next.set(
        key,
        String(
          value,
        ),
      );
    }
  }

  const query =
    next.toString();

  return query
    ? `/admin/leads?${query}`
    : "/admin/leads";
}

function prettyStatus(
  value:
    string | null,
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
      (char) =>
        char.toUpperCase(),
    );
}

function statusClass(
  status:
    string | null,
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

function sequenceClass(
  status:
    string | null,
) {
  switch (status) {
    case "active":
      return "border-emerald-500/15 bg-emerald-500/[0.07] text-emerald-300";

    case "completed":
      return "border-blue-500/15 bg-blue-500/[0.07] text-blue-300";

    case "paused":
      return "border-amber-500/15 bg-amber-500/[0.07] text-amber-300";

    case "stopped":
      return "border-red-500/15 bg-red-500/[0.07] text-red-300";

    default:
      return "border-white/[0.07] bg-white/[0.025] text-zinc-500";
  }
}

function classificationClass(
  value:
    string | null,
) {
  switch (value) {
    case "interested":
      return "border-emerald-500/15 bg-emerald-500/[0.07] text-emerald-300";

    case "call_me":
      return "border-violet-500/15 bg-violet-500/[0.07] text-violet-300";

    case "need_rates":
      return "border-blue-500/15 bg-blue-500/[0.07] text-blue-300";

    case "not_interested":
      return "border-red-500/15 bg-red-500/[0.07] text-red-300";

    case "unsubscribe":
      return "border-red-500/15 bg-red-500/[0.07] text-red-300";

    default:
      return "border-white/[0.07] bg-white/[0.025] text-zinc-500";
  }
}

function classificationLabel(
  value:
    string | null,
) {
  if (!value) {
    return "Replied";
  }

  return prettyStatus(
    value,
  );
}

function sourceLabel(
  source:
    string | null,
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

function sourceClass(
  source:
    string | null,
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

function formatDate(
  value:
    string | null |
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
        "America/Chicago",
      month:
        "short",
      day:
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

function initials(
  company:
    string | null,

  contact:
    string | null,
) {
  const value =
    company ||
    contact ||
    "Lead";

  return (
    value
      .trim()
      .split(
        /\s+/,
      )
      .filter(
        Boolean,
      )
      .slice(
        0,
        2,
      )
      .map(
        (part) =>
          part[0],
      )
      .join("")
      .toUpperCase() ||
    "LD"
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="11"
        cy="11"
        r="6"
      />

      <path d="m16 16 4 4" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </svg>
  );
}

export default async function LeadsPage({
  searchParams,
}: Props) {
  const params =
    await searchParams;

  const search =
    cleanSearch(
      param(
        params,
        "q",
      ),
    );

  const status =
    param(
      params,
      "status",
    );

  const source =
    param(
      params,
      "source",
    );

  const reply =
    param(
      params,
      "reply",
    );

  const sequenceFilter =
    param(
      params,
      "sequence",
    );

  const sort =
    param(
      params,
      "sort",
    ) ||
    "recent";

  const carrier =
    param(
      params,
      "carrier",
    );

  const rawPage =
    Number(
      param(
        params,
        "page",
      ),
    );

  const page =
    Number.isFinite(
      rawPage,
    ) &&
    rawPage > 0
      ? Math.floor(
          rawPage,
        )
      : 1;

  const from =
    (page - 1) *
    PAGE_SIZE;

  const to =
    from +
    PAGE_SIZE -
    1;

  /* ==========================================================
     SERVER ACTION: UPDATE STATUS
  ========================================================== */

  async function updateStatus(
    formData:
      FormData,
  ) {
    "use server";

    const id =
      String(
        formData.get(
          "id",
        ) ?? "",
      );

    const newStatus =
      String(
        formData.get(
          "status",
        ) ?? "",
      );

    if (
      !id ||
      !STATUSES.includes(
        newStatus as
          LeadStatus,
      )
    ) {
      return;
    }

    const db =
      createServerSupabase();

    const now =
      new Date()
        .toISOString();

    const {
      error,
    } =
      await db
        .from("leads")
        .update({
          status:
            newStatus,
          updated_at:
            now,
        })
        .eq(
          "id",
          id,
        );

    if (error) {
      throw new Error(
        error.message,
      );
    }

    /*
     * A client or rejected lead
     * must never remain inside
     * an active email sequence.
     */
    if (
      newStatus ===
        "client" ||
      newStatus ===
        "not_interested"
    ) {
      await db
        .from(
          "email_sequence_enrollments",
        )
        .update({
          status:
            "stopped",
          stopped_at:
            now,
          next_send_at:
            null,
          updated_at:
            now,
        })
        .eq(
          "lead_id",
          id,
        )
        .eq(
          "status",
          "active",
        );
    }

    revalidatePath(
      "/admin/leads",
    );

    revalidatePath(
      "/admin/dashboard",
    );
  }

  /* ==========================================================
     SERVER ACTION: START SEQUENCE
  ========================================================== */

  async function startSequence(
    formData:
      FormData,
  ) {
    "use server";

    const leadId =
      String(
        formData.get(
          "lead_id",
        ) ?? "",
      );

    if (!leadId) {
      return;
    }

    const db =
      createServerSupabase();

    /*
     * Re-check safety on the
     * server rather than trusting
     * the button state in the UI.
     */
    const {
      data: lead,
      error:
        leadError,
    } =
      await db
        .from("leads")
        .select(`
          id,
          email,
          status,
          email_opt_out,
          email_bounced,
          email_complained,
          has_replied
        `)
        .eq(
          "id",
          leadId,
        )
        .maybeSingle();

    if (
      leadError ||
      !lead
    ) {
      return;
    }

    const unsafe =
      !lead.email ||
      lead.email_opt_out ||
      lead.email_bounced ||
      lead.email_complained ||
      lead.has_replied ||
      lead.status ===
        "client" ||
      lead.status ===
        "not_interested";

    if (unsafe) {
      return;
    }

    const {
      data:
        existingEnrollment,
    } =
      await db
        .from(
          "email_sequence_enrollments",
        )
        .select(
          "id,status",
        )
        .eq(
          "lead_id",
          leadId,
        )
        .maybeSingle();

    if (
      existingEnrollment
    ) {
      return;
    }

    const {
      data:
        sequence,
      error:
        sequenceError,
    } =
      await db
        .from(
          "email_sequences",
        )
        .select(
          "id",
        )
        .eq(
          "name",
          DEFAULT_SEQUENCE_NAME,
        )
        .eq(
          "active",
          true,
        )
        .maybeSingle();

    if (
      sequenceError ||
      !sequence
    ) {
      throw new Error(
        sequenceError?.message ||
          "Default email sequence not found.",
      );
    }

    const enrollment =
      await enrollLeadInSequence(
        leadId,
        sequence.id,
      );

    /*
     * Step 1 uses delay 0.
     * Existing email safety logic
     * still governs the send.
     */
    if (
      enrollment.status ===
      "active"
    ) {
      await processEmailEnrollment(
        enrollment.id,
      );
    }

    revalidatePath(
      "/admin/leads",
    );

    revalidatePath(
      "/admin/dashboard",
    );
  }

  /* ==========================================================
     LOAD DATA
  ========================================================== */

  const supabase =
    createServerSupabase();

  let leadQuery =
    supabase
      .from("leads")
      .select(
        `
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
          last_reply_classification,
          reply_requires_attention,

          created_at,
          updated_at
        `,
        {
          count:
            "exact",
        },
      );

  if (
    carrier &&
    /^\d+$/.test(
      carrier,
    )
  ) {
    leadQuery =
      leadQuery.eq(
        "carrier_dot_number",
        Number(
          carrier,
        ),
      );
  }

  if (search) {
    if (
      /^\d+$/.test(
        search,
      )
    ) {
      leadQuery =
        leadQuery.or(
          [
            `carrier_dot_number.eq.${Number(
              search,
            )}`,
            `phone.ilike.%${search}%`,
            `mc_number.ilike.%${search}%`,
          ].join(","),
        );
    } else {
      leadQuery =
        leadQuery.or(
          [
            `company_name.ilike.%${search}%`,
            `name.ilike.%${search}%`,
            `email.ilike.%${search}%`,
            `phone.ilike.%${search}%`,
            `mc_number.ilike.%${search}%`,
          ].join(","),
        );
    }
  }

  if (
    status &&
    STATUSES.includes(
      status as
        LeadStatus,
    )
  ) {
    leadQuery =
      leadQuery.eq(
        "status",
        status,
      );
  }

  switch (source) {
    case "fmcsa":
      leadQuery =
        leadQuery.like(
          "source",
          "fmcsa%",
        );
      break;

    case "automated":
      leadQuery =
        leadQuery.in(
          "source",
          [
            "fmcsa_daily_auto",
            "fmcsa_ramp_20",
            "fmcsa_ramp_20_verified_relaunch",
          ],
        );
      break;

    case "pilot":
      leadQuery =
        leadQuery.eq(
          "source",
          "fmcsa_pilot",
        );
      break;

    case "website":
      leadQuery =
        leadQuery.eq(
          "source",
          "website",
        );
      break;

    case "email_test":
      leadQuery =
        leadQuery.eq(
          "source",
          "email_test",
        );
      break;
  }

  switch (reply) {
    case "attention":
      leadQuery =
        leadQuery
          .eq(
            "has_replied",
            true,
          )
          .eq(
            "reply_requires_attention",
            true,
          );
      break;

    case "replied":
      leadQuery =
        leadQuery.eq(
          "has_replied",
          true,
        );
      break;

    case "none":
      leadQuery =
        leadQuery.or(
          "has_replied.is.null,has_replied.eq.false",
        );
      break;
  }

  switch (sort) {
    case "reply":
      leadQuery =
        leadQuery
          .order(
            "last_reply_at",
            {
              ascending:
                false,
              nullsFirst:
                false,
            },
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          );
      break;

    case "company":
      leadQuery =
        leadQuery.order(
          "company_name",
          {
            ascending:
              true,
            nullsFirst:
              false,
          },
        );
      break;

    case "updated":
      leadQuery =
        leadQuery.order(
          "updated_at",
          {
            ascending:
              false,
            nullsFirst:
              false,
          },
        );
      break;

    case "recent":
    default:
      leadQuery =
        leadQuery.order(
          "created_at",
          {
            ascending:
              false,
          },
        );
      break;
  }

  leadQuery =
    leadQuery.range(
      from,
      to,
    );

  /*
   * Run the page query and
   * default-sequence lookup
   * concurrently.
   */
  const [
    leadResult,
    sequenceResult,
  ] =
    await Promise.all([
      leadQuery,

      supabase
        .from(
          "email_sequences",
        )
        .select(
          "id",
        )
        .eq(
          "name",
          DEFAULT_SEQUENCE_NAME,
        )
        .maybeSingle(),
    ]);

  const {
    data:
      leadData,
    error,
    count,
  } = leadResult;

  const leads =
    (leadData ??
      []) as LeadRow[];

  const defaultSequence =
    sequenceResult.data;

  const leadIds =
    leads.map(
      (lead) =>
        lead.id,
    );

  const enrollmentMap =
    new Map<
      string,
      EnrollmentRow
    >();

  /*
   * One enrollment query for
   * all 50 visible leads.
   */
  if (
    leadIds.length >
      0 &&
    defaultSequence
  ) {
    let enrollmentQuery =
      supabase
        .from(
          "email_sequence_enrollments",
        )
        .select(`
          id,
          lead_id,
          status,
          current_step,
          next_send_at
        `)
        .eq(
          "sequence_id",
          defaultSequence.id,
        )
        .in(
          "lead_id",
          leadIds,
        );

    if (
      sequenceFilter ===
      "active"
    ) {
      enrollmentQuery =
        enrollmentQuery.eq(
          "status",
          "active",
        );
    }

    const {
      data:
        enrollments,
    } =
      await enrollmentQuery;

    for (
      const enrollment
      of (
        enrollments ??
        []
      ) as EnrollmentRow[]
    ) {
      enrollmentMap.set(
        enrollment.lead_id,
        enrollment,
      );
    }
  }

  /*
   * Sequence filter needs to be
   * applied to visible leads
   * because sequence data lives
   * in another table.
   */
  const visibleLeads =
    sequenceFilter ===
      "active"
      ? leads.filter(
          (lead) =>
            enrollmentMap.get(
              lead.id,
            )?.status ===
            "active",
        )
      : sequenceFilter ===
          "none"
        ? leads.filter(
            (lead) =>
              !enrollmentMap.has(
                lead.id,
              ),
          )
        : leads;

  const total =
    count ?? 0;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total /
          PAGE_SIZE,
      ),
    );

  const firstResult =
    total === 0
      ? 0
      : from + 1;

  const lastResult =
    Math.min(
      from +
        PAGE_SIZE,
      total,
    );

  const currentParams =
    new URLSearchParams();

  for (
    const [
      key,
      value,
    ] of Object.entries(
      params,
    )
  ) {
    if (
      typeof value ===
      "string"
    ) {
      currentParams.set(
        key,
        value,
      );
    }
  }

  const activeFilterCount =
    [
      search,
      status,
      source,
      reply,
      sequenceFilter,
      carrier,
    ].filter(
      Boolean,
    ).length;

  const repliedOnPage =
    leads.filter(
      (lead) =>
        lead.has_replied,
    ).length;

  const interestedOnPage =
    leads.filter(
      (lead) =>
        lead.status ===
        "interested",
    ).length;

  const safeSequenceOnPage =
    leads.filter(
      (lead) =>
        Boolean(
          lead.email,
        ) &&
        !lead.email_opt_out &&
        !lead.email_bounced &&
        !lead.email_complained &&
        !lead.has_replied &&
        lead.status !==
          "client" &&
        lead.status !==
          "not_interested" &&
        !enrollmentMap.has(
          lead.id,
        ),
    ).length;

  return (
    <div className="space-y-6">

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-[linear-gradient(135deg,rgba(18,23,31,.94),rgba(9,13,18,.95))] px-6 py-6 shadow-[0_18px_60px_rgba(0,0,0,.16)]">

        <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-emerald-500/[0.045] blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
              Revenue Pipeline
            </div>

            <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.045em] text-white md:text-[38px]">
              Lead workspace
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Prioritize carrier conversations,
              manage outreach and move interested
              operators from first touch to client.
            </p>

          </div>

          <div className="flex flex-wrap gap-2">

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">

              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                Matching
              </div>

              <div className="mt-1 text-xl font-semibold text-white">
                {total.toLocaleString()}
              </div>

            </div>

            <Link
              href="/admin/leads?status=interested&sort=reply"
              className="inline-flex h-[54px] items-center rounded-xl bg-white px-5 text-[11px] font-semibold text-black hover:bg-zinc-200"
            >
              Hot opportunities
              <span className="ml-2">
                →
              </span>
            </Link>

          </div>

        </div>

      </section>

      {/* =====================================================
          PAGE SNAPSHOT
      ===================================================== */}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

        <Link
          href="/admin/leads?status=interested&sort=reply"
          className="rounded-[16px] border border-white/[0.07] bg-white/[0.022] p-4 hover:border-emerald-500/20 hover:bg-white/[0.035]"
        >
          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
            Interested
          </div>

          <div className="mt-3 text-2xl font-semibold text-emerald-300">
            {interestedOnPage}
          </div>

          <div className="mt-1 text-[9px] text-zinc-700">
            Visible on this page
          </div>
        </Link>

        <Link
          href="/admin/leads?reply=attention&sort=reply"
          className="rounded-[16px] border border-white/[0.07] bg-white/[0.022] p-4 hover:border-amber-500/20 hover:bg-white/[0.035]"
        >
          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
            Carrier replies
          </div>

          <div className="mt-3 text-2xl font-semibold text-amber-300">
            {repliedOnPage}
          </div>

          <div className="mt-1 text-[9px] text-zinc-700">
            Conversation activity
          </div>
        </Link>

        <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.022] p-4">

          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
            Sequence ready
          </div>

          <div className="mt-3 text-2xl font-semibold text-blue-300">
            {safeSequenceOnPage}
          </div>

          <div className="mt-1 text-[9px] text-zinc-700">
            Safe to enroll on page
          </div>

        </div>

        <Link
          href="/admin/replies?handling=open"
          className="rounded-[16px] border border-white/[0.07] bg-white/[0.022] p-4 hover:border-blue-500/20 hover:bg-white/[0.035]"
        >
          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
            Inbox
          </div>

          <div className="mt-3 text-lg font-semibold text-zinc-200">
            Review replies
          </div>

          <div className="mt-2 text-[9px] text-blue-400">
            Open carrier inbox →
          </div>
        </Link>

      </div>

      {/* =====================================================
          QUICK VIEWS
      ===================================================== */}

      <section className="flex flex-wrap items-center gap-2">

        <span className="mr-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-zinc-600">
          Views
        </span>

        <Link
          href="/admin/leads?status=interested&sort=reply"
          className="rounded-full border border-emerald-500/15 bg-emerald-500/[0.065] px-3 py-1.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/[0.1]"
        >
          Interested
        </Link>

        <Link
          href="/admin/leads?reply=attention&sort=reply"
          className="rounded-full border border-amber-500/15 bg-amber-500/[0.055] px-3 py-1.5 text-[10px] font-medium text-amber-300 hover:bg-amber-500/[0.09]"
        >
          Needs attention
        </Link>

        <Link
          href="/admin/leads?reply=replied&sort=reply"
          className="rounded-full border border-white/[0.075] bg-white/[0.025] px-3 py-1.5 text-[10px] text-zinc-400 hover:bg-white/[0.05]"
        >
          Replied
        </Link>

        <Link
          href="/admin/leads?status=new"
          className="rounded-full border border-white/[0.075] bg-white/[0.025] px-3 py-1.5 text-[10px] text-zinc-400 hover:bg-white/[0.05]"
        >
          New leads
        </Link>

        <Link
          href="/admin/leads?status=client"
          className="rounded-full border border-violet-500/15 bg-violet-500/[0.055] px-3 py-1.5 text-[10px] text-violet-300 hover:bg-violet-500/[0.09]"
        >
          Clients
        </Link>

        <Link
          href="/admin/leads?sequence=active"
          className="rounded-full border border-blue-500/15 bg-blue-500/[0.055] px-3 py-1.5 text-[10px] text-blue-300 hover:bg-blue-500/[0.09]"
        >
          Active sequences
        </Link>

        {activeFilterCount > 0 ? (
          <Link
            href="/admin/leads"
            className="rounded-full border border-white/[0.075] px-3 py-1.5 text-[10px] text-zinc-500 hover:bg-white/[0.035]"
          >
            Clear filters
          </Link>
        ) : null}

      </section>

      {/* =====================================================
          FILTER PANEL
      ===================================================== */}

      <form
        method="GET"
        className="rounded-[18px] border border-white/[0.07] bg-white/[0.022] p-4"
      >

        <div className="mb-4 flex items-center justify-between">

          <div className="flex items-center gap-2">

            <span className="text-zinc-600">
              <FilterIcon />
            </span>

            <div>
              <div className="text-[11px] font-semibold text-zinc-300">
                Pipeline filters
              </div>

              <div className="mt-0.5 text-[9px] text-zinc-700">
                Find the exact conversations that need action.
              </div>
            </div>

          </div>

          {activeFilterCount > 0 ? (
            <span className="rounded-full border border-blue-500/15 bg-blue-500/[0.06] px-2.5 py-1 text-[9px] font-semibold text-blue-300">
              {activeFilterCount} active
            </span>
          ) : null}

        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">

          <div className="relative md:col-span-2 xl:col-span-2">

            <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.11em] text-zinc-600">
              Search
            </label>

            <span className="pointer-events-none absolute bottom-[12px] left-3 text-zinc-600">
              <SearchIcon />
            </span>

            <input
              name="q"
              defaultValue={search}
              placeholder="Company, contact, DOT, MC, email, phone..."
              className="w-full rounded-xl border border-white/[0.08] bg-black/25 py-2.5 pl-10 pr-3 text-[11px] text-zinc-200 outline-none placeholder:text-zinc-700"
            />

          </div>

          <div>

            <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.11em] text-zinc-600">
              Status
            </label>

            <select
              name="status"
              defaultValue={status}
              className="w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-[11px] text-zinc-300 outline-none"
            >
              <option value="">
                All statuses
              </option>

              {STATUSES.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {prettyStatus(item)}
                  </option>
                ),
              )}
            </select>

          </div>

          <div>

            <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.11em] text-zinc-600">
              Source
            </label>

            <select
              name="source"
              defaultValue={source}
              className="w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-[11px] text-zinc-300 outline-none"
            >
              <option value="">
                All sources
              </option>

              <option value="fmcsa">
                All FMCSA
              </option>

              <option value="automated">
                Automated
              </option>

              <option value="pilot">
                Pilot
              </option>

              <option value="website">
                Website
              </option>

              <option value="email_test">
                Test
              </option>
            </select>

          </div>

          <div>

            <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.11em] text-zinc-600">
              Reply
            </label>

            <select
              name="reply"
              defaultValue={reply}
              className="w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-[11px] text-zinc-300 outline-none"
            >
              <option value="">
                Any reply state
              </option>

              <option value="attention">
                Needs attention
              </option>

              <option value="replied">
                Has replied
              </option>

              <option value="none">
                No reply
              </option>
            </select>

          </div>

          <div>

            <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.11em] text-zinc-600">
              Sort
            </label>

            <select
              name="sort"
              defaultValue={sort}
              className="w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-[11px] text-zinc-300 outline-none"
            >
              <option value="recent">
                Newest lead
              </option>

              <option value="reply">
                Latest reply
              </option>

              <option value="updated">
                Recently updated
              </option>

              <option value="company">
                Company name
              </option>
            </select>

          </div>

        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.055] pt-4 sm:flex-row sm:items-center sm:justify-between">

          <div className="text-[9px] text-zinc-700">
            Search and filters are server-side for consistent results.
          </div>

          <div className="flex gap-2">

            <Link
              href="/admin/leads"
              className="inline-flex h-9 items-center rounded-lg border border-white/[0.075] px-3 text-[10px] font-medium text-zinc-500 hover:bg-white/[0.035]"
            >
              Reset
            </Link>

            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-lg bg-white px-4 text-[10px] font-semibold text-black hover:bg-zinc-200"
            >
              Apply filters
            </button>

          </div>

        </div>

      </form>

      {/* =====================================================
          RESULTS
      ===================================================== */}

      <section className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.018]">

        <div className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <h2 className="text-[13px] font-semibold text-zinc-200">
              Sales pipeline
            </h2>

            <p className="mt-1 text-[10px] text-zinc-600">
              Showing{" "}
              <span className="text-zinc-400">
                {firstResult.toLocaleString()}–{lastResult.toLocaleString()}
              </span>{" "}
              of{" "}
              <span className="text-zinc-400">
                {total.toLocaleString()}
              </span>{" "}
              leads
            </p>

          </div>

          <div className="text-[9px] text-zinc-700">
            Page {page} of {totalPages}
          </div>

        </div>

        {error ? (
          <div className="border-b border-red-500/10 bg-red-500/[0.04] px-5 py-4 text-[11px] text-red-300">
            Could not load leads: {error.message}
          </div>
        ) : null}

        {/* DESKTOP */}

        <div className="hidden overflow-x-auto xl:block">

          <table className="min-w-full">

            <thead>

              <tr className="border-b border-white/[0.055]">

                <th className="px-5 py-3 text-left">
                  Lead
                </th>

                <th className="px-4 py-3 text-left">
                  Contact
                </th>

                <th className="px-4 py-3 text-left">
                  Status
                </th>

                <th className="px-4 py-3 text-left">
                  Conversation
                </th>

                <th className="px-4 py-3 text-left">
                  Sequence
                </th>

                <th className="px-4 py-3 text-left">
                  Source
                </th>

                <th className="px-4 py-3 text-left">
                  Actions
                </th>

                <th className="px-5 py-3 text-right">
                  Open
                </th>

              </tr>

            </thead>

            <tbody>

              {visibleLeads.map(
                (lead) => {
                  const enrollment =
                    enrollmentMap.get(
                      lead.id,
                    );

                  const displayName =
                    lead.company_name ||
                    lead.name ||
                    "Unnamed Lead";

                  const unsafe =
                    !lead.email ||
                    Boolean(
                      lead.email_opt_out,
                    ) ||
                    Boolean(
                      lead.email_bounced,
                    ) ||
                    Boolean(
                      lead.email_complained,
                    ) ||
                    Boolean(
                      lead.has_replied,
                    ) ||
                    lead.status ===
                      "client" ||
                    lead.status ===
                      "not_interested";

                  const canStart =
                    !unsafe &&
                    !enrollment;

                  return (
                    <tr
                      key={lead.id}
                      className={`group border-b border-white/[0.045] transition hover:bg-white/[0.018] ${
                        lead.reply_requires_attention
                          ? "bg-amber-500/[0.018]"
                          : ""
                      }`}
                    >

                      <td className="px-5 py-4">

                        <div className="flex min-w-[235px] items-center gap-3">

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.075] bg-white/[0.03] text-[9px] font-bold text-zinc-400">
                            {initials(
                              lead.company_name,
                              lead.name,
                            )}
                          </div>

                          <div className="min-w-0">

                            <Link
                              href={`/admin/leads/${lead.id}`}
                              className="block max-w-[240px] truncate text-[11px] font-semibold text-zinc-200 hover:text-white"
                            >
                              {displayName}
                            </Link>

                            <div className="mt-1 flex items-center gap-2 text-[9px] text-zinc-700">

                              {lead.name &&
                              lead.company_name ? (
                                <>
                                  <span className="max-w-[115px] truncate">
                                    {lead.name}
                                  </span>

                                  <span>
                                    •
                                  </span>
                                </>
                              ) : null}

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

                            </div>

                          </div>

                        </div>

                      </td>

                      <td className="px-4 py-4">

                        <div className="min-w-[185px]">

                          <div className="max-w-[210px] truncate text-[10px] text-zinc-400">
                            {lead.email ||
                              "No email"}
                          </div>

                          <div className="mt-1 text-[9px] text-zinc-700">
                            {lead.phone ||
                              "No phone"}
                          </div>

                          {(lead.email_opt_out ||
                            lead.email_bounced ||
                            lead.email_complained) ? (
                            <div className="mt-2 flex gap-1">

                              {lead.email_opt_out ? (
                                <span className="rounded border border-red-500/15 bg-red-500/[0.06] px-1.5 py-0.5 text-[7px] font-semibold text-red-300">
                                  OPT-OUT
                                </span>
                              ) : null}

                              {lead.email_bounced ? (
                                <span className="rounded border border-red-500/15 bg-red-500/[0.06] px-1.5 py-0.5 text-[7px] font-semibold text-red-300">
                                  BOUNCED
                                </span>
                              ) : null}

                              {lead.email_complained ? (
                                <span className="rounded border border-red-500/15 bg-red-500/[0.06] px-1.5 py-0.5 text-[7px] font-semibold text-red-300">
                                  COMPLAINT
                                </span>
                              ) : null}

                            </div>
                          ) : null}

                        </div>

                      </td>

                      <td className="px-4 py-4">

                        <form action={updateStatus}>

                          <input
                            type="hidden"
                            name="id"
                            value={lead.id}
                          />

                          <select
                            name="status"
                            defaultValue={
                              lead.status ||
                              "new"
                            }
                            aria-label={`Status for ${displayName}`}
                            className={`min-w-[125px] rounded-lg border px-2 py-2 text-[9px] font-semibold outline-none ${statusClass(
                              lead.status,
                            )}`}
                          >
                            {STATUSES.map(
                              (item) => (
                                <option
                                  key={item}
                                  value={item}
                                >
                                  {prettyStatus(
                                    item,
                                  )}
                                </option>
                              ),
                            )}
                          </select>

                          <button
                            type="submit"
                            className="ml-1 rounded-lg border border-white/[0.07] px-2 py-2 text-[8px] text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300"
                          >
                            Save
                          </button>

                        </form>

                      </td>

                      <td className="px-4 py-4">

                        <div className="min-w-[130px]">

                          {lead.has_replied ? (
                            <>
                              <div className="flex flex-wrap items-center gap-1.5">

                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold ${classificationClass(
                                    lead.last_reply_classification,
                                  )}`}
                                >
                                  {classificationLabel(
                                    lead.last_reply_classification,
                                  )}
                                </span>

                                {lead.reply_requires_attention ? (
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,.4)]" />
                                ) : null}

                              </div>

                              <div className="mt-1.5 text-[8px] text-zinc-700">
                                {lead.reply_count ??
                                  1}
                                {" "}
                                reply
                                {(lead.reply_count ??
                                  1) !== 1
                                  ? "ies"
                                  : ""}
                                {" • "}
                                {formatDate(
                                  lead.last_reply_at,
                                )}
                              </div>
                            </>
                          ) : (
                            <span className="text-[9px] text-zinc-700">
                              No reply
                            </span>
                          )}

                        </div>

                      </td>

                      <td className="px-4 py-4">

                        <div className="min-w-[140px]">

                          {enrollment ? (
                            <>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold ${sequenceClass(
                                  enrollment.status,
                                )}`}
                              >
                                {prettyStatus(
                                  enrollment.status,
                                )}
                                {" "}
                                • Step{" "}
                                {enrollment.current_step}
                              </span>

                              <div className="mt-1.5 text-[8px] text-zinc-700">
                                Next:{" "}
                                {formatDate(
                                  enrollment.next_send_at,
                                )}
                              </div>
                            </>
                          ) : (
                            <span className="text-[9px] text-zinc-700">
                              Not enrolled
                            </span>
                          )}

                        </div>

                      </td>

                      <td className="px-4 py-4">

                        <div className="min-w-[90px]">

                          <span
                            className={`rounded-full border px-2 py-1 text-[8px] font-semibold ${sourceClass(
                              lead.source,
                            )}`}
                          >
                            {sourceLabel(
                              lead.source,
                            )}
                          </span>

                          <div className="mt-2 text-[8px] text-zinc-700">
                            {formatDate(
                              lead.created_at,
                            )}
                          </div>

                        </div>

                      </td>

                      <td className="px-4 py-4">

                        <div className="min-w-[110px]">

                          {canStart ? (
                            <form action={startSequence}>

                              <input
                                type="hidden"
                                name="lead_id"
                                value={lead.id}
                              />

                              <button
                                type="submit"
                                className="rounded-lg border border-blue-500/20 bg-blue-500/[0.07] px-2.5 py-2 text-[8px] font-semibold text-blue-300 hover:bg-blue-500/[0.12]"
                              >
                                Start sequence
                              </button>

                            </form>
                          ) : enrollment ? (
                            <span className="text-[8px] text-zinc-600">
                              Sequence tracked
                            </span>
                          ) : lead.has_replied ? (
                            <span className="text-[8px] font-medium text-amber-400">
                              Reply first
                            </span>
                          ) : (
                            <span className="text-[8px] text-zinc-700">
                              Not eligible
                            </span>
                          )}

                        </div>

                      </td>

                      <td className="px-5 py-4 text-right">

                        <Link
                          href={`/admin/leads/${lead.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-zinc-600 transition hover:border-white/[0.13] hover:bg-white/[0.05] hover:text-zinc-200"
                          aria-label={`Open ${displayName}`}
                        >
                          <ArrowIcon />
                        </Link>

                      </td>

                    </tr>
                  );
                },
              )}

            </tbody>

          </table>

        </div>

        {/* TABLET / MOBILE */}

        <div className="divide-y divide-white/[0.05] xl:hidden">

          {visibleLeads.map(
            (lead) => {
              const enrollment =
                enrollmentMap.get(
                  lead.id,
                );

              const displayName =
                lead.company_name ||
                lead.name ||
                "Unnamed Lead";

              const unsafe =
                !lead.email ||
                Boolean(
                  lead.email_opt_out,
                ) ||
                Boolean(
                  lead.email_bounced,
                ) ||
                Boolean(
                  lead.email_complained,
                ) ||
                Boolean(
                  lead.has_replied,
                ) ||
                lead.status ===
                  "client" ||
                lead.status ===
                  "not_interested";

              const canStart =
                !unsafe &&
                !enrollment;

              return (
                <div
                  key={lead.id}
                  className={`p-4 ${
                    lead.reply_requires_attention
                      ? "bg-amber-500/[0.018]"
                      : ""
                  }`}
                >

                  <div className="flex items-start gap-3">

                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.075] bg-white/[0.03] text-[9px] font-bold text-zinc-400"
                    >
                      {initials(
                        lead.company_name,
                        lead.name,
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <Link
                            href={`/admin/leads/${lead.id}`}
                            className="block truncate text-[12px] font-semibold text-zinc-200"
                          >
                            {displayName}
                          </Link>

                          <div className="mt-1 text-[9px] text-zinc-700">
                            DOT{" "}
                            {lead.carrier_dot_number ??
                              "—"}
                            {lead.mc_number
                              ? ` • ${lead.mc_number}`
                              : ""}
                          </div>

                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-semibold ${statusClass(
                            lead.status,
                          )}`}
                        >
                          {prettyStatus(
                            lead.status,
                          )}
                        </span>

                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3">

                        <div>
                          <div className="text-[8px] uppercase tracking-wide text-zinc-700">
                            Contact
                          </div>

                          <div className="mt-1 truncate text-[9px] text-zinc-400">
                            {lead.email ||
                              "No email"}
                          </div>

                          <div className="mt-0.5 text-[9px] text-zinc-600">
                            {lead.phone ||
                              "No phone"}
                          </div>
                        </div>

                        <div>
                          <div className="text-[8px] uppercase tracking-wide text-zinc-700">
                            Sequence
                          </div>

                          <div className="mt-1 text-[9px] text-zinc-400">
                            {enrollment
                              ? `${prettyStatus(
                                  enrollment.status,
                                )} • Step ${enrollment.current_step}`
                              : "Not enrolled"}
                          </div>
                        </div>

                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">

                        <span
                          className={`rounded-full border px-2 py-0.5 text-[8px] ${sourceClass(
                            lead.source,
                          )}`}
                        >
                          {sourceLabel(
                            lead.source,
                          )}
                        </span>

                        {lead.has_replied ? (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[8px] ${classificationClass(
                              lead.last_reply_classification,
                            )}`}
                          >
                            {classificationLabel(
                              lead.last_reply_classification,
                            )}
                          </span>
                        ) : null}

                        {lead.reply_requires_attention ? (
                          <span className="rounded-full border border-amber-500/15 bg-amber-500/[0.07] px-2 py-0.5 text-[8px] text-amber-300">
                            Needs attention
                          </span>
                        ) : null}

                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">

                        <form action={updateStatus}>
                          <input
                            type="hidden"
                            name="id"
                            value={lead.id}
                          />

                          <div className="flex">

                            <select
                              name="status"
                              defaultValue={
                                lead.status ||
                                "new"
                              }
                              className="rounded-l-lg border border-white/[0.08] bg-black/30 px-2 py-2 text-[9px] text-zinc-300 outline-none"
                            >
                              {STATUSES.map(
                                (item) => (
                                  <option
                                    key={item}
                                    value={item}
                                  >
                                    {prettyStatus(
                                      item,
                                    )}
                                  </option>
                                ),
                              )}
                            </select>

                            <button
                              type="submit"
                              className="rounded-r-lg border border-l-0 border-white/[0.08] px-2 py-2 text-[8px] text-zinc-500"
                            >
                              Save
                            </button>

                          </div>
                        </form>

                        {canStart ? (
                          <form action={startSequence}>

                            <input
                              type="hidden"
                              name="lead_id"
                              value={lead.id}
                            />

                            <button
                              type="submit"
                              className="rounded-lg border border-blue-500/20 bg-blue-500/[0.07] px-3 py-2 text-[8px] font-semibold text-blue-300"
                            >
                              Start sequence
                            </button>

                          </form>
                        ) : null}

                        <Link
                          href={`/admin/leads/${lead.id}`}
                          className="inline-flex items-center rounded-lg border border-white/[0.075] px-3 py-2 text-[8px] font-semibold text-zinc-400"
                        >
                          Open →
                        </Link>

                      </div>

                    </div>

                  </div>

                </div>
              );
            },
          )}

        </div>

        {visibleLeads.length ===
        0 ? (
          <div className="px-5 py-16 text-center">

            <div className="text-sm font-semibold text-zinc-300">
              No leads found
            </div>

            <div className="mt-2 text-[11px] text-zinc-600">
              Adjust the pipeline filters or clear your current view.
            </div>

            <Link
              href="/admin/leads"
              className="mt-4 inline-flex rounded-lg border border-white/[0.08] px-3 py-2 text-[10px] font-semibold text-zinc-400 hover:bg-white/[0.035]"
            >
              Clear all filters
            </Link>

          </div>
        ) : null}

      </section>

      {/* =====================================================
          PAGINATION
      ===================================================== */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div className="text-[10px] text-zinc-700">
          Page{" "}
          <span className="text-zinc-500">
            {page}
          </span>{" "}
          of{" "}
          <span className="text-zinc-500">
            {totalPages}
          </span>
        </div>

        <div className="flex items-center gap-2">

          {page > 1 ? (
            <Link
              href={buildUrl(
                currentParams,
                {
                  page:
                    page - 1,
                },
              )}
              className="inline-flex h-9 items-center rounded-lg border border-white/[0.075] bg-white/[0.02] px-3 text-[10px] font-semibold text-zinc-400 hover:bg-white/[0.05]"
            >
              ← Previous
            </Link>
          ) : (
            <span className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-white/[0.045] px-3 text-[10px] text-zinc-800">
              ← Previous
            </span>
          )}

          <span className="inline-flex h-9 min-w-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-[10px] font-semibold text-zinc-500">
            {page}
          </span>

          {page <
          totalPages ? (
            <Link
              href={buildUrl(
                currentParams,
                {
                  page:
                    page + 1,
                },
              )}
              className="inline-flex h-9 items-center rounded-lg border border-white/[0.075] bg-white/[0.02] px-3 text-[10px] font-semibold text-zinc-400 hover:bg-white/[0.05]"
            >
              Next →
            </Link>
          ) : (
            <span className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-white/[0.045] px-3 text-[10px] text-zinc-800">
              Next →
            </span>
          )}

        </div>

      </div>

    </div>
  );
}