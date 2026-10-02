import Link from "next/link";

import {
  createServerSupabase,
} from "@/lib/supabase/server";

import {
  createTruckAction,
  updateTruckOperationsAction,
} from "./actions";


type ActiveCarrier = {
  id:
    string;

  company_name:
    string;

  dot_number:
    number |
    null;

  mc_number:
    string |
    null;

  minimum_rate_per_mile:
    number |
    string |
    null;

  max_deadhead_miles:
    number |
    null;
};


type TruckRow = {
  truck_id:
    string;

  onboarding_id:
    string;

  company_name:
    string |
    null;

  dot_number:
    number |
    null;

  unit_number:
    string |
    null;

  truck_type:
    string |
    null;

  trailer_type:
    string |
    null;

  driver_name:
    string |
    null;

  driver_phone:
    string |
    null;

  truck_status:
    string |
    null;

  availability_status:
    string |
    null;

  current_city:
    string |
    null;

  current_state:
    string |
    null;

  current_zip:
    string |
    null;

  preferred_destination:
    string |
    null;

  preferred_destination_states:
    string[] |
    null;

  max_deadhead_miles:
    number |
    null;

  minimum_rate_per_mile:
    number |
    string |
    null;

  availability_notes:
    string |
    null;

  ready_for_load_search:
    boolean |
    null;
};


function pretty(
  value:
    string |
    null |
    undefined,
) {
  if (!value) {
    return "—";
  }


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


const inputClass =
  "h-9 w-full rounded-lg border border-white/[0.07] bg-black/20 px-3 text-[9px] text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-blue-500/30";


const selectClass =
  "h-9 w-full rounded-lg border border-white/[0.07] bg-[#0b0f15] px-3 text-[9px] text-zinc-300 outline-none focus:border-blue-500/30";


const textareaClass =
  "min-h-[78px] w-full resize-y rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2 text-[9px] leading-4 text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-blue-500/30";


function Field({
  label,
  children,
}: {
  label:
    string;

  children:
    React.ReactNode;
}) {
  return (
    <label className="block">

      <span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.08em] text-zinc-700">
        {label}
      </span>

      {children}

    </label>
  );
}


export default async function OperationsControls() {
  const supabase =
    createServerSupabase();


  const [
    carrierResult,
    truckResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "carrier_onboardings",
        )
        .select(`
          id,
          company_name,
          dot_number,
          mc_number,
          minimum_rate_per_mile,
          max_deadhead_miles
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
          "truck_dispatch_board",
        )
        .select(`
          truck_id,
          onboarding_id,
          company_name,
          dot_number,
          unit_number,
          truck_type,
          trailer_type,
          driver_name,
          driver_phone,
          truck_status,
          availability_status,
          current_city,
          current_state,
          current_zip,
          preferred_destination,
          preferred_destination_states,
          max_deadhead_miles,
          minimum_rate_per_mile,
          availability_notes,
          ready_for_load_search
        `)
        .eq(
          "carrier_status",
          "active",
        )
        .order(
          "company_name",
          {
            ascending:
              true,
          },
        )
        .order(
          "unit_number",
          {
            ascending:
              true,
          },
        ),
    ]);


  if (
    carrierResult.error
  ) {
    console.error(
      "OPERATIONS CONTROL CARRIERS ERROR:",
      carrierResult.error.message,
    );
  }


  if (
    truckResult.error
  ) {
    console.error(
      "OPERATIONS CONTROL TRUCKS ERROR:",
      truckResult.error.message,
    );
  }


  const carriers =
    (
      carrierResult.data ??
      []
    ) as ActiveCarrier[];


  const trucks =
    (
      truckResult.data ??
      []
    ) as TruckRow[];


  return (
    <div className="space-y-6">

      {/* =====================================================
          REGISTER TRUCK
      ===================================================== */}

      <section className="overflow-hidden rounded-[20px] border border-blue-500/10 bg-[linear-gradient(135deg,rgba(14,21,29,.97),rgba(8,12,17,.98))]">

        <div className="border-b border-white/[0.055] px-5 py-5">

          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-blue-400">
            Phase 3E-B · Fleet Controls
          </div>


          <h2 className="mt-2 text-[17px] font-semibold text-white">
            Register Truck
          </h2>


          <p className="mt-1 max-w-2xl text-[9px] leading-4 text-zinc-600">
            Add equipment only after the carrier has passed
            the Phase 3D activation gate.
          </p>

        </div>


        {carriers.length >
        0 ? (
          <form
            action={
              createTruckAction
            }
            className="p-5"
          >

            {/* CARRIER */}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

              <Field label="Active Carrier">

                <select
                  name="onboardingId"
                  required
                  className={
                    selectClass
                  }
                  defaultValue=""
                >

                  <option
                    value=""
                    disabled
                  >
                    Select carrier
                  </option>


                  {carriers.map(
                    (
                      carrier,
                    ) => (
                      <option
                        key={
                          carrier.id
                        }
                        value={
                          carrier.id
                        }
                      >
                        {carrier.company_name}
                        {carrier.dot_number
                          ? ` — DOT ${carrier.dot_number}`
                          : ""}
                      </option>
                    ),
                  )}

                </select>

              </Field>


              <Field label="Unit Number">

                <input
                  name="unitNumber"
                  required
                  className={
                    inputClass
                  }
                  placeholder="101"
                />

              </Field>


              <Field label="Truck Type">

                <select
                  name="truckType"
                  required
                  defaultValue="semi"
                  className={
                    selectClass
                  }
                >
                  <option value="semi">
                    Semi
                  </option>

                  <option value="box_truck">
                    Box Truck
                  </option>

                  <option value="hotshot">
                    Hotshot
                  </option>

                  <option value="sprinter">
                    Sprinter
                  </option>

                  <option value="straight_truck">
                    Straight Truck
                  </option>

                  <option value="other">
                    Other
                  </option>
                </select>

              </Field>


              <Field label="Truck Status">

                <select
                  name="truckStatus"
                  defaultValue="active"
                  className={
                    selectClass
                  }
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="maintenance">
                    Maintenance
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>
                </select>

              </Field>

            </div>


            {/* EQUIPMENT */}

            <div className="mt-5 border-t border-white/[0.05] pt-5">

              <div className="mb-3 text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                Equipment & Driver
              </div>


              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

                <Field label="Trailer Type">

                  <input
                    name="trailerType"
                    className={
                      inputClass
                    }
                    placeholder="Dry Van / Reefer / Flatbed"
                  />

                </Field>


                <Field label="Trailer Length (ft)">

                  <input
                    name="trailerLengthFt"
                    type="number"
                    min="1"
                    className={
                      inputClass
                    }
                    placeholder="53"
                  />

                </Field>


                <Field label="Max Weight (lbs)">

                  <input
                    name="maxWeightLbs"
                    type="number"
                    min="1"
                    className={
                      inputClass
                    }
                    placeholder="45000"
                  />

                </Field>


                <Field label="Driver Name">

                  <input
                    name="driverName"
                    className={
                      inputClass
                    }
                    placeholder="Driver name"
                  />

                </Field>


                <Field label="Driver Phone">

                  <input
                    name="driverPhone"
                    className={
                      inputClass
                    }
                    placeholder="+1..."
                  />

                </Field>


                <Field label="Home City">

                  <input
                    name="homeCity"
                    className={
                      inputClass
                    }
                    placeholder="Dallas"
                  />

                </Field>


                <Field label="Home State">

                  <input
                    name="homeState"
                    maxLength={
                      30
                    }
                    className={
                      inputClass
                    }
                    placeholder="TX"
                  />

                </Field>


                <Field label="Initial Availability">

                  <select
                    name="availabilityStatus"
                    defaultValue="unavailable"
                    className={
                      selectClass
                    }
                  >
                    <option value="available">
                      Available
                    </option>

                    <option value="booked">
                      Booked
                    </option>

                    <option value="in_transit">
                      In Transit
                    </option>

                    <option value="unavailable">
                      Unavailable
                    </option>

                    <option value="off_duty">
                      Off Duty
                    </option>

                    <option value="maintenance">
                      Maintenance
                    </option>
                  </select>

                </Field>

              </div>

            </div>


            {/* AVAILABILITY */}

            <div className="mt-5 border-t border-white/[0.05] pt-5">

              <div className="mb-3 text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                Initial Dispatch Position
              </div>


              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

                <Field label="Current City">

                  <input
                    name="currentCity"
                    className={
                      inputClass
                    }
                    placeholder="Chicago"
                  />

                </Field>


                <Field label="Current State">

                  <input
                    name="currentState"
                    className={
                      inputClass
                    }
                    placeholder="IL"
                  />

                </Field>


                <Field label="Current ZIP">

                  <input
                    name="currentZip"
                    className={
                      inputClass
                    }
                    placeholder="60601"
                  />

                </Field>


                <Field label="Preferred Destination">

                  <input
                    name="preferredDestination"
                    className={
                      inputClass
                    }
                    placeholder="Southeast / Dallas / Anywhere"
                  />

                </Field>


                <Field label="Destination States">

                  <input
                    name="preferredDestinationStates"
                    className={
                      inputClass
                    }
                    placeholder="TX, OK, AR"
                  />

                </Field>


                <Field label="Max Deadhead Miles">

                  <input
                    name="maxDeadheadMiles"
                    type="number"
                    min="0"
                    className={
                      inputClass
                    }
                    placeholder="150"
                  />

                </Field>


                <Field label="Minimum RPM">

                  <input
                    name="minimumRatePerMile"
                    type="number"
                    min="0"
                    step="0.01"
                    className={
                      inputClass
                    }
                    placeholder="2.00"
                  />

                </Field>

              </div>

            </div>


            {/* NOTES */}

            <div className="mt-5 grid gap-3 md:grid-cols-2">

              <Field label="Equipment Notes">

                <textarea
                  name="equipmentNotes"
                  className={
                    textareaClass
                  }
                  placeholder="Liftgate, straps, tarps, pallet jack, special equipment..."
                />

              </Field>


              <Field label="Availability Notes">

                <textarea
                  name="availabilityNotes"
                  className={
                    textareaClass
                  }
                  placeholder="Driver preferences, appointment limitations, reload instructions..."
                />

              </Field>

            </div>


            <div className="mt-5 flex justify-end">

              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-lg bg-blue-400 px-4 text-[9px] font-bold text-black hover:bg-blue-300"
              >
                Register Truck →
              </button>

            </div>

          </form>
        ) : (
          <div className="p-5">

            <div className="rounded-[15px] border border-amber-500/15 bg-amber-500/[0.03] p-5">

              <div className="text-[10px] font-semibold text-amber-300">
                No active carrier is available for truck registration.
              </div>


              <div className="mt-2 max-w-xl text-[9px] leading-5 text-zinc-600">
                Complete the Client → Onboarding → Active
                Carrier handoff first. Truck registration is
                intentionally blocked before carrier activation.
              </div>


              <Link
                href="/admin/conversions"
                className="mt-4 inline-flex h-8 items-center rounded-lg border border-emerald-500/15 bg-emerald-500/[0.05] px-3 text-[8px] font-semibold text-emerald-300 hover:bg-emerald-500/[0.1]"
              >
                Open Conversion Pipeline →
              </Link>

            </div>

          </div>
        )}

      </section>


      {/* =====================================================
          LIVE TRUCK AVAILABILITY
      ===================================================== */}

      <section className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.018]">

        <div className="flex items-start justify-between gap-4 border-b border-white/[0.055] px-5 py-4">

          <div>

            <h2 className="text-[13px] font-semibold text-zinc-200">
              Live Truck Availability Controls
            </h2>


            <p className="mt-1 text-[9px] leading-4 text-zinc-600">
              Update equipment state, truck location and
              dispatch preferences. Every availability change
              is retained in the existing history table.
            </p>

          </div>


          <div className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[8px] text-zinc-500">
            {trucks.length} truck
            {trucks.length ===
            1
              ? ""
              : "s"}
          </div>

        </div>


        {trucks.length >
        0 ? (
          <div className="space-y-3 p-5">

            {trucks.map(
              (
                truck,
              ) => (
                <form
                  action={
                    updateTruckOperationsAction
                  }
                  key={
                    truck.truck_id
                  }
                  className="rounded-[16px] border border-white/[0.06] bg-black/15 p-4"
                >

                  <input
                    type="hidden"
                    name="truckId"
                    value={
                      truck.truck_id
                    }
                  />


                  {/* TRUCK HEADER */}

                  <div className="flex flex-col gap-3 border-b border-white/[0.05] pb-4 sm:flex-row sm:items-start sm:justify-between">

                    <div>

                      <div className="flex flex-wrap items-center gap-2">

                        <div className="text-[11px] font-semibold text-zinc-200">
                          {truck.company_name ||
                            "Carrier"}{" "}
                          · Unit{" "}
                          {truck.unit_number ||
                            "—"}
                        </div>


                        {truck.ready_for_load_search ? (
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2 py-0.5 text-[7px] font-semibold text-emerald-300">
                            DISPATCH READY
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-500/15 bg-amber-500/[0.05] px-2 py-0.5 text-[7px] font-semibold text-amber-300">
                            NOT READY
                          </span>
                        )}

                      </div>


                      <div className="mt-1 text-[8px] text-zinc-700">
                        {pretty(
                          truck.truck_type,
                        )}

                        {truck.trailer_type
                          ? ` • ${truck.trailer_type}`
                          : ""}

                        {truck.driver_name
                          ? ` • ${truck.driver_name}`
                          : ""}
                      </div>

                    </div>


                    <div className="text-[8px] text-zinc-700">
                      DOT{" "}
                      {truck.dot_number ||
                        "—"}
                    </div>

                  </div>


                  {/* STATUS */}

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">

                    <Field label="Truck Status">

                      <select
                        name="truckStatus"
                        defaultValue={
                          truck.truck_status ||
                          "active"
                        }
                        className={
                          selectClass
                        }
                      >
                        <option value="active">
                          Active
                        </option>

                        <option value="maintenance">
                          Maintenance
                        </option>

                        <option value="inactive">
                          Inactive
                        </option>
                      </select>

                    </Field>


                    <Field label="Availability">

                      <select
                        name="availabilityStatus"
                        defaultValue={
                          truck.availability_status ||
                          "unavailable"
                        }
                        className={
                          selectClass
                        }
                      >
                        <option value="available">
                          Available
                        </option>

                        <option value="booked">
                          Booked
                        </option>

                        <option value="in_transit">
                          In Transit
                        </option>

                        <option value="unavailable">
                          Unavailable
                        </option>

                        <option value="off_duty">
                          Off Duty
                        </option>

                        <option value="maintenance">
                          Maintenance
                        </option>
                      </select>

                    </Field>


                    <Field label="Minimum RPM">

                      <input
                        name="minimumRatePerMile"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={
                          truck.minimum_rate_per_mile ??
                          ""
                        }
                        className={
                          inputClass
                        }
                      />

                    </Field>


                    <Field label="Max Deadhead Miles">

                      <input
                        name="maxDeadheadMiles"
                        type="number"
                        min="0"
                        defaultValue={
                          truck.max_deadhead_miles ??
                          ""
                        }
                        className={
                          inputClass
                        }
                      />

                    </Field>

                  </div>


                  {/* LOCATION */}

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">

                    <Field label="Current City">

                      <input
                        name="currentCity"
                        defaultValue={
                          truck.current_city ??
                          ""
                        }
                        className={
                          inputClass
                        }
                      />

                    </Field>


                    <Field label="Current State">

                      <input
                        name="currentState"
                        defaultValue={
                          truck.current_state ??
                          ""
                        }
                        className={
                          inputClass
                        }
                      />

                    </Field>


                    <Field label="Current ZIP">

                      <input
                        name="currentZip"
                        defaultValue={
                          truck.current_zip ??
                          ""
                        }
                        className={
                          inputClass
                        }
                      />

                    </Field>


                    <Field label="Preferred Destination">

                      <input
                        name="preferredDestination"
                        defaultValue={
                          truck.preferred_destination ??
                          ""
                        }
                        className={
                          inputClass
                        }
                      />

                    </Field>

                  </div>


                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">

                    <Field label="Destination States">

                      <input
                        name="preferredDestinationStates"
                        defaultValue={
                          (
                            truck.preferred_destination_states ??
                            []
                          ).join(
                            ", ",
                          )
                        }
                        className={
                          inputClass
                        }
                        placeholder="TX, OK, AR"
                      />

                    </Field>


                    <Field label="Availability Notes">

                      <input
                        name="availabilityNotes"
                        defaultValue={
                          truck.availability_notes ??
                          ""
                        }
                        className={
                          inputClass
                        }
                        placeholder="Driver or dispatch note"
                      />

                    </Field>


                    <div className="flex items-end">

                      <button
                        type="submit"
                        className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/[0.08] px-4 text-[8px] font-semibold text-blue-300 hover:bg-blue-500/[0.14] md:w-auto"
                      >
                        Save Live Status
                      </button>

                    </div>

                  </div>

                </form>
              ),
            )}

          </div>
        ) : (
          <div className="p-5">

            <div className="rounded-[15px] border border-white/[0.055] bg-black/15 p-5">

              <div className="text-[10px] font-semibold text-zinc-400">
                No truck availability records yet.
              </div>


              <div className="mt-1 text-[9px] leading-4 text-zinc-700">
                Register the first truck above once an active
                carrier is available. Its initial availability
                record and history snapshot will be created
                automatically.
              </div>

            </div>

          </div>
        )}

      </section>

    </div>
  );
}