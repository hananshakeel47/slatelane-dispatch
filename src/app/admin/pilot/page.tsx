import Link from "next/link";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";

import {
  armPilotAction,
  cancelPilotAction,
  getPilotPreview,
  preparePilotAction,
} from "./actions";


export const dynamic =
  "force-dynamic";


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


function scoreClasses(
  score:
    number | null
) {
  const value =
    score ?? 0;


  if (
    value >= 90
  ) {
    return "border-emerald-700 bg-emerald-950 text-emerald-300";
  }


  if (
    value >= 80
  ) {
    return "border-blue-800 bg-blue-950 text-blue-300";
  }


  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}


function batchClasses(
  status: string
) {
  switch (
    status
  ) {
    case "prepared":
      return "border-blue-800 bg-blue-950 text-blue-300";

    case "armed":
      return "border-amber-700 bg-amber-950 text-amber-300";

    case "completed":
      return "border-emerald-800 bg-emerald-950 text-emerald-300";

    case "cancelled":
      return "border-zinc-700 bg-zinc-900 text-zinc-400";

    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
  }
}


export default async function PilotPage() {
  const supabase =
    createAdminSupabase();


  const preview =
    await getPilotPreview();


  const {
    data: activeBatch,
    error:
      activeBatchError,
  } = await supabase
    .from(
      "email_pilot_batches"
    )
    .select(`
      id,
      sequence_id,
      status,
      requested_count,
      prepared_count,
      minimum_score,
      notes,
      prepared_at,
      armed_at,
      created_at,
      updated_at
    `)
    .in(
      "status",
      [
        "prepared",
        "armed",
      ]
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(1)
    .maybeSingle();


  if (
    activeBatchError
  ) {
    throw new Error(
      activeBatchError.message
    );
  }


  const {
    data: latestBatch,
  } = await supabase
    .from(
      "email_pilot_batches"
    )
    .select(`
      id,
      status,
      requested_count,
      prepared_count,
      created_at
    `)
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(1)
    .maybeSingle();


  let activeMembers:
    {
      id: string;
      carrier_id: number;
      lead_id: string;
      enrollment_id: string;
      dot_number: number;
      email: string;
      created_at: string;
    }[] = [];


  if (
    activeBatch
  ) {
    const {
      data,
      error,
    } = await supabase
      .from(
        "email_pilot_members"
      )
      .select(`
        id,
        carrier_id,
        lead_id,
        enrollment_id,
        dot_number,
        email,
        created_at
      `)
      .eq(
        "batch_id",
        activeBatch.id
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );


    if (error) {
      throw new Error(
        error.message
      );
    }


    activeMembers =
      data ?? [];
  }


  const carrierMap =
    new Map<
      number,
      {
        id: number;
        dot_number: number;
        mc_number: string | null;
        legal_name: string | null;
        dba_name: string | null;
        state: string | null;
        status_code: string | null;
        lead_score: number | null;
        dispatcher_probability: number | null;
      }
    >();


  if (
    activeMembers.length >
    0
  ) {
    const carrierIds =
      activeMembers.map(
        (
          member
        ) =>
          member.carrier_id
      );


    const {
      data: carriers,
      error,
    } = await supabase
      .from("carriers")
      .select(`
        id,
        dot_number,
        mc_number,
        legal_name,
        dba_name,
        state,
        status_code,
        lead_score,
        dispatcher_probability
      `)
      .in(
        "id",
        carrierIds
      );


    if (error) {
      throw new Error(
        error.message
      );
    }


    for (
      const carrier
      of carriers ??
      []
    ) {
      carrierMap.set(
        Number(
          carrier.id
        ),
        carrier
      );
    }
  }


  const settings =
    preview.settings;


  const masterSafe =
    !settings.sending_enabled;


  return (
    <div className="space-y-8">

      {/* HEADER */}

      <div className="flex flex-wrap items-end justify-between gap-5">

        <div>

          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">
            Production Launch
          </div>

          <h1 className="mt-2 text-4xl font-bold">
            Real Carrier Pilot
          </h1>

          <p className="mt-2 max-w-3xl text-zinc-400">
            Select, inspect and prepare the first controlled group of real FMCSA carriers before production outreach begins.
          </p>

        </div>


        <Link
          href="/admin/settings"
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold hover:bg-zinc-800"
        >
          Launch Controls →
        </Link>

      </div>


      {/* SAFETY STATUS */}

      <section
        className={`rounded-2xl border p-6 ${
          masterSafe
            ? "border-emerald-900 bg-emerald-950/20"
            : "border-red-800 bg-red-950/30"
        }`}
      >

        <div className="flex flex-wrap items-center justify-between gap-6">

          <div>

            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Master Sending
            </div>

            <div
              className={`mt-2 text-3xl font-bold ${
                masterSafe
                  ? "text-emerald-300"
                  : "text-red-300"
              }`}
            >
              {masterSafe
                ? "OFF — SAFE"
                : "ON — BLOCK PILOT PREPARATION"}
            </div>

          </div>


          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">

            <div>

              <div className="text-zinc-500">
                Pilot Mode
              </div>

              <div className="mt-1 font-semibold">
                {settings.pilot_mode
                  ? "ON"
                  : "OFF"}
              </div>

            </div>


            <div>

              <div className="text-zinc-500">
                Pilot Limit
              </div>

              <div className="mt-1 font-semibold">
                {settings.pilot_limit}
              </div>

            </div>


            <div>

              <div className="text-zinc-500">
                Daily Remaining
              </div>

              <div className="mt-1 font-semibold">
                {preview.remainingToday}
              </div>

            </div>


            <div>

              <div className="text-zinc-500">
                Min Score
              </div>

              <div className="mt-1 font-semibold">
                {settings.minimum_carrier_score}
              </div>

            </div>

          </div>

        </div>

      </section>


      {/* SEQUENCE */}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-6">

        <div className="flex flex-wrap items-center justify-between gap-4">

          <div>

            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Email Sequence
            </div>

            <div className="mt-2 text-xl font-semibold">
              {preview.sequence.name}
            </div>

            <div className="mt-1 text-sm text-zinc-500">
              {preview.sequence.description ||
                "Active SlateLane outreach sequence"}
            </div>

          </div>


          <span className="rounded-full border border-emerald-800 bg-emerald-950 px-3 py-1 text-xs font-semibold text-emerald-300">
            Active
          </span>

        </div>

      </section>


      {/* ACTIVE PILOT */}

      {activeBatch ? (

        <>

          <section className="rounded-2xl border border-amber-900/70 bg-amber-950/10 p-6">

            <div className="flex flex-wrap items-start justify-between gap-5">

              <div>

                <div className="flex flex-wrap items-center gap-3">

                  <h2 className="text-2xl font-bold">
                    Current Pilot
                  </h2>


                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${batchClasses(
                      activeBatch.status
                    )}`}
                  >
                    {activeBatch.status}
                  </span>

                </div>


                <div className="mt-3 text-sm text-zinc-400">
                  Batch:{" "}
                  <span className="font-mono text-zinc-300">
                    {activeBatch.id}
                  </span>
                </div>


                <div className="mt-1 text-sm text-zinc-500">
                  Prepared{" "}
                  {activeBatch.prepared_count}
                  {" / "}
                  {activeBatch.requested_count}
                  {" carriers"}
                </div>

              </div>


              <div className="text-right text-sm text-zinc-500">
                Created{" "}
                {formatDate(
                  activeBatch.created_at
                )}
              </div>

            </div>


            {activeBatch.status ===
              "prepared" && (

              <div className="mt-6 rounded-xl border border-blue-900 bg-blue-950/20 p-4 text-sm text-blue-200">
                These carriers have paused sequence enrollments. No campaign email can be sent from this pilot yet.
              </div>

            )}


            {activeBatch.status ===
              "armed" && (

              <div className="mt-6 rounded-xl border border-amber-800 bg-amber-950/25 p-4 text-sm text-amber-200">
                Pilot enrollments are armed and waiting, but Master Sending is still OFF. Do not turn it ON until you have inspected the complete list below.
              </div>

            )}

          </section>


          {/* EXACT PILOT MEMBERS */}

          <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/45">

            <div className="border-b border-zinc-800 px-6 py-5">

              <h2 className="text-xl font-semibold">
                Exact Pilot Carriers
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                These are the real companies assigned to this batch.
              </p>

            </div>


            <div className="overflow-x-auto">

              <table className="w-full min-w-[1000px] text-left text-sm">

                <thead className="border-b border-zinc-800 bg-zinc-950/60 text-xs uppercase text-zinc-500">

                  <tr>

                    <th className="px-5 py-4">
                      #
                    </th>

                    <th className="px-5 py-4">
                      Carrier
                    </th>

                    <th className="px-5 py-4">
                      USDOT
                    </th>

                    <th className="px-5 py-4">
                      State
                    </th>

                    <th className="px-5 py-4">
                      Score
                    </th>

                    <th className="px-5 py-4">
                      Probability
                    </th>

                    <th className="px-5 py-4">
                      Email
                    </th>

                    <th className="px-5 py-4">
                      Status
                    </th>

                  </tr>

                </thead>


                <tbody className="divide-y divide-zinc-800">

                  {activeMembers.map(
                    (
                      member,
                      index
                    ) => {

                      const carrier =
                        carrierMap.get(
                          Number(
                            member.carrier_id
                          )
                        );


                      return (

                        <tr
                          key={
                            member.id
                          }
                          className="hover:bg-zinc-900"
                        >

                          <td className="px-5 py-4 text-zinc-500">
                            {index + 1}
                          </td>


                          <td className="px-5 py-4">

                            <Link
                              href={`/admin/carriers/${member.dot_number}`}
                              className="font-semibold text-white hover:text-blue-300"
                            >
                              {carrier?.legal_name ||
                                carrier?.dba_name ||
                                "Carrier"}
                            </Link>

                            {carrier?.mc_number && (

                              <div className="mt-1 text-xs text-zinc-500">
                                {carrier.mc_number}
                              </div>

                            )}

                          </td>


                          <td className="px-5 py-4 font-mono text-zinc-300">
                            {member.dot_number}
                          </td>


                          <td className="px-5 py-4">
                            {carrier?.state ||
                              "—"}
                          </td>


                          <td className="px-5 py-4">

                            <span
                              className={`rounded-lg border px-2.5 py-1 font-semibold ${scoreClasses(
                                carrier?.lead_score ??
                                  null
                              )}`}
                            >
                              {carrier?.lead_score ??
                                0}
                            </span>

                          </td>


                          <td className="px-5 py-4">
                            {carrier?.dispatcher_probability !==
                              null &&
                            carrier?.dispatcher_probability !==
                              undefined
                              ? `${carrier.dispatcher_probability}%`
                              : "—"}
                          </td>


                          <td className="px-5 py-4 text-zinc-300">
                            {member.email}
                          </td>


                          <td className="px-5 py-4">

                            <span className="rounded-full border border-emerald-800 bg-emerald-950 px-2.5 py-1 text-xs text-emerald-300">
                              Active FMCSA
                            </span>

                          </td>

                        </tr>

                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

          </section>


          {/* ARM / CANCEL */}

          <section className="grid gap-5 xl:grid-cols-2">

            {activeBatch.status ===
              "prepared" && (

              <form
                action={
                  armPilotAction
                }
                className="rounded-2xl border border-amber-900/70 bg-amber-950/10 p-6"
              >

                <h2 className="text-xl font-semibold">
                  Arm Pilot
                </h2>

                <p className="mt-2 text-sm text-zinc-400">
                  Arming changes the paused enrollments to active and schedules Step 1. Master Sending remains OFF, so arming itself sends nothing.
                </p>


                <input
                  type="hidden"
                  name="batchId"
                  value={
                    activeBatch.id
                  }
                />


                <label className="mt-5 block">

                  <span className="text-sm text-zinc-400">
                    Type ARM
                  </span>

                  <input
                    name="confirmation"
                    autoComplete="off"
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
                    placeholder="ARM"
                  />

                </label>


                <button
                  type="submit"
                  disabled={
                    !masterSafe
                  }
                  className="mt-4 rounded-xl bg-amber-400 px-6 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Arm These {activeBatch.prepared_count} Carriers
                </button>

              </form>

            )}


            <form
              action={
                cancelPilotAction
              }
              className="rounded-2xl border border-red-900/60 bg-red-950/10 p-6"
            >

              <h2 className="text-xl font-semibold">
                Cancel Pilot
              </h2>

              <p className="mt-2 text-sm text-zinc-400">
                Stops all pilot enrollments. No future email from this pilot will be processed.
              </p>


              <input
                type="hidden"
                name="batchId"
                value={
                  activeBatch.id
                }
              />


              <label className="mt-5 block">

                <span className="text-sm text-zinc-400">
                  Type CANCEL
                </span>

                <input
                  name="confirmation"
                  autoComplete="off"
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
                  placeholder="CANCEL"
                />

              </label>


              <button
                type="submit"
                className="mt-4 rounded-xl border border-red-800 bg-red-950 px-6 py-3 font-bold text-red-300"
              >
                Cancel Pilot
              </button>

            </form>

          </section>

        </>

      ) : (

        <>

          {/* PREVIEW */}

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45">

            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 px-6 py-5">

              <div>

                <h2 className="text-xl font-semibold">
                  Pilot Preview
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Highest-ranked eligible carriers after safety exclusions.
                </p>

              </div>


              <div className="text-right text-sm text-zinc-500">

                Scanned:{" "}
                <span className="font-semibold text-zinc-300">
                  {preview.scanned}
                </span>

                <br />

                Eligible in scan:{" "}
                <span className="font-semibold text-emerald-300">
                  {preview.eligibleFound}
                </span>

              </div>

            </div>


            <div className="overflow-x-auto">

              <table className="w-full min-w-[1000px] text-left text-sm">

                <thead className="border-b border-zinc-800 bg-zinc-950/50 text-xs uppercase text-zinc-500">

                  <tr>

                    <th className="px-5 py-4">
                      #
                    </th>

                    <th className="px-5 py-4">
                      Carrier
                    </th>

                    <th className="px-5 py-4">
                      USDOT
                    </th>

                    <th className="px-5 py-4">
                      State
                    </th>

                    <th className="px-5 py-4">
                      Score
                    </th>

                    <th className="px-5 py-4">
                      Dispatcher Probability
                    </th>

                    <th className="px-5 py-4">
                      Fleet
                    </th>

                    <th className="px-5 py-4">
                      Email
                    </th>

                  </tr>

                </thead>


                <tbody className="divide-y divide-zinc-800">

                  {preview.carriers.map(
                    (
                      carrier,
                      index
                    ) => (

                      <tr
                        key={
                          carrier.id
                        }
                        className="hover:bg-zinc-900"
                      >

                        <td className="px-5 py-4 text-zinc-500">
                          {index + 1}
                        </td>


                        <td className="px-5 py-4">

                          <Link
                            href={`/admin/carriers/${carrier.dot_number}`}
                            className="font-semibold hover:text-blue-300"
                          >
                            {carrier.legal_name ||
                              carrier.dba_name ||
                              "Carrier"}
                          </Link>

                          {carrier.mc_number && (

                            <div className="mt-1 text-xs text-zinc-500">
                              {carrier.mc_number}
                            </div>

                          )}

                        </td>


                        <td className="px-5 py-4 font-mono">
                          {carrier.dot_number}
                        </td>


                        <td className="px-5 py-4">
                          {carrier.state ||
                            "—"}
                        </td>


                        <td className="px-5 py-4">

                          <span
                            className={`rounded-lg border px-2.5 py-1 font-semibold ${scoreClasses(
                              carrier.lead_score
                            )}`}
                          >
                            {carrier.lead_score ??
                              0}
                          </span>

                        </td>


                        <td className="px-5 py-4">
                          {carrier.dispatcher_probability !==
                            null &&
                          carrier.dispatcher_probability !==
                            undefined
                            ? `${carrier.dispatcher_probability}%`
                            : "—"}
                        </td>


                        <td className="px-5 py-4">
                          {carrier.power_units ??
                            0}
                          {" units / "}
                          {carrier.drivers ??
                            0}
                          {" drivers"}
                        </td>


                        <td className="px-5 py-4 text-zinc-300">
                          {carrier.email}
                        </td>

                      </tr>

                    )
                  )}


                  {preview.carriers.length ===
                    0 && (

                    <tr>

                      <td
                        colSpan={8}
                        className="px-5 py-12 text-center text-zinc-500"
                      >
                        No eligible carriers were found under the current launch rules.
                      </td>

                    </tr>

                  )}

                </tbody>

              </table>

            </div>

          </section>


          {/* PREPARE */}

          <section className="rounded-2xl border border-blue-900/60 bg-blue-950/10 p-6">

            <h2 className="text-xl font-semibold">
              Prepare Real-Carrier Pilot
            </h2>

            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              This creates CRM leads and PAUSED sequence enrollments only. Preparing the pilot does not send an email.
            </p>


            <form
              action={
                preparePilotAction
              }
              className="mt-6 grid gap-5 lg:grid-cols-[220px_1fr_auto]"
            >

              <label>

                <span className="text-sm text-zinc-400">
                  Pilot Size
                </span>

                <input
                  type="number"
                  name="pilotCount"
                  min="1"
                  max={
                    settings.pilot_limit
                  }
                  defaultValue={
                    Math.min(
                      settings.pilot_limit,
                      preview.carriers.length ||
                        settings.pilot_limit
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
                />

              </label>


              <label>

                <span className="text-sm text-zinc-400">
                  Type PREPARE
                </span>

                <input
                  name="confirmation"
                  autoComplete="off"
                  placeholder="PREPARE"
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
                />

              </label>


              <button
                type="submit"
                disabled={
                  !masterSafe ||
                  !settings.pilot_mode ||
                  preview.carriers.length ===
                    0
                }
                className="self-end rounded-xl bg-white px-7 py-3 font-bold text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prepare Pilot
              </button>

            </form>

          </section>

        </>

      )}


      {/* HISTORY */}

      {latestBatch && (

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-5">

          <div className="flex flex-wrap items-center justify-between gap-4">

            <div>

              <div className="text-xs uppercase text-zinc-500">
                Latest Pilot Record
              </div>

              <div className="mt-2 font-mono text-sm text-zinc-300">
                {latestBatch.id}
              </div>

            </div>


            <div className="flex items-center gap-4">

              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${batchClasses(
                  latestBatch.status
                )}`}
              >
                {latestBatch.status}
              </span>


              <span className="text-sm text-zinc-500">
                {latestBatch.prepared_count}
                {" carriers"}
              </span>

            </div>

          </div>

        </section>

      )}

    </div>
  );
}