"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";


const TRUCK_TYPES =
  new Set([
    "semi",
    "box_truck",
    "hotshot",
    "sprinter",
    "straight_truck",
    "other",
  ]);


const TRUCK_STATUSES =
  new Set([
    "active",
    "maintenance",
    "inactive",
  ]);


const AVAILABILITY_STATUSES =
  new Set([
    "available",
    "booked",
    "in_transit",
    "unavailable",
    "off_duty",
    "maintenance",
  ]);


const LOAD_BOARD_STATUSES =
  new Set([
    "not_requested",
    "requested",
    "invited",
    "active",
    "revoked",
  ]);


const DISPATCH_FEE_TYPES =
  new Set([
    "percentage",
    "flat_per_load",
    "weekly_flat",
  ]);


function clean(
  value:
    FormDataEntryValue |
    null,
) {
  return String(
    value ?? "",
  ).trim();
}


function optionalText(
  value:
    FormDataEntryValue |
    null,
) {
  const text =
    clean(
      value,
    );

  return text ||
    null;
}


function optionalInteger(
  value:
    FormDataEntryValue |
    null,
) {
  const text =
    clean(
      value,
    );


  if (!text) {
    return null;
  }


  const parsed =
    Number.parseInt(
      text,
      10,
    );


  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}


function optionalNumber(
  value:
    FormDataEntryValue |
    null,
) {
  const text =
    clean(
      value,
    );


  if (!text) {
    return null;
  }


  const parsed =
    Number(
      text,
    );


  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}


function parseStateList(
  value:
    FormDataEntryValue |
    null,
) {
  const raw =
    clean(
      value,
    );


  if (!raw) {
    return [];
  }


  return [
    ...new Set(
      raw
        .split(",")
        .map(
          (
            item,
          ) =>
            item
              .trim()
              .toUpperCase(),
        )
        .filter(
          Boolean,
        ),
    ),
  ];
}


function parseTextList(
  value:
    FormDataEntryValue |
    null,
) {
  const raw =
    clean(
      value,
    );


  if (!raw) {
    return [];
  }


  return [
    ...new Set(
      raw
        .split(",")
        .map(
          (
            item,
          ) =>
            item.trim(),
        )
        .filter(
          Boolean,
        ),
    ),
  ];
}


function normalizedState(
  value:
    FormDataEntryValue |
    null,
) {
  const text =
    clean(
      value,
    );


  return text
    ? text.toUpperCase()
    : null;
}


function revalidateOperations({
  onboardingId,
  dotNumber,
  leadId,
}: {
  onboardingId:
    string;

  dotNumber:
    number |
    null;

  leadId?:
    string |
    null;
}) {
  revalidatePath(
    "/admin/operations",
  );

  revalidatePath(
    "/admin/conversions",
  );

  revalidatePath(
    "/admin/dashboard",
  );

  revalidatePath(
    "/admin/onboarding",
  );

  revalidatePath(
    `/admin/onboarding/${onboardingId}/documents`,
  );

  revalidatePath(
    "/admin/carriers",
  );


  if (
    dotNumber
  ) {
    revalidatePath(
      `/admin/carriers/${dotNumber}`,
    );
  }


  if (
    leadId
  ) {
    revalidatePath(
      `/admin/leads/${leadId}`,
    );
  }
}


function safeAvailabilityStatus({
  truckStatus,
  availabilityStatus,
}: {
  truckStatus:
    string;

  availabilityStatus:
    string;
}) {
  if (
    truckStatus ===
    "maintenance"
  ) {
    return "maintenance";
  }


  if (
    truckStatus ===
    "inactive"
  ) {
    return "unavailable";
  }


  return availabilityStatus;
}


/* ============================================================
   PHASE 3E-C
   UPDATE CARRIER OPERATING PROFILE
============================================================ */

export async function updateCarrierOperatingProfileAction(
  formData:
    FormData,
) {
  const onboardingId =
    clean(
      formData.get(
        "onboardingId",
      ),
    );


  if (
    !onboardingId
  ) {
    throw new Error(
      "Carrier onboarding ID is required.",
    );
  }


  const loadBoardStatus =
    clean(
      formData.get(
        "loadBoardAccessStatus",
      ),
    );


  if (
    !LOAD_BOARD_STATUSES.has(
      loadBoardStatus,
    )
  ) {
    throw new Error(
      "Invalid load-board access status.",
    );
  }


  const dispatchFeeTypeRaw =
    clean(
      formData.get(
        "dispatchFeeType",
      ),
    );


  const dispatchFeeType =
    dispatchFeeTypeRaw ||
    null;


  if (
    dispatchFeeType &&
    !DISPATCH_FEE_TYPES.has(
      dispatchFeeType,
    )
  ) {
    throw new Error(
      "Invalid dispatch fee type.",
    );
  }


  const dispatchFeeValue =
    optionalNumber(
      formData.get(
        "dispatchFeeValue",
      ),
    );


  /*
   * Fee type and fee value operate as one setting.
   */
  if (
    (
      dispatchFeeType &&
      dispatchFeeValue ===
        null
    ) ||
    (
      !dispatchFeeType &&
      dispatchFeeValue !==
        null
    )
  ) {
    throw new Error(
      "Dispatch fee type and value must either both be provided or both be blank.",
    );
  }


  if (
    dispatchFeeValue !==
      null &&
    dispatchFeeValue <
      0
  ) {
    throw new Error(
      "Dispatch fee cannot be negative.",
    );
  }


  if (
    dispatchFeeType ===
      "percentage" &&
    dispatchFeeValue !==
      null &&
    dispatchFeeValue >
      100
  ) {
    throw new Error(
      "Percentage dispatch fee cannot exceed 100%.",
    );
  }


  const minimumRpm =
    optionalNumber(
      formData.get(
        "minimumRatePerMile",
      ),
    );


  const targetRpm =
    optionalNumber(
      formData.get(
        "targetRatePerMile",
      ),
    );


  const weeklyTarget =
    optionalNumber(
      formData.get(
        "weeklyRevenueTarget",
      ),
    );


  const maxDeadhead =
    optionalInteger(
      formData.get(
        "maxDeadheadMiles",
      ),
    );


  const tripMin =
    optionalInteger(
      formData.get(
        "preferredTripMinMiles",
      ),
    );


  const tripMax =
    optionalInteger(
      formData.get(
        "preferredTripMaxMiles",
      ),
    );


  const defaultMpg =
    optionalNumber(
      formData.get(
        "defaultMpg",
      ),
    );


  const defaultFuelPrice =
    optionalNumber(
      formData.get(
        "defaultFuelPrice",
      ),
    );


  const operatingCost =
    optionalNumber(
      formData.get(
        "operatingCostPerMile",
      ),
    );


  if (
    minimumRpm !==
      null &&
    minimumRpm <
      0
  ) {
    throw new Error(
      "Minimum RPM cannot be negative.",
    );
  }


  if (
    targetRpm !==
      null &&
    targetRpm <=
      0
  ) {
    throw new Error(
      "Target RPM must be greater than zero.",
    );
  }


  if (
    minimumRpm !==
      null &&
    targetRpm !==
      null &&
    targetRpm <
      minimumRpm
  ) {
    throw new Error(
      "Target RPM cannot be below the minimum RPM.",
    );
  }


  if (
    weeklyTarget !==
      null &&
    weeklyTarget <
      0
  ) {
    throw new Error(
      "Weekly revenue target cannot be negative.",
    );
  }


  if (
    maxDeadhead !==
      null &&
    maxDeadhead <
      0
  ) {
    throw new Error(
      "Maximum deadhead cannot be negative.",
    );
  }


  if (
    tripMin !==
      null &&
    tripMin <
      0
  ) {
    throw new Error(
      "Minimum trip miles cannot be negative.",
    );
  }


  if (
    tripMax !==
      null &&
    tripMax <
      0
  ) {
    throw new Error(
      "Maximum trip miles cannot be negative.",
    );
  }


  if (
    tripMin !==
      null &&
    tripMax !==
      null &&
    tripMin >
      tripMax
  ) {
    throw new Error(
      "Minimum trip miles cannot exceed maximum trip miles.",
    );
  }


  if (
    defaultMpg !==
      null &&
    defaultMpg <=
      0
  ) {
    throw new Error(
      "Default MPG must be greater than zero.",
    );
  }


  if (
    defaultFuelPrice !==
      null &&
    defaultFuelPrice <
      0
  ) {
    throw new Error(
      "Fuel price cannot be negative.",
    );
  }


  if (
    operatingCost !==
      null &&
    operatingCost <
      0
  ) {
    throw new Error(
      "Operating cost cannot be negative.",
    );
  }


  const primaryContactEmail =
    optionalText(
      formData.get(
        "primaryContactEmail",
      ),
    );


  if (
    primaryContactEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      primaryContactEmail,
    )
  ) {
    throw new Error(
      "Primary contact email is not valid.",
    );
  }


  const db =
    createAdminSupabase();


  /* ==========================================================
     RELOAD CARRIER SERVER-SIDE
  ========================================================== */

  const {
    data:
      onboarding,

    error:
      onboardingError,
  } =
    await db
      .from(
        "carrier_onboardings",
      )
      .select(`
        id,
        lead_id,
        carrier_id,
        dot_number,
        status
      `)
      .eq(
        "id",
        onboardingId,
      )
      .maybeSingle();


  if (
    onboardingError
  ) {
    throw new Error(
      `Could not verify carrier: ${onboardingError.message}`,
    );
  }


  if (
    !onboarding
  ) {
    throw new Error(
      "Carrier onboarding record was not found.",
    );
  }


  /*
   * Phase 3E is intentionally post-activation.
   */
  if (
    onboarding.status !==
    "active"
  ) {
    throw new Error(
      "Operating profiles may only be edited for active carriers.",
    );
  }


  const now =
    new Date()
      .toISOString();


  const {
    error:
      updateError,
  } =
    await db
      .from(
        "carrier_onboardings",
      )
      .update({
        primary_contact_name:
          optionalText(
            formData.get(
              "primaryContactName",
            ),
          ),

        primary_contact_email:
          primaryContactEmail,

        primary_contact_phone:
          optionalText(
            formData.get(
              "primaryContactPhone",
            ),
          ),

        load_board_access_status:
          loadBoardStatus,

        load_board_provider:
          optionalText(
            formData.get(
              "loadBoardProvider",
            ),
          ),

        dispatch_fee_type:
          dispatchFeeType,

        dispatch_fee_value:
          dispatchFeeValue,

        minimum_rate_per_mile:
          minimumRpm,

        target_rate_per_mile:
          targetRpm,

        weekly_revenue_target:
          weeklyTarget,

        preferred_lanes:
          parseTextList(
            formData.get(
              "preferredLanes",
            ),
          ),

        preferred_states:
          parseStateList(
            formData.get(
              "preferredStates",
            ),
          ),

        regions_to_avoid:
          parseTextList(
            formData.get(
              "regionsToAvoid",
            ),
          ),

        max_deadhead_miles:
          maxDeadhead,

        preferred_trip_min_miles:
          tripMin,

        preferred_trip_max_miles:
          tripMax,

        default_mpg:
          defaultMpg,

        default_fuel_price:
          defaultFuelPrice,

        operating_cost_per_mile:
          operatingCost,

        home_time_notes:
          optionalText(
            formData.get(
              "homeTimeNotes",
            ),
          ),

        operating_notes:
          optionalText(
            formData.get(
              "operatingNotes",
            ),
          ),

        updated_at:
          now,
      })
      .eq(
        "id",
        onboarding.id,
      )
      .eq(
        "status",
        "active",
      );


  if (
    updateError
  ) {
    throw new Error(
      `Could not update carrier operating profile: ${updateError.message}`,
    );
  }


  /*
   * We deliberately do NOT overwrite per-truck
   * minimum RPM or deadhead settings here.
   *
   * Carrier settings are defaults.
   * Truck-specific operational overrides remain intact.
   */
  revalidateOperations({
    onboardingId:
      onboarding.id,

    dotNumber:
      onboarding.dot_number,

    leadId:
      onboarding.lead_id,
  });
}


/* ============================================================
   PHASE 3E-B
   REGISTER TRUCK
============================================================ */

export async function createTruckAction(
  formData:
    FormData,
) {
  const onboardingId =
    clean(
      formData.get(
        "onboardingId",
      ),
    );


  const unitNumber =
    clean(
      formData.get(
        "unitNumber",
      ),
    );


  const truckType =
    clean(
      formData.get(
        "truckType",
      ),
    );


  const requestedTruckStatus =
    clean(
      formData.get(
        "truckStatus",
      ),
    ) ||
    "active";


  const requestedAvailability =
    clean(
      formData.get(
        "availabilityStatus",
      ),
    ) ||
    "unavailable";


  if (
    !onboardingId ||
    !unitNumber
  ) {
    throw new Error(
      "Carrier and unit number are required.",
    );
  }


  if (
    !TRUCK_TYPES.has(
      truckType,
    )
  ) {
    throw new Error(
      "Invalid truck type.",
    );
  }


  if (
    !TRUCK_STATUSES.has(
      requestedTruckStatus,
    )
  ) {
    throw new Error(
      "Invalid truck status.",
    );
  }


  if (
    !AVAILABILITY_STATUSES.has(
      requestedAvailability,
    )
  ) {
    throw new Error(
      "Invalid availability status.",
    );
  }


  const trailerLength =
    optionalInteger(
      formData.get(
        "trailerLengthFt",
      ),
    );


  const maxWeight =
    optionalInteger(
      formData.get(
        "maxWeightLbs",
      ),
    );


  const maxDeadhead =
    optionalInteger(
      formData.get(
        "maxDeadheadMiles",
      ),
    );


  const minimumRpm =
    optionalNumber(
      formData.get(
        "minimumRatePerMile",
      ),
    );


  if (
    trailerLength !==
      null &&
    trailerLength <=
      0
  ) {
    throw new Error(
      "Trailer length must be greater than zero.",
    );
  }


  if (
    maxWeight !==
      null &&
    maxWeight <=
      0
  ) {
    throw new Error(
      "Maximum weight must be greater than zero.",
    );
  }


  if (
    maxDeadhead !==
      null &&
    maxDeadhead <
      0
  ) {
    throw new Error(
      "Maximum deadhead cannot be negative.",
    );
  }


  if (
    minimumRpm !==
      null &&
    minimumRpm <
      0
  ) {
    throw new Error(
      "Minimum rate per mile cannot be negative.",
    );
  }


  const db =
    createAdminSupabase();


  const {
    data:
      onboarding,

    error:
      onboardingError,
  } =
    await db
      .from(
        "carrier_onboardings",
      )
      .select(`
        id,
        carrier_id,
        company_name,
        dot_number,
        status,
        minimum_rate_per_mile,
        max_deadhead_miles
      `)
      .eq(
        "id",
        onboardingId,
      )
      .maybeSingle();


  if (
    onboardingError
  ) {
    throw new Error(
      `Could not verify carrier: ${onboardingError.message}`,
    );
  }


  if (
    !onboarding
  ) {
    throw new Error(
      "Carrier onboarding record was not found.",
    );
  }


  if (
    onboarding.status !==
    "active"
  ) {
    throw new Error(
      "Trucks can only be registered for an active carrier.",
    );
  }


  const {
    data:
      duplicate,
  } =
    await db
      .from(
        "trucks",
      )
      .select(
        "id",
      )
      .eq(
        "onboarding_id",
        onboarding.id,
      )
      .eq(
        "unit_number",
        unitNumber,
      )
      .maybeSingle();


  if (
    duplicate
  ) {
    throw new Error(
      `Unit ${unitNumber} is already registered for this carrier.`,
    );
  }


  const truckStatus =
    requestedTruckStatus;


  const availabilityStatus =
    safeAvailabilityStatus({
      truckStatus,

      availabilityStatus:
        requestedAvailability,
    });


  const {
    data:
      truck,

    error:
      truckError,
  } =
    await db
      .from(
        "trucks",
      )
      .insert({
        onboarding_id:
          onboarding.id,

        carrier_id:
          onboarding.carrier_id,

        unit_number:
          unitNumber,

        truck_type:
          truckType,

        trailer_type:
          optionalText(
            formData.get(
              "trailerType",
            ),
          ),

        trailer_length_ft:
          trailerLength,

        max_weight_lbs:
          maxWeight,

        driver_name:
          optionalText(
            formData.get(
              "driverName",
            ),
          ),

        driver_phone:
          optionalText(
            formData.get(
              "driverPhone",
            ),
          ),

        home_city:
          optionalText(
            formData.get(
              "homeCity",
            ),
          ),

        home_state:
          normalizedState(
            formData.get(
              "homeState",
            ),
          ),

        status:
          truckStatus,

        equipment_notes:
          optionalText(
            formData.get(
              "equipmentNotes",
            ),
          ),
      })
      .select(
        "id",
      )
      .single();


  if (
    truckError ||
    !truck
  ) {
    throw new Error(
      `Could not register truck: ${
        truckError?.message ??
        "Unknown error"
      }`,
    );
  }


  const now =
    new Date()
      .toISOString();


  const effectiveMinimumRpm =
    minimumRpm ??
    (
      onboarding.minimum_rate_per_mile !==
      null
        ? Number(
            onboarding.minimum_rate_per_mile,
          )
        : null
    );


  const effectiveDeadhead =
    maxDeadhead ??
    onboarding.max_deadhead_miles ??
    null;


  const {
    error:
      availabilityError,
  } =
    await db
      .from(
        "truck_availability",
      )
      .insert({
        truck_id:
          truck.id,

        availability_status:
          availabilityStatus,

        available_at:
          availabilityStatus ===
          "available"
            ? now
            : null,

        current_city:
          optionalText(
            formData.get(
              "currentCity",
            ),
          ),

        current_state:
          normalizedState(
            formData.get(
              "currentState",
            ),
          ),

        current_zip:
          optionalText(
            formData.get(
              "currentZip",
            ),
          ),

        preferred_destination:
          optionalText(
            formData.get(
              "preferredDestination",
            ),
          ),

        preferred_destination_states:
          parseStateList(
            formData.get(
              "preferredDestinationStates",
            ),
          ),

        max_deadhead_miles:
          effectiveDeadhead,

        minimum_rate_per_mile:
          effectiveMinimumRpm,

        notes:
          optionalText(
            formData.get(
              "availabilityNotes",
            ),
          ),
      });


  if (
    availabilityError
  ) {
    await db
      .from(
        "trucks",
      )
      .delete()
      .eq(
        "id",
        truck.id,
      );


    throw new Error(
      `Truck availability could not be created: ${availabilityError.message}`,
    );
  }


  revalidateOperations({
    onboardingId:
      onboarding.id,

    dotNumber:
      onboarding.dot_number,
  });
}


/* ============================================================
   UPDATE LIVE TRUCK OPERATIONS
============================================================ */

export async function updateTruckOperationsAction(
  formData:
    FormData,
) {
  const truckId =
    clean(
      formData.get(
        "truckId",
      ),
    );


  const requestedTruckStatus =
    clean(
      formData.get(
        "truckStatus",
      ),
    );


  const requestedAvailability =
    clean(
      formData.get(
        "availabilityStatus",
      ),
    );


  if (
    !truckId
  ) {
    throw new Error(
      "Truck ID is required.",
    );
  }


  if (
    !TRUCK_STATUSES.has(
      requestedTruckStatus,
    )
  ) {
    throw new Error(
      "Invalid truck status.",
    );
  }


  if (
    !AVAILABILITY_STATUSES.has(
      requestedAvailability,
    )
  ) {
    throw new Error(
      "Invalid availability status.",
    );
  }


  const maxDeadhead =
    optionalInteger(
      formData.get(
        "maxDeadheadMiles",
      ),
    );


  const minimumRpm =
    optionalNumber(
      formData.get(
        "minimumRatePerMile",
      ),
    );


  if (
    maxDeadhead !==
      null &&
    maxDeadhead <
      0
  ) {
    throw new Error(
      "Maximum deadhead cannot be negative.",
    );
  }


  if (
    minimumRpm !==
      null &&
    minimumRpm <
      0
  ) {
    throw new Error(
      "Minimum rate per mile cannot be negative.",
    );
  }


  const db =
    createAdminSupabase();


  const {
    data:
      truck,

    error:
      truckError,
  } =
    await db
      .from(
        "trucks",
      )
      .select(`
        id,
        onboarding_id,
        status
      `)
      .eq(
        "id",
        truckId,
      )
      .maybeSingle();


  if (
    truckError
  ) {
    throw new Error(
      `Could not verify truck: ${truckError.message}`,
    );
  }


  if (
    !truck
  ) {
    throw new Error(
      "Truck was not found.",
    );
  }


  const {
    data:
      onboarding,

    error:
      onboardingError,
  } =
    await db
      .from(
        "carrier_onboardings",
      )
      .select(`
        id,
        dot_number,
        status
      `)
      .eq(
        "id",
        truck.onboarding_id,
      )
      .maybeSingle();


  if (
    onboardingError
  ) {
    throw new Error(
      `Could not verify carrier: ${onboardingError.message}`,
    );
  }


  if (
    !onboarding ||
    onboarding.status !==
      "active"
  ) {
    throw new Error(
      "Operational changes are only allowed for active carriers.",
    );
  }


  const availabilityStatus =
    safeAvailabilityStatus({
      truckStatus:
        requestedTruckStatus,

      availabilityStatus:
        requestedAvailability,
    });


  const {
    error:
      statusError,
  } =
    await db
      .from(
        "trucks",
      )
      .update({
        status:
          requestedTruckStatus,
      })
      .eq(
        "id",
        truck.id,
      )
      .eq(
        "onboarding_id",
        onboarding.id,
      );


  if (
    statusError
  ) {
    throw new Error(
      `Could not update truck status: ${statusError.message}`,
    );
  }


  const {
    data:
      previousAvailability,
  } =
    await db
      .from(
        "truck_availability",
      )
      .select(`
        availability_status,
        available_at
      `)
      .eq(
        "truck_id",
        truck.id,
      )
      .maybeSingle();


  const becameAvailable =
    availabilityStatus ===
      "available" &&
    previousAvailability
      ?.availability_status !==
      "available";


  const availableAt =
    availabilityStatus ===
    "available"
      ? becameAvailable
        ? new Date()
            .toISOString()
        : previousAvailability
            ?.available_at ??
          new Date()
            .toISOString()
      : null;


  const {
    error:
      availabilityError,
  } =
    await db
      .from(
        "truck_availability",
      )
      .upsert(
        {
          truck_id:
            truck.id,

          availability_status:
            availabilityStatus,

          available_at:
            availableAt,

          current_city:
            optionalText(
              formData.get(
                "currentCity",
              ),
            ),

          current_state:
            normalizedState(
              formData.get(
                "currentState",
              ),
            ),

          current_zip:
            optionalText(
              formData.get(
                "currentZip",
              ),
            ),

          preferred_destination:
            optionalText(
              formData.get(
                "preferredDestination",
              ),
            ),

          preferred_destination_states:
            parseStateList(
              formData.get(
                "preferredDestinationStates",
              ),
            ),

          max_deadhead_miles:
            maxDeadhead,

          minimum_rate_per_mile:
            minimumRpm,

          notes:
            optionalText(
              formData.get(
                "availabilityNotes",
              ),
            ),
        },
        {
          onConflict:
            "truck_id",
        },
      );


  if (
    availabilityError
  ) {
    throw new Error(
      `Could not update availability: ${availabilityError.message}`,
    );
  }


  revalidateOperations({
    onboardingId:
      onboarding.id,

    dotNumber:
      onboarding.dot_number,
  });
}