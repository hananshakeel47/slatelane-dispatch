import Link from "next/link";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;


type LearningStatus = {
  enabled: boolean | null;

  matured_prospects:
    number | null;

  delivered:
    number | null;

  bounced:
    number | null;

  replied:
    number | null;

  positive_replies:
    number | null;

  meetings:
    number | null;

  clients:
    number | null;

  delivery_rate:
    number |
    string |
    null;

  bounce_rate:
    number |
    string |
    null;

  reply_rate:
    number |
    string |
    null;

  positive_reply_rate:
    number |
    string |
    null;

  learning_state:
    string | null;

  positive_replies_needed_to_activate:
    number | null;
};


type Segment = {
  dimension: string;

  segment_value:
    string;

  prospects:
    number;

  delivered:
    number;

  bounced:
    number;

  replied:
    number;

  positive_replies:
    number;

  clients:
    number;

  delivery_rate:
    number | string;

  reply_rate:
    number | string;

  positive_reply_rate:
    number | string;

  learning_state:
    string;

  conversion_boost:
    number;
};


type Opportunity = {
  company_name:
    string | null;

  contact_name:
    string | null;

  email:
    string | null;

  phone:
    string | null;

  lead_status:
    string | null;

  latest_reply_classification:
    string | null;

  open_task_title:
    string | null;

  open_task_priority:
    string | null;

  opportunity_score:
    number | null;
};


function pct(
  value:
    number |
    string |
    null |
    undefined,
) {
  const n =
    Number(
      value ?? 0,
    );

  return `${(
    n * 100
  ).toFixed(1)}%`;
}


function learningClasses(
  state:
    string |
    null |
    undefined,
) {
  if (
    state ===
    "learning_active"
  ) {
    return `
      border-emerald-800
      bg-emerald-950/30
      text-emerald-300
    `;
  }

  return `
    border-amber-800
    bg-amber-950/30
    text-amber-300
  `;
}


export default async function AcquisitionPage() {
  const supabase =
    createAdminSupabase();


  const [
    statusResult,
    segmentResult,
    opportunitiesResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "email_conversion_learning_status",
        )
        .select("*")
        .limit(1)
        .maybeSingle(),

      supabase
        .from(
          "email_acquisition_segment_weights",
        )
        .select(`
          dimension,
          segment_value,
          prospects,
          delivered,
          bounced,
          replied,
          positive_replies,
          clients,
          delivery_rate,
          reply_rate,
          positive_reply_rate,
          learning_state,
          conversion_boost
        `)
        .order(
          "prospects",
          {
            ascending:
              false,
          },
        )
        .limit(50),

      supabase
        .from(
          "first_client_command_center",
        )
        .select(`
          company_name,
          contact_name,
          email,
          phone,
          lead_status,
          latest_reply_classification,
          open_task_title,
          open_task_priority,
          opportunity_score
        `)
        .order(
          "opportunity_score",
          {
            ascending:
              false,
          },
        )
        .limit(15),
    ]);


  if (
    statusResult.error
  ) {
    throw new Error(
      statusResult.error.message,
    );
  }


  if (
    segmentResult.error
  ) {
    throw new Error(
      segmentResult.error.message,
    );
  }


  if (
    opportunitiesResult.error
  ) {
    throw new Error(
      opportunitiesResult.error.message,
    );
  }


  const status =
    statusResult.data as
      LearningStatus |
      null;


  const segments =
    (
      segmentResult.data ??
      []
    ) as Segment[];


  const opportunities =
    (
      opportunitiesResult.data ??
      []
    ) as Opportunity[];


  const visibleSegments =
    segments
      .filter(
        (row) =>
          row.prospects >= 5,
      )
      .slice(
        0,
        20,
      );


  const learningActive =
    status?.learning_state ===
    "learning_active";


  return (
    <div className="space-y-8">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div className="flex flex-wrap items-end justify-between gap-5">

        <div>

          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">
            Phase 029C-D
            {" · "}
            Conversion Optimization
          </div>


          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            First Client Acquisition
          </h1>


          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            SlateLane monitors real
            outreach performance and
            learns which carrier
            segments are most likely
            to respond positively.
          </p>

        </div>


        <div className="flex gap-3">

          <Link
            href="/admin/replies?handling=open"
            className="
              rounded-xl
              border
              border-zinc-700
              bg-zinc-900
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              transition
              hover:bg-zinc-800
            "
          >
            Open Replies
          </Link>


          <Link
            href="/admin/tasks"
            className="
              rounded-xl
              bg-white
              px-4
              py-2.5
              text-sm
              font-semibold
              text-black
              transition
              hover:bg-zinc-200
            "
          >
            Work Tasks →
          </Link>

        </div>

      </div>


      {/* ================================================= */}
      {/* KPI CARDS */}
      {/* ================================================= */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">

        <MetricCard
          label="Matured Prospects"
          value={
            Number(
              status
                ?.matured_prospects ??
              0,
            ).toLocaleString()
          }
          note="Outreach old enough to evaluate"
        />


        <MetricCard
          label="Delivery Rate"
          value={
            pct(
              status
                ?.delivery_rate,
            )
          }
          note={`${Number(
            status?.bounced ??
            0,
          )} bounces`}
        />


        <MetricCard
          label="Reply Rate"
          value={
            pct(
              status
                ?.reply_rate,
            )
          }
          note={`${Number(
            status?.replied ??
            0,
          )} genuine replies`}
        />


        <MetricCard
          label="Positive Replies"
          value={
            Number(
              status
                ?.positive_replies ??
              0,
            ).toLocaleString()
          }
          note="Interested / rates / call"
        />


        <MetricCard
          label="Clients"
          value={
            Number(
              status
                ?.clients ??
              0,
            ).toLocaleString()
          }
          note={`${Number(
            status?.meetings ??
            0,
          )} meetings`}
        />

      </div>


      {/* ================================================= */}
      {/* LEARNING ENGINE */}
      {/* ================================================= */}

      <section
        className={`
          rounded-2xl
          border
          p-6
          ${learningClasses(
            status
              ?.learning_state,
          )}
        `}
      >

        <div className="flex flex-wrap items-center justify-between gap-4">

          <div>

            <div className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">
              Adaptive Learning
              Engine
            </div>


            <div className="mt-2 text-3xl font-bold">

              {learningActive
                ? "LEARNING ACTIVE"
                : "COLD START"}

            </div>

          </div>


          <div className="rounded-full border border-current px-4 py-2 text-xs font-semibold">

            {learningActive
              ? "Conversion Boost Enabled"
              : `${Number(
                  status
                    ?.positive_replies_needed_to_activate ??
                  0,
                )} positive replies needed`}

          </div>

        </div>


        <p className="mt-4 max-w-4xl text-sm leading-6 opacity-90">

          {learningActive
            ? (
              <>
                SlateLane now uses
                real conversion
                history to adjust
                future verification
                and outreach
                priority.
              </>
            )
            : (
              <>
                SlateLane is collecting
                performance data but
                intentionally applies
                no conversion ranking
                boost yet. This protects
                the system from making
                decisions from a very
                small sample.
              </>
            )}

        </p>

      </section>


      {/* ================================================= */}
      {/* PIPELINE */}
      {/* ================================================= */}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-6">

        <div>

          <h2 className="text-xl font-semibold">
            Acquisition Engine
          </h2>


          <p className="mt-1 text-sm text-zinc-500">
            Current automatic first-client pipeline.
          </p>

        </div>


        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">

          <PipelineBox
            number="01"
            title="MOTUS"
            text="Fresh authority"
          />

          <PipelineBox
            number="02"
            title="Priority"
            text="Best prospects"
          />

          <PipelineBox
            number="03"
            title="Verifalia"
            text="Mailbox verified"
          />

          <PipelineBox
            number="04"
            title="Outreach"
            text="4-step sequence"
          />

          <PipelineBox
            number="05"
            title="Reply"
            text="Intent detected"
          />

          <PipelineBox
            number="06"
            title="Convert"
            text="First client"
          />

        </div>

      </section>


      {/* ================================================= */}
      {/* SEGMENT PERFORMANCE */}
      {/* ================================================= */}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-6">

        <div className="flex flex-wrap items-center justify-between gap-4">

          <div>

            <h2 className="text-xl font-semibold">
              Segment Performance
            </h2>


            <p className="mt-1 text-sm text-zinc-500">
              Mature outreach only.
              Recent emails remain
              excluded until they have
              had enough time to reply.
            </p>

          </div>


          <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-semibold text-zinc-400">

            {
              visibleSegments
                .length
            }{" "}
            segments

          </span>

        </div>


        <div className="mt-6 overflow-x-auto">

          <table className="w-full min-w-[950px] text-left text-sm">

            <thead className="text-xs uppercase tracking-wide text-zinc-500">

              <tr className="border-b border-zinc-800">

                <th className="px-3 py-3">
                  Dimension
                </th>

                <th className="px-3 py-3">
                  Segment
                </th>

                <th className="px-3 py-3 text-right">
                  Prospects
                </th>

                <th className="px-3 py-3 text-right">
                  Delivery
                </th>

                <th className="px-3 py-3 text-right">
                  Reply
                </th>

                <th className="px-3 py-3 text-right">
                  Positive
                </th>

                <th className="px-3 py-3 text-right">
                  Clients
                </th>

                <th className="px-3 py-3 text-right">
                  Boost
                </th>

                <th className="px-3 py-3">
                  Learning
                </th>

              </tr>

            </thead>


            <tbody>

              {visibleSegments.map(
                (row) => (

                  <tr
                    key={`${row.dimension}:${row.segment_value}`}
                    className="border-b border-zinc-900"
                  >

                    <td className="px-3 py-3 text-zinc-500">
                      {
                        row.dimension
                      }
                    </td>


                    <td className="px-3 py-3 font-semibold text-white">
                      {
                        row.segment_value
                      }
                    </td>


                    <td className="px-3 py-3 text-right text-zinc-300">
                      {
                        row.prospects
                      }
                    </td>


                    <td className="px-3 py-3 text-right text-zinc-300">
                      {
                        pct(
                          row.delivery_rate,
                        )
                      }
                    </td>


                    <td className="px-3 py-3 text-right text-zinc-300">
                      {
                        pct(
                          row.reply_rate,
                        )
                      }
                    </td>


                    <td className="px-3 py-3 text-right text-zinc-300">
                      {
                        row.positive_replies
                      }
                    </td>


                    <td className="px-3 py-3 text-right text-zinc-300">
                      {
                        row.clients
                      }
                    </td>


                    <td
                      className={`
                        px-3
                        py-3
                        text-right
                        font-bold
                        ${
                          row.conversion_boost >
                          0
                            ? "text-emerald-300"
                            : row.conversion_boost <
                                0
                              ? "text-red-300"
                              : "text-zinc-500"
                        }
                      `}
                    >

                      {row.conversion_boost >
                      0
                        ? "+"
                        : ""}

                      {
                        row.conversion_boost
                      }

                    </td>


                    <td className="px-3 py-3 text-xs text-zinc-500">
                      {
                        row.learning_state
                      }
                    </td>

                  </tr>

                ),
              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* ================================================= */}
      {/* FIRST CLIENT QUEUE */}
      {/* ================================================= */}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-6">

        <div className="flex flex-wrap items-center justify-between gap-4">

          <div>

            <h2 className="text-xl font-semibold">
              First Client Queue
            </h2>


            <p className="mt-1 text-sm text-zinc-500">
              Highest opportunity
              score first.
            </p>

          </div>


          <Link
            href="/admin/tasks"
            className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
          >
            Open all tasks →
          </Link>

        </div>


        <div className="mt-5 space-y-3">

          {opportunities.length ===
          0 ? (

            <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">

              No carrier reply
              requires action right
              now.

            </div>

          ) : (

            opportunities.map(
              (
                row,
                index,
              ) => (

                <div
                  key={`${row.email ?? "lead"}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-black/20 p-4"
                >

                  <div>

                    <div className="font-semibold text-white">

                      {row.company_name ||
                        row.contact_name ||
                        "Carrier"}

                    </div>


                    <div className="mt-1 text-xs text-zinc-500">

                      {row.latest_reply_classification ||
                        "No classified reply"}

                      {" · "}

                      {row.open_task_priority ||
                        "No task"}

                    </div>


                    {row.open_task_title ? (

                      <div className="mt-2 text-sm font-medium text-amber-200">
                        {
                          row.open_task_title
                        }
                      </div>

                    ) : null}

                  </div>


                  <div className="text-right">

                    <div className="text-2xl font-bold text-cyan-300">

                      {
                        Number(
                          row.opportunity_score ??
                          0,
                        )
                      }

                    </div>


                    <div className="text-[10px] uppercase tracking-wide text-zinc-600">
                      Opportunity
                    </div>

                  </div>

                </div>

              ),
            )

          )}

        </div>

      </section>


      {/* ================================================= */}
      {/* FOOTER NOTE */}
      {/* ================================================= */}

      <div className="rounded-2xl border border-blue-900/70 bg-blue-950/20 p-5 text-sm leading-6 text-blue-200">

        <strong>
          029C-D:
        </strong>{" "}

        SlateLane optimizes using
        delivery, genuine replies,
        positive intent, meetings
        and clients. Open/click
        tracking is intentionally
        not used until those events
        are reliably available.

      </div>

    </div>
  );
}


function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/55 p-5">

      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {
          label
        }
      </div>


      <div className="mt-2 text-3xl font-bold text-white">
        {
          value
        }
      </div>


      <div className="mt-2 text-xs text-zinc-600">
        {
          note
        }
      </div>

    </div>
  );
}


function PipelineBox({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">

      <div className="text-[10px] font-bold tracking-[0.18em] text-cyan-500">
        {
          number
        }
      </div>


      <div className="mt-2 font-bold text-white">
        {
          title
        }
      </div>


      <div className="mt-1 text-xs text-zinc-500">
        {
          text
        }
      </div>

    </div>
  );
}