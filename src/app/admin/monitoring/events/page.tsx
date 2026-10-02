import Link from "next/link";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";

import {
  reopenReliabilityEventAction,
  resolveReliabilityEventAction,
} from "./actions";


export const dynamic =
  "force-dynamic";


type ReliabilityEvent = {
  id:
    string;

  source:
    string;

  event_type:
    string;

  severity:
    string;

  message:
    string;

  entity_type:
    string |
    null;

  entity_id:
    string |
    null;

  metadata:
    Record<
      string,
      unknown
    > |
    null;

  occurred_at:
    string;

  resolved_at:
    string |
    null;

  resolution_note:
    string |
    null;
};


function pretty(
  value:
    string,
) {
  return value
    .replace(
      /_/g,
      " ",
    )
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character.toUpperCase(),
    );
}


function formatDate(
  value:
    string |
    null,
) {
  if (
    !value
  ) {
    return "—";
  }


  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        "America/Chicago",

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
    },
  ).format(
    new Date(
      value,
    ),
  );
}


function severityClass(
  severity:
    string,
) {
  switch (
    severity
  ) {
    case "critical":
      return "border-red-500/25 bg-red-500/[0.08] text-red-300";

    case "error":
      return "border-red-500/15 bg-red-500/[0.05] text-red-300";

    case "warning":
      return "border-amber-500/20 bg-amber-500/[0.05] text-amber-300";

    default:
      return "border-blue-500/20 bg-blue-500/[0.05] text-blue-300";
  }
}


function metadataText(
  metadata:
    Record<
      string,
      unknown
    > |
    null,
) {
  if (
    !metadata ||
    Object.keys(
      metadata,
    ).length ===
      0
  ) {
    return null;
  }


  try {
    const value =
      JSON.stringify(
        metadata,
      );


    return value.length >
      500
      ? `${value.slice(
          0,
          500,
        )}…`
      : value;
  } catch {
    return null;
  }
}


export default async function ReliabilityEventsPage() {
  const supabase =
    createAdminSupabase();


  const [
    eventsResult,
    unresolvedResult,
    criticalResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "reliability_events",
        )
        .select(`
          id,
          source,
          event_type,
          severity,
          message,
          entity_type,
          entity_id,
          metadata,
          occurred_at,
          resolved_at,
          resolution_note
        `)
        .order(
          "occurred_at",
          {
            ascending:
              false,
          },
        )
        .limit(
          100,
        ),

      supabase
        .from(
          "reliability_events",
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .is(
          "resolved_at",
          null,
        ),

      supabase
        .from(
          "reliability_events",
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .is(
          "resolved_at",
          null,
        )
        .in(
          "severity",
          [
            "error",
            "critical",
          ],
        ),
    ]);


  if (
    eventsResult.error
  ) {
    throw new Error(
      eventsResult.error
        .message,
    );
  }


  if (
    unresolvedResult.error
  ) {
    throw new Error(
      unresolvedResult.error
        .message,
    );
  }


  if (
    criticalResult.error
  ) {
    throw new Error(
      criticalResult.error
        .message,
    );
  }


  const events =
    (
      eventsResult.data ??
      []
    ) as ReliabilityEvent[];


  const unresolved =
    unresolvedResult.count ??
    0;


  const critical =
    criticalResult.count ??
    0;


  return (
    <div className="space-y-6">

      <section className="rounded-[20px] border border-white/[0.07] bg-white/[0.018] p-6">

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-400">
              Phase 3G · Persistent Reliability
            </div>


            <h1 className="mt-2 text-[24px] font-semibold tracking-tight text-white">
              Reliability Event Ledger
            </h1>


            <p className="mt-2 max-w-3xl text-[9px] leading-5 text-zinc-600">
              Durable operational events that remain visible
              after the original request, cron job or webhook
              has finished.
            </p>

          </div>


          <div className="flex flex-wrap gap-2">

            <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3">

              <div className="text-[7px] uppercase text-amber-400/70">
                Unresolved
              </div>

              <div className="mt-1 text-[18px] font-semibold text-amber-300">
                {unresolved}
              </div>

            </div>


            <div className="rounded-xl border border-red-500/15 bg-red-500/[0.04] px-4 py-3">

              <div className="text-[7px] uppercase text-red-400/70">
                Error / Critical
              </div>

              <div className="mt-1 text-[18px] font-semibold text-red-300">
                {critical}
              </div>

            </div>

          </div>

        </div>


        <div className="mt-5 flex flex-wrap gap-3 border-t border-white/[0.05] pt-4">

          <Link
            href="/admin/monitoring/reliability"
            className="text-[8px] font-semibold text-cyan-400"
          >
            Reliability Command Center →
          </Link>


          <a
            href="/api/admin/health"
            target="_blank"
            rel="noreferrer"
            className="text-[8px] font-semibold text-blue-400"
          >
            Detailed Health JSON →
          </a>

        </div>

      </section>


      <section className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.018]">

        <div className="border-b border-white/[0.05] px-5 py-4">

          <div className="text-[11px] font-semibold text-zinc-200">
            Latest 100 Events
          </div>

          <div className="mt-1 text-[8px] text-zinc-700">
            Newest reliability event first.
          </div>

        </div>


        {events.length >
        0 ? (
          <div className="divide-y divide-white/[0.045]">

            {events.map(
              (
                event,
              ) => {
                const metadata =
                  metadataText(
                    event.metadata,
                  );


                return (
                  <article
                    key={
                      event.id
                    }
                    className="p-5"
                  >

                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-2">

                          <span
                            className={`rounded-full border px-2 py-1 text-[7px] font-semibold uppercase ${severityClass(
                              event.severity,
                            )}`}
                          >
                            {event.severity}
                          </span>


                          <span className="rounded-full border border-white/[0.06] px-2 py-1 text-[7px] uppercase text-zinc-600">
                            {event.source}
                          </span>


                          <span className="text-[8px] font-medium text-zinc-400">
                            {pretty(
                              event.event_type,
                            )}
                          </span>


                          {event.resolved_at ? (
                            <span className="rounded-full border border-emerald-500/15 bg-emerald-500/[0.04] px-2 py-1 text-[7px] font-semibold text-emerald-300">
                              RESOLVED
                            </span>
                          ) : (
                            <span className="rounded-full border border-amber-500/15 bg-amber-500/[0.04] px-2 py-1 text-[7px] font-semibold text-amber-300">
                              OPEN
                            </span>
                          )}

                        </div>


                        <div className="mt-3 text-[10px] font-medium leading-5 text-zinc-300">
                          {event.message}
                        </div>


                        <div className="mt-2 flex flex-wrap gap-3 text-[7px] text-zinc-700">

                          <span>
                            {formatDate(
                              event.occurred_at,
                            )}
                          </span>


                          {event.entity_type ? (
                            <span>
                              {pretty(
                                event.entity_type,
                              )}
                              {event.entity_id
                                ? ` • ${event.entity_id}`
                                : ""}
                            </span>
                          ) : null}

                        </div>

                      </div>

                    </div>


                    {metadata ? (
                      <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2 font-mono text-[7px] leading-4 text-zinc-700">
                        {metadata}
                      </div>
                    ) : null}


                    {event.resolved_at ? (
                      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-emerald-500/10 bg-emerald-500/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between">

                        <div>

                          <div className="text-[7px] font-semibold text-emerald-300">
                            Resolved{" "}
                            {formatDate(
                              event.resolved_at,
                            )}
                          </div>


                          {event.resolution_note ? (
                            <div className="mt-1 text-[7px] text-zinc-600">
                              {event.resolution_note}
                            </div>
                          ) : null}

                        </div>


                        <form
                          action={
                            reopenReliabilityEventAction
                          }
                        >

                          <input
                            type="hidden"
                            name="eventId"
                            value={
                              event.id
                            }
                          />


                          <button
                            type="submit"
                            className="h-8 rounded-lg border border-white/[0.07] px-3 text-[8px] font-semibold text-zinc-400 hover:bg-white/[0.03]"
                          >
                            Reopen
                          </button>

                        </form>

                      </div>
                    ) : (
                      <form
                        action={
                          resolveReliabilityEventAction
                        }
                        className="mt-4 flex flex-col gap-2 sm:flex-row"
                      >

                        <input
                          type="hidden"
                          name="eventId"
                          value={
                            event.id
                          }
                        />


                        <input
                          name="resolutionNote"
                          maxLength={
                            1000
                          }
                          placeholder="Optional resolution note..."
                          className="h-9 flex-1 rounded-lg border border-white/[0.07] bg-black/20 px-3 text-[8px] text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-emerald-500/25"
                        />


                        <button
                          type="submit"
                          className="h-9 rounded-lg bg-emerald-400 px-4 text-[8px] font-bold text-black hover:bg-emerald-300"
                        >
                          Mark Resolved
                        </button>

                      </form>
                    )}

                  </article>
                );
              },
            )}

          </div>
        ) : (
          <div className="p-8">

            <div className="text-[10px] font-medium text-emerald-300">
              Reliability ledger is clean.
            </div>

            <div className="mt-2 text-[8px] leading-4 text-zinc-700">
              New failed, bounced or complained email states
              will be recorded automatically. Application
              events can also be written through the shared
              reliability event helper.
            </div>

          </div>
        )}

      </section>

    </div>
  );
}