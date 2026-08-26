import Link from "next/link";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";


export const dynamic =
  "force-dynamic";


function percent(
  value:
    number | string | null
) {
  const number =
    Number(value ?? 0);

  return `${number.toFixed(1)}%`;
}


function formatDate(
  value:
    string | null
) {
  if (!value) {
    return "No activity yet";
  }

  return new Date(
    value
  ).toLocaleString();
}


function healthClasses(
  bad:
    boolean
) {
  return bad
    ? "border-red-900 bg-red-950/20 text-red-300"
    : "border-emerald-900 bg-emerald-950/20 text-emerald-300";
}


export default async function MonitoringPage() {

  const supabase =
    createAdminSupabase();


  const {
    data: health,
    error: healthError,
  } = await supabase
    .from(
      "production_health_snapshot"
    )
    .select("*")
    .single();


  if (
    healthError ||
    !health
  ) {
    throw new Error(
      healthError?.message ||
      "Could not load production health."
    );
  }


  const {
    data: pilots,
    error: pilotError,
  } = await supabase
    .from(
      "pilot_campaign_metrics"
    )
    .select("*")
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(10);


  if (pilotError) {
    throw new Error(
      pilotError.message
    );
  }


  const failed =
    Number(
      health.failed_last_24h ??
      0
    );


  const bounced =
    Number(
      health.bounced_last_24h ??
      0
    );


  const attention =
    Number(
      health.attention_required ??
      0
    );


  return (

    <div className="space-y-8">

      {/* HEADER */}

      <div className="flex flex-wrap items-end justify-between gap-5">

        <div>

          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">
            Production Operations
          </div>

          <h1 className="mt-2 text-4xl font-bold">
            Monitoring
          </h1>

          <p className="mt-2 max-w-3xl text-zinc-400">
            Live health, email performance and pilot campaign analytics.
          </p>

        </div>


        <div className="flex gap-3">

          <Link
            href="/admin/replies"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold hover:bg-zinc-800"
          >
            Replies
          </Link>

          <Link
            href="/admin/settings"
            className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black"
          >
            Launch Controls →
          </Link>

        </div>

      </div>


      {/* SYSTEM HEALTH */}

      <section>

        <div className="mb-4 flex items-center justify-between">

          <div>

            <h2 className="text-xl font-bold">
              System Health
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Current state of production automation.
            </p>

          </div>

        </div>


        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <MetricCard
            label="Active Enrollments"
            value={
              health.active_enrollments
            }
            accent="text-blue-300"
          />

          <MetricCard
            label="Sends — 24h"
            value={
              health.sends_last_24h
            }
            accent="text-cyan-300"
          />

          <MetricCard
            label="Delivered — 24h"
            value={
              health.delivered_last_24h
            }
            accent="text-emerald-300"
          />

          <MetricCard
            label="Replies — 24h"
            value={
              health.replies_last_24h
            }
            accent="text-purple-300"
          />

        </div>


        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <MetricCard
            label="Needs Attention"
            value={
              health.attention_required
            }
            accent={
              attention > 0
                ? "text-amber-300"
                : "text-emerald-300"
            }
          />

          <MetricCard
            label="Overdue Tasks"
            value={
              health.overdue_tasks
            }
            accent={
              Number(
                health.overdue_tasks
              ) > 0
                ? "text-red-300"
                : "text-emerald-300"
            }
          />

          <MetricCard
            label="Bounces — 24h"
            value={
              health.bounced_last_24h
            }
            accent={
              bounced > 0
                ? "text-amber-300"
                : "text-emerald-300"
            }
          />

          <MetricCard
            label="Failed — 24h"
            value={
              health.failed_last_24h
            }
            accent={
              failed > 0
                ? "text-red-300"
                : "text-emerald-300"
            }
          />

        </div>

      </section>


      {/* ALERT STATUS */}

      <section className="grid gap-4 xl:grid-cols-3">

        <div
          className={`rounded-2xl border p-5 ${healthClasses(
            failed > 0
          )}`}
        >

          <div className="text-xs uppercase tracking-wide opacity-70">
            Sending Health
          </div>

          <div className="mt-2 text-xl font-bold">

            {failed > 0
              ? `${failed} failed send(s)`
              : "Healthy"}

          </div>

        </div>


        <div
          className={`rounded-2xl border p-5 ${healthClasses(
            bounced >= 3
          )}`}
        >

          <div className="text-xs uppercase tracking-wide opacity-70">
            Deliverability
          </div>

          <div className="mt-2 text-xl font-bold">

            {bounced >= 3
              ? "Needs Review"
              : "Normal"}

          </div>

        </div>


        <div
          className={`rounded-2xl border p-5 ${healthClasses(
            attention > 0
          )}`}
        >

          <div className="text-xs uppercase tracking-wide opacity-70">
            Sales Inbox
          </div>

          <div className="mt-2 text-xl font-bold">

            {attention > 0
              ? `${attention} awaiting action`
              : "Clear"}

          </div>

        </div>

      </section>


      {/* ACTIVITY */}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">

        <h2 className="text-xl font-bold">
          Recent Automation Activity
        </h2>


        <div className="mt-6 grid gap-6 md:grid-cols-3">

          <Activity
            label="Last Email Send"
            value={
              formatDate(
                health.last_send_at
              )
            }
          />

          <Activity
            label="Last Webhook"
            value={
              formatDate(
                health.last_webhook_at
              )
            }
          />

          <Activity
            label="Last Carrier Reply"
            value={
              formatDate(
                health.last_reply_at
              )
            }
          />

        </div>


        <div className="mt-6 border-t border-zinc-800 pt-5">

          <div className="text-sm text-zinc-500">
            Webhook events received in last 24 hours
          </div>

          <div className="mt-1 text-2xl font-bold">
            {health.webhook_events_last_24h}
          </div>

        </div>

      </section>


      {/* PILOT ANALYTICS */}

      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 px-6 py-5">

          <div>

            <h2 className="text-xl font-bold">
              Pilot Performance
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Results from controlled real-carrier launches.
            </p>

          </div>


          <Link
            href="/admin/pilot"
            className="text-sm font-semibold text-blue-400 hover:text-blue-300"
          >
            Pilot Launch →
          </Link>

        </div>


        <div className="overflow-x-auto">

          <table className="w-full min-w-[1150px] text-left text-sm">

            <thead className="border-b border-zinc-800 bg-zinc-950/50 text-xs uppercase text-zinc-500">

              <tr>

                <th className="px-5 py-4">
                  Batch
                </th>

                <th className="px-5 py-4">
                  Status
                </th>

                <th className="px-5 py-4">
                  Carriers
                </th>

                <th className="px-5 py-4">
                  Sent
                </th>

                <th className="px-5 py-4">
                  Delivered
                </th>

                <th className="px-5 py-4">
                  Replies
                </th>

                <th className="px-5 py-4">
                  Interested
                </th>

                <th className="px-5 py-4">
                  Delivery %
                </th>

                <th className="px-5 py-4">
                  Reply %
                </th>

                <th className="px-5 py-4">
                  Bounce %
                </th>

              </tr>

            </thead>


            <tbody className="divide-y divide-zinc-800">

              {(pilots ?? []).map(
                (
                  pilot
                ) => (

                  <tr
                    key={
                      pilot.batch_id
                    }
                    className="hover:bg-zinc-900/80"
                  >

                    <td className="px-5 py-4">

                      <div className="font-mono text-xs">
                        {String(
                          pilot.batch_id
                        ).slice(
                          0,
                          8
                        )}
                      </div>

                      <div className="mt-1 text-xs text-zinc-600">
                        {formatDate(
                          pilot.created_at
                        )}
                      </div>

                    </td>


                    <td className="px-5 py-4">

                      <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-semibold uppercase">
                        {pilot.status}
                      </span>

                    </td>


                    <td className="px-5 py-4">
                      {pilot.member_count}
                    </td>


                    <td className="px-5 py-4">
                      {pilot.sent_count}
                    </td>


                    <td className="px-5 py-4 text-emerald-300">
                      {pilot.delivered_count}
                    </td>


                    <td className="px-5 py-4 text-purple-300">
                      {pilot.replied_leads}
                    </td>


                    <td className="px-5 py-4 text-emerald-300">
                      {pilot.interested_leads}
                    </td>


                    <td className="px-5 py-4">
                      {percent(
                        pilot.delivery_rate
                      )}
                    </td>


                    <td className="px-5 py-4">
                      {percent(
                        pilot.reply_rate
                      )}
                    </td>


                    <td className="px-5 py-4">
                      {percent(
                        pilot.bounce_rate
                      )}
                    </td>

                  </tr>

                )
              )}


              {(pilots ?? []).length ===
                0 && (

                <tr>

                  <td
                    colSpan={10}
                    className="px-5 py-12 text-center text-zinc-500"
                  >
                    No pilot analytics available yet.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
}


function MetricCard({
  label,
  value,
  accent,
}: {
  label:
    string;

  value:
    number | string;

  accent:
    string;
}) {

  return (

    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-5">

      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>

      <div
        className={`mt-3 text-3xl font-bold ${accent}`}
      >
        {value}
      </div>

    </div>

  );
}


function Activity({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {

  return (

    <div>

      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>

      <div className="mt-2 font-semibold text-zinc-200">
        {value}
      </div>

    </div>

  );
}