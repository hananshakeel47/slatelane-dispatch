import {
  createServerSupabase,
} from "@/lib/supabase/server";


type HistoryRow = {
  id:
    string;

  truck_id:
    string;

  availability_status:
    string;

  available_at:
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

  notes:
    string |
    null;

  recorded_at:
    string;
};


type TruckRow = {
  id:
    string;

  onboarding_id:
    string;

  unit_number:
    string;

  truck_type:
    string;

  driver_name:
    string |
    null;
};


type CarrierRow = {
  id:
    string;

  company_name:
    string;

  dot_number:
    number |
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
    date,
  );
}


function rate(
  value:
    number |
    string |
    null,
) {
  if (
    value ===
    null
  ) {
    return "—";
  }


  const parsed =
    Number(
      value,
    );


  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return "—";
  }


  return `$${parsed.toFixed(
    2,
  )}/mi`;
}


function statusClasses(
  status:
    string,
) {
  switch (
    status
  ) {
    case "available":
      return "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300";

    case "booked":
      return "border-blue-500/20 bg-blue-500/[0.07] text-blue-300";

    case "in_transit":
      return "border-violet-500/20 bg-violet-500/[0.07] text-violet-300";

    case "maintenance":
      return "border-red-500/20 bg-red-500/[0.07] text-red-300";

    case "off_duty":
      return "border-amber-500/20 bg-amber-500/[0.06] text-amber-300";

    default:
      return "border-white/[0.07] bg-white/[0.025] text-zinc-500";
  }
}


export default async function OperationsHistory() {
  const supabase =
    createServerSupabase();


  const {
    data:
      historyData,

    error:
      historyError,
  } =
    await supabase
      .from(
        "truck_availability_history",
      )
      .select(`
        id,
        truck_id,
        availability_status,
        available_at,
        current_city,
        current_state,
        current_zip,
        preferred_destination,
        preferred_destination_states,
        max_deadhead_miles,
        minimum_rate_per_mile,
        notes,
        recorded_at
      `)
      .order(
        "recorded_at",
        {
          ascending:
            false,
        },
      )
      .limit(
        100,
      );


  if (
    historyError
  ) {
    console.error(
      "TRUCK AVAILABILITY HISTORY ERROR:",
      historyError.message,
    );
  }


  const history =
    (
      historyData ??
      []
    ) as HistoryRow[];


  const truckIds =
    [
      ...new Set(
        history.map(
          (
            row,
          ) =>
            row.truck_id,
        ),
      ),
    ];


  const truckMap =
    new Map<
      string,
      TruckRow
    >();


  const carrierMap =
    new Map<
      string,
      CarrierRow
    >();


  if (
    truckIds.length >
    0
  ) {
    const {
      data:
        truckData,

      error:
        truckError,
    } =
      await supabase
        .from(
          "trucks",
        )
        .select(`
          id,
          onboarding_id,
          unit_number,
          truck_type,
          driver_name
        `)
        .in(
          "id",
          truckIds,
        );


    if (
      truckError
    ) {
      console.error(
        "HISTORY TRUCK LOOKUP ERROR:",
        truckError.message,
      );
    }


    const trucks =
      (
        truckData ??
        []
      ) as TruckRow[];


    for (
      const truck
      of trucks
    ) {
      truckMap.set(
        truck.id,
        truck,
      );
    }


    const onboardingIds =
      [
        ...new Set(
          trucks.map(
            (
              truck,
            ) =>
              truck.onboarding_id,
          ),
        ),
      ];


    if (
      onboardingIds.length >
      0
    ) {
      const {
        data:
          carrierData,

        error:
          carrierError,
      } =
        await supabase
          .from(
            "carrier_onboardings",
          )
          .select(`
            id,
            company_name,
            dot_number
          `)
          .in(
            "id",
            onboardingIds,
          );


      if (
        carrierError
      ) {
        console.error(
          "HISTORY CARRIER LOOKUP ERROR:",
          carrierError.message,
        );
      }


      for (
        const carrier
        of (
          carrierData ??
          []
        ) as CarrierRow[]
      ) {
        carrierMap.set(
          carrier.id,
          carrier,
        );
      }
    }
  }


  return (
    <section className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.018]">

      <div className="flex flex-col gap-3 border-b border-white/[0.055] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-emerald-400">
            Phase 3E-D · Operations Audit
          </div>


          <h2 className="mt-2 text-[14px] font-semibold text-zinc-200">
            Truck Availability History
          </h2>


          <p className="mt-1 text-[9px] leading-4 text-zinc-600">
            Automatic audit trail generated whenever truck
            availability, location, rate or dispatch
            preferences change.
          </p>

        </div>


        <div className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[8px] text-zinc-500">
          Last {history.length} change
          {history.length ===
          1
            ? ""
            : "s"}
        </div>

      </div>


      {history.length >
      0 ? (
        <div className="overflow-x-auto p-5">

          <table className="w-full min-w-[1120px] text-left">

            <thead>

              <tr className="border-b border-white/[0.055] text-[7px] uppercase tracking-[0.1em] text-zinc-700">

                <th className="pb-3 pr-4 font-semibold">
                  Carrier / Truck
                </th>

                <th className="pb-3 pr-4 font-semibold">
                  Status
                </th>

                <th className="pb-3 pr-4 font-semibold">
                  Location
                </th>

                <th className="pb-3 pr-4 font-semibold">
                  Destination
                </th>

                <th className="pb-3 pr-4 font-semibold">
                  Deadhead
                </th>

                <th className="pb-3 pr-4 font-semibold">
                  Minimum RPM
                </th>

                <th className="pb-3 pr-4 font-semibold">
                  Notes
                </th>

                <th className="pb-3 text-right font-semibold">
                  Recorded
                </th>

              </tr>

            </thead>


            <tbody>

              {history.map(
                (
                  row,
                ) => {
                  const truck =
                    truckMap.get(
                      row.truck_id,
                    );


                  const carrier =
                    truck
                      ? carrierMap.get(
                          truck.onboarding_id,
                        )
                      : undefined;


                  return (
                    <tr
                      key={
                        row.id
                      }
                      className="border-b border-white/[0.04] last:border-b-0"
                    >

                      <td className="py-4 pr-4">

                        <div className="text-[9px] font-semibold text-zinc-300">
                          {carrier?.company_name ??
                            "Unknown Carrier"}
                        </div>


                        <div className="mt-1 text-[8px] text-zinc-700">

                          Unit{" "}
                          {truck?.unit_number ??
                            "—"}

                          {truck?.driver_name
                            ? ` • ${truck.driver_name}`
                            : ""}

                          {carrier?.dot_number
                            ? ` • DOT ${carrier.dot_number}`
                            : ""}

                        </div>

                      </td>


                      <td className="py-4 pr-4">

                        <span
                          className={`rounded-full border px-2 py-1 text-[7px] font-semibold ${statusClasses(
                            row.availability_status,
                          )}`}
                        >
                          {pretty(
                            row.availability_status,
                          )}
                        </span>


                        {row.available_at ? (
                          <div className="mt-1 text-[7px] text-zinc-700">
                            Available since{" "}
                            {formatDate(
                              row.available_at,
                            )}
                          </div>
                        ) : null}

                      </td>


                      <td className="py-4 pr-4">

                        <div className="text-[9px] text-zinc-400">

                          {row.current_city ||
                            "—"}

                          {row.current_state
                            ? `, ${row.current_state}`
                            : ""}

                        </div>


                        <div className="mt-1 text-[8px] text-zinc-700">
                          {row.current_zip ||
                            ""}
                        </div>

                      </td>


                      <td className="py-4 pr-4">

                        <div className="max-w-[170px] text-[8px] leading-4 text-zinc-500">
                          {row.preferred_destination ||
                            (
                              row.preferred_destination_states ??
                              []
                            ).join(
                              ", ",
                            ) ||
                            "—"}
                        </div>

                      </td>


                      <td className="py-4 pr-4 text-[9px] text-zinc-400">
                        {row.max_deadhead_miles !==
                        null
                          ? `${row.max_deadhead_miles} mi`
                          : "—"}
                      </td>


                      <td className="py-4 pr-4 text-[9px] font-medium text-zinc-300">
                        {rate(
                          row.minimum_rate_per_mile,
                        )}
                      </td>


                      <td className="py-4 pr-4">

                        <div className="max-w-[200px] truncate text-[8px] text-zinc-600">
                          {row.notes ||
                            "—"}
                        </div>

                      </td>


                      <td className="py-4 text-right text-[8px] text-zinc-700">
                        {formatDate(
                          row.recorded_at,
                        )}
                      </td>

                    </tr>
                  );
                },
              )}

            </tbody>

          </table>

        </div>
      ) : (
        <div className="p-5">

          <div className="rounded-[15px] border border-white/[0.055] bg-black/15 p-5">

            <div className="text-[10px] font-semibold text-zinc-400">
              No operational history yet.
            </div>


            <div className="mt-1 max-w-2xl text-[9px] leading-4 text-zinc-700">
              Once the first truck is registered, its initial
              availability snapshot will appear here. Every
              later change made through Live Truck
              Availability Controls will create another
              history record automatically.
            </div>

          </div>

        </div>
      )}

    </section>
  );
}