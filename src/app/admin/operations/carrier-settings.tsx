import Link from "next/link";

import type {
  ReactNode,
} from "react";

import {
  createServerSupabase,
} from "@/lib/supabase/server";

import {
  updateCarrierOperatingProfileAction,
} from "./actions";


type CarrierRow = {
  id:
    string;

  lead_id:
    string |
    null;

  company_name:
    string;

  dot_number:
    number |
    null;

  mc_number:
    string |
    null;

  primary_contact_name:
    string |
    null;

  primary_contact_email:
    string |
    null;

  primary_contact_phone:
    string |
    null;

  load_board_access_status:
    string;

  load_board_provider:
    string |
    null;

  dispatch_fee_type:
    string |
    null;

  dispatch_fee_value:
    number |
    string |
    null;

  minimum_rate_per_mile:
    number |
    string |
    null;

  target_rate_per_mile:
    number |
    string |
    null;

  weekly_revenue_target:
    number |
    string |
    null;

  preferred_lanes:
    string[] |
    null;

  preferred_states:
    string[] |
    null;

  regions_to_avoid:
    string[] |
    null;

  max_deadhead_miles:
    number |
    null;

  preferred_trip_min_miles:
    number |
    null;

  preferred_trip_max_miles:
    number |
    null;

  default_mpg:
    number |
    string |
    null;

  default_fuel_price:
    number |
    string |
    null;

  operating_cost_per_mile:
    number |
    string |
    null;

  home_time_notes:
    string |
    null;

  operating_notes:
    string |
    null;
};


type ReadinessRow = {
  onboarding_id:
    string;

  ready_for_dispatch:
    boolean |
    null;

  missing_requirements:
    string[] |
    null;

  active_truck_count:
    number |
    null;

  available_truck_count:
    number |
    null;
};


const inputClass =
  "h-9 w-full rounded-lg border border-white/[0.07] bg-black/20 px-3 text-[9px] text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-blue-500/30";


const selectClass =
  "h-9 w-full rounded-lg border border-white/[0.07] bg-[#0b0f15] px-3 text-[9px] text-zinc-300 outline-none focus:border-blue-500/30";


const textareaClass =
  "min-h-[86px] w-full resize-y rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2 text-[9px] leading-4 text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-blue-500/30";


function Field({
  label,
  hint,
  children,
}: {
  label:
    string;

  hint?:
    string;

  children:
    ReactNode;
}) {
  return (
    <label className="block">

      <span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.08em] text-zinc-700">
        {label}
      </span>


      {children}


      {hint ? (
        <span className="mt-1 block text-[7px] leading-3 text-zinc-700">
          {hint}
        </span>
      ) : null}

    </label>
  );
}


function listValue(
  values:
    string[] |
    null,
) {
  return (
    values ??
    []
  ).join(
    ", ",
  );
}


function requirementLabel(
  value:
    string,
) {
  switch (
    value
  ) {
    case "company_name":
      return "Company";

    case "dot_number":
      return "USDOT";

    case "primary_contact":
      return "Primary Contact";

    case "signed_dispatch_agreement":
      return "Signed Agreement";

    case "load_board_access":
      return "Load Board";

    case "dispatch_fee":
      return "Dispatch Fee";

    case "active_truck":
      return "Active Truck";

    default:
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
}


export default async function CarrierSettings() {
  const supabase =
    createServerSupabase();


  const [
    carriersResult,
    readinessResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "carrier_onboardings",
        )
        .select(`
          id,
          lead_id,
          company_name,
          dot_number,
          mc_number,

          primary_contact_name,
          primary_contact_email,
          primary_contact_phone,

          load_board_access_status,
          load_board_provider,

          dispatch_fee_type,
          dispatch_fee_value,

          minimum_rate_per_mile,
          target_rate_per_mile,
          weekly_revenue_target,

          preferred_lanes,
          preferred_states,
          regions_to_avoid,

          max_deadhead_miles,
          preferred_trip_min_miles,
          preferred_trip_max_miles,

          default_mpg,
          default_fuel_price,
          operating_cost_per_mile,

          home_time_notes,
          operating_notes
        `)
        .eq(
          "status",
          "active",
        )
        .order(
          "company_name",
          {
            ascending:
              true,
          },
        ),

      supabase
        .from(
          "carrier_onboarding_readiness",
        )
        .select(`
          onboarding_id,
          ready_for_dispatch,
          missing_requirements,
          active_truck_count,
          available_truck_count
        `)
        .eq(
          "status",
          "active",
        ),
    ]);


  if (
    carriersResult.error
  ) {
    console.error(
      "OPERATING PROFILE ERROR:",
      carriersResult.error.message,
    );
  }


  if (
    readinessResult.error
  ) {
    console.error(
      "OPERATING READINESS ERROR:",
      readinessResult.error.message,
    );
  }


  const carriers =
    (
      carriersResult.data ??
      []
    ) as CarrierRow[];


  const readinessMap =
    new Map<
      string,
      ReadinessRow
    >();


  for (
    const readiness
    of (
      readinessResult.data ??
      []
    ) as ReadinessRow[]
  ) {
    readinessMap.set(
      readiness.onboarding_id,
      readiness,
    );
  }


  return (
    <section className="overflow-hidden rounded-[20px] border border-violet-500/10 bg-[linear-gradient(135deg,rgba(17,17,28,.96),rgba(8,12,17,.98))]">

      <div className="flex flex-col gap-4 border-b border-white/[0.055] px-5 py-5 lg:flex-row lg:items-center lg:justify-between">

        <div>

          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-violet-400">
            Phase 3E-C · Dispatch Profile
          </div>


          <h2 className="mt-2 text-[17px] font-semibold text-white">
            Carrier Operating Profiles
          </h2>


          <p className="mt-1 max-w-2xl text-[9px] leading-4 text-zinc-600">
            Maintain the commercial rules, lanes, targets,
            costs and operational instructions that dispatch
            should follow for each active client.
          </p>

        </div>


        <div className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[8px] text-zinc-500">
          {carriers.length} active carrier
          {carriers.length ===
          1
            ? ""
            : "s"}
        </div>

      </div>


      {carriers.length >
      0 ? (
        <div className="space-y-4 p-5">

          {carriers.map(
            (
              carrier,
            ) => {
              const readiness =
                readinessMap.get(
                  carrier.id,
                );


              const ready =
                readiness?.ready_for_dispatch ===
                true;


              const missing =
                readiness?.missing_requirements ??
                [];


              return (
                <details
                  key={
                    carrier.id
                  }
                  className="group overflow-hidden rounded-[17px] border border-white/[0.06] bg-black/15"
                >

                  <summary className="cursor-pointer list-none px-4 py-4">

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-2">

                          <div className="truncate text-[11px] font-semibold text-zinc-200">
                            {carrier.company_name}
                          </div>


                          <span
                            className={[
                              "rounded-full border px-2 py-0.5 text-[7px] font-semibold",
                              ready
                                ? "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300"
                                : "border-amber-500/20 bg-amber-500/[0.06] text-amber-300",
                            ].join(
                              " ",
                            )}
                          >
                            {ready
                              ? "DISPATCH READY"
                              : "ACTION REQUIRED"}
                          </span>

                        </div>


                        <div className="mt-1 text-[8px] text-zinc-700">

                          {carrier.dot_number
                            ? `USDOT ${carrier.dot_number}`
                            : "No USDOT"}

                          {carrier.mc_number
                            ? ` • MC ${carrier.mc_number}`
                            : ""}

                          {" • "}

                          {readiness?.active_truck_count ??
                            0} active truck
                          {(readiness?.active_truck_count ??
                            0) ===
                          1
                            ? ""
                            : "s"}

                        </div>

                      </div>


                      <div className="flex items-center gap-3">

                        <span className="text-[8px] text-zinc-600">
                          Click to edit
                        </span>

                        <span className="text-[12px] text-zinc-600 transition group-open:rotate-180">
                          ↓
                        </span>

                      </div>

                    </div>

                  </summary>


                  <form
                    action={
                      updateCarrierOperatingProfileAction
                    }
                    className="border-t border-white/[0.05] p-5"
                  >

                    <input
                      type="hidden"
                      name="onboardingId"
                      value={
                        carrier.id
                      }
                    />


                    {/* READINESS */}

                    {!ready &&
                    missing.length >
                      0 ? (
                      <div className="mb-5 rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-4">

                        <div className="text-[8px] font-semibold text-amber-300">
                          Current readiness blockers
                        </div>


                        <div className="mt-2 flex flex-wrap gap-1.5">

                          {missing.map(
                            (
                              item,
                            ) => (
                              <span
                                key={
                                  item
                                }
                                className="rounded-full border border-amber-500/15 px-2 py-1 text-[7px] text-amber-300/80"
                              >
                                {requirementLabel(
                                  item,
                                )}
                              </span>
                            ),
                          )}

                        </div>

                      </div>
                    ) : null}


                    {/* CONTACT */}

                    <div>

                      <div className="mb-3 text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                        Carrier Contact
                      </div>


                      <div className="grid gap-3 md:grid-cols-3">

                        <Field label="Primary Contact">

                          <input
                            name="primaryContactName"
                            defaultValue={
                              carrier.primary_contact_name ??
                              ""
                            }
                            className={
                              inputClass
                            }
                            placeholder="Owner / dispatcher"
                          />

                        </Field>


                        <Field label="Email">

                          <input
                            name="primaryContactEmail"
                            type="email"
                            defaultValue={
                              carrier.primary_contact_email ??
                              ""
                            }
                            className={
                              inputClass
                            }
                            placeholder="carrier@example.com"
                          />

                        </Field>


                        <Field label="Phone">

                          <input
                            name="primaryContactPhone"
                            defaultValue={
                              carrier.primary_contact_phone ??
                              ""
                            }
                            className={
                              inputClass
                            }
                            placeholder="+1..."
                          />

                        </Field>

                      </div>

                    </div>


                    {/* LOAD BOARD */}

                    <div className="mt-6 border-t border-white/[0.05] pt-5">

                      <div className="mb-3 text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                        Load Board & Dispatch Agreement
                      </div>


                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

                        <Field label="Load Board Status">

                          <select
                            name="loadBoardAccessStatus"
                            defaultValue={
                              carrier.load_board_access_status
                            }
                            className={
                              selectClass
                            }
                          >
                            <option value="not_requested">
                              Not Requested
                            </option>

                            <option value="requested">
                              Requested
                            </option>

                            <option value="invited">
                              Invited
                            </option>

                            <option value="active">
                              Active
                            </option>

                            <option value="revoked">
                              Revoked
                            </option>
                          </select>

                        </Field>


                        <Field label="Load Board Provider">

                          <input
                            name="loadBoardProvider"
                            defaultValue={
                              carrier.load_board_provider ??
                              ""
                            }
                            className={
                              inputClass
                            }
                            placeholder="DAT / Truckstop / Other"
                          />

                        </Field>


                        <Field label="Dispatch Fee Type">

                          <select
                            name="dispatchFeeType"
                            defaultValue={
                              carrier.dispatch_fee_type ??
                              ""
                            }
                            className={
                              selectClass
                            }
                          >
                            <option value="">
                              Not configured
                            </option>

                            <option value="percentage">
                              Percentage
                            </option>

                            <option value="flat_per_load">
                              Flat Per Load
                            </option>

                            <option value="weekly_flat">
                              Weekly Flat
                            </option>
                          </select>

                        </Field>


                        <Field
                          label="Dispatch Fee Value"
                          hint="Example: 7 for 7%, or 250 for $250."
                        >

                          <input
                            name="dispatchFeeValue"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={
                              carrier.dispatch_fee_value ??
                              ""
                            }
                            className={
                              inputClass
                            }
                            placeholder="7"
                          />

                        </Field>

                      </div>

                    </div>


                    {/* REVENUE RULES */}

                    <div className="mt-6 border-t border-white/[0.05] pt-5">

                      <div className="mb-3 text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                        Revenue & Rate Rules
                      </div>


                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

                        <Field
                          label="Minimum RPM"
                          hint="Carrier-level floor. Truck-specific RPM may override this."
                        >

                          <input
                            name="minimumRatePerMile"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={
                              carrier.minimum_rate_per_mile ??
                              ""
                            }
                            className={
                              inputClass
                            }
                            placeholder="2.00"
                          />

                        </Field>


                        <Field label="Target RPM">

                          <input
                            name="targetRatePerMile"
                            type="number"
                            min="0.01"
                            step="0.01"
                            defaultValue={
                              carrier.target_rate_per_mile ??
                              ""
                            }
                            className={
                              inputClass
                            }
                            placeholder="2.50"
                          />

                        </Field>


                        <Field label="Weekly Revenue Target">

                          <input
                            name="weeklyRevenueTarget"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={
                              carrier.weekly_revenue_target ??
                              ""
                            }
                            className={
                              inputClass
                            }
                            placeholder="7000"
                          />

                        </Field>


                        <Field
                          label="Max Deadhead"
                          hint="Default for the carrier. Individual trucks may override it."
                        >

                          <input
                            name="maxDeadheadMiles"
                            type="number"
                            min="0"
                            defaultValue={
                              carrier.max_deadhead_miles ??
                              ""
                            }
                            className={
                              inputClass
                            }
                            placeholder="150"
                          />

                        </Field>

                      </div>

                    </div>


                    {/* LANES */}

                    <div className="mt-6 border-t border-white/[0.05] pt-5">

                      <div className="mb-3 text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                        Lane & Trip Preferences
                      </div>


                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">

                        <Field
                          label="Preferred States"
                          hint="Comma separated."
                        >

                          <input
                            name="preferredStates"
                            defaultValue={
                              listValue(
                                carrier.preferred_states,
                              )
                            }
                            className={
                              inputClass
                            }
                            placeholder="TX, OK, AR, LA"
                          />

                        </Field>


                        <Field
                          label="Preferred Lanes"
                          hint="Comma separated."
                        >

                          <input
                            name="preferredLanes"
                            defaultValue={
                              listValue(
                                carrier.preferred_lanes,
                              )
                            }
                            className={
                              inputClass
                            }
                            placeholder="Dallas → Atlanta, Houston → Memphis"
                          />

                        </Field>


                        <Field
                          label="Regions To Avoid"
                          hint="Comma separated."
                        >

                          <input
                            name="regionsToAvoid"
                            defaultValue={
                              listValue(
                                carrier.regions_to_avoid,
                              )
                            }
                            className={
                              inputClass
                            }
                            placeholder="Northeast, NYC, California"
                          />

                        </Field>


                        <Field label="Minimum Trip Miles">

                          <input
                            name="preferredTripMinMiles"
                            type="number"
                            min="0"
                            defaultValue={
                              carrier.preferred_trip_min_miles ??
                              ""
                            }
                            className={
                              inputClass
                            }
                            placeholder="400"
                          />

                        </Field>


                        <Field label="Maximum Trip Miles">

                          <input
                            name="preferredTripMaxMiles"
                            type="number"
                            min="0"
                            defaultValue={
                              carrier.preferred_trip_max_miles ??
                              ""
                            }
                            className={
                              inputClass
                            }
                            placeholder="1500"
                          />

                        </Field>

                      </div>

                    </div>


                    {/* COST MODEL */}

                    <div className="mt-6 border-t border-white/[0.05] pt-5">

                      <div className="mb-3 text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                        Operating Economics
                      </div>


                      <div className="grid gap-3 md:grid-cols-3">

                        <Field label="Default MPG">

                          <input
                            name="defaultMpg"
                            type="number"
                            min="0.01"
                            step="0.01"
                            defaultValue={
                              carrier.default_mpg ??
                              ""
                            }
                            className={
                              inputClass
                            }
                            placeholder="6.5"
                          />

                        </Field>


                        <Field label="Default Fuel Price">

                          <input
                            name="defaultFuelPrice"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={
                              carrier.default_fuel_price ??
                              ""
                            }
                            className={
                              inputClass
                            }
                            placeholder="3.75"
                          />

                        </Field>


                        <Field label="Operating Cost / Mile">

                          <input
                            name="operatingCostPerMile"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={
                              carrier.operating_cost_per_mile ??
                              ""
                            }
                            className={
                              inputClass
                            }
                            placeholder="1.45"
                          />

                        </Field>

                      </div>

                    </div>


                    {/* INSTRUCTIONS */}

                    <div className="mt-6 border-t border-white/[0.05] pt-5">

                      <div className="mb-3 text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                        Dispatch Instructions
                      </div>


                      <div className="grid gap-3 md:grid-cols-2">

                        <Field label="Home-Time Instructions">

                          <textarea
                            name="homeTimeNotes"
                            defaultValue={
                              carrier.home_time_notes ??
                              ""
                            }
                            className={
                              textareaClass
                            }
                            placeholder="Needs to be home every second weekend..."
                          />

                        </Field>


                        <Field label="Operating Notes">

                          <textarea
                            name="operatingNotes"
                            defaultValue={
                              carrier.operating_notes ??
                              ""
                            }
                            className={
                              textareaClass
                            }
                            placeholder="No NYC, driver prefers morning pickup, no touch freight..."
                          />

                        </Field>

                      </div>

                    </div>


                    {/* FOOTER */}

                    <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.05] pt-5 sm:flex-row sm:items-center sm:justify-between">

                      <div className="flex flex-wrap gap-3 text-[8px]">

                        {carrier.lead_id ? (
                          <Link
                            href={`/admin/leads/${carrier.lead_id}`}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            Lead 360 →
                          </Link>
                        ) : null}


                        {carrier.dot_number ? (
                          <Link
                            href={`/admin/carriers/${carrier.dot_number}`}
                            className="text-emerald-400 hover:text-emerald-300"
                          >
                            Carrier 360 →
                          </Link>
                        ) : null}


                        <Link
                          href={`/admin/onboarding/${carrier.id}/documents`}
                          className="text-violet-400 hover:text-violet-300"
                        >
                          Document Vault →
                        </Link>

                      </div>


                      <button
                        type="submit"
                        className="inline-flex h-9 items-center justify-center rounded-lg bg-violet-400 px-4 text-[9px] font-bold text-black hover:bg-violet-300"
                      >
                        Save Operating Profile
                      </button>

                    </div>

                  </form>

                </details>
              );
            },
          )}

        </div>
      ) : (
        <div className="p-5">

          <div className="rounded-[15px] border border-white/[0.055] bg-black/15 p-5">

            <div className="text-[10px] font-semibold text-zinc-400">
              No active carrier profiles yet.
            </div>


            <div className="mt-1 text-[9px] leading-4 text-zinc-700">
              Carrier operating settings become editable after
              the Phase 3D activation process is complete.
            </div>


            <Link
              href="/admin/conversions"
              className="mt-4 inline-flex h-8 items-center rounded-lg border border-emerald-500/15 bg-emerald-500/[0.05] px-3 text-[8px] font-semibold text-emerald-300"
            >
              Open Conversions →
            </Link>

          </div>

        </div>
      )}

    </section>
  );
}