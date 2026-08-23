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


function getParam(
  params: SearchParams,
  key: string
) {
  const value =
    params[key];

  return Array.isArray(
    value
  )
    ? value[0] ?? ""
    : value ?? "";
}


function cleanSearch(
  value: string
) {
  return value
    .trim()
    .replace(
      /[(),"]/g,
      " "
    )
    .slice(
      0,
      120
    );
}


function previewText(
  text:
    string | null,
  maxLength = 220
) {
  if (!text) {
    return "No reply text available.";
  }

  const cleaned =
    text
      .replace(
        /\s+/g,
        " "
      )
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
  value:
    string | null
) {
  if (!value) {
    return "—";
  }

  return new Date(
    value
  ).toLocaleString();
}


function classificationLabel(
  value:
    string | null
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
  value:
    string | null
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
  value:
    string | null
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


  const handling =
    getParam(
      params,
      "handling"
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
          count:
            "exact",
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
    classification !==
      "all"
  ) {
    query =
      query.eq(
        "classification",
        classification
      );
  }


  if (
    handling ===
    "open"
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
    handling ===
    "handled"
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
        "received_at",
        {
          ascending:
            false,
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
        ).map(
          (
            reply
          ) =>
            reply.lead_id
        )
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

        phone:
          string | null;

        carrier_dot_number:
          number | null;

        status:
          string | null;
      }
    >();


  if (
    leadIds.length >
    0
  ) {
    const {
      data: leads,
    } = await supabase
      .from("leads")
      .select(`
        id,
        company_name,
        name,
        phone,
        carrier_dot_number,
        status
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
  // DASHBOARD COUNTERS
  // ==========================================================

  const {
    count:
      totalReplies,
  } = await supabase
    .from(
      "email_replies"
    )
    .select(
      "id",
      {
        count:
          "exact",

        head:
          true,
      }
    );


  const {
    count:
      repliedLeads,
  } = await supabase
    .from("leads")
    .select(
      "id",
      {
        count:
          "exact",

        head:
          true,
      }
    )
    .eq(
      "has_replied",
      true
    );


  const {
    count:
      openTasks,
  } = await supabase
    .from(
      "email_replies"
    )
    .select(
      "id",
      {
        count:
          "exact",

        head:
          true,
      }
    )
    .eq(
      "requires_attention",
      true
    )
    .eq(
      "handled",
      false
    );


  const {
    count:
      handledCount,
  } = await supabase
    .from(
      "email_replies"
    )
    .select(
      "id",
      {
        count:
          "exact",

        head:
          true,
      }
    )
    .eq(
      "handled",
      true
    );


  const total =
    count ??
    0;


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total /
        PAGE_SIZE
      )
    );


  function pageUrl(
    targetPage:
      number
  ) {
    const params =
      new URLSearchParams();


    params.set(
      "page",
      String(
        targetPage
      )
    );


    if (search) {
      params.set(
        "q",
        search
      );
    }


    if (
      classification
    ) {
      params.set(
        "classification",
        classification
      );
    }


    if (handling) {
      params.set(
        "handling",
        handling
      );
    }


    return `/admin/replies?${params.toString()}`;
  }


  return (
    <div className="space-y-8">

      {/* HEADER */}

      <div className="flex flex-wrap items-end justify-between gap-5">

        <div>

          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
            Sales Inbox
          </div>

          <h1 className="text-4xl font-bold">
            Replies
          </h1>

          <p className="mt-2 text-zinc-400">
            Review carrier replies and move each response through the sales workflow.
          </p>

        </div>


        <Link
          href="/admin/leads"
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold hover:bg-zinc-800"
        >
          View All Leads →
        </Link>

      </div>


      {/* STATS */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">

          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Total Replies
          </div>

          <div className="mt-2 text-3xl font-bold">
            {(
              totalReplies ??
              0
            ).toLocaleString()}
          </div>

        </div>


        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">

          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Replied Leads
          </div>

          <div className="mt-2 text-3xl font-bold text-emerald-300">
            {(
              repliedLeads ??
              0
            ).toLocaleString()}
          </div>

        </div>


        <div className="rounded-2xl border border-amber-900/70 bg-amber-950/20 p-5">

          <div className="text-xs uppercase tracking-wide text-amber-500">
            Open Tasks
          </div>

          <div className="mt-2 text-3xl font-bold text-amber-300">
            {(
              openTasks ??
              0
            ).toLocaleString()}
          </div>

        </div>


        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">

          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Handled
          </div>

          <div className="mt-2 text-3xl font-bold text-blue-300">
            {(
              handledCount ??
              0
            ).toLocaleString()}
          </div>

        </div>

      </div>


      {/* FILTERS */}

      <form
        method="GET"
        className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
      >

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_210px_180px_auto_auto]">

          <input
            type="text"
            name="q"
            defaultValue={
              search
            }
            placeholder="Search sender, subject or reply..."
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none"
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


          <select
            name="handling"
            defaultValue={
              handling ||
              "all"
            }
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
          >

            <option value="all">
              All replies
            </option>

            <option value="open">
              Open tasks
            </option>

            <option value="handled">
              Handled
            </option>

          </select>


          <button
            type="submit"
            className="rounded-xl bg-white px-6 py-3 font-semibold text-black"
          >
            Filter
          </button>


          <Link
            href="/admin/replies"
            className="rounded-xl border border-zinc-700 px-6 py-3 text-center"
          >
            Clear
          </Link>

        </div>

      </form>


      {/* ERROR */}

      {error && (

        <div className="rounded-xl border border-red-900 bg-red-950/40 p-5 text-red-300">
          {error.message}
        </div>

      )}


      {/* REPLY CARDS */}

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

              <div
                key={
                  reply.id
                }
                className="rounded-2xl border border-zinc-800 bg-zinc-900/55 p-6"
              >

                {/* TOP */}

                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">

                  <div className="min-w-0 flex-1">

                    <div className="flex flex-wrap items-center gap-3">

                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-800 bg-emerald-950 text-emerald-300">
                        ↩
                      </div>


                      <div>

                        <div className="text-lg font-semibold">
                          {name}
                        </div>

                        <div className="text-sm text-zinc-500">
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
                          Needs Attention
                        </span>

                      ) : null}

                    </div>


                    {/* MESSAGE */}

                    <div className="mt-5">

                      <div className="font-medium">
                        {reply.subject ||
                          "(No subject)"}
                      </div>

                      <p className="mt-2 leading-6 text-zinc-400">
                        {previewText(
                          reply.text_body
                        )}
                      </p>

                    </div>


                    {/* META */}

                    <div className="mt-5 flex flex-wrap gap-4 text-xs text-zinc-500">

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
                          {
                            lead.phone
                          }
                        </span>

                      )}


                      {reply.classification_confidence !==
                        null && (

                        <span>
                          Confidence{" "}
                          {Math.round(
                            Number(
                              reply.classification_confidence
                            ) *
                              100
                          )}
                          %
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


                  <div className="shrink-0 xl:text-right">

                    <div className="text-sm text-zinc-400">
                      {formatDate(
                        reply.received_at
                      )}
                    </div>

                    <Link
                      href={`/admin/leads/${reply.lead_id}`}
                      className="mt-2 inline-block text-xs font-semibold text-blue-400 hover:text-blue-300"
                    >
                      Open conversation →
                    </Link>

                  </div>

                </div>


                {/* SALES ACTIONS */}

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


                    <div className="flex flex-col gap-3">

                      <input
                        type="text"
                        name="note"
                        placeholder="Optional internal note..."
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none placeholder:text-zinc-600"
                      />


                      <div className="flex flex-wrap gap-2">

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
                          value="interested"
                          className="rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-900"
                        >
                          Interested
                        </button>


                        <button
                          type="submit"
                          name="action"
                          value="call_lead"
                          className="rounded-lg border border-purple-800 bg-purple-950 px-4 py-2 text-sm font-semibold text-purple-300 hover:bg-purple-900"
                        >
                          Call Lead
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

                    </div>

                  </form>

                )}

              </div>

            );
          }
        )}


        {!error &&
          (
            replies?.length ??
            0
          ) ===
            0 && (

          <div className="rounded-2xl border border-dashed border-zinc-800 p-16 text-center">

            <div className="text-4xl">
              📭
            </div>

            <div className="mt-4 text-xl font-semibold">
              No matching replies
            </div>

          </div>

        )}

      </div>


      {/* PAGINATION */}

      {total > 0 && (

        <div className="flex items-center justify-between">

          {page > 1 ? (

            <Link
              href={
                pageUrl(
                  page - 1
                )
              }
              className="rounded-lg border border-zinc-700 px-5 py-3"
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
              className="rounded-lg border border-zinc-700 px-5 py-3"
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