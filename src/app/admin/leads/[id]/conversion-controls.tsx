import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import {
  createServerSupabase,
} from "@/lib/supabase/server";

import {
  advanceLeadConversionAction,
  completeLeadTaskAction,
  startLeadSequenceAction,
  stopLeadSequenceAction,
  updateLeadStatusAction,
} from "./actions";


const BUSINESS_TIMEZONE =
  "America/Chicago";


const STATUSES = [
  "new",
  "contacted",
  "interested",
  "follow_up",
  "meeting",
  "client",
  "not_interested",
] as const;


type Props = {
  leadId:
    string;
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

      hour:
        "numeric",

      minute:
        "2-digit",
    },
  ).format(
    date,
  );
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


function priorityRank(
  value:
    string |
    null,
) {
  switch (value) {
    case "urgent":
      return 0;

    case "high":
      return 1;

    case "normal":
      return 2;

    case "low":
      return 3;

    default:
      return 4;
  }
}


function priorityClasses(
  value:
    string |
    null |
    undefined,
) {
  switch (value) {
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


function pipelineRank(
  status:
    string |
    null,
) {
  switch (status) {
    case "client":
      return 4;

    case "meeting":
      return 3;

    case "follow_up":
      return 2;

    case "interested":
      return 1;

    default:
      return 0;
  }
}


export default async function LeadConversionControls({
  leadId,
}: Props) {
  const supabase =
    createServerSupabase();


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
        carrier_dot_number,
        status,

        email_opt_out,
        email_bounced,
        email_complained,

        has_replied,
        reply_requires_attention
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
    notFound();
  }


  const [
    enrollmentResult,
    taskResult,
    onboardingResult,
  ] =
    await Promise.all([

      supabase
        .from(
          "email_sequence_enrollments",
        )
        .select(`
          id,
          status,
          current_step,
          next_send_at,
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
          title,
          task_type,
          status,
          priority,
          due_at
        `)
        .eq(
          "lead_id",
          lead.id,
        )
        .eq(
          "status",
          "open",
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
          status,
          agreement_status
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
    enrollmentResult.error
  ) {
    console.error(
      "CONVERSION ENROLLMENT ERROR:",
      enrollmentResult.error.message,
    );
  }


  if (
    taskResult.error
  ) {
    console.error(
      "CONVERSION TASK ERROR:",
      taskResult.error.message,
    );
  }


  if (
    onboardingResult.error
  ) {
    console.error(
      "CONVERSION ONBOARDING ERROR:",
      onboardingResult.error.message,
    );
  }


  const enrollment =
    enrollmentResult.data;


  const onboarding =
    onboardingResult.data;


  const openTasks =
    [
      ...(
        taskResult.data ??
        []
      ),
    ].sort(
      (
        a,
        b,
      ) => {
        const priorityDifference =
          priorityRank(
            a.priority,
          ) -
          priorityRank(
            b.priority,
          );


        if (
          priorityDifference !==
          0
        ) {
          return priorityDifference;
        }


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


  let blockReason:
    string |
    null =
      null;


  if (
    !lead.email
  ) {
    blockReason =
      "No email address";
  } else if (
    lead.email_opt_out
  ) {
    blockReason =
      "Unsubscribed";
  } else if (
    lead.email_bounced
  ) {
    blockReason =
      "Email bounced";
  } else if (
    lead.email_complained
  ) {
    blockReason =
      "Spam complaint";
  } else if (
    lead.has_replied
  ) {
    blockReason =
      "Carrier replied";
  } else if (
    [
      "interested",
      "follow_up",
      "meeting",
    ].includes(
      lead.status ??
        "",
    )
  ) {
    blockReason =
      "Human sales workflow active";
  } else if (
    lead.status ===
    "client"
  ) {
    blockReason =
      "Client";
  } else if (
    lead.status ===
    "not_interested"
  ) {
    blockReason =
      "Not interested";
  }


  const canStartSequence =
    !blockReason &&
    !enrollment;


  const canStopSequence =
    enrollment?.status ===
      "active" ||
    enrollment?.status ===
      "paused";


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


  const currentStatus =
    STATUSES.includes(
      lead.status as
        (
          typeof STATUSES
        )[number],
    )
      ? lead.status!
      : "new";


  const displayName =
    lead.company_name ||
    lead.name ||
    lead.email ||
    "Lead";


  const rank =
    pipelineRank(
      lead.status,
    );


  const stages = [
    {
      label:
        "Interested",

      complete:
        rank >= 1,
    },
    {
      label:
        "Follow Up",

      complete:
        rank >= 2,
    },
    {
      label:
        "Meeting",

      complete:
        rank >= 3,
    },
    {
      label:
        "Client",

      complete:
        rank >= 4,
    },
    {
      label:
        "Onboarding",

      complete:
        Boolean(
          onboarding,
        ),
    },
  ];


  return (
    <section className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-[linear-gradient(135deg,rgba(14,19,26,.96),rgba(8,12,17,.97))]">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="flex flex-col gap-4 border-b border-white/[0.055] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">

        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-2">

            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
              Phase 3D · Conversion Pipeline
            </span>


            <span
              className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold ${statusClasses(
                lead.status,
              )}`}
            >
              {prettyStatus(
                lead.status,
              )}
            </span>


            {lead.reply_requires_attention ? (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/[0.07] px-2 py-0.5 text-[8px] font-semibold text-amber-300">
                Reply needs attention
              </span>
            ) : null}

          </div>


          <div className="mt-2 truncate text-[13px] font-semibold text-zinc-200">
            {displayName}
          </div>


          <div className="mt-1 text-[9px] text-zinc-600">
            Move the carrier from reply to qualified client without restarting prospecting automation.
          </div>

        </div>


        <div className="flex flex-wrap gap-2">

          {lead.carrier_dot_number ? (
            <Link
              href={`/admin/carriers/${lead.carrier_dot_number}`}
              className="inline-flex h-8 items-center rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 text-[9px] font-medium text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
            >
              Carrier 360
            </Link>
          ) : null}


          <Link
            href={
              lead.reply_requires_attention
                ? "/admin/replies?view=attention"
                : "/admin/replies?view=open"
            }
            className="inline-flex h-8 items-center rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 text-[9px] font-medium text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
          >
            Inbox
          </Link>


          <Link
            href="/admin/tasks"
            className="inline-flex h-8 items-center rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 text-[9px] font-medium text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
          >
            Tasks
          </Link>


          {onboarding ? (
            <Link
              href={`/admin/onboarding/${onboarding.id}/documents`}
              className="inline-flex h-8 items-center rounded-lg border border-violet-500/15 bg-violet-500/[0.06] px-3 text-[9px] font-medium text-violet-300 hover:bg-violet-500/[0.1]"
            >
              Document Vault
            </Link>
          ) : onboardingEligible ? (
            <Link
              href={`/admin/onboarding/new?lead=${lead.id}`}
              className="inline-flex h-8 items-center rounded-lg border border-emerald-500/15 bg-emerald-500/[0.06] px-3 text-[9px] font-medium text-emerald-300 hover:bg-emerald-500/[0.1]"
            >
              Start Onboarding
            </Link>
          ) : null}

        </div>

      </div>


      {/* =====================================================
          CONVERSION TRACK
      ===================================================== */}

      <div className="border-b border-white/[0.05] px-5 py-5">

        <div className="mb-3 text-[8px] font-semibold uppercase tracking-[0.12em] text-zinc-700">
          Conversion Journey
        </div>


        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">

          {stages.map(
            (
              stage,
              index,
            ) => (
              <div
                key={
                  stage.label
                }
                className={[
                  "relative rounded-xl border px-3 py-3",
                  stage.complete
                    ? "border-emerald-500/20 bg-emerald-500/[0.055]"
                    : "border-white/[0.055] bg-black/15",
                ].join(
                  " ",
                )}
              >

                <div className="flex items-center gap-2">

                  <div
                    className={[
                      "flex h-5 w-5 items-center justify-center rounded-full border text-[8px] font-bold",
                      stage.complete
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                        : "border-white/[0.08] text-zinc-700",
                    ].join(
                      " ",
                    )}
                  >
                    {stage.complete
                      ? "✓"
                      : index + 1}
                  </div>

                  <div
                    className={[
                      "text-[9px] font-semibold",
                      stage.complete
                        ? "text-emerald-300"
                        : "text-zinc-600",
                    ].join(
                      " ",
                    )}
                  >
                    {stage.label}
                  </div>

                </div>

              </div>
            ),
          )}

        </div>

      </div>


      {/* =====================================================
          NEXT CONVERSION ACTION
      ===================================================== */}

      <div className="border-b border-white/[0.05] bg-emerald-500/[0.018] px-5 py-4">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-emerald-500">
              Recommended Next Conversion Action
            </div>


            {lead.status ===
            "not_interested" ? (
              <div className="mt-2 text-[10px] text-red-300">
                Lead is closed as Not Interested. Use the manual status selector only if you intentionally want to reopen it.
              </div>
            ) : lead.status ===
                "client" ? (
              <div className="mt-2 text-[10px] text-zinc-300">
                Carrier has converted to Client. Continue the onboarding workflow.
              </div>
            ) : lead.status ===
                "meeting" ? (
              <div className="mt-2 text-[10px] text-zinc-300">
                Meeting stage reached. Convert the carrier when they agree to use SlateLane.
              </div>
            ) : lead.status ===
                "follow_up" ? (
              <div className="mt-2 text-[10px] text-zinc-300">
                Follow-up stage active. Advance when a meeting is booked.
              </div>
            ) : lead.status ===
                "interested" ? (
              <div className="mt-2 text-[10px] text-zinc-300">
                Carrier is interested. Create the next follow-up responsibility.
              </div>
            ) : (
              <div className="mt-2 text-[10px] text-zinc-300">
                Qualify the carrier as Interested when a real sales opportunity exists.
              </div>
            )}

          </div>


          <div className="shrink-0">

            {lead.status ===
            "not_interested" ? (
              <div className="rounded-lg border border-red-500/15 bg-red-500/[0.04] px-3 py-2 text-[8px] font-semibold text-red-300">
                Closed
              </div>
            ) : lead.status ===
                "client" ? (
              onboarding ? (
                <Link
                  href={`/admin/onboarding/${onboarding.id}/documents`}
                  className="inline-flex h-9 items-center rounded-lg border border-violet-500/20 bg-violet-500/[0.08] px-4 text-[9px] font-semibold text-violet-300 hover:bg-violet-500/[0.13]"
                >
                  Continue Onboarding →
                </Link>
              ) : (
                <Link
                  href={`/admin/onboarding/new?lead=${lead.id}`}
                  className="inline-flex h-9 items-center rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-4 text-[9px] font-semibold text-emerald-300 hover:bg-emerald-500/[0.13]"
                >
                  Start Onboarding →
                </Link>
              )
            ) : lead.status ===
                "meeting" ? (
              <form
                action={
                  advanceLeadConversionAction
                }
              >

                <input
                  type="hidden"
                  name="leadId"
                  value={
                    lead.id
                  }
                />

                <input
                  type="hidden"
                  name="target"
                  value="client"
                />


                <button
                  type="submit"
                  className="inline-flex h-9 items-center rounded-lg bg-emerald-400 px-4 text-[9px] font-bold text-black hover:bg-emerald-300"
                >
                  Convert to Client + Onboard →
                </button>

              </form>
            ) : lead.status ===
                "follow_up" ? (
              <form
                action={
                  advanceLeadConversionAction
                }
              >

                <input
                  type="hidden"
                  name="leadId"
                  value={
                    lead.id
                  }
                />

                <input
                  type="hidden"
                  name="target"
                  value="meeting"
                />


                <button
                  type="submit"
                  className="inline-flex h-9 items-center rounded-lg border border-blue-500/20 bg-blue-500/[0.08] px-4 text-[9px] font-semibold text-blue-300 hover:bg-blue-500/[0.13]"
                >
                  Meeting Booked →
                </button>

              </form>
            ) : lead.status ===
                "interested" ? (
              <form
                action={
                  advanceLeadConversionAction
                }
              >

                <input
                  type="hidden"
                  name="leadId"
                  value={
                    lead.id
                  }
                />

                <input
                  type="hidden"
                  name="target"
                  value="follow_up"
                />


                <button
                  type="submit"
                  className="inline-flex h-9 items-center rounded-lg border border-amber-500/20 bg-amber-500/[0.08] px-4 text-[9px] font-semibold text-amber-300 hover:bg-amber-500/[0.13]"
                >
                  Follow Up in 24h →
                </button>

              </form>
            ) : (
              <form
                action={
                  advanceLeadConversionAction
                }
              >

                <input
                  type="hidden"
                  name="leadId"
                  value={
                    lead.id
                  }
                />

                <input
                  type="hidden"
                  name="target"
                  value="interested"
                />


                <button
                  type="submit"
                  className="inline-flex h-9 items-center rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-4 text-[9px] font-semibold text-emerald-300 hover:bg-emerald-500/[0.13]"
                >
                  Mark Interested + Follow-up →
                </button>

              </form>
            )}

          </div>

        </div>

      </div>


      {/* =====================================================
          OPERATIONAL CONTROLS
      ===================================================== */}

      <div className="grid gap-3 p-4 xl:grid-cols-[1.05fr_1fr_1.1fr]">

        {/* STATUS */}

        <div className="rounded-[14px] border border-white/[0.06] bg-black/20 p-3">

          <div className="mb-2 text-[8px] font-semibold uppercase tracking-[0.11em] text-zinc-700">
            Manual Pipeline Status
          </div>


          <form
            action={
              updateLeadStatusAction
            }
            className="flex gap-2"
          >

            <input
              type="hidden"
              name="leadId"
              value={
                lead.id
              }
            />


            <select
              name="status"
              defaultValue={
                currentStatus
              }
              className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[9px] text-zinc-300 outline-none"
            >
              {STATUSES.map(
                (
                  status,
                ) => (
                  <option
                    key={
                      status
                    }
                    value={
                      status
                    }
                  >
                    {prettyStatus(
                      status,
                    )}
                  </option>
                ),
              )}
            </select>


            <button
              type="submit"
              className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 text-[9px] font-semibold text-zinc-300 hover:bg-white/[0.07]"
            >
              Save
            </button>

          </form>


          <div className="mt-2 text-[8px] leading-4 text-zinc-700">
            Carrier CRM flags are synchronized when the pipeline status changes.
          </div>

        </div>


        {/* SEQUENCE */}

        <div className="rounded-[14px] border border-white/[0.06] bg-black/20 p-3">

          <div className="flex items-center justify-between gap-2">

            <div className="text-[8px] font-semibold uppercase tracking-[0.11em] text-zinc-700">
              Email Sequence
            </div>


            {enrollment ? (
              <span
                className={`rounded-full border px-2 py-0.5 text-[7px] font-semibold ${sequenceClasses(
                  enrollment.status,
                )}`}
              >
                {prettyStatus(
                  enrollment.status,
                )}
              </span>
            ) : null}

          </div>


          {canStopSequence &&
          enrollment ? (
            <>

              <div className="mt-2 text-[9px] text-zinc-500">
                Step{" "}
                {enrollment.current_step}
                {" • "}
                Next{" "}
                {formatDate(
                  enrollment.next_send_at,
                )}
              </div>


              <form
                action={
                  stopLeadSequenceAction
                }
                className="mt-3"
              >

                <input
                  type="hidden"
                  name="leadId"
                  value={
                    lead.id
                  }
                />

                <input
                  type="hidden"
                  name="enrollmentId"
                  value={
                    enrollment.id
                  }
                />


                <button
                  type="submit"
                  className="inline-flex h-8 items-center rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 text-[8px] font-semibold text-red-300 hover:bg-red-500/[0.1]"
                >
                  Stop Sequence
                </button>

              </form>

            </>
          ) : canStartSequence ? (
            <>

              <div className="mt-2 text-[9px] leading-4 text-emerald-400">
                Eligible for automated prospecting.
              </div>


              <form
                action={
                  startLeadSequenceAction
                }
                className="mt-3"
              >

                <input
                  type="hidden"
                  name="leadId"
                  value={
                    lead.id
                  }
                />


                <button
                  type="submit"
                  className="inline-flex h-8 items-center rounded-lg border border-blue-500/20 bg-blue-500/[0.07] px-3 text-[8px] font-semibold text-blue-300 hover:bg-blue-500/[0.12]"
                >
                  Start Sequence + Send Step 1
                </button>

              </form>

            </>
          ) : enrollment ? (
            <>

              <div className="mt-2 text-[9px] text-zinc-500">
                {enrollment.status ===
                "stopped"
                  ? "Sequence stopped. Automatic restart remains disabled."
                  : enrollment.status ===
                      "completed"
                    ? "Sequence completed. Duplicate enrollment is blocked."
                    : "Sequence is already tracked."}
              </div>

            </>
          ) : (
            <>

              <div className="mt-2 text-[9px] font-medium text-amber-300">
                Prospecting blocked
              </div>

              <div className="mt-1 text-[8px] leading-4 text-zinc-600">
                {blockReason ||
                  "Lead is not eligible for automated outreach."}
              </div>

            </>
          )}

        </div>


        {/* TASK */}

        <div className="rounded-[14px] border border-white/[0.06] bg-black/20 p-3">

          <div className="flex items-center justify-between gap-2">

            <div className="text-[8px] font-semibold uppercase tracking-[0.11em] text-zinc-700">
              Next Sales Task
            </div>

            <Link
              href="/admin/tasks"
              className="text-[8px] text-blue-400 hover:text-blue-300"
            >
              All tasks →
            </Link>

          </div>


          {nextTask ? (
            <>

              <div className="mt-2 flex flex-wrap items-center gap-2">

                <span
                  className={`rounded-full border px-2 py-0.5 text-[7px] font-semibold ${priorityClasses(
                    nextTask.priority,
                  )}`}
                >
                  {prettyStatus(
                    nextTask.priority,
                  )}
                </span>

                <span className="text-[8px] text-zinc-700">
                  {prettyStatus(
                    nextTask.task_type,
                  )}
                </span>

              </div>


              <div className="mt-2 truncate text-[10px] font-medium text-zinc-300">
                {nextTask.title}
              </div>


              <div className="mt-1 text-[8px] text-zinc-700">
                Due{" "}
                {formatDate(
                  nextTask.due_at,
                )}
              </div>


              <form
                action={
                  completeLeadTaskAction
                }
                className="mt-3"
              >

                <input
                  type="hidden"
                  name="leadId"
                  value={
                    lead.id
                  }
                />

                <input
                  type="hidden"
                  name="taskId"
                  value={
                    nextTask.id
                  }
                />


                <button
                  type="submit"
                  className="inline-flex h-8 items-center rounded-lg border border-emerald-500/20 bg-emerald-500/[0.065] px-3 text-[8px] font-semibold text-emerald-300 hover:bg-emerald-500/[0.11]"
                >
                  Mark Task Complete
                </button>

              </form>

            </>
          ) : (
            <>

              <div className="mt-2 text-[9px] font-medium text-zinc-400">
                No open task
              </div>

              <div className="mt-1 text-[8px] leading-4 text-zinc-700">
                The next conversion action can automatically create a follow-up when required.
              </div>

            </>
          )}

        </div>

      </div>


      {/* =====================================================
          SAFETY FOOTER
      ===================================================== */}

      <div className="flex flex-col gap-2 border-t border-white/[0.05] bg-black/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">

        <div className="flex flex-wrap items-center gap-2">

          <span
            className={`h-1.5 w-1.5 rounded-full ${
              blockReason
                ? "bg-amber-400"
                : "bg-emerald-400"
            }`}
          />

          <span className="text-[8px] text-zinc-600">
            {blockReason
              ? `Outreach protection: ${blockReason}`
              : "Prospecting eligibility checks currently pass"}
          </span>

        </div>


        <div className="text-[8px] text-zinc-700">
          Interested, Follow Up, Meeting and Client progression stops automated prospecting.
        </div>

      </div>

    </section>
  );
}