import Link from "next/link";

import {
  createServerSupabase,
} from "@/lib/supabase/server";


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
      return "Reply";
  }
}


function classificationClasses(
  value: string | null
) {
  switch (value) {
    case "interested":
      return "border-emerald-800 bg-emerald-950 text-emerald-300";

    case "need_rates":
      return "border-blue-800 bg-blue-950 text-blue-300";

    case "call_me":
      return "border-purple-800 bg-purple-950 text-purple-300";

    case "not_interested":
      return "border-red-900 bg-red-950 text-red-300";

    case "wrong_contact":
      return "border-amber-800 bg-amber-950 text-amber-300";

    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
  }
}


function priorityClasses(
  priority: string
) {
  switch (priority) {
    case "urgent":
      return "border-red-700 bg-red-950 text-red-300";

    case "high":
      return "border-amber-700 bg-amber-950 text-amber-300";

    case "low":
      return "border-zinc-700 bg-zinc-900 text-zinc-400";

    default:
      return "border-blue-800 bg-blue-950 text-blue-300";
  }
}


function taskTypeLabel(
  type: string
) {
  switch (type) {
    case "call":
      return "Call";

    case "send_rates":
      return "Send Rates";

    case "follow_up":
      return "Follow Up";

    case "email":
      return "Email";

    case "meeting":
      return "Meeting";

    default:
      return "Task";
  }
}


export default async function DashboardPage() {
  const supabase =
    createServerSupabase();


  const now =
    new Date();


  const nowIso =
    now.toISOString();


  const next24Hours =
    new Date(
      now.getTime() +
      24 * 60 * 60 * 1000
    ).toISOString();


  const previous24Hours =
    new Date(
      now.getTime() -
      24 * 60 * 60 * 1000
    ).toISOString();


  // ==========================================================
  // MAIN KPI COUNTS
  // ==========================================================

  const [
    totalLeadsResult,
    interestedResult,
    followUpResult,
    clientsResult,
    notInterestedResult,
    openRepliesResult,
    overdueTasksResult,
    next24TasksResult,
    activeSequencesResult,
    sent24Result,
  ] =
    await Promise.all([

      supabase
        .from("leads")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        ),

      supabase
        .from("leads")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "status",
          "interested"
        ),

      supabase
        .from("leads")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "status",
          "follow_up"
        ),

      supabase
        .from("leads")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "status",
          "client"
        ),

      supabase
        .from("leads")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "status",
          "not_interested"
        ),

      supabase
        .from("email_replies")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "requires_attention",
          true
        )
        .eq(
          "handled",
          false
        ),

      supabase
        .from("lead_tasks")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "status",
          "open"
        )
        .lt(
          "due_at",
          nowIso
        ),

      supabase
        .from("lead_tasks")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "status",
          "open"
        )
        .gte(
          "due_at",
          nowIso
        )
        .lte(
          "due_at",
          next24Hours
        ),

      supabase
        .from(
          "email_sequence_enrollments"
        )
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "status",
          "active"
        ),

      supabase
        .from("email_sends")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .gte(
          "created_at",
          previous24Hours
        ),
    ]);


  // ==========================================================
  // RECENT REPLIES
  // ==========================================================

  const {
    data: recentReplies,
  } = await supabase
    .from(
      "email_replies"
    )
    .select(`
      id,
      lead_id,
      from_email,
      subject,
      text_body,
      classification,
      requires_attention,
      handled,
      received_at
    `)
    .order(
      "received_at",
      {
        ascending: false,
      }
    )
    .limit(6);


  // ==========================================================
  // OPEN TASKS
  // ==========================================================

  const {
    data: priorityTasks,
  } = await supabase
    .from(
      "lead_tasks"
    )
    .select(`
      id,
      lead_id,
      task_type,
      title,
      priority,
      due_at,
      note
    `)
    .eq(
      "status",
      "open"
    )
    .order(
      "due_at",
      {
        ascending: true,
      }
    )
    .limit(8);


  // ==========================================================
  // LOAD LEAD DETAILS FOR REPLIES + TASKS
  // ==========================================================

  const leadIds =
    [
      ...new Set(
        [
          ...(
            recentReplies ??
            []
          ).map(
            (
              reply
            ) =>
              reply.lead_id
          ),

          ...(
            priorityTasks ??
            []
          ).map(
            (
              task
            ) =>
              task.lead_id
          ),
        ]
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


  const totalLeads =
    totalLeadsResult.count ??
    0;


  const interested =
    interestedResult.count ??
    0;


  const followUp =
    followUpResult.count ??
    0;


  const clients =
    clientsResult.count ??
    0;


  const notInterested =
    notInterestedResult.count ??
    0;


  const openReplies =
    openRepliesResult.count ??
    0;


  const overdueTasks =
    overdueTasksResult.count ??
    0;


  const tasksNext24 =
    next24TasksResult.count ??
    0;


  const activeSequences =
    activeSequencesResult.count ??
    0;


  const sentLast24 =
    sent24Result.count ??
    0;


  return (
    <div className="space-y-8">

      {/* =======================================================
          HEADER
      ======================================================= */}

      <div className="flex flex-wrap items-end justify-between gap-5">

        <div>

          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
            SlateLane Operations
          </div>

          <h1 className="mt-2 text-4xl font-bold">
            Dashboard
          </h1>

          <p className="mt-2 text-zinc-400">
            Sales, replies, follow-ups and email automation in one place.
          </p>

        </div>


        <div className="flex flex-wrap gap-3">

          <Link
            href="/admin/replies?handling=open"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold hover:bg-zinc-800"
          >
            Open Replies
          </Link>


          <Link
            href="/admin/tasks"
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-zinc-200"
          >
            View Tasks →
          </Link>

        </div>

      </div>


      {/* =======================================================
          PRIMARY KPI CARDS
      ======================================================= */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

        <Link
          href="/admin/replies?handling=open"
          className="rounded-2xl border border-amber-900/70 bg-amber-950/20 p-5 transition hover:border-amber-700"
        >

          <div className="text-xs uppercase tracking-wide text-amber-500">
            Open Replies
          </div>

          <div className="mt-2 text-3xl font-bold text-amber-300">
            {openReplies.toLocaleString()}
          </div>

          <div className="mt-2 text-xs text-zinc-500">
            Waiting for human action
          </div>

        </Link>


        <Link
          href="/admin/tasks"
          className="rounded-2xl border border-red-900/70 bg-red-950/20 p-5 transition hover:border-red-700"
        >

          <div className="text-xs uppercase tracking-wide text-red-400">
            Overdue Tasks
          </div>

          <div className="mt-2 text-3xl font-bold text-red-300">
            {overdueTasks.toLocaleString()}
          </div>

          <div className="mt-2 text-xs text-zinc-500">
            Needs immediate action
          </div>

        </Link>


        <Link
          href="/admin/tasks"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/65 p-5 transition hover:border-zinc-700"
        >

          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Due Next 24h
          </div>

          <div className="mt-2 text-3xl font-bold">
            {tasksNext24.toLocaleString()}
          </div>

          <div className="mt-2 text-xs text-zinc-500">
            Upcoming sales work
          </div>

        </Link>


        <Link
          href="/admin/leads"
          className="rounded-2xl border border-emerald-900/70 bg-emerald-950/20 p-5 transition hover:border-emerald-700"
        >

          <div className="text-xs uppercase tracking-wide text-emerald-500">
            Interested Leads
          </div>

          <div className="mt-2 text-3xl font-bold text-emerald-300">
            {interested.toLocaleString()}
          </div>

          <div className="mt-2 text-xs text-zinc-500">
            Positive opportunities
          </div>

        </Link>

      </div>


      {/* =======================================================
          AUTOMATION KPI CARDS
      ======================================================= */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Total Leads
          </div>

          <div className="mt-2 text-3xl font-bold">
            {totalLeads.toLocaleString()}
          </div>

        </div>


        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Follow-up Leads
          </div>

          <div className="mt-2 text-3xl font-bold text-blue-300">
            {followUp.toLocaleString()}
          </div>

        </div>


        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Active Sequences
          </div>

          <div className="mt-2 text-3xl font-bold text-purple-300">
            {activeSequences.toLocaleString()}
          </div>

        </div>


        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Emails Last 24h
          </div>

          <div className="mt-2 text-3xl font-bold text-cyan-300">
            {sentLast24.toLocaleString()}
          </div>

        </div>

      </div>


      {/* =======================================================
          SALES PIPELINE
      ======================================================= */}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-6">

        <div className="flex flex-wrap items-center justify-between gap-4">

          <div>

            <h2 className="text-xl font-semibold">
              Sales Pipeline
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Current lead status distribution.
            </p>

          </div>


          <Link
            href="/admin/leads"
            className="text-sm font-semibold text-blue-400 hover:text-blue-300"
          >
            View Leads →
          </Link>

        </div>


        <div className="mt-6 grid gap-4 md:grid-cols-4">

          <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4">

            <div className="text-sm text-zinc-400">
              Interested
            </div>

            <div className="mt-2 text-2xl font-bold text-emerald-300">
              {interested.toLocaleString()}
            </div>

          </div>


          <div className="rounded-xl border border-blue-900/60 bg-blue-950/20 p-4">

            <div className="text-sm text-zinc-400">
              Follow Up
            </div>

            <div className="mt-2 text-2xl font-bold text-blue-300">
              {followUp.toLocaleString()}
            </div>

          </div>


          <div className="rounded-xl border border-purple-900/60 bg-purple-950/20 p-4">

            <div className="text-sm text-zinc-400">
              Clients
            </div>

            <div className="mt-2 text-2xl font-bold text-purple-300">
              {clients.toLocaleString()}
            </div>

          </div>


          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">

            <div className="text-sm text-zinc-400">
              Not Interested
            </div>

            <div className="mt-2 text-2xl font-bold text-zinc-300">
              {notInterested.toLocaleString()}
            </div>

          </div>

        </div>

      </section>


      {/* =======================================================
          TWO COLUMN OPERATIONS
      ======================================================= */}

      <div className="grid gap-6 2xl:grid-cols-2">

        {/* PRIORITY TASKS */}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45">

          <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">

            <div>

              <h2 className="text-xl font-semibold">
                Priority Tasks
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Next actions sorted by due time.
              </p>

            </div>


            <Link
              href="/admin/tasks"
              className="text-sm font-semibold text-blue-400"
            >
              All Tasks →
            </Link>

          </div>


          <div className="space-y-3 p-5">

            {priorityTasks?.map(
              (
                task
              ) => {

                const lead =
                  leadMap.get(
                    task.lead_id
                  );


                return (

                  <Link
                    key={
                      task.id
                    }
                    href={`/admin/leads/${task.lead_id}`}
                    className="block rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 transition hover:border-zinc-700"
                  >

                    <div className="flex flex-wrap items-start justify-between gap-3">

                      <div>

                        <div className="flex flex-wrap items-center gap-2">

                          <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300">
                            {taskTypeLabel(
                              task.task_type
                            )}
                          </span>


                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${priorityClasses(
                              task.priority
                            )}`}
                          >
                            {task.priority.toUpperCase()}
                          </span>

                        </div>


                        <div className="mt-3 font-semibold">
                          {task.title}
                        </div>


                        <div className="mt-1 text-xs text-zinc-500">
                          {lead?.company_name ||
                            lead?.name ||
                            lead?.email ||
                            "Lead"}
                        </div>

                      </div>


                      <div className="text-right text-xs text-zinc-500">

                        Due

                        <div className="mt-1 text-zinc-300">
                          {formatDate(
                            task.due_at
                          )}
                        </div>

                      </div>

                    </div>

                  </Link>

                );
              }
            )}


            {(
              priorityTasks
                ?.length ??
              0
            ) === 0 && (

              <div className="py-12 text-center text-zinc-500">
                No open follow-up tasks.
              </div>

            )}

          </div>

        </section>


        {/* RECENT REPLIES */}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45">

          <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">

            <div>

              <h2 className="text-xl font-semibold">
                Recent Replies
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Latest inbound carrier responses.
              </p>

            </div>


            <Link
              href="/admin/replies"
              className="text-sm font-semibold text-blue-400"
            >
              Inbox →
            </Link>

          </div>


          <div className="space-y-3 p-5">

            {recentReplies?.map(
              (
                reply
              ) => {

                const lead =
                  leadMap.get(
                    reply.lead_id
                  );


                const preview =
                  reply.text_body
                    ?.replace(
                      /\s+/g,
                      " "
                    )
                    .trim()
                    .slice(
                      0,
                      120
                    ) ||
                  "No text preview";


                return (

                  <Link
                    key={
                      reply.id
                    }
                    href={`/admin/leads/${reply.lead_id}`}
                    className="block rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 transition hover:border-zinc-700"
                  >

                    <div className="flex flex-wrap items-start justify-between gap-3">

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-wrap items-center gap-2">

                          <div className="font-semibold">
                            {lead?.company_name ||
                              lead?.name ||
                              reply.from_email}
                          </div>


                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classificationClasses(
                              reply.classification
                            )}`}
                          >
                            {classificationLabel(
                              reply.classification
                            )}
                          </span>


                          {!reply.handled &&
                            reply.requires_attention && (

                            <span className="rounded-full border border-amber-800 bg-amber-950 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                              Action Needed
                            </span>

                          )}

                        </div>


                        <div className="mt-2 text-sm text-zinc-400">
                          {preview}
                          {(
                            reply.text_body
                              ?.length ??
                            0
                          ) >
                            120
                            ? "…"
                            : ""}
                        </div>

                      </div>


                      <div className="shrink-0 text-xs text-zinc-500">
                        {formatDate(
                          reply.received_at
                        )}
                      </div>

                    </div>

                  </Link>

                );
              }
            )}


            {(
              recentReplies
                ?.length ??
              0
            ) === 0 && (

              <div className="py-12 text-center text-zinc-500">
                No carrier replies yet.
              </div>

            )}

          </div>

        </section>

      </div>


      {/* =======================================================
          PRODUCTION STATUS
      ======================================================= */}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-6">

        <div className="flex flex-wrap items-center justify-between gap-5">

          <div>

            <h2 className="text-lg font-semibold">
              Email Automation
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Sequence processing, reply detection and follow-up management.
            </p>

          </div>


          <div className="flex flex-wrap gap-2">

            <span className="rounded-full border border-emerald-800 bg-emerald-950 px-3 py-1 text-xs font-semibold text-emerald-300">
              Scheduler Live
            </span>

            <span className="rounded-full border border-emerald-800 bg-emerald-950 px-3 py-1 text-xs font-semibold text-emerald-300">
              Reply Detection Live
            </span>

            <span className="rounded-full border border-emerald-800 bg-emerald-950 px-3 py-1 text-xs font-semibold text-emerald-300">
              Auto-Stop Live
            </span>

          </div>

        </div>

      </section>

    </div>
  );
}