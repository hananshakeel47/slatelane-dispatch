export type ProviderSourceCode =
  | "dat"
  | "truckstop"
  | "123loadboard"
  | "direct_broker"
  | "email";


export type ProviderSearchInput = {
  sessionId:
    string;

  truckId:
    string;

  originCity:
    string | null;

  originState:
    string | null;

  originZip:
    string | null;

  originRadiusMiles:
    number | null;

  destinationCity:
    string | null;

  destinationState:
    string | null;

  destinationZip:
    string | null;

  destinationRadiusMiles:
    number | null;

  equipmentType:
    string | null;

  pickupStart:
    string | null;

  pickupEnd:
    string | null;

  minimumRate:
    number | null;

  minimumRatePerMile:
    number | null;

  minimumTripMiles:
    number | null;

  maximumTripMiles:
    number | null;

  maximumDeadheadMiles:
    number | null;
};


export type NormalizedProviderLoad = {
  externalLoadId?:
    string | null;

  brokerLoadNumber?:
    string | null;

  providerUrl?:
    string | null;


  brokerName?:
    string | null;

  brokerMcNumber?:
    string | null;

  brokerDotNumber?:
    number | null;

  brokerPhone?:
    string | null;

  brokerEmail?:
    string | null;


  originCity:
    string;

  originState:
    string;

  originZip?:
    string | null;

  originLat?:
    number | null;

  originLon?:
    number | null;


  destinationCity:
    string;

  destinationState:
    string;

  destinationZip?:
    string | null;

  destinationLat?:
    number | null;

  destinationLon?:
    number | null;


  pickupStart?:
    string | null;

  pickupEnd?:
    string | null;

  deliveryStart?:
    string | null;

  deliveryEnd?:
    string | null;


  equipmentType?:
    string | null;

  trailerLengthFt?:
    number | null;

  commodity?:
    string | null;

  weightLbs?:
    number | null;


  postedRate?:
    number | null;

  loadedMiles?:
    number | null;

  deadheadMiles?:
    number | null;


  bookingMethod?:
    | "call"
    | "email"
    | "provider"
    | "book_now"
    | "unknown";

  bookNowAvailable?:
    boolean;


  providerPostedAt?:
    string | null;

  providerUpdatedAt?:
    string | null;

  expiresAt?:
    string | null;


  providerMetadata?:
    Record<
      string,
      unknown
    >;

  raw?:
    unknown;
};


export type ProviderSearchOutcome = {
  status:
    | "succeeded"
    | "partial"
    | "failed"
    | "rate_limited"
    | "skipped";

  loads:
    NormalizedProviderLoad[];

  providerRequestId?:
    string | null;

  errorCode?:
    string | null;

  errorMessage?:
    string | null;

  rateLimitRemaining?:
    number | null;

  rateLimitResetsAt?:
    string | null;

  metadata?:
    Record<
      string,
      unknown
    >;
};


/*
 * ============================================================
 * SLATELANE AUTHORIZED PROVIDER ADAPTER REGISTRY
 * ============================================================
 *
 * IMPORTANT:
 *
 * We intentionally do NOT guess private provider endpoints and
 * we do NOT scrape DAT / Truckstop / 123Loadboard.
 *
 * Once an authorized provider account/API credential is issued,
 * only the matching adapter in this file needs to be implemented.
 *
 * Everything after the adapter is already operational:
 *
 * Provider API
 *   -> normalization
 *   -> temporary result storage
 *   -> dedupe
 *   -> scoring
 *   -> profitability
 *   -> save opportunity
 *   -> negotiation
 *   -> booking
 *
 * ============================================================
 */


async function unavailableAdapter(
  sourceCode:
    ProviderSourceCode,
): Promise<ProviderSearchOutcome> {
  return {
    status:
      "skipped",

    loads:
      [],

    errorCode:
      "authorized_adapter_not_configured",

    errorMessage:
      `${sourceCode} is registered in SlateLane but its authorized API adapter has not been configured yet.`,

    metadata: {
      source:
        sourceCode,

      requiresAuthorizedProviderAccess:
        true,
    },
  };
}


async function searchDat(
  _input:
    ProviderSearchInput,
): Promise<ProviderSearchOutcome> {
  return unavailableAdapter(
    "dat",
  );
}


async function searchTruckstop(
  _input:
    ProviderSearchInput,
): Promise<ProviderSearchOutcome> {
  return unavailableAdapter(
    "truckstop",
  );
}


async function search123Loadboard(
  _input:
    ProviderSearchInput,
): Promise<ProviderSearchOutcome> {
  return unavailableAdapter(
    "123loadboard",
  );
}


async function searchDirectBroker(
  _input:
    ProviderSearchInput,
): Promise<ProviderSearchOutcome> {
  return unavailableAdapter(
    "direct_broker",
  );
}


async function searchEmailFeed(
  _input:
    ProviderSearchInput,
): Promise<ProviderSearchOutcome> {
  return unavailableAdapter(
    "email",
  );
}


export async function searchProvider(
  sourceCode:
    string,

  input:
    ProviderSearchInput,
): Promise<ProviderSearchOutcome> {
  switch (
    sourceCode
  ) {
    case "dat":
      return searchDat(
        input,
      );


    case "truckstop":
      return searchTruckstop(
        input,
      );


    case "123loadboard":
      return search123Loadboard(
        input,
      );


    case "direct_broker":
      return searchDirectBroker(
        input,
      );


    case "email":
      return searchEmailFeed(
        input,
      );


    default:
      return {
        status:
          "skipped",

        loads:
          [],

        errorCode:
          "unsupported_provider",

        errorMessage:
          `SlateLane does not have an adapter registered for ${sourceCode}.`,
      };
  }
}