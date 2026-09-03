import Link from "next/link";

import {
  createServerSupabase,
} from "@/lib/supabase/server";

import {
  handleReplyAction,
} from "./actions";


const PAGE_SIZE = 50;


type SearchParams =
  Record<
    string,
    string | string[] | undefined
  >;


type Props = {
  searchParams:
    Promise<SearchParams>;
};


type InboxView =
  | "open"
  | "attention"
  | "handled"
  | "all";


function getParam(
  params: SearchParams,
  key: string
) {
  const value =
    params[key];

  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
}


function cleanSearch(
  value: string
) {
  return value
    .trim()
    .replace(/[(),"]/g, " ")
    .slice(0, 120);
}


function getInboxView(
  value: string
): InboxView {
  if (
    value === "attention" ||
    value === "handled" ||
    value === "all"
  ) {
    return value;
  }

  return "open";
}


function previewText(
  text: string | null,
  maxLength = 260
) {
  if (!text) {
    return "No reply text available.";
  }

  const cleaned =
    text
      .replace(/\s+/g, " ")
      .trim();

  if (
    cleaned.length <=
    maxLength
  ) {
    return cleaned;
  }

  return `${cleaned.slice(
    0,
    maxLength
  )}…`;
}


function formatDate(
  value: string | null
) {
  if (!value) {
    return "—";
  }

  return new Date(
    value
  ).toLocaleString();
}


function classificationLabel(
  value: string | null
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

    case "other":
      return "Other";

    default:
      return "Unclassified";
  }
}


function classificationClasses(
  value: string | null
) {
  switch (value) {
    case "interested":
      return "border-emerald-700 bg-emerald-950 text-emerald-300";

    case "need_rates":
      return "border-blue-700 bg-blue-950 text-blue-300";

    case "call_me":
      return "border-purple-700 bg-purple-950 text-purple-300";

    case "not_interested":
      return "border-red-800 bg-red-950 text-red-300";

    case "wrong_contact":
      return "border-amber-700 bg-amber-950 text-amber-300";

    case "unsubscribe":
      return "border-zinc-600 bg-zinc-800 text-zinc-200";

    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-400";
  }
}


function actionLabel(
  value: string | null
) {
  switch (value) {
    case "handled":
      return "Handled";

    case "call_lead":
      return "Call Lead";

    case "sent_rates":
      return "Sent Rates";

    case "interested":
      return "Interested";

    case "not_interested":
      return "Not Interested";

    case "wrong_contact":
      return "Wrong Contact";

    case "unsubscribe":
      return "Unsubscribed";

    default:
      return "Handled";
  }
}


function viewTitle(
  view: InboxView
) {
  switch (view) {
    case "attention":
      return "Needs Attention";

    case "handled":
      return "Handled Replies";

    case "all":
      return "All Replies";

    default:
      return "Open Replies";
  }
}


export default async function RepliesPage({
  searchParams,
}: Props) {
  const params =
    await searchParams;


  const search =
    cleanSearch(
      getParam(
        params,
        "q"
      )
    );


  const classification =
    getParam(
      params,
      "classification"
    );


  const view =
    getInboxView(
      getParam(
        params,
        "view"
      )
    );


  const rawPage =
    Number(
      getParam(
        params,
        "page"
      )
    );


  const page =
    Number.isFinite(
      rawPage
    ) &&
    rawPage > 0
      ? Math.floor(
          rawPage
        )
      : 1;


  const from =
    (
      page - 1
    ) *
    PAGE_SIZE;


  const to =
    from +
    PAGE_SIZE -
    1;


  const supabase =
    createServerSupabase();


  // ==========================================================
  // REPLIES QUERY
  // ==========================================================

  let query =
    supabase
      .from(
        "email_replies"
      )
      .select(
        `
          id,
          lead_id,
          from_email,
          to_email,
          subject,
          text_body,
          attachment_count,
          received_at,

          classification,
          classification_confidence,
          classification_reason,

          requires_attention,

          handled,
          handled_at,
          handled_action,
          handled_note
        `,
        {
          count: "exact",
        }
      );


  if (search) {
    query =
      query.or(
        [
          `from_email.ilike.%${search}%`,
          `subject.ilike.%${search}%`,
          `text_body.ilike.%${search}%`,
        ].join(",")
      );
  }


  if (
    classification &&
    classification !== "all"
  ) {
    query =
      query.eq(
        "classification",
        classification
      );
  }


  if (
    view === "open"
  ) {
    query =
      query.eq(
        "handled",
        false
      );
  }


  if (
    view === "attention"
  ) {
    query =
      query
        .eq(
          "handled",
          false
        )
        .eq(
          "requires_attention",
          true
        );
  }


  if (
    view === "handled"
  ) {
    query =
      query.eq(
        "handled",
        true
      );
  }


  const {
    data: replies,
    error,
    count,
  } =
    await query
      .order(
        "requires_attention",
        {
          ascending: false,
        }
      )
      .order(
        "received_at",
        {
          ascending: false,
        }
      )
      .range(
        from,
        to
      );


  // ==========================================================
  // LEADS
  // ==========================================================

  const leadIds =
    [
      ...new Set(
        (
          replies ??
          []
        )
          .map(
            (
              reply
            ) =>
              reply.lead_id
          )
          .filter(Boolean)
      ),
    ];


  const leadMap =
    new Map<
      string,
      {
        id: string;

        company_name:
          string | null;

        name:
          string | null;

        email:
          string | null;

        phone:
          string | null;

        carrier_dot_number:
          number | null;

        status:
          string | null;

        has_replied:
          boolean | null;

        reply_requires_attention:
          boolean | null;
      }
    >();


  if (
    leadIds.length > 0
  ) {
    const {
      data: leads,
    } = await supabase
      .from("leads")
      .select(`
        id,
        company_name,
        name,
        email,
        phone,
        carrier_dot_number,
        status,
        has_replied,
        reply_requires_attention
      `)
      .in(
        "id",
        leadIds
      );


    for (
      const lead
      of leads ?? []
    ) {
      leadMap.set(
        lead.id,
        lead
      );
    }
  }


  // ==========================================================
  // INBOX COUNTERS
  // ==========================================================

  const [
    totalResult,
    openResult,
    attentionResult,
    handledResult,
    interestedResult,
    repliedLeadsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "email_replies"
        )
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        ),

      supabase
        .from(
          "email_replies"
        )
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "handled",
          false
        ),

      supabase
        .from(
          "email_replies"
        )
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "handled",
          false
        )
        .eq(
          "requires_attention",
          true
        ),

      supabase
        .from(
          "email_replies"
        )
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "handled",
          true
        ),

      supabase
        .from(
          "email_replies"
        )
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "classification",
          "interested"
        ),

      supabase
        .from(
          "leads"
        )
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "has_replied",
          true
        ),
    ]);


  const totalReplies =
    totalResult.count ??
    0;


  const openReplies =
    openResult.count ??
    0;


  const attentionReplies =
    attentionResult.count ??
    0;


  const handledReplies =
    handledResult.count ??
    0;


  const interestedReplies =
    interestedResult.count ??
    0;


  const repliedLeads =
    repliedLeadsResult.count ??
    0;


  const total =
    count ?? 0;


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total /
        PAGE_SIZE
      )
    );


  function pageUrl(
    targetPage: number
  ) {
    const urlParams =
      new URLSearchParams();


    urlParams.set(
      "page",
      String(
        targetPage
      )
    );


    urlParams.set(
      "view",
      view
    );


    if (search) {
      urlParams.set(
        "q",
        search
      );
    }


    if (
      classification
    ) {
      urlParams.set(
        "classification",
        classification
      );
    }


    return `/admin/replies?${urlParams.toString()}`;
  }


  function viewUrl(
    targetView: InboxView
  ) {
    const urlParams =
      new URLSearchParams();


    urlParams.set(
      "view",
      targetView
    );


    if (search) {
      urlParams.set(
        "q",
        search
      );
    }


    if (
      classification
    ) {
      urlParams.set(
        "classification",
        classification
      );
    }


    return `/admin/replies?${urlParams.toString()}`;
  }


  const tabs: Array<{
    key: InboxView;
    label: string;
    count: number;
  }> = [
    {
      key: "open",
      label: "Open",
      count: openReplies,
    },
    {
      key: "attention",
      label: "Needs Attention",
      count: attentionReplies,
    },
    {
      key: "handled",
      label: "Handled",
      count: handledReplies,
    },
    {
      key: "all",
      label: "All Replies",
      count: totalReplies,
    },
  ];


  return (
    <div className="space-y-7">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-wrap items-end justify-between gap-5">

        <div>

          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
            Phase 026D · First Client Operations
          </div>

          <h1 className="text-4xl font-bold">
            First Client Inbox
          </h1>

          <p className="mt-2 max-w-3xl text-zinc-400">
            Every carrier response enters this sales inbox.
            Review the reply, decide the next action and keep
            replied leads safely outside automated outreach.
          </p>

        </div>


        <div className="flex flex-wrap gap-3">

          <Link
            href="/admin/tasks"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold hover:bg-zinc-800"
          >
            Follow-up Tasks →
          </Link>

          <Link
            href="/admin/leads"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold hover:bg-zinc-800"
          >
            All Leads →
          </Link>

        </div>

      </div>


      {/* ======================================================
          PROTECTION BANNER
      ====================================================== */}

      <div className="rounded-2xl border border-emerald-900/70 bg-emerald-950/20 px-5 py-4">

        <div className="flex flex-wrap items-center justify-between gap-3">

          <div>

            <div className="text-sm font-semibold text-emerald-300">
              Reply protection workflow active
            </div>

            <div className="mt-1 text-sm text-zinc-400">
              Inbox actions never restart a stopped sequence.
              Follow-up work is created only after an explicit operator action.
            </div>

          </div>

          <div className="rounded-full border border-emerald-800 bg-emerald-950 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
            Protected
          </div>

        </div>

      </div>


      {/* ======================================================
          KPI CARDS
      ====================================================== */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">

        <div className="rounded-2xl border border-cyan-900/70 bg-cyan-950/20 p-5">

          <div className="text-xs uppercase tracking-wide text-cyan-500">
            Open
          </div>

          <div className="mt-2 text-3xl font-bold text-cyan-300">
            {openReplies.toLocaleString()}
          </div>

          <div className="mt-2 text-xs text-zinc-500">
            Awaiting operator handling
          </div>

        </div>


        <div className="rounded-2xl border border-amber-900/70 bg-amber-950/20 p-5">

          <div className="text-xs uppercase tracking-wide text-amber-500">
            Needs Attention
          </div>

          <div className="mt-2 text-3xl font-bold text-amber-300">
            {attentionReplies.toLocaleString()}
          </div>

          <div className="mt-2 text-xs text-zinc-500">
            Highest priority replies
          </div>

        </div>


        <div className="rounded-2xl border border-emerald-900/70 bg-emerald-950/20 p-5">

          <div className="text-xs uppercase tracking-wide text-emerald-500">
            Interested
          </div>

          <div className="mt-2 text-3xl font-bold text-emerald-300">
            {interestedReplies.toLocaleString()}
          </div>

          <div className="mt-2 text-xs text-zinc-500">
            Potential clients
          </div>

        </div>


        <div className="rounded-2xl border border-blue-900/70 bg-blue-950/20 p-5">

          <div className="text-xs uppercase tracking-wide text-blue-500">
            Handled
          </div>

          <div className="mt-2 text-3xl font-bold text-blue-300">
            {handledReplies.toLocaleString()}
          </div>

          <div className="mt-2 text-xs text-zinc-500">
            Completed inbox work
          </div>

        </div>


        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">

          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Replied Leads
          </div>

          <div className="mt-2 text-3xl font-bold">
            {repliedLeads.toLocaleString()}
          </div>

          <div className="mt-2 text-xs text-zinc-500">
            Unique leads with replies
          </div>

        </div>

      </div>


      {/* ======================================================
          INBOX TABS
      ====================================================== */}

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">

        <div className="flex overflow-x-auto">

          {tabs.map(
            (
              tab
            ) => {

              const active =
                view === tab.key;


              return (

                <Link
                  key={
                    tab.key
                  }
                  href={
                    viewUrl(
                      tab.key
                    )
                  }
                  className={[
                    "flex min-w-max items-center gap-2 border-b-2 px-6 py-4 text-sm font-semibold transition",
                    active
                      ? "border-cyan-400 bg-cyan-950/20 text-cyan-300"
                      : "border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-white",
                  ].join(" ")}
                >

                  <span>
                    {tab.label}
                  </span>

                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-xs",
                      active
                        ? "bg-cyan-900 text-cyan-200"
                        : "bg-zinc-800 text-zinc-400",
                    ].join(" ")}
                  >
                    {tab.count}
                  </span>

                </Link>

              );
            }
          )}

        </div>

      </div>


      {/* ======================================================
          FILTERS
      ====================================================== */}

      <form
        method="GET"
        className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
      >

        <input
          type="hidden"
          name="view"
          value={
            view
          }
        />


        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px_auto_auto]">

          <input
            type="text"
            name="q"
            defaultValue={
              search
            }
            placeholder="Search sender, company, subject or reply..."
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-cyan-700"
          />


          <select
            name="classification"
            defaultValue={
              classification ||
              "all"
            }
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
          >

            <option value="all">
              All classifications
            </option>

            <option value="interested">
              Interested
            </option>

            <option value="need_rates">
              Need Rates
            </option>

            <option value="call_me">
              Call Me
            </option>

            <option value="not_interested">
              Not Interested
            </option>

            <option value="wrong_contact">
              Wrong Contact
            </option>

            <option value="unsubscribe">
              Unsubscribe
            </option>

            <option value="other">
              Other
            </option>

          </select>


          <button
            type="submit"
            className="rounded-xl bg-white px-6 py-3 font-semibold text-black hover:bg-zinc-200"
          >
            Search
          </button>


          <Link
            href={`/admin/replies?view=${view}`}
            className="rounded-xl border border-zinc-700 px-6 py-3 text-center hover:bg-zinc-800"
          >
            Clear
          </Link>

        </div>

      </form>


      {/* ======================================================
          SECTION TITLE
      ====================================================== */}

      <div className="flex flex-wrap items-center justify-between gap-3">

        <div>

          <h2 className="text-2xl font-bold">
            {viewTitle(
              view
            )}
          </h2>

          <div className="mt-1 text-sm text-zinc-500">
            {total.toLocaleString()} matching{" "}
            {total === 1
              ? "reply"
              : "replies"}
          </div>

        </div>

        {attentionReplies > 0 && (
          <Link
            href="/admin/replies?view=attention"
            className="rounded-xl border border-amber-800 bg-amber-950/30 px-4 py-2 text-sm font-semibold text-amber-300"
          >
            ⚠ {attentionReplies} need attention
          </Link>
        )}

      </div>


      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (

        <div className="rounded-xl border border-red-900 bg-red-950/40 p-5 text-red-300">
          {error.message}
        </div>

      )}


      {/* ======================================================
          REPLY CARDS
      ====================================================== */}

      <div className="space-y-5">

        {replies?.map(
          (
            reply
          ) => {

            const lead =
              leadMap.get(
                reply.lead_id
              );


            const name =
              lead?.company_name ||
              lead?.name ||
              reply.from_email;


            return (

              <article
                key={
                  reply.id
                }
                className={[
                  "rounded-2xl border bg-zinc-900/55 p-6",
                  !reply.handled &&
                  reply.requires_attention
                    ? "border-amber-800/80"
                    : "border-zinc-800",
                ].join(" ")}
              >

                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">

                  <div className="min-w-0 flex-1">

                    {/* SENDER */}

                    <div className="flex flex-wrap items-center gap-3">

                      <div
                        className={[
                          "flex h-11 w-11 items-center justify-center rounded-full border font-bold",
                          !reply.handled &&
                          reply.requires_attention
                            ? "border-amber-700 bg-amber-950 text-amber-300"
                            : "border-emerald-800 bg-emerald-950 text-emerald-300",
                        ].join(" ")}
                      >
                        ↩
                      </div>


                      <div className="min-w-0">

                        <div className="truncate text-lg font-semibold">
                          {name}
                        </div>

                        <div className="truncate text-sm text-zinc-500">
                          {reply.from_email}
                        </div>

                      </div>


                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${classificationClasses(
                          reply.classification
                        )}`}
                      >
                        {classificationLabel(
                          reply.classification
                        )}
                      </span>


                      {reply.handled ? (

                        <span className="rounded-full border border-blue-800 bg-blue-950 px-3 py-1 text-xs font-semibold text-blue-300">
                          ✓{" "}
                          {actionLabel(
                            reply.handled_action
                          )}
                        </span>

                      ) : reply.requires_attention ? (

                        <span className="rounded-full border border-amber-800 bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-300">
                          ⚠ Needs Attention
                        </span>

                      ) : (

                        <span className="rounded-full border border-cyan-800 bg-cyan-950 px-3 py-1 text-xs font-semibold text-cyan-300">
                          Open
                        </span>

                      )}

                    </div>


                    {/* MESSAGE */}

                    <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">

                      <div className="font-semibold text-zinc-100">
                        {reply.subject ||
                          "(No subject)"}
                      </div>

                      <p className="mt-3 whitespace-pre-wrap leading-6 text-zinc-300">
                        {previewText(
                          reply.text_body
                        )}
                      </p>

                    </div>


                    {/* METADATA */}

                    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">

                      {lead
                        ?.carrier_dot_number && (

                        <span>
                          DOT{" "}
                          {
                            lead.carrier_dot_number
                          }
                        </span>

                      )}


                      {lead?.phone && (

                        <span>
                          Phone{" "}
                          {
                            lead.phone
                          }
                        </span>

                      )}


                      {lead?.status && (

                        <span>
                          Lead status{" "}
                          {
                            lead.status
                          }
                        </span>

                      )}


                      {reply.classification_confidence !==
                        null && (

                        <span>
                          Classification confidence{" "}
                          {Math.round(
                            Number(
                              reply.classification_confidence
                            ) *
                              100
                          )}
                          %
                        </span>

                      )}


                      {reply.attachment_count >
                        0 && (

                        <span>
                          📎{" "}
                          {
                            reply.attachment_count
                          }{" "}
                          attachment
                          {reply.attachment_count ===
                          1
                            ? ""
                            : "s"}
                        </span>

                      )}


                      {reply.handled_at && (

                        <span>
                          Handled{" "}
                          {formatDate(
                            reply.handled_at
                          )}
                        </span>

                      )}

                    </div>


                    {reply.classification_reason && (

                      <div className="mt-4 text-xs text-zinc-600">
                        Classification reason:{" "}
                        {
                          reply.classification_reason
                        }
                      </div>

                    )}


                    {reply.handled_note && (

                      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-400">

                        <span className="font-semibold text-zinc-300">
                          Internal note:
                        </span>{" "}

                        {
                          reply.handled_note
                        }

                      </div>

                    )}

                  </div>


                  {/* RIGHT SIDE */}

                  <div className="shrink-0 xl:w-52 xl:text-right">

                    <div className="text-xs uppercase tracking-wide text-zinc-600">
                      Received
                    </div>

                    <div className="mt-1 text-sm text-zinc-300">
                      {formatDate(
                        reply.received_at
                      )}
                    </div>

                    <Link
                      href={`/admin/leads/${reply.lead_id}`}
                      className="mt-4 inline-block rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-blue-400 hover:bg-zinc-800 hover:text-blue-300"
                    >
                      Open Lead →
                    </Link>

                  </div>

                </div>


                {/* ==================================================
                    SALES ACTIONS
                ================================================== */}

                {!reply.handled && (

                  <form
                    action={
                      handleReplyAction
                    }
                    className="mt-6 border-t border-zinc-800 pt-5"
                  >

                    <input
                      type="hidden"
                      name="replyId"
                      value={
                        reply.id
                      }
                    />

                    <input
                      type="hidden"
                      name="leadId"
                      value={
                        reply.lead_id
                      }
                    />


                    <div className="mb-4">

                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-400">
                        Operator Action
                      </div>

                      <div className="mt-1 text-sm text-zinc-500">
                        Choose what happened with this carrier response.
                      </div>

                    </div>


                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">

                      <input
                        type="text"
                        name="note"
                        placeholder="Optional internal note..."
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none placeholder:text-zinc-600"
                      />


                      <select
                        name="followUpDelay"
                        defaultValue="24h"
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none"
                      >
                        <option value="1h">
                          Follow up in 1 hour
                        </option>

                        <option value="2h">
                          Follow up in 2 hours
                        </option>

                        <option value="24h">
                          Follow up tomorrow
                        </option>

                        <option value="3d">
                          Follow up in 3 days
                        </option>

                        <option value="7d">
                          Follow up in 1 week
                        </option>
                      </select>

                    </div>


                    <div className="mt-4 flex flex-wrap gap-2">

                      <button
                        type="submit"
                        name="action"
                        value="interested"
                        className="rounded-lg border border-emerald-700 bg-emerald-950 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-900"
                      >
                        ★ Interested
                      </button>


                      <button
                        type="submit"
                        name="action"
                        value="call_lead"
                        className="rounded-lg border border-purple-800 bg-purple-950 px-4 py-2 text-sm font-semibold text-purple-300 hover:bg-purple-900"
                      >
                        ☎ Call Lead
                      </button>


                      <button
                        type="submit"
                        name="action"
                        value="sent_rates"
                        className="rounded-lg border border-blue-800 bg-blue-950 px-4 py-2 text-sm font-semibold text-blue-300 hover:bg-blue-900"
                      >
                        Sent Rates
                      </button>


                      <button
                        type="submit"
                        name="action"
                        value="handled"
                        className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-semibold hover:bg-zinc-700"
                      >
                        ✓ Mark Handled
                      </button>


                      <button
                        type="submit"
                        name="action"
                        value="not_interested"
                        className="rounded-lg border border-red-900 bg-red-950 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-900"
                      >
                        Not Interested
                      </button>


                      <button
                        type="submit"
                        name="action"
                        value="wrong_contact"
                        className="rounded-lg border border-amber-800 bg-amber-950 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-900"
                      >
                        Wrong Contact
                      </button>


                      <button
                        type="submit"
                        name="action"
                        value="unsubscribe"
                        className="rounded-lg border border-zinc-600 bg-black px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
                      >
                        Unsubscribe
                      </button>

                    </div>


                    <div className="mt-4 text-xs text-zinc-600">
                      Interested, Call Lead and Sent Rates create a follow-up task.
                      Negative/unsubscribe actions permanently keep the lead out of automated outreach.
                    </div>

                  </form>

                )}

              </article>

            );
          }
        )}


        {!error &&
          (
            replies?.length ??
            0
          ) === 0 && (

          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 p-16 text-center">

            <div className="text-4xl">
              {view === "open"
                ? "✅"
                : "📭"}
            </div>

            <div className="mt-4 text-xl font-semibold">
              {view === "open"
                ? "Inbox clear"
                : "No matching replies"}
            </div>

            <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-500">
              {view === "open"
                ? "There are currently no replies waiting for operator handling."
                : "Try another inbox tab or clear the current search filters."}
            </p>

            {view !== "all" && (

              <Link
                href="/admin/replies?view=all"
                className="mt-5 inline-block rounded-lg border border-zinc-700 px-5 py-3 text-sm font-semibold hover:bg-zinc-800"
              >
                View reply history
              </Link>

            )}

          </div>

        )}

      </div>


      {/* ======================================================
          PAGINATION
      ====================================================== */}

      {total > 0 && (

        <div className="flex items-center justify-between">

          {page > 1 ? (

            <Link
              href={
                pageUrl(
                  page - 1
                )
              }
              className="rounded-lg border border-zinc-700 px-5 py-3 hover:bg-zinc-800"
            >
              ← Previous
            </Link>

          ) : (
            <div />
          )}


          <div className="text-sm text-zinc-500">
            Page {page} of{" "}
            {totalPages}
          </div>


          {page <
          totalPages ? (

            <Link
              href={
                pageUrl(
                  page + 1
                )
              }
              className="rounded-lg border border-zinc-700 px-5 py-3 hover:bg-zinc-800"
            >
              Next →
            </Link>

          ) : (
            <div />
          )}

        </div>

      )}

    </div>
  );
}