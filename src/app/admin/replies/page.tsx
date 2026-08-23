import Link from "next/link";

import {
  createServerSupabase,
} from "@/lib/supabase/server";


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


  const attention =
    getParam(
      params,
      "attention"
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
  // QUERY
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
          classified_at,
          requires_attention
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
    attention ===
    "yes"
  ) {
    query =
      query.eq(
        "requires_attention",
        true
      );
  }


  if (
    attention ===
    "no"
  ) {
    query =
      query.eq(
        "requires_attention",
        false
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
  // STATS
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
      needsAttention,
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
    );


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
    const query =
      new URLSearchParams();


    query.set(
      "page",
      String(
        targetPage
      )
    );


    if (search) {
      query.set(
        "q",
        search
      );
    }


    if (
      classification
    ) {
      query.set(
        "classification",
        classification
      );
    }


    if (attention) {
      query.set(
        "attention",
        attention
      );
    }


    return `/admin/replies?${query.toString()}`;
  }


  return (
    <div className="space-y-8">

      {/* HEADER */}

      <div className="flex flex-wrap items-end justify-between gap-5">

        <div>

          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
            Email Inbox
          </div>

          <h1 className="text-4xl font-bold">
            Replies
          </h1>

          <p className="mt-2 text-zinc-400">
            Carrier responses classified automatically by SlateLane.
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

          <div className="text-xs uppercase text-zinc-500">
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

          <div className="text-xs uppercase text-zinc-500">
            Replied Leads
          </div>

          <div className="mt-2 text-3xl font-bold text-emerald-300">
            {(
              repliedLeads ??
              0
            ).toLocaleString()}
          </div>

        </div>


        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">

          <div className="text-xs uppercase text-zinc-500">
            Needs Attention
          </div>

          <div className="mt-2 text-3xl font-bold text-amber-300">
            {(
              needsAttention ??
              0
            ).toLocaleString()}
          </div>

        </div>


        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">

          <div className="text-xs uppercase text-zinc-500">
            Showing
          </div>

          <div className="mt-2 text-3xl font-bold">
            {total.toLocaleString()}
          </div>

        </div>

      </div>


      {/* FILTERS */}

      <form
        method="GET"
        className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
      >

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_190px_auto_auto]">

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
            name="attention"
            defaultValue={
              attention ||
              "all"
            }
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
          >
            <option value="all">
              All replies
            </option>

            <option value="yes">
              Needs attention
            </option>

            <option value="no">
              No attention needed
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


      {error && (

        <div className="rounded-xl border border-red-900 bg-red-950/40 p-5 text-red-300">
          {error.message}
        </div>

      )}


      {/* REPLIES */}

      <div className="space-y-4">

        {replies?.map(
          (
            reply
          ) => {

            const lead =
              leadMap.get(
                reply.lead_id
              );


            const name =
              lead
                ?.company_name ||
              lead?.name ||
              reply.from_email;


            return (

              <Link
                key={
                  reply.id
                }
                href={`/admin/leads/${reply.lead_id}`}
                className="block rounded-2xl border border-zinc-800 bg-zinc-900/55 p-6 transition hover:border-zinc-700 hover:bg-zinc-900"
              >

                <div className="flex flex-col gap-5 xl:flex-row xl:justify-between">

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


                      {reply.requires_attention && (

                        <span className="rounded-full border border-amber-800 bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-300">
                          Needs Attention
                        </span>

                      )}

                    </div>


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


                      {(reply.attachment_count ??
                        0) >
                        0 && (

                        <span>
                          📎{" "}
                          {
                            reply.attachment_count
                          }
                        </span>

                      )}

                    </div>

                  </div>


                  <div className="shrink-0 xl:text-right">

                    <div className="text-sm text-zinc-400">
                      {formatDate(
                        reply.received_at
                      )}
                    </div>

                    <div className="mt-2 text-xs font-semibold text-blue-400">
                      Open conversation →
                    </div>

                  </div>

                </div>

              </Link>

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