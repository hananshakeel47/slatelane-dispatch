import Link from "next/link";

import type {
  ReactNode,
} from "react";

import {
  createServerSupabase,
} from "@/lib/supabase/server";


export const dynamic =
  "force-dynamic";


type NumericValue =
  | number
  | string
  | null;


type OnboardingRow = {
  id:
    string;

  lead_id:
    string |
    null;

  carrier_id:
    number |
    null;

  company_name:
    string;

  dot_number:
    number |
    null;

  mc_number:
    string |
    null;

  status:
    string;

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
    string |
    null;

  load_board_provider:
    string |
    null;

  dispatch_fee_type:
    string |
    null;

  dispatch_fee_value:
    NumericValue;

  minimum_rate_per_mile:
    NumericValue;

  weekly_revenue_target:
    NumericValue;

  preferred_lanes:
    string[] |
    null;

  regions_to_avoid:
    string[] |
    null;

  preferred_states:
    string[] |
    null;

  home_time_notes:
    string |
    null;

  operating_notes:
    string |
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

  target_rate_per_mile:
    NumericValue;

  default_mpg:
    NumericValue;

  operating_cost_per_mile:
    NumericValue;

  activated_at:
    string |
    null;

  updated_at:
    string;
};


type ReadinessRow = {
  onboarding_id:
    string;

  lead_id:
    string |
    null;

  carrier_id:
    number |
    null;

  company_name:
    string |
    null;

  dot_number:
    number |
    null;

  mc_number:
    string |
    null;

  status:
    string |
    null;

  agreement_status:
    string |
    null;

  load_board_access_status:
    string |
    null;

  dispatch_fee_type:
    string |
    null;

  dispatch_fee_value:
    NumericValue;

  minimum_rate_per_mile:
    NumericValue;

  weekly_revenue_target:
    NumericValue;

  truck_count:
    number |
    null;

  active_truck_count:
    number |
    null;

  available_truck_count:
    number |
    null;

  missing_requirements:
    string[] |
    null;

  ready_for_dispatch:
    boolean |
    null;

  updated_at:
    string |
    null;
};


type TruckBoardRow = {
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

  mc_number:
    string |
    null;

  carrier_status:
    string |
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

  trailer_length_ft:
    number |
    null;

  max_weight_lbs:
    number |
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
    NumericValue;

  availability_notes:
    string |
    null;

  ready_for_load_search:
    boolean |
    null;

  last_operational_update:
    string |
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


function numeric(
  value:
    NumericValue |
    undefined,
) {
  const parsed =
    Number(
      value,
    );


  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}


function money(
  value:
    NumericValue |
    undefined,
) {
  const parsed =
    numeric(
      value,
    );


  if (
    parsed ===
    null
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


function rate(
  value:
    NumericValue |
    undefined,
) {
  const parsed =
    numeric(
      value,
    );


  if (
    parsed ===
    null
  ) {
    return "—";
  }


  return `$${parsed.toFixed(
    2,
  )}/mi`;
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


function dispatchFee(
  type:
    string |
    null,

  value:
    NumericValue,
) {
  const amount =
    numeric(
      value,
    );


  if (
    !type ||
    amount ===
      null
  ) {
    return "—";
  }


  if (
    type ===
    "percentage"
  ) {
    return `${amount}%`;
  }


  if (
    type ===
    "flat_per_load"
  ) {
    return `${money(
      amount,
    )} / load`;
  }


  if (
    type ===
    "weekly_flat"
  ) {
    return `${money(
      amount,
    )} / week`;
  }


  return `${pretty(
    type,
  )}: ${amount}`;
}


function stateList(
  values:
    string[] |
    null |
    undefined,
) {
  if (
    !values ||
    values.length ===
      0
  ) {
    return "—";
  }


  return values.join(
    ", ",
  );
}


function requirementLabel(
  requirement:
    string,
) {
  switch (
    requirement
  ) {
    case "company_name":
      return "Company name";

    case "dot_number":
      return "USDOT";

    case "primary_contact":
      return "Primary contact";

    case "signed_dispatch_agreement":
      return "Signed agreement";

    case "load_board_access":
      return "Load-board access";

    case "dispatch_fee":
      return "Dispatch fee";

    case "active_truck":
      return "Active truck";

    default:
      return pretty(
        requirement,
      );
  }
}


function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label:
    string;

  value:
    number |
    string;

  detail:
    string;

  tone?:
    | "neutral"
    | "green"
    | "amber"
    | "blue"
    | "violet";
}) {
  const tones = {
    neutral:
      "border-white/[0.07] bg-white/[0.02]",

    green:
      "border-emerald-500/15 bg-emerald-500/[0.035]",

    amber:
      "border-amber-500/15 bg-amber-500/[0.035]",

    blue:
      "border-blue-500/15 bg-blue-500/[0.035]",

    violet:
      "border-violet-500/15 bg-violet-500/[0.035]",
  };


  return (
    <div
      className={`rounded-[17px] border p-4 ${tones[tone]}`}
    >

      <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
        {label}
      </div>


      <div className="mt-3 text-[25px] font-semibold tracking-[-0.04em] text-white">
        {value}
      </div>


      <div className="mt-1 text-[8px] leading-4 text-zinc-600">
        {detail}
      </div>

    </div>
  );
}


function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title:
    string;

  subtitle?:
    string;

  action?:
    ReactNode;

  children:
    ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.018]">

      <div className="flex flex-col gap-3 border-b border-white/[0.055] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">

        <div>

          <h2 className="text-[13px] font-semibold text-zinc-200">
            {title}
          </h2>


          {subtitle ? (
            <p className="mt-1 text-[9px] leading-4 text-zinc-600">
              {subtitle}
            </p>
          ) : null}

        </div>


        {action}

      </div>


      <div className="p-5">
        {children}
      </div>

    </section>
  );
}


function readinessClasses(
  ready:
    boolean,
) {
  return ready
    ? "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300"
    : "border-amber-500/20 bg-amber-500/[0.06] text-amber-300";
}


function availabilityClasses(
  status:
    string |
    null,
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


export default async function CarrierOperationsPage() {
  const supabase =
    createServerSupabase();


  const [
    onboardingResult,
    readinessResult,
    truckBoardResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "carrier_onboardings",
        )
        .select(`
          id,
          lead_id,
          carrier_id,
          company_name,
          dot_number,
          mc_number,
          status,

          primary_contact_name,
          primary_contact_email,
          primary_contact_phone,

          load_board_access_status,
          load_board_provider,

          dispatch_fee_type,
          dispatch_fee_value,

          minimum_rate_per_mile,
          weekly_revenue_target,

          preferred_lanes,
          regions_to_avoid,
          preferred_states,

          home_time_notes,
          operating_notes,

          max_deadhead_miles,
          preferred_trip_min_miles,
          preferred_trip_max_miles,

          target_rate_per_mile,
          default_mpg,
          operating_cost_per_mile,

          activated_at,
          updated_at
        `)
        .eq(
          "status",
          "active",
        )
        .order(
          "activated_at",
          {
            ascending:
              false,
            nullsFirst:
              false,
          },
        ),

      supabase
        .from(
          "carrier_onboarding_readiness",
        )
        .select(`
          onboarding_id,
          lead_id,
          carrier_id,
          company_name,
          dot_number,
          mc_number,
          status,
          agreement_status,
          load_board_access_status,
          dispatch_fee_type,
          dispatch_fee_value,
          minimum_rate_per_mile,
          weekly_revenue_target,
          truck_count,
          active_truck_count,
          available_truck_count,
          missing_requirements,
          ready_for_dispatch,
          updated_at
        `)
        .eq(
          "status",
          "active",
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
          mc_number,
          carrier_status,
          unit_number,
          truck_type,
          trailer_type,
          trailer_length_ft,
          max_weight_lbs,
          driver_name,
          driver_phone,
          truck_status,
          availability_status,
          available_at,
          current_city,
          current_state,
          current_zip,
          preferred_destination,
          preferred_destination_states,
          max_deadhead_miles,
          minimum_rate_per_mile,
          availability_notes,
          ready_for_load_search,
          last_operational_update
        `)
        .eq(
          "carrier_status",
          "active",
        )
        .order(
          "last_operational_update",
          {
            ascending:
              false,
            nullsFirst:
              false,
          },
        ),
    ]);


  if (
    onboardingResult.error
  ) {
    console.error(
      "ACTIVE CARRIER OPERATIONS ERROR:",
      onboardingResult.error.message,
    );
  }


  if (
    readinessResult.error
  ) {
    console.error(
      "CARRIER READINESS ERROR:",
      readinessResult.error.message,
    );
  }


  if (
    truckBoardResult.error
  ) {
    console.error(
      "TRUCK DISPATCH BOARD ERROR:",
      truckBoardResult.error.message,
    );
  }


  const onboardings =
    (
      onboardingResult.data ??
      []
    ) as OnboardingRow[];


  const readinessRows =
    (
      readinessResult.data ??
      []
    ) as ReadinessRow[];


  const truckBoard =
    (
      truckBoardResult.data ??
      []
    ) as TruckBoardRow[];


  const readinessMap =
    new Map<
      string,
      ReadinessRow
    >();


  for (
    const row
    of readinessRows
  ) {
    readinessMap.set(
      row.onboarding_id,
      row,
    );
  }


  const activeCarriers =
    onboardings.length;


  const readyCarriers =
    readinessRows.filter(
      (
        row,
      ) =>
        row.ready_for_dispatch ===
        true,
    ).length;


  const blockedCarriers =
    Math.max(
      0,
      activeCarriers -
        readyCarriers,
    );


  const activeTrucks =
    truckBoard.filter(
      (
        truck,
      ) =>
        truck.truck_status ===
        "active",
    ).length;


  const availableTrucks =
    truckBoard.filter(
      (
        truck,
      ) =>
        truck.truck_status ===
          "active" &&
        truck.availability_status ===
          "available",
    ).length;


  const inTransitTrucks =
    truckBoard.filter(
      (
        truck,
      ) =>
        truck.availability_status ===
        "in_transit",
    ).length;


  const maintenanceTrucks =
    truckBoard.filter(
      (
        truck,
      ) =>
        truck.truck_status ===
          "maintenance" ||
        truck.availability_status ===
          "maintenance",
    ).length;


  const dispatchReadyTrucks =
    truckBoard.filter(
      (
        truck,
      ) =>
        truck.ready_for_load_search ===
        true,
    ).length;


  return (
    <div className="space-y-6">

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[linear-gradient(135deg,rgba(15,22,28,.97),rgba(8,12,17,.98))] px-6 py-6">

        <div className="pointer-events-none absolute -right-28 -top-32 h-72 w-72 rounded-full bg-blue-500/[0.055] blur-3xl" />


        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">

          <div>

            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-blue-400">
              Phase 3E · Carrier Operations
            </div>


            <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.045em] text-white md:text-[38px]">
              Active Carrier Operations
            </h1>


            <p className="mt-2 max-w-2xl text-[11px] leading-5 text-zinc-500">
              Operational workspace for active SlateLane
              clients, equipment readiness, truck
              availability and dispatch preferences.
            </p>


            <div className="mt-4 inline-flex rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[8px] text-zinc-500">
              Load-finder automation is intentionally not included in this phase.
            </div>

          </div>


          <div className="flex flex-wrap gap-2">

            <Link
              href="/admin/conversions"
              className="inline-flex h-9 items-center rounded-lg border border-emerald-500/15 bg-emerald-500/[0.05] px-4 text-[9px] font-semibold text-emerald-300 hover:bg-emerald-500/[0.1]"
            >
              Conversion Pipeline
            </Link>


            <Link
              href="/admin/onboarding"
              className="inline-flex h-9 items-center rounded-lg border border-white/[0.08] bg-white/[0.025] px-4 text-[9px] font-semibold text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
            >
              Onboarding Hub
            </Link>


            <Link
              href="/admin/carriers"
              className="inline-flex h-9 items-center rounded-lg border border-blue-500/15 bg-blue-500/[0.05] px-4 text-[9px] font-semibold text-blue-300 hover:bg-blue-500/[0.1]"
            >
              Carrier CRM
            </Link>

          </div>

        </div>

      </section>


      {/* =====================================================
          METRICS
      ===================================================== */}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">

        <MetricCard
          label="Active Clients"
          value={
            activeCarriers
          }
          detail="Activated carrier accounts"
          tone="violet"
        />


        <MetricCard
          label="Dispatch Ready"
          value={
            readyCarriers
          }
          detail="All carrier readiness checks pass"
          tone="green"
        />


        <MetricCard
          label="Blocked"
          value={
            blockedCarriers
          }
          detail="Active clients with requirements missing"
          tone="amber"
        />


        <MetricCard
          label="Active Trucks"
          value={
            activeTrucks
          }
          detail="Equipment currently active"
          tone="blue"
        />


        <MetricCard
          label="Available"
          value={
            availableTrucks
          }
          detail="Trucks currently available"
          tone="green"
        />


        <MetricCard
          label="In Transit"
          value={
            inTransitTrucks
          }
          detail="Equipment currently moving"
          tone="violet"
        />


        <MetricCard
          label="Maintenance"
          value={
            maintenanceTrucks
          }
          detail="Equipment unavailable for service"
          tone="amber"
        />

      </div>


      {/* =====================================================
          ACTIVE CLIENTS
      ===================================================== */}

      <Section
        title="Active Carrier Accounts"
        subtitle="Post-onboarding operational profiles for SlateLane clients."
      >

        {onboardings.length >
        0 ? (
          <div className="grid gap-4 xl:grid-cols-2">

            {onboardings.map(
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
                  <article
                    key={
                      carrier.id
                    }
                    className="overflow-hidden rounded-[18px] border border-white/[0.065] bg-black/15"
                  >

                    {/* HEADER */}

                    <div className="border-b border-white/[0.05] p-4">

                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                        <div className="min-w-0">

                          <div className="flex flex-wrap items-center gap-2">

                            <h3 className="truncate text-[13px] font-semibold text-white">
                              {carrier.company_name}
                            </h3>


                            <span
                              className={`rounded-full border px-2 py-0.5 text-[7px] font-semibold ${readinessClasses(
                                ready,
                              )}`}
                            >
                              {ready
                                ? "DISPATCH READY"
                                : "ACTION REQUIRED"}
                            </span>

                          </div>


                          <div className="mt-2 text-[8px] text-zinc-600">

                            {carrier.dot_number
                              ? `USDOT ${carrier.dot_number}`
                              : "No USDOT"}

                            {carrier.mc_number
                              ? ` • MC ${carrier.mc_number}`
                              : ""}

                          </div>


                          <div className="mt-1 text-[8px] text-zinc-700">
                            Activated{" "}
                            {formatDate(
                              carrier.activated_at,
                            )}
                          </div>

                        </div>


                        <div className="flex flex-wrap gap-2">

                          {carrier.lead_id ? (
                            <Link
                              href={`/admin/leads/${carrier.lead_id}`}
                              className="inline-flex h-7 items-center rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 text-[7px] font-medium text-zinc-500 hover:text-zinc-200"
                            >
                              Lead 360
                            </Link>
                          ) : null}


                          {carrier.dot_number ? (
                            <Link
                              href={`/admin/carriers/${carrier.dot_number}`}
                              className="inline-flex h-7 items-center rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 text-[7px] font-medium text-zinc-500 hover:text-zinc-200"
                            >
                              Carrier 360
                            </Link>
                          ) : null}


                          <Link
                            href={`/admin/onboarding/${carrier.id}/documents`}
                            className="inline-flex h-7 items-center rounded-lg border border-violet-500/15 bg-violet-500/[0.04] px-2.5 text-[7px] font-medium text-violet-300 hover:bg-violet-500/[0.08]"
                          >
                            Document Vault
                          </Link>

                        </div>

                      </div>

                    </div>


                    {/* READINESS */}

                    <div className="grid gap-2 border-b border-white/[0.05] p-4 sm:grid-cols-3">

                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.018] p-3">

                        <div className="text-[7px] uppercase tracking-[0.09em] text-zinc-700">
                          Trucks
                        </div>

                        <div className="mt-1 text-[15px] font-semibold text-white">
                          {readiness?.active_truck_count ??
                            0}
                          <span className="ml-1 text-[8px] font-normal text-zinc-600">
                            active
                          </span>
                        </div>

                      </div>


                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.018] p-3">

                        <div className="text-[7px] uppercase tracking-[0.09em] text-zinc-700">
                          Available
                        </div>

                        <div className="mt-1 text-[15px] font-semibold text-emerald-300">
                          {readiness?.available_truck_count ??
                            0}
                        </div>

                      </div>


                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.018] p-3">

                        <div className="text-[7px] uppercase tracking-[0.09em] text-zinc-700">
                          Load Board
                        </div>

                        <div className="mt-1 text-[10px] font-semibold text-zinc-300">
                          {pretty(
                            carrier.load_board_access_status,
                          )}
                        </div>

                      </div>

                    </div>


                    {/* COMMERCIAL SETTINGS */}

                    <div className="border-b border-white/[0.05] p-4">

                      <div className="mb-3 text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                        Commercial Rules
                      </div>


                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                        <div>

                          <div className="text-[7px] text-zinc-700">
                            Dispatch Fee
                          </div>

                          <div className="mt-1 text-[9px] font-medium text-zinc-300">
                            {dispatchFee(
                              carrier.dispatch_fee_type,
                              carrier.dispatch_fee_value,
                            )}
                          </div>

                        </div>


                        <div>

                          <div className="text-[7px] text-zinc-700">
                            Minimum RPM
                          </div>

                          <div className="mt-1 text-[9px] font-medium text-zinc-300">
                            {rate(
                              carrier.minimum_rate_per_mile,
                            )}
                          </div>

                        </div>


                        <div>

                          <div className="text-[7px] text-zinc-700">
                            Target RPM
                          </div>

                          <div className="mt-1 text-[9px] font-medium text-emerald-300">
                            {rate(
                              carrier.target_rate_per_mile,
                            )}
                          </div>

                        </div>


                        <div>

                          <div className="text-[7px] text-zinc-700">
                            Weekly Target
                          </div>

                          <div className="mt-1 text-[9px] font-medium text-zinc-300">
                            {money(
                              carrier.weekly_revenue_target,
                            )}
                          </div>

                        </div>

                      </div>

                    </div>


                    {/* TRIP PREFERENCES */}

                    <div className="border-b border-white/[0.05] p-4">

                      <div className="mb-3 text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-700">
                        Dispatch Preferences
                      </div>


                      <div className="grid gap-4 sm:grid-cols-2">

                        <div>

                          <div className="text-[7px] uppercase tracking-[0.08em] text-zinc-700">
                            Preferred States
                          </div>

                          <div className="mt-1 text-[9px] leading-4 text-zinc-400">
                            {stateList(
                              carrier.preferred_states,
                            )}
                          </div>

                        </div>


                        <div>

                          <div className="text-[7px] uppercase tracking-[0.08em] text-zinc-700">
                            Preferred Lanes
                          </div>

                          <div className="mt-1 text-[9px] leading-4 text-zinc-400">
                            {stateList(
                              carrier.preferred_lanes,
                            )}
                          </div>

                        </div>


                        <div>

                          <div className="text-[7px] uppercase tracking-[0.08em] text-zinc-700">
                            Avoid
                          </div>

                          <div className="mt-1 text-[9px] leading-4 text-red-300/80">
                            {stateList(
                              carrier.regions_to_avoid,
                            )}
                          </div>

                        </div>


                        <div>

                          <div className="text-[7px] uppercase tracking-[0.08em] text-zinc-700">
                            Trip Range
                          </div>

                          <div className="mt-1 text-[9px] text-zinc-400">

                            {carrier.preferred_trip_min_miles !==
                            null
                              ? carrier.preferred_trip_min_miles
                              : "—"}

                            {" – "}

                            {carrier.preferred_trip_max_miles !==
                            null
                              ? carrier.preferred_trip_max_miles
                              : "—"}

                            {" mi"}

                          </div>

                        </div>


                        <div>

                          <div className="text-[7px] uppercase tracking-[0.08em] text-zinc-700">
                            Max Deadhead
                          </div>

                          <div className="mt-1 text-[9px] text-zinc-400">
                            {carrier.max_deadhead_miles !==
                            null
                              ? `${carrier.max_deadhead_miles} mi`
                              : "—"}
                          </div>

                        </div>


                        <div>

                          <div className="text-[7px] uppercase tracking-[0.08em] text-zinc-700">
                            Operating Cost
                          </div>

                          <div className="mt-1 text-[9px] text-zinc-400">
                            {rate(
                              carrier.operating_cost_per_mile,
                            )}
                          </div>

                        </div>

                      </div>

                    </div>


                    {/* NOTES + BLOCKERS */}

                    <div className="p-4">

                      {!ready &&
                      missing.length >
                        0 ? (
                        <div className="mb-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.035] p-3">

                          <div className="text-[8px] font-semibold text-amber-300">
                            Dispatch readiness blockers
                          </div>


                          <div className="mt-2 flex flex-wrap gap-1.5">

                            {missing.map(
                              (
                                requirement,
                              ) => (
                                <span
                                  key={
                                    requirement
                                  }
                                  className="rounded-full border border-amber-500/15 bg-black/10 px-2 py-1 text-[7px] text-amber-300/80"
                                >
                                  {requirementLabel(
                                    requirement,
                                  )}
                                </span>
                              ),
                            )}

                          </div>

                        </div>
                      ) : null}


                      <div className="grid gap-3 sm:grid-cols-2">

                        <div>

                          <div className="text-[7px] uppercase tracking-[0.08em] text-zinc-700">
                            Home Time
                          </div>

                          <div className="mt-1 text-[8px] leading-4 text-zinc-500">
                            {carrier.home_time_notes ||
                              "No home-time notes."}
                          </div>

                        </div>


                        <div>

                          <div className="text-[7px] uppercase tracking-[0.08em] text-zinc-700">
                            Operating Notes
                          </div>

                          <div className="mt-1 text-[8px] leading-4 text-zinc-500">
                            {carrier.operating_notes ||
                              "No operating notes."}
                          </div>

                        </div>

                      </div>

                    </div>

                  </article>
                );
              },
            )}

          </div>
        ) : (
          <div className="rounded-[16px] border border-white/[0.055] bg-black/15 p-6">

            <div className="text-[11px] font-semibold text-zinc-300">
              No active carrier accounts yet.
            </div>


            <div className="mt-2 max-w-xl text-[9px] leading-5 text-zinc-600">
              Carriers will appear here automatically
              after they pass the Phase 3D activation gate.
              No duplicate carrier setup is required.
            </div>


            <Link
              href="/admin/conversions"
              className="mt-4 inline-flex h-8 items-center rounded-lg border border-emerald-500/15 bg-emerald-500/[0.05] px-3 text-[8px] font-semibold text-emerald-300 hover:bg-emerald-500/[0.1]"
            >
              Open Conversion Pipeline →
            </Link>

          </div>
        )}

      </Section>


      {/* =====================================================
          TRUCK BOARD
      ===================================================== */}

      <Section
        title="Truck Operations Board"
        subtitle="Live equipment and driver state from the existing dispatch-board view."
        action={
          <div className="rounded-full border border-emerald-500/15 bg-emerald-500/[0.04] px-2.5 py-1 text-[8px] text-emerald-300">
            {dispatchReadyTrucks} dispatch ready
          </div>
        }
      >

        {truckBoard.length >
        0 ? (
          <div className="overflow-x-auto">

            <table className="w-full min-w-[1100px] text-left">

              <thead>

                <tr className="border-b border-white/[0.055] text-[7px] uppercase tracking-[0.1em] text-zinc-700">

                  <th className="pb-3 pr-4 font-semibold">
                    Carrier / Unit
                  </th>

                  <th className="pb-3 pr-4 font-semibold">
                    Equipment
                  </th>

                  <th className="pb-3 pr-4 font-semibold">
                    Driver
                  </th>

                  <th className="pb-3 pr-4 font-semibold">
                    Availability
                  </th>

                  <th className="pb-3 pr-4 font-semibold">
                    Current Location
                  </th>

                  <th className="pb-3 pr-4 font-semibold">
                    Preference
                  </th>

                  <th className="pb-3 pr-4 font-semibold">
                    Min RPM
                  </th>

                  <th className="pb-3 text-right font-semibold">
                    Updated
                  </th>

                </tr>

              </thead>


              <tbody>

                {truckBoard.map(
                  (
                    truck,
                  ) => (
                    <tr
                      key={
                        truck.truck_id
                      }
                      className="border-b border-white/[0.04] last:border-b-0"
                    >

                      <td className="py-4 pr-4">

                        <div className="text-[9px] font-semibold text-zinc-300">
                          {truck.company_name ||
                            "Carrier"}
                        </div>

                        <div className="mt-1 text-[8px] text-zinc-700">
                          Unit{" "}
                          {truck.unit_number ||
                            "—"}
                        </div>

                      </td>


                      <td className="py-4 pr-4">

                        <div className="text-[9px] text-zinc-400">
                          {pretty(
                            truck.truck_type,
                          )}
                        </div>

                        <div className="mt-1 text-[8px] text-zinc-700">
                          {pretty(
                            truck.trailer_type,
                          )}

                          {truck.trailer_length_ft
                            ? ` • ${truck.trailer_length_ft} ft`
                            : ""}
                        </div>

                      </td>


                      <td className="py-4 pr-4">

                        <div className="text-[9px] text-zinc-400">
                          {truck.driver_name ||
                            "—"}
                        </div>

                        <div className="mt-1 text-[8px] text-zinc-700">
                          {truck.driver_phone ||
                            "No phone"}
                        </div>

                      </td>


                      <td className="py-4 pr-4">

                        <span
                          className={`rounded-full border px-2 py-1 text-[7px] font-semibold ${availabilityClasses(
                            truck.availability_status,
                          )}`}
                        >
                          {pretty(
                            truck.availability_status,
                          )}
                        </span>


                        {truck.ready_for_load_search ? (
                          <div className="mt-1 text-[7px] font-medium text-emerald-400">
                            Dispatch Ready
                          </div>
                        ) : null}

                      </td>


                      <td className="py-4 pr-4">

                        <div className="text-[9px] text-zinc-400">

                          {truck.current_city ||
                            "—"}

                          {truck.current_state
                            ? `, ${truck.current_state}`
                            : ""}

                        </div>

                        <div className="mt-1 text-[8px] text-zinc-700">
                          {truck.current_zip ||
                            ""}
                        </div>

                      </td>


                      <td className="py-4 pr-4">

                        <div className="max-w-[170px] text-[8px] leading-4 text-zinc-500">
                          {truck.preferred_destination ||
                            stateList(
                              truck.preferred_destination_states,
                            )}
                        </div>


                        {truck.max_deadhead_miles !==
                        null ? (
                          <div className="mt-1 text-[7px] text-zinc-700">
                            Max DH{" "}
                            {truck.max_deadhead_miles} mi
                          </div>
                        ) : null}

                      </td>


                      <td className="py-4 pr-4 text-[9px] font-medium text-zinc-300">
                        {rate(
                          truck.minimum_rate_per_mile,
                        )}
                      </td>


                      <td className="py-4 text-right text-[8px] text-zinc-700">
                        {formatDate(
                          truck.last_operational_update,
                        )}
                      </td>

                    </tr>
                  ),
                )}

              </tbody>

            </table>

          </div>
        ) : (
          <div className="rounded-[16px] border border-white/[0.055] bg-black/15 p-6">

            <div className="text-[11px] font-semibold text-zinc-300">
              No trucks have been registered yet.
            </div>


            <div className="mt-2 max-w-2xl text-[9px] leading-5 text-zinc-600">
              The database already contains the truck,
              availability and availability-history
              infrastructure. Phase 3E-B will add the
              production controls for registering trucks and
              updating their availability from this workspace.
            </div>

          </div>
        )}

      </Section>


      {/* =====================================================
          OPERATING MODEL
      ===================================================== */}

      <Section
        title="Operational Readiness Rules"
        subtitle="The existing database view determines when an active carrier can actually be dispatched."
      >

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-xl border border-white/[0.055] bg-black/15 p-4">

            <div className="text-[8px] font-semibold text-zinc-300">
              1. Client Activated
            </div>

            <div className="mt-2 text-[8px] leading-4 text-zinc-700">
              Phase 3D completes the sales and document handoff.
            </div>

          </div>


          <div className="rounded-xl border border-white/[0.055] bg-black/15 p-4">

            <div className="text-[8px] font-semibold text-zinc-300">
              2. Load Board Ready
            </div>

            <div className="mt-2 text-[8px] leading-4 text-zinc-700">
              Carrier load-board access must be marked active.
            </div>

          </div>


          <div className="rounded-xl border border-white/[0.055] bg-black/15 p-4">

            <div className="text-[8px] font-semibold text-zinc-300">
              3. Active Truck
            </div>

            <div className="mt-2 text-[8px] leading-4 text-zinc-700">
              At least one truck must be active in the fleet.
            </div>

          </div>


          <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.025] p-4">

            <div className="text-[8px] font-semibold text-emerald-300">
              4. Dispatch Ready
            </div>

            <div className="mt-2 text-[8px] leading-4 text-zinc-600">
              The carrier becomes operationally ready without requiring load-finder automation.
            </div>

          </div>

        </div>

      </Section>

    </div>
  );
}