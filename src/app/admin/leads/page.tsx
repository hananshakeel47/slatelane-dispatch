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


const PAGE_SIZE =
  50;


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
    >
) {
  const next =
    new URLSearchParams(
      current
    );


  for (
    const [key, value]
    of Object.entries(
      changes
    )
  ) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      next.delete(key);
    } else {
      next.set(
        key,
        String(value)
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
  status: string
) {
  return status
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      (
        char
      ) =>
        char.toUpperCase()
    );
}


function statusClasses(
  status: string
) {
  switch (
    status
  ) {
    case "client":
      return "border-emerald-700 bg-emerald-950 text-emerald-300";

    case "interested":
    case "meeting":
      return "border-blue-700 bg-blue-950 text-blue-300";

    case "follow_up":
      return "border-amber-700 bg-amber-950 text-amber-300";

    case "contacted":
      return "border-cyan-700 bg-cyan-950 text-cyan-300";

    case "not_interested":
      return "border-red-900 bg-red-950 text-red-300";

    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
  }
}


function sequenceClasses(
  status: string
) {
  switch (
    status
  ) {
    case "active":
      return "border-emerald-800 bg-emerald-950 text-emerald-300";

    case "completed":
      return "border-blue-800 bg-blue-950 text-blue-300";

    case "paused":
      return "border-amber-800 bg-amber-950 text-amber-300";

    case "stopped":
      return "border-red-900 bg-red-950 text-red-300";

    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
  }
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
        "q"
      )
    );


  const status =
    param(
      params,
      "status"
    );


  const source =
    param(
      params,
      "source"
    );


  const carrier =
    param(
      params,
      "carrier"
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


  // ==========================================================
  // UPDATE LEAD STATUS
  // ==========================================================

  async function updateStatus(
    formData:
      FormData
  ) {
    "use server";


    const id =
      String(
        formData.get(
          "id"
        ) ?? ""
      );


    const newStatus =
      String(
        formData.get(
          "status"
        ) ?? ""
      );


    if (
      !id ||
      !STATUSES.includes(
        newStatus as
          LeadStatus
      )
    ) {
      return;
    }


    const db =
      createServerSupabase();


    const {
      error,
    } = await db
      .from("leads")
      .update({
        status:
          newStatus,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        id
      );


    if (error) {
      throw new Error(
        error.message
      );
    }


    /*
     * Stop active sequences when
     * lead becomes a client or says
     * they're not interested.
     */

    if (
      newStatus ===
        "client" ||
      newStatus ===
        "not_interested"
    ) {
      const now =
        new Date()
          .toISOString();


      await db
        .from(
          "email_sequence_enrollments"
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
          id
        )
        .eq(
          "status",
          "active"
        );
    }


    revalidatePath(
      "/admin/leads"
    );
  }


  // ==========================================================
  // START EMAIL SEQUENCE
  // ==========================================================

  async function startSequence(
    formData:
      FormData
  ) {
    "use server";


    const leadId =
      String(
        formData.get(
          "lead_id"
        ) ?? ""
      );


    if (!leadId) {
      return;
    }


    const db =
      createServerSupabase();


    const {
      data: sequence,
      error:
        sequenceError,
    } = await db
      .from(
        "email_sequences"
      )
      .select(
        "id"
      )
      .eq(
        "name",
        DEFAULT_SEQUENCE_NAME
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();


    if (
      sequenceError ||
      !sequence
    ) {
      throw new Error(
        sequenceError?.message ||
        "Default email sequence not found."
      );
    }


    const enrollment =
      await enrollLeadInSequence(
        leadId,
        sequence.id
      );


    /*
     * Step 1 has delay 0,
     * so send it immediately.
     */

    if (
      enrollment.status ===
      "active"
    ) {
      await processEmailEnrollment(
        enrollment.id
      );
    }


    revalidatePath(
      "/admin/leads"
    );
  }


  // ==========================================================
  // LOAD LEADS
  // ==========================================================

  const supabase =
    createServerSupabase();


  let query =
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

          created_at
        `,
        {
          count:
            "exact",
        }
      );


  if (
    carrier &&
    /^\d+$/.test(
      carrier
    )
  ) {
    query =
      query.eq(
        "carrier_dot_number",
        Number(
          carrier
        )
      );
  }


  if (search) {
    if (
      /^\d+$/.test(
        search
      )
    ) {
      query =
        query.or(
          [
            `carrier_dot_number.eq.${Number(
              search
            )}`,
            `phone.ilike.%${search}%`,
            `mc_number.ilike.%${search}%`,
          ].join(",")
        );
    } else {
      query =
        query.or(
          [
            `company_name.ilike.%${search}%`,
            `name.ilike.%${search}%`,
            `email.ilike.%${search}%`,
            `phone.ilike.%${search}%`,
            `mc_number.ilike.%${search}%`,
          ].join(",")
        );
    }
  }


  if (
    status &&
    STATUSES.includes(
      status as
        LeadStatus
    )
  ) {
    query =
      query.eq(
        "status",
        status
      );
  }


  if (
    source ===
      "website" ||
    source ===
      "fmcsa" ||
    source ===
      "email_test"
  ) {
    query =
      query.eq(
        "source",
        source
      );
  }


  query =
    query
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      )
      .range(
        from,
        to
      );


  const {
    data: leads,
    error,
    count,
  } =
    await query;


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


  // ==========================================================
  // DEFAULT SEQUENCE + ENROLLMENTS
  // ==========================================================

  const {
    data:
      defaultSequence,
  } = await supabase
    .from(
      "email_sequences"
    )
    .select(
      "id"
    )
    .eq(
      "name",
      DEFAULT_SEQUENCE_NAME
    )
    .maybeSingle();


  const leadIds =
    (
      leads ?? []
    ).map(
      (
        lead
      ) =>
        lead.id
    );


  const enrollmentMap =
    new Map<
      string,
      {
        id: string;
        status: string;
        current_step: number;
        next_send_at:
          string | null;
      }
    >();


  if (
    leadIds.length >
      0 &&
    defaultSequence
  ) {
    const {
      data:
        enrollments,
    } = await supabase
      .from(
        "email_sequence_enrollments"
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
        defaultSequence.id
      )
      .in(
        "lead_id",
        leadIds
      );


    for (
      const enrollment
      of enrollments ?? []
    ) {
      enrollmentMap.set(
        enrollment.lead_id,
        enrollment
      );
    }
  }


  const currentParams =
    new URLSearchParams();


  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      params
    )
  ) {
    if (
      typeof value ===
      "string"
    ) {
      currentParams.set(
        key,
        value
      );
    }
  }


  return (
    <div className="space-y-8">

      {/* HEADER */}

      <div className="flex flex-wrap items-end justify-between gap-4">

        <div>

          <h1 className="text-4xl font-bold">
            Leads
          </h1>

          <p className="mt-2 text-zinc-400">
            Manage prospects and automated outreach.
          </p>

        </div>


        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3">

          <div className="text-xs uppercase text-zinc-500">
            Matching Leads
          </div>

          <div className="mt-1 text-2xl font-bold">
            {total.toLocaleString()}
          </div>

        </div>

      </div>


      {/* QUICK FILTERS */}

      <div className="flex flex-wrap gap-2">

        {[
          "new",
          "contacted",
          "interested",
          "follow_up",
          "meeting",
          "client",
        ].map(
          (
            item
          ) => (

            <Link
              key={
                item
              }
              href={`/admin/leads?status=${item}`}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm hover:bg-zinc-800"
            >
              {prettyStatus(
                item
              )}
            </Link>

          )
        )}


        <Link
          href="/admin/leads?source=fmcsa"
          className="rounded-lg border border-purple-800 bg-purple-950 px-4 py-2 text-sm text-purple-300"
        >
          🚛 FMCSA
        </Link>


        <Link
          href="/admin/leads"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400"
        >
          Clear
        </Link>

      </div>


      {/* FILTERS */}

      <form
        method="GET"
        className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
      >

        <div className="grid gap-4 lg:grid-cols-4">

          <div className="lg:col-span-2">

            <label className="mb-2 block text-xs uppercase text-zinc-500">
              Search
            </label>

            <input
              name="q"
              defaultValue={
                search
              }
              placeholder="Company, DOT, MC, email, phone..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5"
            />

          </div>


          <div>

            <label className="mb-2 block text-xs uppercase text-zinc-500">
              Status
            </label>

            <select
              name="status"
              defaultValue={
                status
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"
            >

              <option value="">
                All
              </option>

              {STATUSES.map(
                (
                  item
                ) => (

                  <option
                    key={
                      item
                    }
                    value={
                      item
                    }
                  >
                    {prettyStatus(
                      item
                    )}
                  </option>

                )
              )}

            </select>

          </div>


          <div>

            <label className="mb-2 block text-xs uppercase text-zinc-500">
              Source
            </label>

            <select
              name="source"
              defaultValue={
                source
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"
            >

              <option value="">
                All
              </option>

              <option value="fmcsa">
                FMCSA
              </option>

              <option value="website">
                Website
              </option>

            </select>

          </div>

        </div>


        {carrier && (

          <input
            type="hidden"
            name="carrier"
            value={
              carrier
            }
          />

        )}


        <div className="mt-4 flex justify-end">

          <button
            type="submit"
            className="rounded-lg bg-white px-6 py-2.5 font-semibold text-black"
          >
            Apply Filters
          </button>

        </div>

      </form>


      {/* ERROR */}

      {error && (

        <div className="rounded-xl border border-red-800 bg-red-950/50 p-5 text-red-300">
          {error.message}
        </div>

      )}


      {/* TABLE */}

      <div className="overflow-hidden rounded-2xl border border-zinc-800">

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1450px] text-left text-sm">

            <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">

              <tr>

                <th className="px-4 py-4">
                  Company
                </th>

                <th className="px-4 py-4">
                  DOT / MC
                </th>

                <th className="px-4 py-4">
                  Email
                </th>

                <th className="px-4 py-4">
                  Phone
                </th>

                <th className="px-4 py-4">
                  Status
                </th>

                <th className="px-4 py-4">
                  Email Sequence
                </th>

                <th className="px-4 py-4">
                  Last Email
                </th>

              </tr>

            </thead>


            <tbody className="divide-y divide-zinc-800">

              {leads?.map(
                (
                  lead
                ) => {

                  const enrollment =
                    enrollmentMap.get(
                      lead.id
                    );


                  const blocked =
                    lead.email_opt_out ||
                    lead.email_bounced ||
                    lead.email_complained;


                  return (

                    <tr
                      key={
                        lead.id
                      }
                      className="bg-zinc-950 hover:bg-zinc-900/80"
                    >

                      {/* COMPANY */}

                      <td className="max-w-[260px] px-4 py-4">

                        <div className="font-semibold">
                          {lead.company_name ||
                            lead.name ||
                            "Unknown"}
                        </div>


                        {lead.carrier_dot_number && (

                          <Link
                            href={`/admin/carriers/${lead.carrier_dot_number}`}
                            className="mt-1 inline-block text-xs text-blue-400 hover:underline"
                          >
                            View carrier →
                          </Link>

                        )}

                      </td>


                      {/* DOT / MC */}

                      <td className="px-4 py-4 font-mono">

                        <div>
                          {lead.carrier_dot_number
                            ? `DOT ${lead.carrier_dot_number}`
                            : "—"}
                        </div>

                        <div className="text-xs text-zinc-500">
                          {lead.mc_number ||
                            "—"}
                        </div>

                      </td>


                      {/* EMAIL */}

                      <td className="max-w-[250px] px-4 py-4">

                        {lead.email
                          ? (
                            <a
                              href={`mailto:${lead.email}`}
                              className="text-blue-400 hover:underline"
                            >
                              {lead.email}
                            </a>
                          )
                          : "—"}


                        {blocked && (

                          <div className="mt-1 text-xs text-red-400">
                            Email blocked
                          </div>

                        )}

                      </td>


                      {/* PHONE */}

                      <td className="px-4 py-4">

                        {lead.phone ||
                          "—"}

                      </td>


                      {/* STATUS */}

                      <td className="px-4 py-4">

                        <form
                          action={
                            updateStatus
                          }
                          className="flex gap-2"
                        >

                          <input
                            type="hidden"
                            name="id"
                            value={
                              lead.id
                            }
                          />


                          <select
                            name="status"
                            defaultValue={
                              lead.status ||
                              "new"
                            }
                            className={`rounded-lg border px-2 py-2 text-xs ${statusClasses(
                              lead.status ||
                                "new"
                            )}`}
                          >

                            {STATUSES.map(
                              (
                                item
                              ) => (

                                <option
                                  key={
                                    item
                                  }
                                  value={
                                    item
                                  }
                                >
                                  {prettyStatus(
                                    item
                                  )}
                                </option>

                              )
                            )}

                          </select>


                          <button
                            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs"
                          >
                            Save
                          </button>

                        </form>

                      </td>


                      {/* EMAIL SEQUENCE */}

                      <td className="px-4 py-4">

                        {enrollment ? (

                          <div>

                            <span
                              className={`rounded-lg border px-3 py-1.5 text-xs ${sequenceClasses(
                                enrollment.status
                              )}`}
                            >
                              {prettyStatus(
                                enrollment.status
                              )}
                            </span>


                            <div className="mt-2 text-xs text-zinc-500">
                              Step{" "}
                              {
                                enrollment.current_step
                              }
                            </div>


                            {enrollment.next_send_at && (

                              <div className="mt-1 text-xs text-zinc-500">
                                Next:{" "}
                                {new Date(
                                  enrollment.next_send_at
                                ).toLocaleString()}
                              </div>

                            )}

                          </div>

                        ) : !lead.email ? (

                          <span className="text-xs text-zinc-600">
                            No email
                          </span>

                        ) : blocked ? (

                          <span className="text-xs text-red-400">
                            Suppressed
                          </span>

                        ) : (

                          <form
                            action={
                              startSequence
                            }
                          >

                            <input
                              type="hidden"
                              name="lead_id"
                              value={
                                lead.id
                              }
                            />


                            <button
                              type="submit"
                              className="rounded-lg border border-emerald-700 bg-emerald-950 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-900"
                            >
                              ▶ Start Sequence
                            </button>

                          </form>

                        )}

                      </td>


                      {/* LAST EMAIL */}

                      <td className="px-4 py-4 text-zinc-400">

                        {lead.last_email_sent_at
                          ? new Date(
                              lead.last_email_sent_at
                            ).toLocaleString()
                          : "Never"}

                      </td>

                    </tr>

                  );
                }
              )}

            </tbody>

          </table>

        </div>

      </div>


      {/* PAGINATION */}

      {total > 0 && (

        <div className="flex items-center justify-between">

          {page > 1 ? (

            <Link
              href={buildUrl(
                currentParams,
                {
                  page:
                    page - 1,
                }
              )}
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
              href={buildUrl(
                currentParams,
                {
                  page:
                    page + 1,
                }
              )}
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