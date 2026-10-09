"use client";

import Link from "next/link";

import {
  type FormEvent,
  useMemo,
  useState,
} from "react";


export type LoadBoardSource = {
  source_id:
    string;

  code:
    string;

  display_name:
    string;

  provider_kind:
    string;

  enabled:
    boolean;

  requires_api_credentials:
    boolean;

  search_supported:
    boolean;

  bid_supported:
    boolean;

  book_supported:
    boolean;

  rate_supported:
    boolean;

  connection_status:
    string |
    null;

  live_result_count:
    number |
    string |
    null;

  last_result_seen_at:
    string |
    null;

  last_success_at:
    string |
    null;

  last_error_at:
    string |
    null;

  last_error_message:
    string |
    null;
};


export type LoadBoardTruck = {
  truck_id:
    string;

  onboarding_id:
    string;

  company_name:
    string;

  dot_number:
    number |
    null;

  unit_number:
    string;

  truck_type:
    string;

  trailer_type:
    string |
    null;

  trailer_length_ft:
    number |
    null;

  max_weight_lbs:
    number |
    null;

  driver_name:
    string |
    null;

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

  ready_for_load_search:
    boolean;

  last_operational_update:
    string;
};


export type LoadBoardSession = {
  id:
    string;

  truck_id:
    string;

  onboarding_id:
    string;

  status:
    string;

  origin_city:
    string |
    null;

  origin_state:
    string |
    null;

  destination_city:
    string |
    null;

  destination_state:
    string |
    null;

  equipment_type:
    string |
    null;

  requested_source_codes:
    string[] |
    null;

  result_count:
    number;

  started_at:
    string;

  completed_at:
    string |
    null;

  expires_at:
    string;
};


type RankedLoad = {
  id:
    string;

  session_id:
    string;

  source_code:
    string;

  source_name:
    string;

  external_load_id:
    string |
    null;

  broker_load_number:
    string |
    null;

  provider_url:
    string |
    null;


  broker_name:
    string |
    null;

  broker_mc_number:
    string |
    null;

  broker_phone:
    string |
    null;

  broker_email:
    string |
    null;


  origin_city:
    string;

  origin_state:
    string;

  origin_zip:
    string |
    null;

  destination_city:
    string;

  destination_state:
    string;

  destination_zip:
    string |
    null;


  pickup_start:
    string |
    null;

  pickup_end:
    string |
    null;

  delivery_start:
    string |
    null;

  delivery_end:
    string |
    null;


  equipment_type:
    string |
    null;

  commodity:
    string |
    null;

  weight_lbs:
    number |
    null;


  posted_rate:
    number |
    string |
    null;

  loaded_miles:
    number |
    null;

  deadhead_miles:
    number |
    null;


  booking_method:
    string |
    null;

  book_now_available:
    boolean;


  last_seen_at:
    string;

  expires_at:
    string |
    null;


  promoted_opportunity_id:
    string |
    null;


  match_score:
    number |
    string |
    null;

  equipment_score:
    number |
    string |
    null;

  deadhead_score:
    number |
    string |
    null;

  rpm_score:
    number |
    string |
    null;

  destination_score:
    number |
    string |
    null;

  pickup_score:
    number |
    string |
    null;


  loaded_rate_per_mile:
    number |
    string |
    null;

  all_in_rate_per_mile:
    number |
    string |
    null;

  estimated_fuel_cost:
    number |
    string |
    null;

  estimated_operating_cost:
    number |
    string |
    null;

  estimated_profit:
    number |
    string |
    null;
};


type ProviderRun = {
  source?:
    string;

  name?:
    string;

  status?:
    string;

  resultCount?:
    number;

  errorCode?:
    string |
    null;

  errorMessage?:
    string |
    null;

  latencyMs?:
    number;
};


const INPUT =
  "h-10 w-full rounded-lg border border-white/[0.07] bg-black/20 px-3 text-[9px] text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-emerald-500/30";


const LABEL =
  "mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.08em] text-zinc-700";


function numberValue(
  value:
    number |
    string |
    null |
    undefined,
) {
  const parsed =
    Number(
      value ?? 0,
    );


  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}


function money(
  value:
    number |
    string |
    null |
    undefined,
) {
  if (
    value ===
      null ||
    value ===
      undefined
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


  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",

      maximumFractionDigits:
        0,
    },
  ).format(
    parsed,
  );
}


function rpm(
  value:
    number |
    string |
    null |
    undefined,
) {
  if (
    value ===
      null ||
    value ===
      undefined
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


function pretty(
  value:
    string |
    null |
    undefined,
) {
  if (
    !value
  ) {
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
  if (
    !value
  ) {
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
      month:
        "short",

      day:
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


function relativeAge(
  value:
    string |
    null |
    undefined,
) {
  if (
    !value
  ) {
    return "never";
  }


  const timestamp =
    new Date(
      value,
    ).getTime();


  if (
    Number.isNaN(
      timestamp,
    )
  ) {
    return "unknown";
  }


  const minutes =
    Math.max(
      0,
      Math.floor(
        (
          Date.now() -
          timestamp
        ) /
          60_000,
      ),
    );


  if (
    minutes <
    1
  ) {
    return "just now";
  }


  if (
    minutes <
    60
  ) {
    return `${minutes}m ago`;
  }


  const hours =
    Math.floor(
      minutes /
        60,
    );


  if (
    hours <
    24
  ) {
    return `${hours}h ago`;
  }


  return `${Math.floor(
    hours /
      24,
  )}d ago`;
}


function sourceStatusClass(
  status:
    string |
    null,
) {
  if (
    status ===
    "connected"
  ) {
    return "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300";
  }


  if (
    status ===
      "pending_credentials" ||
    status ===
      "degraded"
  ) {
    return "border-amber-500/20 bg-amber-500/[0.05] text-amber-300";
  }


  if (
    status ===
    "error"
  ) {
    return "border-red-500/20 bg-red-500/[0.05] text-red-300";
  }


  return "border-white/[0.07] bg-white/[0.025] text-zinc-500";
}


function matchClass(
  score:
    number,
) {
  if (
    score >=
    90
  ) {
    return "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300";
  }


  if (
    score >=
    75
  ) {
    return "border-blue-500/20 bg-blue-500/[0.06] text-blue-300";
  }


  if (
    score >=
    60
  ) {
    return "border-amber-500/20 bg-amber-500/[0.05] text-amber-300";
  }


  return "border-red-500/20 bg-red-500/[0.05] text-red-300";
}


function matchLabel(
  score:
    number,
) {
  if (
    score >=
    90
  ) {
    return "Excellent";
  }


  if (
    score >=
    75
  ) {
    return "Strong";
  }


  if (
    score >=
    60
  ) {
    return "Acceptable";
  }


  return "Weak";
}


async function apiRequest(
  payload:
    Record<
      string,
      unknown
    >,
) {
  const response =
    await fetch(
      "/api/admin/loadboard",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            payload,
          ),
      },
    );


  const data =
    await response
      .json()
      .catch(
        () => ({
          success:
            false,

          error:
            "Invalid server response.",
        }),
      );


  if (
    !response.ok ||
    data.success !==
      true
  ) {
    throw new Error(
      data.error ??
        "SlateLane could not complete the request.",
    );
  }


  return data;
}


export default function LoadBoardClient({
  initialSources,
  initialTrucks,
  initialSessions,
}: {
  initialSources:
    LoadBoardSource[];

  initialTrucks:
    LoadBoardTruck[];

  initialSessions:
    LoadBoardSession[];
}) {
  const readyTrucks =
    useMemo(
      () =>
        initialTrucks.filter(
          (
            truck,
          ) =>
            truck.ready_for_load_search,
        ),
      [
        initialTrucks,
      ],
    );


  const connectedSources =
    useMemo(
      () =>
        initialSources.filter(
          (
            source,
          ) =>
            source.enabled &&
            source.search_supported &&
            source.connection_status ===
              "connected",
        ),
      [
        initialSources,
      ],
    );


  const [
    selectedTruckId,
    setSelectedTruckId,
  ] =
    useState(
      readyTrucks[0]
        ?.truck_id ??
        "",
    );


  const selectedTruck =
    useMemo(
      () =>
        initialTrucks.find(
          (
            truck,
          ) =>
            truck.truck_id ===
            selectedTruckId,
        ) ??
        null,
      [
        initialTrucks,
        selectedTruckId,
      ],
    );


  const [
    sessionId,
    setSessionId,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const [
    sessionStatus,
    setSessionStatus,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const [
    results,
    setResults,
  ] =
    useState<
      RankedLoad[]
    >(
      [],
    );


  const [
    providerRuns,
    setProviderRuns,
  ] =
    useState<
      ProviderRun[]
    >(
      [],
    );


  const [
    busy,
    setBusy,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const [
    message,
    setMessage,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const [
    showManual,
    setShowManual,
  ] =
    useState(
      false,
    );


  const [
    sourceCodes,
    setSourceCodes,
  ] =
    useState<
      string[]
    >(
      connectedSources.map(
        (
          source,
        ) =>
          source.code,
      ),
    );


  const [
    search,
    setSearch,
  ] =
    useState({
      originCity:
        readyTrucks[0]
          ?.current_city ??
        "",

      originState:
        readyTrucks[0]
          ?.current_state ??
        "",

      originZip:
        readyTrucks[0]
          ?.current_zip ??
        "",

      originRadiusMiles:
        "100",

      destinationCity:
        "",

      destinationState:
        "",

      destinationZip:
        "",

      destinationRadiusMiles:
        "",

      equipmentType:
        readyTrucks[0]
          ?.trailer_type ??
        readyTrucks[0]
          ?.truck_type ??
        "",

      pickupStart:
        "",

      pickupEnd:
        "",

      minimumRate:
        "",

      minimumRatePerMile:
        readyTrucks[0]
          ?.minimum_rate_per_mile !=
        null
          ? String(
              readyTrucks[0]
                .minimum_rate_per_mile,
            )
          : "",

      minimumTripMiles:
        "",

      maximumTripMiles:
        "",

      maximumDeadheadMiles:
        readyTrucks[0]
          ?.max_deadhead_miles !=
        null
          ? String(
              readyTrucks[0]
                .max_deadhead_miles,
            )
          : "",
    });


  const [
    manual,
    setManual,
  ] =
    useState({
      originCity:
        "",

      originState:
        "",

      originZip:
        "",

      destinationCity:
        "",

      destinationState:
        "",

      destinationZip:
        "",

      pickupStart:
        "",

      deliveryStart:
        "",

      equipmentType:
        "",

      commodity:
        "",

      weightLbs:
        "",

      postedRate:
        "",

      loadedMiles:
        "",

      deadheadMiles:
        "0",

      brokerName:
        "",

      brokerMcNumber:
        "",

      brokerPhone:
        "",

      brokerEmail:
        "",

      brokerLoadNumber:
        "",

      notes:
        "",
    });


  function changeTruck(
    truckId:
      string,
  ) {
    setSelectedTruckId(
      truckId,
    );


    const truck =
      initialTrucks.find(
        (
          item,
        ) =>
          item.truck_id ===
          truckId,
      );


    if (
      truck
    ) {
      setSearch(
        (
          current,
        ) => ({
          ...current,

          originCity:
            truck.current_city ??
            "",

          originState:
            truck.current_state ??
            "",

          originZip:
            truck.current_zip ??
            "",

          equipmentType:
            truck.trailer_type ??
            truck.truck_type ??
            "",

          minimumRatePerMile:
            truck.minimum_rate_per_mile !=
            null
              ? String(
                  truck.minimum_rate_per_mile,
                )
              : "",

          maximumDeadheadMiles:
            truck.max_deadhead_miles !=
            null
              ? String(
                  truck.max_deadhead_miles,
                )
              : "",
        }),
      );
    }


    setSessionId(
      null,
    );

    setSessionStatus(
      null,
    );

    setResults(
      [],
    );

    setProviderRuns(
      [],
    );
  }


  function toggleSource(
    code:
      string,
  ) {
    setSourceCodes(
      (
        current,
      ) =>
        current.includes(
          code,
        )
          ? current.filter(
              (
                value,
              ) =>
                value !==
                code,
            )
          : [
              ...current,
              code,
            ],
    );
  }


  async function runSearch(
    event:
      FormEvent,
  ) {
    event.preventDefault();


    setBusy(
      "search",
    );

    setError(
      null,
    );

    setMessage(
      null,
    );


    try {
      const response =
        await apiRequest({
          action:
            "search",

          truckId:
            selectedTruckId,

          sourceCodes,

          ...search,
        });


      setSessionId(
        response.sessionId,
      );

      setSessionStatus(
        response.sessionStatus,
      );

      setResults(
        response.results ??
        [],
      );

      setProviderRuns(
        response.providerRuns ??
        [],
      );


      if (
        (
          response.connectedSources ??
          []
        ).length ===
        0
      ) {
        setMessage(
          "Search session created successfully. No authorized external provider is connected yet, so no marketplace inventory was requested.",
        );
      } else {
        setMessage(
          `Search completed with ${(response.results ?? []).length} normalized load result(s).`,
        );
      }


      setShowManual(
        true,
      );
    } catch (
      caught
    ) {
      setError(
        caught instanceof
        Error
          ? caught.message
          : "Search failed.",
      );
    } finally {
      setBusy(
        null,
      );
    }
  }


  async function addManualLoad(
    event:
      FormEvent,
  ) {
    event.preventDefault();


    if (
      !sessionId
    ) {
      setError(
        "Run a truck search before adding a manual load.",
      );

      return;
    }


    setBusy(
      "manual",
    );

    setError(
      null,
    );

    setMessage(
      null,
    );


    try {
      const response =
        await apiRequest({
          action:
            "manual",

          sessionId,

          ...manual,
        });


      setResults(
        response.results ??
        [],
      );


      setMessage(
        "Manual broker load added and scored against the selected truck.",
      );


      setManual(
        (
          current,
        ) => ({
          ...current,

          destinationCity:
            "",

          destinationState:
            "",

          destinationZip:
            "",

          postedRate:
            "",

          loadedMiles:
            "",

          commodity:
            "",

          brokerLoadNumber:
            "",

          notes:
            "",
        }),
      );
    } catch (
      caught
    ) {
      setError(
        caught instanceof
        Error
          ? caught.message
          : "Could not add the manual load.",
      );
    } finally {
      setBusy(
        null,
      );
    }
  }


  async function saveOpportunity(
    resultId:
      string,
  ) {
    setBusy(
      `save:${resultId}`,
    );

    setError(
      null,
    );

    setMessage(
      null,
    );


    try {
      const response =
        await apiRequest({
          action:
            "save",

          resultId,
        });


      setResults(
        (
          current,
        ) =>
          current.map(
            (
              load,
            ) =>
              load.id ===
              resultId
                ? {
                    ...load,

                    promoted_opportunity_id:
                      response.opportunityId,
                  }
                : load,
          ),
      );


      setMessage(
        response.alreadySaved
          ? "This load was already saved in SlateLane Opportunities."
          : "Load saved to SlateLane Opportunities. It is now available for negotiation and booking.",
      );
    } catch (
      caught
    ) {
      setError(
        caught instanceof
        Error
          ? caught.message
          : "Could not save the opportunity.",
      );
    } finally {
      setBusy(
        null,
      );
    }
  }


  const connectedMarketplaceCount =
    initialSources.filter(
      (
        source,
      ) =>
        source.provider_kind ===
          "marketplace" &&
        source.connection_status ===
          "connected",
    ).length;


  return (
    <div className="space-y-6">

      <section className="overflow-hidden rounded-[22px] border border-emerald-500/10 bg-[linear-gradient(135deg,rgba(9,22,20,.98),rgba(7,10,15,.98))]">

        <div className="flex flex-col gap-5 p-6 xl:flex-row xl:items-center xl:justify-between">

          <div>

            <div className="text-[9px] font-semibold uppercase tracking-[0.17em] text-emerald-400">
              SlateLane Load Engine
            </div>


            <h1 className="mt-2 text-[25px] font-semibold tracking-tight text-white">
              Unified Load Board
            </h1>


            <p className="mt-2 max-w-3xl text-[9px] leading-5 text-zinc-600">
              Search authorized freight sources, match loads against
              active trucks, calculate all-in RPM and profitability,
              then move the best loads directly into SlateLane&apos;s
              negotiation and booking workflow.
            </p>

          </div>


          <div className="flex flex-wrap gap-2">

            <Link
              href="/admin/operations"
              className="inline-flex h-9 items-center rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 text-[8px] font-semibold text-zinc-400 hover:bg-white/[0.05]"
            >
              Carrier Operations
            </Link>


            <Link
              href="/admin/onboarding"
              className="inline-flex h-9 items-center rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-3 text-[8px] font-semibold text-emerald-300 hover:bg-emerald-500/[0.08]"
            >
              Carrier Onboarding
            </Link>

          </div>

        </div>


        <div className="grid border-t border-white/[0.05] sm:grid-cols-2 xl:grid-cols-4">

          <div className="border-b border-white/[0.05] p-4 sm:border-r xl:border-b-0">

            <div className="text-[7px] uppercase tracking-[0.1em] text-zinc-700">
              Searchable Trucks
            </div>

            <div className="mt-1 text-[20px] font-semibold text-zinc-200">
              {readyTrucks.length}
            </div>

          </div>


          <div className="border-b border-white/[0.05] p-4 xl:border-b-0 xl:border-r">

            <div className="text-[7px] uppercase tracking-[0.1em] text-zinc-700">
              Connected Sources
            </div>

            <div className="mt-1 text-[20px] font-semibold text-zinc-200">
              {connectedSources.length}
            </div>

          </div>


          <div className="border-b border-white/[0.05] p-4 sm:border-r sm:border-b-0">

            <div className="text-[7px] uppercase tracking-[0.1em] text-zinc-700">
              Marketplaces
            </div>

            <div className="mt-1 text-[20px] font-semibold text-zinc-200">
              {connectedMarketplaceCount}/3
            </div>

          </div>


          <div className="p-4">

            <div className="text-[7px] uppercase tracking-[0.1em] text-zinc-700">
              Current Results
            </div>

            <div className="mt-1 text-[20px] font-semibold text-zinc-200">
              {results.length}
            </div>

          </div>

        </div>

      </section>


      {readyTrucks.length ===
      0 ? (
        <section className="rounded-[18px] border border-amber-500/15 bg-amber-500/[0.035] p-5">

          <div className="text-[10px] font-semibold text-amber-300">
            No truck is currently ready for load search.
          </div>


          <p className="mt-2 max-w-3xl text-[8px] leading-5 text-zinc-600">
            SlateLane requires an active carrier, an active truck and
            available truck status before a search can run. This
            protects the board from producing recommendations for
            equipment you cannot actually dispatch.
          </p>


          <Link
            href="/admin/operations"
            className="mt-3 inline-flex text-[8px] font-semibold text-amber-300"
          >
            Open Carrier Operations →
          </Link>

        </section>
      ) : null}


      <section>

        <div className="mb-3">

          <h2 className="text-[13px] font-semibold text-zinc-200">
            Load Sources
          </h2>


          <p className="mt-1 text-[8px] text-zinc-700">
            SlateLane will never label a provider as connected until
            authorized access exists.
          </p>

        </div>


        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">

          {initialSources.map(
            (
              source,
            ) => (
              <div
                key={
                  source.source_id
                }
                className="rounded-[17px] border border-white/[0.065] bg-white/[0.018] p-4"
              >

                <div className="flex items-start justify-between gap-3">

                  <div>

                    <div className="text-[10px] font-semibold text-zinc-200">
                      {source.display_name}
                    </div>


                    <div className="mt-1 text-[7px] uppercase tracking-[0.08em] text-zinc-700">
                      {pretty(
                        source.provider_kind,
                      )}
                    </div>

                  </div>


                  <span
                    className={`rounded-full border px-2 py-1 text-[7px] font-semibold uppercase ${sourceStatusClass(
                      source.connection_status,
                    )}`}
                  >
                    {pretty(
                      source.connection_status,
                    )}
                  </span>

                </div>


                <div className="mt-4 grid grid-cols-3 gap-2 text-center">

                  <div className="rounded-lg border border-white/[0.05] bg-black/15 p-2">

                    <div className="text-[6px] uppercase text-zinc-700">
                      Search
                    </div>

                    <div className="mt-1 text-[8px] text-zinc-400">
                      {source.search_supported
                        ? "Yes"
                        : "—"}
                    </div>

                  </div>


                  <div className="rounded-lg border border-white/[0.05] bg-black/15 p-2">

                    <div className="text-[6px] uppercase text-zinc-700">
                      Bid
                    </div>

                    <div className="mt-1 text-[8px] text-zinc-400">
                      {source.bid_supported
                        ? "Yes"
                        : "—"}
                    </div>

                  </div>


                  <div className="rounded-lg border border-white/[0.05] bg-black/15 p-2">

                    <div className="text-[6px] uppercase text-zinc-700">
                      Book
                    </div>

                    <div className="mt-1 text-[8px] text-zinc-400">
                      {source.book_supported
                        ? "Yes"
                        : "—"}
                    </div>

                  </div>

                </div>


                <div className="mt-3 flex items-center justify-between text-[7px] text-zinc-700">

                  <span>
                    Live{" "}
                    {numberValue(
                      source.live_result_count,
                    )}
                  </span>


                  <span>
                    Seen{" "}
                    {relativeAge(
                      source.last_result_seen_at,
                    )}
                  </span>

                </div>


                {source.last_error_message ? (
                  <div className="mt-3 rounded-lg border border-red-500/10 bg-red-500/[0.025] p-2 text-[7px] leading-4 text-red-300/70">
                    {source.last_error_message}
                  </div>
                ) : null}

              </div>
            ),
          )}

        </div>

      </section>


      <section className="rounded-[20px] border border-white/[0.065] bg-white/[0.018] p-5">

        <div>

          <div className="text-[11px] font-semibold text-zinc-200">
            Search Loads
          </div>

          <div className="mt-1 text-[8px] text-zinc-700">
            Search criteria are tied to one real truck so SlateLane can
            rank loads accurately.
          </div>

        </div>


        <form
          onSubmit={
            runSearch
          }
          className="mt-5 space-y-5"
        >

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

            <label>

              <span className={LABEL}>
                Truck
              </span>

              <select
                value={
                  selectedTruckId
                }
                onChange={(
                  event,
                ) =>
                  changeTruck(
                    event.target
                      .value,
                  )
                }
                className={INPUT}
                disabled={
                  readyTrucks.length ===
                  0
                }
              >

                {readyTrucks.length ===
                0 ? (
                  <option value="">
                    No available trucks
                  </option>
                ) : null}


                {readyTrucks.map(
                  (
                    truck,
                  ) => (
                    <option
                      key={
                        truck.truck_id
                      }
                      value={
                        truck.truck_id
                      }
                    >
                      {truck.company_name} · Unit{" "}
                      {truck.unit_number}
                    </option>
                  ),
                )}

              </select>

            </label>


            <label>

              <span className={LABEL}>
                Origin City
              </span>

              <input
                value={
                  search.originCity
                }
                onChange={(
                  event,
                ) =>
                  setSearch(
                    (
                      current,
                    ) => ({
                      ...current,

                      originCity:
                        event.target
                          .value,
                    }),
                  )
                }
                className={INPUT}
                placeholder="Dallas"
              />

            </label>


            <label>

              <span className={LABEL}>
                Origin State
              </span>

              <input
                value={
                  search.originState
                }
                onChange={(
                  event,
                ) =>
                  setSearch(
                    (
                      current,
                    ) => ({
                      ...current,

                      originState:
                        event.target
                          .value
                          .toUpperCase(),
                    }),
                  )
                }
                maxLength={
                  2
                }
                className={INPUT}
                placeholder="TX"
              />

            </label>


            <label>

              <span className={LABEL}>
                Origin Radius
              </span>

              <input
                type="number"
                min="0"
                max="1000"
                value={
                  search.originRadiusMiles
                }
                onChange={(
                  event,
                ) =>
                  setSearch(
                    (
                      current,
                    ) => ({
                      ...current,

                      originRadiusMiles:
                        event.target
                          .value,
                    }),
                  )
                }
                className={INPUT}
              />

            </label>


            <label>

              <span className={LABEL}>
                Destination City
              </span>

              <input
                value={
                  search.destinationCity
                }
                onChange={(
                  event,
                ) =>
                  setSearch(
                    (
                      current,
                    ) => ({
                      ...current,

                      destinationCity:
                        event.target
                          .value,
                    }),
                  )
                }
                className={INPUT}
                placeholder="Atlanta"
              />

            </label>


            <label>

              <span className={LABEL}>
                Destination State
              </span>

              <input
                value={
                  search.destinationState
                }
                onChange={(
                  event,
                ) =>
                  setSearch(
                    (
                      current,
                    ) => ({
                      ...current,

                      destinationState:
                        event.target
                          .value
                          .toUpperCase(),
                    }),
                  )
                }
                maxLength={
                  2
                }
                className={INPUT}
                placeholder="GA"
              />

            </label>


            <label>

              <span className={LABEL}>
                Equipment
              </span>

              <input
                value={
                  search.equipmentType
                }
                onChange={(
                  event,
                ) =>
                  setSearch(
                    (
                      current,
                    ) => ({
                      ...current,

                      equipmentType:
                        event.target
                          .value,
                    }),
                  )
                }
                className={INPUT}
                placeholder="Dry Van"
              />

            </label>


            <label>

              <span className={LABEL}>
                Max Deadhead
              </span>

              <input
                type="number"
                min="0"
                value={
                  search.maximumDeadheadMiles
                }
                onChange={(
                  event,
                ) =>
                  setSearch(
                    (
                      current,
                    ) => ({
                      ...current,

                      maximumDeadheadMiles:
                        event.target
                          .value,
                    }),
                  )
                }
                className={INPUT}
                placeholder="100"
              />

            </label>


            <label>

              <span className={LABEL}>
                Pickup From
              </span>

              <input
                type="datetime-local"
                value={
                  search.pickupStart
                }
                onChange={(
                  event,
                ) =>
                  setSearch(
                    (
                      current,
                    ) => ({
                      ...current,

                      pickupStart:
                        event.target
                          .value,
                    }),
                  )
                }
                className={INPUT}
              />

            </label>


            <label>

              <span className={LABEL}>
                Pickup Until
              </span>

              <input
                type="datetime-local"
                value={
                  search.pickupEnd
                }
                onChange={(
                  event,
                ) =>
                  setSearch(
                    (
                      current,
                    ) => ({
                      ...current,

                      pickupEnd:
                        event.target
                          .value,
                    }),
                  )
                }
                className={INPUT}
              />

            </label>


            <label>

              <span className={LABEL}>
                Minimum Rate
              </span>

              <input
                type="number"
                min="0"
                step="1"
                value={
                  search.minimumRate
                }
                onChange={(
                  event,
                ) =>
                  setSearch(
                    (
                      current,
                    ) => ({
                      ...current,

                      minimumRate:
                        event.target
                          .value,
                    }),
                  )
                }
                className={INPUT}
                placeholder="1800"
              />

            </label>


            <label>

              <span className={LABEL}>
                Minimum All-in RPM
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  search.minimumRatePerMile
                }
                onChange={(
                  event,
                ) =>
                  setSearch(
                    (
                      current,
                    ) => ({
                      ...current,

                      minimumRatePerMile:
                        event.target
                          .value,
                    }),
                  )
                }
                className={INPUT}
                placeholder="2.00"
              />

            </label>

          </div>


          <div>

            <div className={LABEL}>
              Authorized Search Sources
            </div>


            {connectedSources.length >
            0 ? (
              <div className="flex flex-wrap gap-2">

                {connectedSources.map(
                  (
                    source,
                  ) => (
                    <button
                      key={
                        source.code
                      }
                      type="button"
                      onClick={() =>
                        toggleSource(
                          source.code,
                        )
                      }
                      className={`rounded-lg border px-3 py-2 text-[8px] font-semibold ${
                        sourceCodes.includes(
                          source.code,
                        )
                          ? "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300"
                          : "border-white/[0.07] text-zinc-600"
                      }`}
                    >
                      {source.display_name}
                    </button>
                  ),
                )}

              </div>
            ) : (
              <div className="rounded-lg border border-amber-500/10 bg-amber-500/[0.025] px-3 py-2 text-[8px] text-amber-300/80">
                No external marketplace has authorized API access yet.
                You can still create the truck search session and add
                broker loads manually.
              </div>
            )}

          </div>


          {selectedTruck ? (
            <div className="rounded-xl border border-white/[0.05] bg-black/15 p-4">

              <div className="grid gap-3 text-[8px] text-zinc-600 sm:grid-cols-2 xl:grid-cols-4">

                <div>
                  <span className="text-zinc-700">
                    Current
                  </span>
                  <br />
                  {selectedTruck.current_city ||
                    "—"}
                  {selectedTruck.current_state
                    ? `, ${selectedTruck.current_state}`
                    : ""}
                </div>


                <div>
                  <span className="text-zinc-700">
                    Equipment
                  </span>
                  <br />
                  {selectedTruck.trailer_type ||
                    selectedTruck.truck_type}
                </div>


                <div>
                  <span className="text-zinc-700">
                    Minimum RPM
                  </span>
                  <br />
                  {rpm(
                    selectedTruck.minimum_rate_per_mile,
                  )}
                </div>


                <div>
                  <span className="text-zinc-700">
                    Max Deadhead
                  </span>
                  <br />
                  {selectedTruck.max_deadhead_miles ??
                    "—"}{" "}
                  mi
                </div>

              </div>

            </div>
          ) : null}


          <div className="flex flex-wrap gap-2">

            <button
              type="submit"
              disabled={
                !selectedTruckId ||
                busy !==
                  null
              }
              className="h-10 rounded-lg bg-emerald-400 px-5 text-[8px] font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ===
              "search"
                ? "Searching..."
                : "Search Loads"}
            </button>


            {sessionId ? (
              <button
                type="button"
                onClick={() =>
                  setShowManual(
                    (
                      current,
                    ) =>
                      !current,
                  )
                }
                className="h-10 rounded-lg border border-white/[0.07] px-4 text-[8px] font-semibold text-zinc-400"
              >
                {showManual
                  ? "Hide Manual Entry"
                  : "Add Broker Load"}
              </button>
            ) : null}

          </div>

        </form>

      </section>


      {error ? (
        <div className="rounded-[14px] border border-red-500/15 bg-red-500/[0.04] p-4 text-[8px] leading-5 text-red-300">
          {error}
        </div>
      ) : null}


      {message ? (
        <div className="rounded-[14px] border border-cyan-500/15 bg-cyan-500/[0.035] p-4 text-[8px] leading-5 text-cyan-200">
          {message}
        </div>
      ) : null}


      {sessionId ? (
        <section className="rounded-[18px] border border-white/[0.065] bg-white/[0.018] p-5">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <div className="text-[10px] font-semibold text-zinc-200">
                Current Search Session
              </div>

              <div className="mt-1 font-mono text-[7px] text-zinc-700">
                {sessionId}
              </div>

            </div>


            <span className="rounded-full border border-white/[0.07] px-2 py-1 text-[7px] font-semibold uppercase text-zinc-500">
              {pretty(
                sessionStatus,
              )}
            </span>

          </div>


          {providerRuns.length >
          0 ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">

              {providerRuns.map(
                (
                  run,
                  index,
                ) => (
                  <div
                    key={`${run.source}-${index}`}
                    className="rounded-lg border border-white/[0.05] bg-black/15 p-3"
                  >

                    <div className="flex items-center justify-between">

                      <span className="text-[8px] font-semibold text-zinc-400">
                        {run.name ||
                          run.source}
                      </span>

                      <span className="text-[7px] uppercase text-zinc-700">
                        {pretty(
                          run.status,
                        )}
                      </span>

                    </div>


                    <div className="mt-2 text-[7px] text-zinc-700">
                      {run.resultCount ??
                        0}{" "}
                      result(s)
                      {run.latencyMs
                        ? ` · ${run.latencyMs} ms`
                        : ""}
                    </div>


                    {run.errorMessage ? (
                      <div className="mt-2 text-[7px] leading-4 text-amber-300/70">
                        {run.errorMessage}
                      </div>
                    ) : null}

                  </div>
                ),
              )}

            </div>
          ) : null}

        </section>
      ) : null}


      {showManual &&
      sessionId ? (
        <section className="rounded-[20px] border border-blue-500/10 bg-blue-500/[0.02] p-5">

          <div className="text-[11px] font-semibold text-zinc-200">
            Add Broker Load Manually
          </div>


          <p className="mt-1 text-[8px] text-zinc-700">
            Use this while provider APIs are pending. The load is still
            scored using the same SlateLane engine as API results.
          </p>


          <form
            onSubmit={
              addManualLoad
            }
            className="mt-5 space-y-4"
          >

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

              <label>

                <span className={LABEL}>
                  Origin City *
                </span>

                <input
                  required
                  value={
                    manual.originCity
                  }
                  onChange={(
                    event,
                  ) =>
                    setManual(
                      (
                        current,
                      ) => ({
                        ...current,

                        originCity:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={INPUT}
                />

              </label>


              <label>

                <span className={LABEL}>
                  Origin State *
                </span>

                <input
                  required
                  maxLength={
                    2
                  }
                  value={
                    manual.originState
                  }
                  onChange={(
                    event,
                  ) =>
                    setManual(
                      (
                        current,
                      ) => ({
                        ...current,

                        originState:
                          event.target
                            .value
                            .toUpperCase(),
                      }),
                    )
                  }
                  className={INPUT}
                />

              </label>


              <label>

                <span className={LABEL}>
                  Destination City *
                </span>

                <input
                  required
                  value={
                    manual.destinationCity
                  }
                  onChange={(
                    event,
                  ) =>
                    setManual(
                      (
                        current,
                      ) => ({
                        ...current,

                        destinationCity:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={INPUT}
                />

              </label>


              <label>

                <span className={LABEL}>
                  Destination State *
                </span>

                <input
                  required
                  maxLength={
                    2
                  }
                  value={
                    manual.destinationState
                  }
                  onChange={(
                    event,
                  ) =>
                    setManual(
                      (
                        current,
                      ) => ({
                        ...current,

                        destinationState:
                          event.target
                            .value
                            .toUpperCase(),
                      }),
                    )
                  }
                  className={INPUT}
                />

              </label>


              <label>

                <span className={LABEL}>
                  Posted Rate
                </span>

                <input
                  type="number"
                  min="0"
                  value={
                    manual.postedRate
                  }
                  onChange={(
                    event,
                  ) =>
                    setManual(
                      (
                        current,
                      ) => ({
                        ...current,

                        postedRate:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={INPUT}
                  placeholder="2200"
                />

              </label>


              <label>

                <span className={LABEL}>
                  Loaded Miles
                </span>

                <input
                  type="number"
                  min="1"
                  value={
                    manual.loadedMiles
                  }
                  onChange={(
                    event,
                  ) =>
                    setManual(
                      (
                        current,
                      ) => ({
                        ...current,

                        loadedMiles:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={INPUT}
                  placeholder="750"
                />

              </label>


              <label>

                <span className={LABEL}>
                  Deadhead Miles
                </span>

                <input
                  type="number"
                  min="0"
                  value={
                    manual.deadheadMiles
                  }
                  onChange={(
                    event,
                  ) =>
                    setManual(
                      (
                        current,
                      ) => ({
                        ...current,

                        deadheadMiles:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={INPUT}
                />

              </label>


              <label>

                <span className={LABEL}>
                  Equipment
                </span>

                <input
                  value={
                    manual.equipmentType
                  }
                  onChange={(
                    event,
                  ) =>
                    setManual(
                      (
                        current,
                      ) => ({
                        ...current,

                        equipmentType:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={INPUT}
                  placeholder="Dry Van"
                />

              </label>


              <label>

                <span className={LABEL}>
                  Pickup
                </span>

                <input
                  type="datetime-local"
                  value={
                    manual.pickupStart
                  }
                  onChange={(
                    event,
                  ) =>
                    setManual(
                      (
                        current,
                      ) => ({
                        ...current,

                        pickupStart:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={INPUT}
                />

              </label>


              <label>

                <span className={LABEL}>
                  Delivery
                </span>

                <input
                  type="datetime-local"
                  value={
                    manual.deliveryStart
                  }
                  onChange={(
                    event,
                  ) =>
                    setManual(
                      (
                        current,
                      ) => ({
                        ...current,

                        deliveryStart:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={INPUT}
                />

              </label>


              <label>

                <span className={LABEL}>
                  Broker
                </span>

                <input
                  value={
                    manual.brokerName
                  }
                  onChange={(
                    event,
                  ) =>
                    setManual(
                      (
                        current,
                      ) => ({
                        ...current,

                        brokerName:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={INPUT}
                />

              </label>


              <label>

                <span className={LABEL}>
                  Broker MC
                </span>

                <input
                  value={
                    manual.brokerMcNumber
                  }
                  onChange={(
                    event,
                  ) =>
                    setManual(
                      (
                        current,
                      ) => ({
                        ...current,

                        brokerMcNumber:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={INPUT}
                />

              </label>


              <label>

                <span className={LABEL}>
                  Broker Phone
                </span>

                <input
                  value={
                    manual.brokerPhone
                  }
                  onChange={(
                    event,
                  ) =>
                    setManual(
                      (
                        current,
                      ) => ({
                        ...current,

                        brokerPhone:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={INPUT}
                />

              </label>


              <label>

                <span className={LABEL}>
                  Broker Email
                </span>

                <input
                  type="email"
                  value={
                    manual.brokerEmail
                  }
                  onChange={(
                    event,
                  ) =>
                    setManual(
                      (
                        current,
                      ) => ({
                        ...current,

                        brokerEmail:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={INPUT}
                />

              </label>


              <label>

                <span className={LABEL}>
                  Broker Load #
                </span>

                <input
                  value={
                    manual.brokerLoadNumber
                  }
                  onChange={(
                    event,
                  ) =>
                    setManual(
                      (
                        current,
                      ) => ({
                        ...current,

                        brokerLoadNumber:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={INPUT}
                />

              </label>


              <label>

                <span className={LABEL}>
                  Commodity
                </span>

                <input
                  value={
                    manual.commodity
                  }
                  onChange={(
                    event,
                  ) =>
                    setManual(
                      (
                        current,
                      ) => ({
                        ...current,

                        commodity:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className={INPUT}
                />

              </label>

            </div>


            <button
              type="submit"
              disabled={
                busy !==
                null
              }
              className="h-10 rounded-lg bg-blue-400 px-5 text-[8px] font-bold text-black disabled:opacity-40"
            >
              {busy ===
              "manual"
                ? "Scoring Load..."
                : "Add & Score Load"}
            </button>

          </form>

        </section>
      ) : null}


      <section className="overflow-hidden rounded-[20px] border border-white/[0.065] bg-white/[0.018]">

        <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] px-5 py-4">

          <div>

            <div className="text-[11px] font-semibold text-zinc-200">
              Ranked Loads
            </div>


            <div className="mt-1 text-[8px] text-zinc-700">
              Match score combines equipment, deadhead, all-in RPM,
              destination preference, pickup timing, trip length,
              broker quality and freshness.
            </div>

          </div>


          <span className="rounded-full border border-white/[0.06] px-2 py-1 text-[7px] font-semibold text-zinc-600">
            {results.length} LOAD
            {results.length ===
            1
              ? ""
              : "S"}
          </span>

        </div>


        {results.length >
        0 ? (
          <div className="overflow-x-auto">

            <table className="w-full min-w-[1320px] text-left">

              <thead>

                <tr className="border-b border-white/[0.05] text-[7px] uppercase tracking-[0.08em] text-zinc-700">

                  <th className="px-4 py-3">
                    Match
                  </th>

                  <th className="px-4 py-3">
                    Source
                  </th>

                  <th className="px-4 py-3">
                    Lane
                  </th>

                  <th className="px-4 py-3">
                    Pickup
                  </th>

                  <th className="px-4 py-3">
                    Miles
                  </th>

                  <th className="px-4 py-3">
                    Rate
                  </th>

                  <th className="px-4 py-3">
                    Loaded RPM
                  </th>

                  <th className="px-4 py-3">
                    All-in RPM
                  </th>

                  <th className="px-4 py-3">
                    Est. Profit
                  </th>

                  <th className="px-4 py-3">
                    Broker
                  </th>

                  <th className="px-4 py-3">
                    Freshness
                  </th>

                  <th className="px-4 py-3">
                    Action
                  </th>

                </tr>

              </thead>


              <tbody>

                {results.map(
                  (
                    load,
                  ) => {
                    const score =
                      numberValue(
                        load.match_score,
                      );


                    return (
                      <tr
                        key={
                          load.id
                        }
                        className="border-b border-white/[0.04] last:border-b-0"
                      >

                        <td className="px-4 py-4">

                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-[7px] font-semibold ${matchClass(
                              score,
                            )}`}
                          >
                            {score.toFixed(
                              0,
                            )}{" "}
                            ·{" "}
                            {matchLabel(
                              score,
                            )}
                          </span>

                        </td>


                        <td className="px-4 py-4">

                          <span className="rounded-full border border-blue-500/15 bg-blue-500/[0.04] px-2 py-1 text-[7px] font-semibold text-blue-300">
                            {load.source_name}
                          </span>

                        </td>


                        <td className="px-4 py-4">

                          <div className="text-[9px] font-medium text-zinc-300">
                            {load.origin_city},{" "}
                            {load.origin_state}
                          </div>

                          <div className="mt-1 text-[8px] text-zinc-600">
                            →{" "}
                            {load.destination_city},{" "}
                            {load.destination_state}
                          </div>

                          <div className="mt-1 text-[7px] text-zinc-700">
                            {load.equipment_type ||
                              "Equipment unknown"}
                          </div>

                        </td>


                        <td className="px-4 py-4 text-[8px] text-zinc-500">
                          {formatDate(
                            load.pickup_start,
                          )}
                        </td>


                        <td className="px-4 py-4">

                          <div className="text-[8px] text-zinc-400">
                            {load.loaded_miles ??
                              "—"}{" "}
                            loaded
                          </div>

                          <div className="mt-1 text-[7px] text-zinc-700">
                            {load.deadhead_miles ??
                              0}{" "}
                            deadhead
                          </div>

                        </td>


                        <td className="px-4 py-4 text-[9px] font-semibold text-zinc-200">
                          {money(
                            load.posted_rate,
                          )}
                        </td>


                        <td className="px-4 py-4 text-[8px] text-zinc-400">
                          {rpm(
                            load.loaded_rate_per_mile,
                          )}
                        </td>


                        <td className="px-4 py-4 text-[8px] font-semibold text-emerald-300">
                          {rpm(
                            load.all_in_rate_per_mile,
                          )}
                        </td>


                        <td className="px-4 py-4">

                          <div className="text-[8px] font-semibold text-cyan-300">
                            {money(
                              load.estimated_profit,
                            )}
                          </div>

                          <div className="mt-1 text-[7px] text-zinc-700">
                            Op cost{" "}
                            {money(
                              load.estimated_operating_cost,
                            )}
                          </div>

                        </td>


                        <td className="px-4 py-4">

                          <div className="text-[8px] text-zinc-400">
                            {load.broker_name ||
                              "Unknown"}
                          </div>

                          {load.broker_mc_number ? (
                            <div className="mt-1 text-[7px] text-zinc-700">
                              MC{" "}
                              {load.broker_mc_number}
                            </div>
                          ) : null}

                        </td>


                        <td className="px-4 py-4 text-[7px] text-zinc-600">
                          {relativeAge(
                            load.last_seen_at,
                          )}
                        </td>


                        <td className="px-4 py-4">

                          {load.promoted_opportunity_id ? (
                            <span className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2 text-[7px] font-semibold text-emerald-300">
                              Saved
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                saveOpportunity(
                                  load.id,
                                )
                              }
                              disabled={
                                busy !==
                                null
                              }
                              className="rounded-lg border border-blue-500/20 bg-blue-500/[0.05] px-3 py-2 text-[7px] font-semibold text-blue-300 disabled:opacity-40"
                            >
                              {busy ===
                              `save:${load.id}`
                                ? "Saving..."
                                : "Save Opportunity"}
                            </button>
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
          <div className="p-8">

            <div className="text-[10px] font-medium text-zinc-300">
              No live loads in this search yet.
            </div>


            <p className="mt-2 max-w-3xl text-[8px] leading-5 text-zinc-700">
              SlateLane does not generate fake freight. Marketplace
              results will appear only after an authorized DAT,
              Truckstop, 123Loadboard or direct broker adapter is
              connected. Until then, you can use Add Broker Load to
              test the full scoring → opportunity → negotiation →
              booking workflow using a real load you receive manually.
            </p>

          </div>
        )}

      </section>


      {initialSessions.length >
      0 ? (
        <section className="rounded-[18px] border border-white/[0.065] bg-white/[0.018] p-5">

          <div className="text-[10px] font-semibold text-zinc-200">
            Recent Search Sessions
          </div>


          <div className="mt-4 space-y-2">

            {initialSessions
              .slice(
                0,
                5,
              )
              .map(
                (
                  session,
                ) => (
                  <div
                    key={
                      session.id
                    }
                    className="flex flex-col gap-2 rounded-lg border border-white/[0.05] bg-black/15 p-3 md:flex-row md:items-center md:justify-between"
                  >

                    <div>

                      <div className="text-[8px] text-zinc-400">
                        {session.origin_city ||
                          "Any origin"}
                        {session.origin_state
                          ? `, ${session.origin_state}`
                          : ""}
                        {" → "}
                        {session.destination_city ||
                          "Any destination"}
                        {session.destination_state
                          ? `, ${session.destination_state}`
                          : ""}
                      </div>

                      <div className="mt-1 text-[7px] text-zinc-700">
                        {formatDate(
                          session.started_at,
                        )}
                        {" · "}
                        {session.result_count} result(s)
                      </div>

                    </div>


                    <span className="text-[7px] uppercase text-zinc-600">
                      {pretty(
                        session.status,
                      )}
                    </span>

                  </div>
                ),
              )}

          </div>

        </section>
      ) : null}


      <section className="rounded-[18px] border border-cyan-500/10 bg-cyan-500/[0.025] p-5">

        <div className="text-[9px] font-semibold text-cyan-300">
          Production architecture
        </div>


        <p className="mt-2 max-w-4xl text-[8px] leading-5 text-zinc-600">
          External provider inventory stays temporary. A load becomes a
          permanent CRM record only when you press Save Opportunity.
          That saved opportunity then uses SlateLane&apos;s existing
          negotiation, booking, dispatch-fee and truck-availability
          workflow.
        </p>

      </section>

    </div>
  );
}