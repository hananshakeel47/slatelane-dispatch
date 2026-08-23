import Link from "next/link";

import {
  createServerSupabase,
} from "@/lib/supabase/server";


const PAGE_SIZE = 50;


type SearchParams = Record<
  string,
  string | string[] | undefined
>;


type Props = {
  searchParams:
    Promise<SearchParams>;
};


function param(
  params: SearchParams,
  key: string
) {
  const value =
    params[key];

  if (
    Array.isArray(value)
  ) {
    return value[0] ?? "";
  }

  return value ?? "";
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
  maxLength = 180
) {
  if (!text) {
    return "No text preview available.";
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


export default async function RepliesPage({
  searchParams,
}: Props) {
  const params =
    await searchParams;


  const search =
    cleanSearch(
      param(
        params,
        "q"
      )
    );


  const rawPage =
    Number(
      param(
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
  // LOAD REPLIES
  // ==========================================================

  let replyQuery =
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
          created_at
        `,
        {
          count:
            "exact",
        }
      );


  if (search) {
    replyQuery =
      replyQuery.or(
        [
          `from_email.ilike.%${search}%`,
          `subject.ilike.%${search}%`,
          `text_body.ilike.%${search}%`,
        ].join(",")
      );
  }


  const {
    data: replies,
    error:
      repliesError,
    count,
  } =
    await replyQuery
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


  const leadIds =
    [
      ...new Set(
        (
          replies ?? []
        ).map(
          (
            reply
          ) =>
            reply.lead_id
        )
      ),
    ];


  // ==========================================================
  // LOAD MATCHING LEADS
  // ==========================================================

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

        status:
          string | null;

        reply_count:
          number | null;

        last_reply_at:
          string | null;

        carrier_dot_number:
          number | null;
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
        email,
        phone,
        status,
        reply_count,
        last_reply_at,
        carrier_dot_number
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

          <p className="mt-2 max-w-2xl text-zinc-400">
            Carrier responses captured automatically through SlateLane email automation.
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

      <div className="grid gap-4 md:grid-cols-3">

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">

          <div className="text-xs uppercase tracking-wider text-zinc-500">
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

          <div className="text-xs uppercase tracking-wider text-zinc-500">
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

          <div className="text-xs uppercase tracking-wider text-zinc-500">
            Showing
          </div>

          <div className="mt-2 text-3xl font-bold">
            {total.toLocaleString()}
          </div>

        </div>

      </div>


      {/* SEARCH */}

      <form
        method="GET"
        className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
      >

        <div className="flex flex-col gap-3 md:flex-row">

          <input
            type="text"
            name="q"
            defaultValue={
              search
            }
            placeholder="Search sender, subject or reply text..."
            className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none placeholder:text-zinc-600 focus:border-zinc-500"
          />

          <button
            type="submit"
            className="rounded-xl bg-white px-6 py-3 font-semibold text-black hover:bg-zinc-200"
          >
            Search
          </button>

          {search && (

            <Link
              href="/admin/replies"
              className="rounded-xl border border-zinc-700 px-6 py-3 text-center text-zinc-300 hover:bg-zinc-800"
            >
              Clear
            </Link>

          )}

        </div>

      </form>


      {/* ERROR */}

      {repliesError && (

        <div className="rounded-xl border border-red-900 bg-red-950/40 p-5 text-red-300">
          {repliesError.message}
        </div>

      )}


      {/* REPLY LIST */}

      <div className="space-y-4">

        {replies?.map(
          (
            reply
          ) => {

            const lead =
              leadMap.get(
                reply.lead_id
              );


            const leadName =
              lead?.company_name ||
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

                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">

                  <div className="min-w-0 flex-1">

                    <div className="flex flex-wrap items-center gap-3">

                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-800 bg-emerald-950 font-bold text-emerald-300">
                        ↩
                      </div>


                      <div className="min-w-0">

                        <div className="truncate text-lg font-semibold">
                          {leadName}
                        </div>

                        <div className="truncate text-sm text-zinc-500">
                          {reply.from_email}
                        </div>

                      </div>


                      <span className="rounded-full border border-emerald-800 bg-emerald-950 px-3 py-1 text-xs font-semibold text-emerald-300">
                        Replied
                      </span>

                    </div>


                    <div className="mt-5">

                      <div className="font-medium text-zinc-200">
                        {reply.subject ||
                          "(No subject)"}
                      </div>

                      <p className="mt-2 leading-6 text-zinc-400">
                        {previewText(
                          reply.text_body
                        )}
                      </p>

                    </div>


                    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">

                      {lead?.carrier_dot_number && (

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


                      {(reply.attachment_count ??
                        0) >
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

                    </div>

                  </div>


                  <div className="flex shrink-0 flex-col gap-2 xl:items-end">

                    <div className="text-sm text-zinc-400">
                      {formatDate(
                        reply.received_at
                      )}
                    </div>

                    <div className="text-xs font-semibold text-blue-400">
                      Open conversation →
                    </div>

                  </div>

                </div>

              </Link>

            );
          }
        )}


        {!repliesError &&
          (
            replies?.length ??
            0
          ) ===
            0 && (

          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-16 text-center">

            <div className="text-4xl">
              📭
            </div>

            <h2 className="mt-4 text-xl font-semibold">
              No replies found
            </h2>

            <p className="mt-2 text-zinc-500">
              Carrier responses will automatically appear here.
            </p>

          </div>

        )}

      </div>


      {/* PAGINATION */}

      {total > 0 && (

        <div className="flex items-center justify-between">

          {page > 1 ? (

            <Link
              href={`/admin/replies?page=${
                page - 1
              }${
                search
                  ? `&q=${encodeURIComponent(
                      search
                    )}`
                  : ""
              }`}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-2.5"
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
              href={`/admin/replies?page=${
                page + 1
              }${
                search
                  ? `&q=${encodeURIComponent(
                      search
                    )}`
                  : ""
              }`}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-2.5"
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