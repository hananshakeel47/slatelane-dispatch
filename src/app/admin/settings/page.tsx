import {
  getLaunchSnapshot,
} from "@/lib/email/launch-controls";

import {
  updateLaunchSettingsAction,
} from "./actions";


export const dynamic = "force-dynamic";


function booleanOptions(
  enabledText: string,
  disabledText: string
) {
  return (
    <>
      <option value="true">
        {enabledText}
      </option>

      <option value="false">
        {disabledText}
      </option>
    </>
  );
}


export default async function SettingsPage() {
  const snapshot =
    await getLaunchSnapshot();


  const {
    settings,
    sentToday,
    effectiveCap,
    remainingToday,
    withinSendingWindow,
    localHour,
  } = snapshot;


  return (
    <div className="space-y-8">

      <div>

        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-purple-400">
          Production Safety
        </div>

        <h1 className="mt-2 text-4xl font-bold">
          Launch Controls
        </h1>

        <p className="mt-2 max-w-3xl text-zinc-400">
          Global controls governing automated SlateLane email outreach.
        </p>

      </div>


      <div
        className={`rounded-2xl border p-6 ${
          settings.sending_enabled
            ? "border-emerald-800 bg-emerald-950/25"
            : "border-red-900 bg-red-950/25"
        }`}
      >

        <div className="flex flex-wrap items-center justify-between gap-5">

          <div>

            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Master Sending
            </div>

            <div
              className={`mt-2 text-3xl font-bold ${
                settings.sending_enabled
                  ? "text-emerald-300"
                  : "text-red-300"
              }`}
            >
              {settings.sending_enabled
                ? "ON"
                : "OFF"}
            </div>

          </div>


          <div className="text-right">

            <div className="text-sm text-zinc-400">
              Scheduler window
            </div>

            <div className="mt-1 font-semibold">
              {withinSendingWindow
                ? "Inside allowed hours"
                : "Outside allowed hours"}
            </div>

            <div className="mt-1 text-xs text-zinc-500">
              Current local hour:{" "}
              {localHour}:00{" "}
              ({settings.sending_timezone})
            </div>

          </div>

        </div>

      </div>


      <div className="grid gap-4 md:grid-cols-4">

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

          <div className="text-xs uppercase text-zinc-500">
            Sent Today
          </div>

          <div className="mt-2 text-3xl font-bold text-cyan-300">
            {sentToday}
          </div>

        </div>


        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

          <div className="text-xs uppercase text-zinc-500">
            Effective Cap
          </div>

          <div className="mt-2 text-3xl font-bold">
            {effectiveCap}
          </div>

        </div>


        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

          <div className="text-xs uppercase text-zinc-500">
            Remaining Today
          </div>

          <div className="mt-2 text-3xl font-bold text-emerald-300">
            {remainingToday}
          </div>

        </div>


        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

          <div className="text-xs uppercase text-zinc-500">
            Pilot
          </div>

          <div className="mt-2 text-3xl font-bold text-purple-300">
            {settings.pilot_mode
              ? "ON"
              : "OFF"}
          </div>

        </div>

      </div>


      {!settings.sending_enabled && (

        <div className="rounded-2xl border border-amber-900 bg-amber-950/20 p-5 text-sm text-amber-200">
          Automated production sending is currently blocked. The scheduler can still run, but it cannot send campaign emails while Master Sending is OFF.
        </div>

      )}


      <form
        action={
          updateLaunchSettingsAction
        }
        className="space-y-6"
      >

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-6">

          <h2 className="text-xl font-semibold">
            Sending Limits
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">

            <label className="space-y-2">

              <span className="text-sm text-zinc-400">
                Master Sending
              </span>

              <select
                name="sending_enabled"
                defaultValue={
                  String(
                    settings.sending_enabled
                  )
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              >
                <option value="false">
                  OFF — Block automated sending
                </option>

                <option value="true">
                  ON — Allow automated sending
                </option>
              </select>

            </label>


            <label className="space-y-2">

              <span className="text-sm text-zinc-400">
                Daily Send Cap
              </span>

              <input
                name="daily_send_cap"
                type="number"
                min="0"
                max="10000"
                defaultValue={
                  settings.daily_send_cap
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              />

            </label>


            <label className="space-y-2">

              <span className="text-sm text-zinc-400">
                Maximum Scheduler Batch
              </span>

              <input
                name="max_batch_size"
                type="number"
                min="1"
                max="100"
                defaultValue={
                  settings.max_batch_size
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              />

            </label>

          </div>

        </section>


        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-6">

          <h2 className="text-xl font-semibold">
            Sending Window
          </h2>


          <div className="mt-6 grid gap-5 md:grid-cols-3">

            <label className="space-y-2">

              <span className="text-sm text-zinc-400">
                Start Hour
              </span>

              <input
                type="number"
                name="sending_hour_start"
                min="0"
                max="23"
                defaultValue={
                  settings.sending_hour_start
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              />

            </label>


            <label className="space-y-2">

              <span className="text-sm text-zinc-400">
                End Hour
              </span>

              <input
                type="number"
                name="sending_hour_end"
                min="1"
                max="24"
                defaultValue={
                  settings.sending_hour_end
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              />

            </label>


            <label className="space-y-2">

              <span className="text-sm text-zinc-400">
                Timezone
              </span>

              <select
                name="sending_timezone"
                defaultValue={
                  settings.sending_timezone
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              >

                <option value="America/Chicago">
                  America/Chicago — Central
                </option>

                <option value="America/New_York">
                  America/New_York — Eastern
                </option>

                <option value="America/Denver">
                  America/Denver — Mountain
                </option>

                <option value="America/Los_Angeles">
                  America/Los_Angeles — Pacific
                </option>

              </select>

            </label>

          </div>

        </section>


        <section className="rounded-2xl border border-purple-900/60 bg-purple-950/15 p-6">

          <h2 className="text-xl font-semibold">
            Pilot Protection
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Keep this enabled during the first real-carrier launch.
          </p>


          <div className="mt-6 grid gap-5 md:grid-cols-2">

            <label className="space-y-2">

              <span className="text-sm text-zinc-400">
                Pilot Mode
              </span>

              <select
                name="pilot_mode"
                defaultValue={
                  String(
                    settings.pilot_mode
                  )
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              >
                {booleanOptions(
                  "ON — Pilot protection enabled",
                  "OFF — Normal production mode"
                )}
              </select>

            </label>


            <label className="space-y-2">

              <span className="text-sm text-zinc-400">
                Pilot Limit
              </span>

              <input
                type="number"
                name="pilot_limit"
                min="1"
                max="1000"
                defaultValue={
                  settings.pilot_limit
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              />

            </label>

          </div>

        </section>


        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-6">

          <h2 className="text-xl font-semibold">
            Carrier Eligibility
          </h2>


          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">

            <label className="space-y-2">

              <span className="text-sm text-zinc-400">
                Minimum Carrier Score
              </span>

              <input
                type="number"
                name="minimum_carrier_score"
                min="0"
                max="100"
                defaultValue={
                  settings.minimum_carrier_score
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              />

            </label>


            <label className="space-y-2">

              <span className="text-sm text-zinc-400">
                Active Authority
              </span>

              <select
                name="require_active_authority"
                defaultValue={
                  String(
                    settings.require_active_authority
                  )
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              >
                {booleanOptions(
                  "Required",
                  "Not required"
                )}
              </select>

            </label>


            <label className="space-y-2">

              <span className="text-sm text-zinc-400">
                Email Required
              </span>

              <select
                name="require_email"
                defaultValue={
                  String(
                    settings.require_email
                  )
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              >
                {booleanOptions(
                  "Required",
                  "Not required"
                )}
              </select>

            </label>

          </div>

        </section>


        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-6">

          <h2 className="text-xl font-semibold">
            Suppression Rules
          </h2>


          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">

            {[
              [
                "skip_replied",
                "Skip Replied",
                settings.skip_replied,
              ],

              [
                "skip_bounced",
                "Skip Bounced",
                settings.skip_bounced,
              ],

              [
                "skip_complained",
                "Skip Complaints",
                settings.skip_complained,
              ],

              [
                "skip_opted_out",
                "Skip Opted Out",
                settings.skip_opted_out,
              ],
            ].map(
              (
                [
                  name,
                  label,
                  value,
                ]
              ) => (

                <label
                  key={
                    String(
                      name
                    )
                  }
                  className="space-y-2"
                >

                  <span className="text-sm text-zinc-400">
                    {String(
                      label
                    )}
                  </span>

                  <select
                    name={
                      String(
                        name
                      )
                    }
                    defaultValue={
                      String(
                        value
                      )
                    }
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
                  >
                    {booleanOptions(
                      "Yes",
                      "No"
                    )}
                  </select>

                </label>

              )
            )}

          </div>

        </section>


        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-6">

          <label className="space-y-2">

            <span className="text-sm text-zinc-400">
              Internal Launch Notes
            </span>

            <textarea
              name="notes"
              defaultValue={
                settings.notes ??
                ""
              }
              rows={4}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
            />

          </label>

        </section>


        <div className="flex justify-end">

          <button
            type="submit"
            className="rounded-xl bg-white px-8 py-3 font-bold text-black hover:bg-zinc-200"
          >
            Save Launch Controls
          </button>

        </div>

      </form>

    </div>
  );
}