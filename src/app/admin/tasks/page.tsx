import Link from "next/link";

import {
  createServerSupabase,
} from "@/lib/supabase/server";

import {
  cancelTaskAction,
  completeTaskAction,
  reopenTaskAction,
  rescheduleTaskAction,
  updateTaskPriorityAction,
} from "./actions";


export const dynamic =
  "force-dynamic";


const BUSINESS_TIMEZONE =
  "America/Chicago";


function formatDate(
  value:
    | string
    | null
) {
  if (!value) {
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

      year:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",
    }
  ).format(
    new Date(
      value
    )
  );
}


function chicagoDateKey(
  value:
    Date
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          BUSINESS_TIMEZONE,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(
      value
    );

  const year =
    parts.find(
      (
        part
      ) =>
        part.type ===
        "year"
    )?.value;

  const month =
    parts.find(
      (
        part
      ) =>
        part.type ===
        "month"
    )?.value;

  const day =
    parts.find(
      (
        part
      ) =>
        part.type ===
        "day"
    )?.value;

  return `${year}-${month}-${day}`;
}


function priorityRank(
  priority:
    string
) {
  switch (
    priority
  ) {
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
  priority:
    string
) {
  switch (
    priority
  ) {
    case "urgent":
      return "border-red-700 bg-red-950/70 text-red-300";

    case "high":
      return "border-amber-700 bg-amber-950/70 text-amber-300";

    case "low":
      return "border-zinc-700 bg-zinc-900 text-zinc-400";

    default:
      return "border-blue-800 bg-blue-950/60 text-blue-300";
  }
}


function taskTypeLabel(
  type:
    string
) {
  switch (
    type
  ) {
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
      return type
        .replaceAll(
          "_",
          " "
        )
        .replace(
          /\b\w/g,
          (
            value
          ) =>
            value.toUpperCase()
        );
  }
}


export default async function TasksPage() {
  const supabase =
    createServerSupabase();


  const {
    data:
      openTasksRaw,
    error:
      openError,
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
      completed_at,
      created_at,
      updated_at
    `)
    .eq(
      "status",
      "open"
    )
    .order(
      "due_at",
      {
        ascending:
          true,
      }
    )
    .limit(
      300
    );


  const {
    data:
      completedTasks,
    error:
      completedError,
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
      completed_at,
      created_at,
      updated_at
    `)
    .eq(
      "status",
      "completed"
    )
    .order(
      "completed_at",
      {
        ascending:
          false,
      }
    )
    .limit(
      30
    );


  const {
    data:
      cancelledTasks,
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
      completed_at,
      created_at,
      updated_at
    `)
    .eq(
      "status",
      "cancelled"
    )
    .order(
      "updated_at",
      {
        ascending:
          false,
      }
    )
    .limit(
      15
    );


  const openTasks =
    [
      ...(
        openTasksRaw ??
        []
      ),
    ].sort(
      (
        a,
        b
      ) => {
        const priorityDifference =
          priorityRank(
            a.priority
          ) -
          priorityRank(
            b.priority
          );

        if (
          priorityDifference !==
          0
        ) {
          return priorityDifference;
        }

        return (
          new Date(
            a.due_at
          ).getTime() -
          new Date(
            b.due_at
          ).getTime()
        );
      }
    );


  const allTasks =
    [
      ...openTasks,
      ...(
        completedTasks ??
        []
      ),
      ...(
        cancelledTasks ??
        []
      ),
    ];


  const leadIds =
    [
      ...new Set(
        allTasks.map(
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
        id:
          string;

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

        mc_number:
          string | null;

        status:
          string | null;

        has_replied:
          boolean | null;

        last_reply_classification:
          string | null;
      }
    >();


  if (
    leadIds.length >
    0
  ) {
    const {
      data:
        leads,
    } = await supabase
      .from(
        "leads"
      )
      .select(`
        id,
        company_name,
        name,
        email,
        phone,
        carrier_dot_number,
        mc_number,
        status,
        has_replied,
        last_reply_classification
      `)
      .in(
        "id",
        leadIds
      );


    for (
      const lead
      of leads ??
      []
    ) {
      leadMap.set(
        lead.id,
        lead
      );
    }
  }


  const now =
    new Date();

  const nowMs =
    now.getTime();

  const todayKey =
    chicagoDateKey(
      now
    );


  const overdue =
    openTasks.filter(
      (
        task
      ) =>
        new Date(
          task.due_at
        ).getTime() <
        nowMs
    );


  const dueToday =
    openTasks.filter(
      (
        task
      ) => {
        const due =
          new Date(
            task.due_at
          );

        return (
          due.getTime() >=
            nowMs &&
          chicagoDateKey(
            due
          ) ===
            todayKey
        );
      }
    );


  const upcoming =
    openTasks.filter(
      (
        task
      ) => {
        const due =
          new Date(
            task.due_at
          );

        return (
          due.getTime() >=
            nowMs &&
          chicagoDateKey(
            due
          ) !==
            todayKey
        );
      }
    );


  const urgentOpen =
    openTasks.filter(
      (
        task
      ) =>
        task.priority ===
        "urgent"
    ).length;


  const highOpen =
    openTasks.filter(
      (
        task
      ) =>
        task.priority ===
        "high"
    ).length;


  const firstTask =
    openTasks[0] ??
    null;


  function TaskCard({
    task,
    overdueTask =
      false,
  }: {
    task:
      NonNullable<
        typeof openTasksRaw
      >[number];

    overdueTask?:
      boolean;
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
      <article
        className={[
          "rounded-2xl border p-5",

          overdueTask
            ? "border-red-900/70 bg-red-950/10"
            : "border-zinc-800 bg-zinc-900/45",
        ].join(
          " "
        )}
      >

        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">

          <div className="min-w-0 flex-1">

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


              {overdueTask && (
                <span className="rounded-full border border-red-800 bg-red-950 px-3 py-1 text-xs font-semibold text-red-300">
                  OVERDUE
                </span>
              )}


              {task.source_reply_id && (
                <span className="rounded-full border border-emerald-900 bg-emerald-950/40 px-3 py-1 text-xs text-emerald-300">
                  Reply Generated
                </span>
              )}

            </div>


            <h3 className="mt-4 text-xl font-semibold text-white">
              {task.title}
            </h3>


            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-400">

              <span className="font-medium text-zinc-200">
                {leadName}
              </span>


              {lead?.carrier_dot_number && (
                <span>
                  DOT{" "}
                  {
                    lead.carrier_dot_number
                  }
                </span>
              )}


              {lead?.mc_number && (
                <span>
                  MC{" "}
                  {
                    lead.mc_number
                  }
                </span>
              )}


              {lead?.status && (
                <span>
                  Lead:{" "}
                  {
                    lead.status
                  }
                </span>
              )}

            </div>


            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">

              {lead?.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="text-blue-300 hover:text-blue-200"
                >
                  {
                    lead.email
                  }
                </a>
              )}


              {lead?.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="text-emerald-300 hover:text-emerald-200"
                >
                  {
                    lead.phone
                  }
                </a>
              )}

            </div>


            {task.note && (
              <div className="mt-4 rounded-xl border border-zinc-800 bg-black/30 p-4 text-sm leading-6 text-zinc-400">
                {
                  task.note
                }
              </div>
            )}


            <div className="mt-4 flex flex-wrap gap-4 text-sm">

              <div>
                <span className="text-zinc-500">
                  Due:
                </span>{" "}
                <span
                  className={
                    overdueTask
                      ? "font-semibold text-red-300"
                      : "font-medium text-zinc-200"
                  }
                >
                  {formatDate(
                    task.due_at
                  )}
                </span>
              </div>


              <div className="text-zinc-500">
                {
                  BUSINESS_TIMEZONE
                }
              </div>


              {lead?.has_replied && (
                <div className="text-emerald-400">
                  Reply protected
                </div>
              )}

            </div>

          </div>


          <div className="flex w-full flex-col gap-3 xl:w-[310px]">

            <div className="grid grid-cols-2 gap-2">

              <Link
                href={`/admin/leads/${task.lead_id}`}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-center text-sm font-medium hover:bg-zinc-800"
              >
                View Lead
              </Link>


              <Link
                href="/admin/replies"
                className="rounded-lg border border-zinc-700 px-3 py-2 text-center text-sm font-medium hover:bg-zinc-800"
              >
                Replies
              </Link>

            </div>


            <form
              action={
                updateTaskPriorityAction
              }
              className="flex gap-2"
            >
              <input
                type="hidden"
                name="taskId"
                value={
                  task.id
                }
              />

              <select
                name="priority"
                defaultValue={
                  task.priority
                }
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
              >
                <option value="low">
                  Low
                </option>

                <option value="normal">
                  Normal
                </option>

                <option value="high">
                  High
                </option>

                <option value="urgent">
                  Urgent
                </option>
              </select>

              <button
                type="submit"
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800"
              >
                Save
              </button>
            </form>


            <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">

              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Reschedule
              </div>


              <div className="grid grid-cols-4 gap-2">

                {[
                  {
                    label:
                      "+1h",
                    hours:
                      1,
                  },
                  {
                    label:
                      "+1d",
                    hours:
                      24,
                  },
                  {
                    label:
                      "+3d",
                    hours:
                      72,
                  },
                  {
                    label:
                      "+7d",
                    hours:
                      168,
                  },
                ].map(
                  (
                    option
                  ) => (
                    <form
                      key={
                        option.label
                      }
                      action={
                        rescheduleTaskAction
                      }
                    >
                      <input
                        type="hidden"
                        name="taskId"
                        value={
                          task.id
                        }
                      />

                      <input
                        type="hidden"
                        name="offsetHours"
                        value={
                          option.hours
                        }
                      />

                      <button
                        type="submit"
                        className="w-full rounded-md border border-zinc-700 px-2 py-2 text-xs hover:bg-zinc-800"
                      >
                        {
                          option.label
                        }
                      </button>
                    </form>
                  )
                )}

              </div>

            </div>


            <div className="grid grid-cols-2 gap-2">

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
                  className="w-full rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-900/60"
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
                  className="w-full rounded-lg border border-red-900 bg-red-950/60 px-4 py-2 text-sm text-red-300 hover:bg-red-900/50"
                >
                  Cancel
                </button>
              </form>

            </div>

          </div>

        </div>

      </article>
    );
  }


  return (
    <div className="space-y-8">

      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">

        <div>

          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
            Phase 026E · First Client Operations
          </div>


          <h1 className="mt-2 text-4xl font-bold">
            Follow-up Task Center
          </h1>


          <p className="mt-2 max-w-3xl text-zinc-400">
            Every sales follow-up created from carrier replies is organized here so no interested carrier is forgotten.
          </p>

        </div>


        <div className="flex flex-wrap gap-2">

          <Link
            href="/admin/replies"
            className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold hover:bg-zinc-800"
          >
            ← First Client Inbox
          </Link>


          <Link
            href="/admin/leads"
            className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold hover:bg-zinc-800"
          >
            All Leads →
          </Link>

        </div>

      </header>


      <div className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-5">

        <div className="font-semibold text-emerald-300">
          Sales follow-up protection active
        </div>

        <p className="mt-1 text-sm text-zinc-400">
          Completing, cancelling or rescheduling a task does not restart a stopped email sequence. Replied leads remain protected from automated follow-ups.
        </p>

      </div>


      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">

        <div className="rounded-2xl border border-red-900/70 bg-red-950/20 p-5">

          <div className="text-xs uppercase text-red-400">
            Overdue
          </div>

          <div className="mt-2 text-3xl font-bold text-red-300">
            {
              overdue.length
            }
          </div>

        </div>


        <div className="rounded-2xl border border-amber-900/70 bg-amber-950/20 p-5">

          <div className="text-xs uppercase text-amber-400">
            Due Today
          </div>

          <div className="mt-2 text-3xl font-bold text-amber-300">
            {
              dueToday.length
            }
          </div>

        </div>


        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

          <div className="text-xs uppercase text-zinc-500">
            Upcoming
          </div>

          <div className="mt-2 text-3xl font-bold">
            {
              upcoming.length
            }
          </div>

        </div>


        <div className="rounded-2xl border border-red-900/60 bg-zinc-900/60 p-5">

          <div className="text-xs uppercase text-zinc-500">
            Urgent
          </div>

          <div className="mt-2 text-3xl font-bold text-red-300">
            {
              urgentOpen
            }
          </div>

        </div>


        <div className="rounded-2xl border border-amber-900/60 bg-zinc-900/60 p-5">

          <div className="text-xs uppercase text-zinc-500">
            High
          </div>

          <div className="mt-2 text-3xl font-bold text-amber-300">
            {
              highOpen
            }
          </div>

        </div>


        <div className="rounded-2xl border border-emerald-900/50 bg-zinc-900/60 p-5">

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

      </section>


      {firstTask && (
        <div className="rounded-2xl border border-blue-900/60 bg-blue-950/15 p-5">

          <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
            Next Follow-Up
          </div>

          <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">

            <div>

              <div className="font-semibold">
                {
                  firstTask.title
                }
              </div>

              <div className="mt-1 text-sm text-zinc-400">
                {formatDate(
                  firstTask.due_at
                )}
                {" · "}
                {
                  leadMap.get(
                    firstTask.lead_id
                  )
                    ?.company_name ||
                  leadMap.get(
                    firstTask.lead_id
                  )
                    ?.email ||
                  "Lead"
                }
              </div>

            </div>


            <Link
              href={`/admin/leads/${firstTask.lead_id}`}
              className="rounded-lg border border-blue-800 bg-blue-950 px-4 py-2 text-sm font-semibold text-blue-300"
            >
              Open Lead →
            </Link>

          </div>

        </div>
      )}


      {(
        openError ||
        completedError
      ) && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-5 text-red-300">

          {
            openError
              ?.message ||
            completedError
              ?.message
          }

        </div>
      )}


      {openTasks.length ===
        0 && (
        <div className="rounded-2xl border border-dashed border-emerald-900/70 bg-emerald-950/10 p-12 text-center">

          <div className="text-3xl">
            ✓
          </div>

          <div className="mt-3 text-xl font-semibold text-emerald-300">
            Follow-up queue clear
          </div>

          <p className="mt-2 text-sm text-zinc-500">
            There are currently no open sales tasks.
          </p>

        </div>
      )}


      {overdue.length >
        0 && (
        <section className="space-y-4">

          <div>

            <h2 className="text-2xl font-semibold text-red-300">
              Overdue
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Handle these first.
            </p>

          </div>


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
                overdueTask
              />
            )
          )}

        </section>
      )}


      {dueToday.length >
        0 && (
        <section className="space-y-4">

          <div>

            <h2 className="text-2xl font-semibold text-amber-300">
              Due Today
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              America/Chicago business day.
            </p>

          </div>


          {dueToday.map(
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


      {upcoming.length >
        0 && (
        <section className="space-y-4">

          <div>

            <h2 className="text-2xl font-semibold">
              Upcoming
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Future follow-ups already scheduled.
            </p>

          </div>


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

          <div>

            <h2 className="text-xl font-semibold text-zinc-300">
              Recently Completed
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Finished follow-up work.
            </p>

          </div>


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
                  className="rounded-xl border border-zinc-800 bg-zinc-900/35 p-4"
                >

                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                    <div>

                      <div className="font-medium text-zinc-300">
                        ✓{" "}
                        {
                          task.title
                        }
                      </div>

                      <div className="mt-1 text-xs text-zinc-500">
                        {lead?.company_name ||
                          lead?.name ||
                          lead?.email ||
                          "Lead"}
                        {" · "}
                        Completed{" "}
                        {formatDate(
                          task.completed_at
                        )}
                      </div>

                    </div>


                    <div className="flex gap-2">

                      <Link
                        href={`/admin/leads/${task.lead_id}`}
                        className="rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-800"
                      >
                        View Lead
                      </Link>


                      <form
                        action={
                          reopenTaskAction
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
                          className="rounded-lg border border-blue-900 bg-blue-950/40 px-3 py-2 text-xs text-blue-300"
                        >
                          Reopen
                        </button>
                      </form>

                    </div>

                  </div>

                </div>
              );
            }
          )}

        </section>
      )}


      {(
        cancelledTasks
          ?.length ??
        0
      ) > 0 && (
        <section className="space-y-4">

          <h2 className="text-lg font-semibold text-zinc-500">
            Recently Cancelled
          </h2>


          {cancelledTasks?.map(
            (
              task
            ) => (
              <div
                key={
                  task.id
                }
                className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4 text-sm text-zinc-500"
              >

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                  <span>
                    {
                      task.title
                    }
                  </span>


                  <form
                    action={
                      reopenTaskAction
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
                      className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-900"
                    >
                      Reopen
                    </button>
                  </form>

                </div>

              </div>
            )
          )}

        </section>
      )}

    </div>
  );
}