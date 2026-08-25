import Link from "next/link";

import {
  createServerSupabase,
} from "@/lib/supabase/server";

import {
  cancelTaskAction,
  completeTaskAction,
} from "./actions";


export const dynamic = "force-dynamic";


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


export default async function TasksPage() {
  const supabase =
    createServerSupabase();


  const {
    data: openTasks,
    error: openError,
  } = await supabase
    .from(
      "lead_tasks"
    )
    .select(`
      id,
      lead_id,
      source_reply_id,
      task_type,
      title,
      note,
      status,
      priority,
      due_at,
      created_at
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
    .limit(200);


  const {
    data: completedTasks,
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
      completed_at
    `)
    .eq(
      "status",
      "completed"
    )
    .order(
      "completed_at",
      {
        ascending: false,
      }
    )
    .limit(25);


  const leadIds =
    [
      ...new Set(
        [
          ...(openTasks ?? []),
          ...(completedTasks ?? []),
        ].map(
          (
            task
          ) =>
            task.lead_id
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

        email:
          string | null;

        phone:
          string | null;

        carrier_dot_number:
          number | null;
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


  const now =
    Date.now();


  const next24Hours =
    now +
    24 *
      60 *
      60 *
      1000;


  const overdue =
    (
      openTasks ??
      []
    ).filter(
      (
        task
      ) =>
        new Date(
          task.due_at
        ).getTime() <
        now
    );


  const next24 =
    (
      openTasks ??
      []
    ).filter(
      (
        task
      ) => {

        const due =
          new Date(
            task.due_at
          ).getTime();


        return (
          due >= now &&
          due <=
            next24Hours
        );
      }
    );


  const upcoming =
    (
      openTasks ??
      []
    ).filter(
      (
        task
      ) =>
        new Date(
          task.due_at
        ).getTime() >
        next24Hours
    );


  function TaskCard({
    task,
  }: {
    task:
      NonNullable<
        typeof openTasks
      >[number];
  }) {
    const lead =
      leadMap.get(
        task.lead_id
      );


    const leadName =
      lead?.company_name ||
      lead?.name ||
      lead?.email ||
      "Lead";


    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/55 p-5">

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">

          <div>

            <div className="flex flex-wrap items-center gap-2">

              <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                {taskTypeLabel(
                  task.task_type
                )}
              </span>


              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${priorityClasses(
                  task.priority
                )}`}
              >
                {task.priority.toUpperCase()}
              </span>

            </div>


            <h3 className="mt-4 text-lg font-semibold">
              {task.title}
            </h3>


            <div className="mt-1 text-sm text-zinc-500">
              {leadName}
            </div>


            {lead?.phone && (
              <div className="mt-2 text-sm text-zinc-400">
                {lead.phone}
              </div>
            )}


            {task.note && (
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-400">
                {task.note}
              </div>
            )}


            <div className="mt-4 text-sm font-medium text-zinc-300">
              Due:{" "}
              {formatDate(
                task.due_at
              )}
            </div>

          </div>


          <div className="flex flex-wrap gap-2">

            <Link
              href={`/admin/leads/${task.lead_id}`}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
            >
              View Lead
            </Link>


            <form
              action={
                completeTaskAction
              }
            >
              <input
                type="hidden"
                name="taskId"
                value={
                  task.id
                }
              />

              <button
                type="submit"
                className="rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-2 text-sm font-semibold text-emerald-300"
              >
                ✓ Complete
              </button>
            </form>


            <form
              action={
                cancelTaskAction
              }
            >
              <input
                type="hidden"
                name="taskId"
                value={
                  task.id
                }
              />

              <button
                type="submit"
                className="rounded-lg border border-red-900 bg-red-950 px-4 py-2 text-sm text-red-300"
              >
                Cancel
              </button>
            </form>

          </div>

        </div>

      </div>
    );
  }


  return (
    <div className="space-y-8">

      <div>

        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
          Sales Operations
        </div>

        <h1 className="mt-2 text-4xl font-bold">
          Follow-up Tasks
        </h1>

        <p className="mt-2 text-zinc-400">
          Calls and follow-ups generated from carrier replies.
        </p>

      </div>


      <div className="grid gap-4 md:grid-cols-4">

        <div className="rounded-2xl border border-red-900/70 bg-red-950/20 p-5">

          <div className="text-xs uppercase text-red-400">
            Overdue
          </div>

          <div className="mt-2 text-3xl font-bold text-red-300">
            {overdue.length}
          </div>

        </div>


        <div className="rounded-2xl border border-amber-900/70 bg-amber-950/20 p-5">

          <div className="text-xs uppercase text-amber-400">
            Next 24 Hours
          </div>

          <div className="mt-2 text-3xl font-bold text-amber-300">
            {next24.length}
          </div>

        </div>


        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

          <div className="text-xs uppercase text-zinc-500">
            Upcoming
          </div>

          <div className="mt-2 text-3xl font-bold">
            {upcoming.length}
          </div>

        </div>


        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

          <div className="text-xs uppercase text-zinc-500">
            Completed
          </div>

          <div className="mt-2 text-3xl font-bold text-emerald-300">
            {
              completedTasks
                ?.length ??
              0
            }
          </div>

        </div>

      </div>


      {openError && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-5 text-red-300">
          {openError.message}
        </div>
      )}


      {overdue.length > 0 && (

        <section className="space-y-4">

          <h2 className="text-xl font-semibold text-red-300">
            Overdue
          </h2>

          {overdue.map(
            (
              task
            ) => (
              <TaskCard
                key={
                  task.id
                }
                task={
                  task
                }
              />
            )
          )}

        </section>

      )}


      <section className="space-y-4">

        <h2 className="text-xl font-semibold">
          Next 24 Hours
        </h2>


        {next24.map(
          (
            task
          ) => (
            <TaskCard
              key={
                task.id
              }
              task={
                task
              }
            />
          )
        )}


        {next24.length === 0 && (

          <div className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">
            No tasks due in the next 24 hours.
          </div>

        )}

      </section>


      {upcoming.length > 0 && (

        <section className="space-y-4">

          <h2 className="text-xl font-semibold">
            Upcoming
          </h2>

          {upcoming.map(
            (
              task
            ) => (
              <TaskCard
                key={
                  task.id
                }
                task={
                  task
                }
              />
            )
          )}

        </section>

      )}


      {(
        completedTasks
          ?.length ??
        0
      ) > 0 && (

        <section className="space-y-4">

          <h2 className="text-xl font-semibold text-zinc-400">
            Recently Completed
          </h2>


          {completedTasks?.map(
            (
              task
            ) => {

              const lead =
                leadMap.get(
                  task.lead_id
                );


              return (

                <div
                  key={
                    task.id
                  }
                  className="rounded-xl border border-zinc-800 bg-zinc-900/35 p-4 opacity-70"
                >

                  <div className="flex flex-wrap items-center justify-between gap-3">

                    <div>

                      <div className="font-medium">
                        ✓ {task.title}
                      </div>

                      <div className="mt-1 text-xs text-zinc-500">
                        {lead?.company_name ||
                          lead?.name ||
                          lead?.email ||
                          "Lead"}
                      </div>

                    </div>


                    <div className="text-xs text-zinc-500">
                      Completed{" "}
                      {formatDate(
                        task.completed_at
                      )}
                    </div>

                  </div>

                </div>

              );
            }
          )}

        </section>

      )}

    </div>
  );
}