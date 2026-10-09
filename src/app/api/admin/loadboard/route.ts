import {
  createHash,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  searchProvider,
  type NormalizedProviderLoad,
  type ProviderSearchInput,
} from "@/lib/loadboard/provider-adapters";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


type JsonBody =
  Record<
    string,
    unknown
  >;


type SourceStatusRow = {
  source_id:
    string;

  code:
    string;

  display_name:
    string;

  enabled:
    boolean;

  search_supported:
    boolean;

  connection_status:
    string | null;

  data_retention_minutes:
    number;

  minimum_refresh_seconds:
    number;
};


function cleanText(
  value:
    unknown,
):
  string |
  null {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }


  const cleaned =
    value.trim();


  return cleaned.length >
    0
    ? cleaned
    : null;
}


function numberOrNull(
  value:
    unknown,
):
  number |
  null {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return null;
  }


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


function integerOrNull(
  value:
    unknown,
):
  number |
  null {
  const parsed =
    numberOrNull(
      value,
    );


  if (
    parsed ===
    null
  ) {
    return null;
  }


  return Math.trunc(
    parsed,
  );
}


function isoOrNull(
  value:
    unknown,
):
  string |
  null {
  const cleaned =
    cleanText(
      value,
    );


  if (
    !cleaned
  ) {
    return null;
  }


  const date =
    new Date(
      cleaned,
    );


  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }


  return date
    .toISOString();
}


function stringArray(
  value:
    unknown,
):
  string[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }


  return value
    .map(
      (
        item:
          unknown,
      ) =>
        cleanText(
          item,
        ),
    )
    .filter(
      (
        item:
          string |
          null,
      ): item is string =>
        item !==
        null,
    );
}


function payloadHash(
  load:
    NormalizedProviderLoad,
) {
  return createHash(
    "sha256",
  )
    .update(
      JSON.stringify(
        load.raw ??
          load,
      ),
      "utf8",
    )
    .digest(
      "hex",
    );
}


function validProviderLoad(
  load:
    NormalizedProviderLoad,
) {
  return Boolean(
    cleanText(
      load.originCity,
    ) &&
      cleanText(
        load.originState,
      ) &&
      cleanText(
        load.destinationCity,
      ) &&
      cleanText(
        load.destinationState,
      ),
  );
}


async function getResults(
  sessionId:
    string,
) {
  const supabase =
    createAdminSupabase();


  const {
    data,
    error,
  } =
    await supabase
      .from(
        "loadboard_ranked_results",
      )
      .select(
        "*",
      )
      .eq(
        "session_id",
        sessionId,
      )
      .order(
        "match_score",
        {
          ascending:
            false,

          nullsFirst:
            false,
        },
      )
      .order(
        "last_seen_at",
        {
          ascending:
            false,
        },
      )
      .limit(
        250,
      );


  if (
    error
  ) {
    throw new Error(
      error.message,
    );
  }


  return data ??
    [];
}


async function getSnapshot() {
  const supabase =
    createAdminSupabase();


  const [
    sourceResult,
    truckResult,
    sessionResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "loadboard_source_status",
        )
        .select(
          "*",
        )
        .order(
          "display_name",
          {
            ascending:
              true,
          },
        ),

      supabase
        .from(
          "truck_dispatch_board",
        )
        .select(
          "*",
        )
        .order(
          "ready_for_load_search",
          {
            ascending:
              false,
          },
        )
        .order(
          "last_operational_update",
          {
            ascending:
              false,
          },
        ),

      supabase
        .from(
          "load_search_sessions",
        )
        .select(`
          id,
          truck_id,
          onboarding_id,
          status,
          origin_city,
          origin_state,
          destination_city,
          destination_state,
          equipment_type,
          requested_source_codes,
          result_count,
          started_at,
          completed_at,
          expires_at
        `)
        .order(
          "created_at",
          {
            ascending:
              false,
          },
        )
        .limit(
          10,
        ),
    ]);


  if (
    sourceResult.error
  ) {
    throw new Error(
      sourceResult.error
        .message,
    );
  }


  if (
    truckResult.error
  ) {
    throw new Error(
      truckResult.error
        .message,
    );
  }


  if (
    sessionResult.error
  ) {
    throw new Error(
      sessionResult.error
        .message,
    );
  }


  return {
    sources:
      sourceResult.data ??
      [],

    trucks:
      truckResult.data ??
      [],

    sessions:
      sessionResult.data ??
      [],
  };
}


async function insertProviderLoads({
  sessionId,
  truckId,
  onboardingId,
  source,
  providerRunId,
  loads,
}: {
  sessionId:
    string;

  truckId:
    string;

  onboardingId:
    string;

  source:
    SourceStatusRow;

  providerRunId:
    string;

  loads:
    NormalizedProviderLoad[];
}) {
  const supabase =
    createAdminSupabase();


  const validLoads =
    loads.filter(
      validProviderLoad,
    );


  if (
    validLoads.length ===
    0
  ) {
    return {
      inserted:
        0,

      rejected:
        loads.length,
    };
  }


  const retentionMinutes =
    Math.max(
      1,
      Number(
        source
          .data_retention_minutes ??
          60,
      ),
    );


  const now =
    new Date();


  const defaultExpiry =
    new Date(
      now.getTime() +
        retentionMinutes *
          60_000,
    ).toISOString();


  const nowIso =
    now.toISOString();


  const rows =
    validLoads.map(
      (
        load:
          NormalizedProviderLoad,
      ) => {
        const originCity =
          cleanText(
            load.originCity,
          );

        const originState =
          cleanText(
            load.originState,
          );

        const destinationCity =
          cleanText(
            load.destinationCity,
          );

        const destinationState =
          cleanText(
            load.destinationState,
          );


        if (
          !originCity ||
          !originState ||
          !destinationCity ||
          !destinationState
        ) {
          throw new Error(
            "Provider returned an invalid load without a complete lane.",
          );
        }


        return {
          session_id:
            sessionId,

          source_id:
            source.source_id,

          provider_run_id:
            providerRunId,

          truck_id:
            truckId,

          onboarding_id:
            onboardingId,


          external_load_id:
            cleanText(
              load.externalLoadId,
            ),

          broker_load_number:
            cleanText(
              load.brokerLoadNumber,
            ),

          provider_url:
            cleanText(
              load.providerUrl,
            ),


          broker_name:
            cleanText(
              load.brokerName,
            ),

          broker_mc_number:
            cleanText(
              load.brokerMcNumber,
            ),

          broker_dot_number:
            integerOrNull(
              load.brokerDotNumber,
            ),

          broker_phone:
            cleanText(
              load.brokerPhone,
            ),

          broker_email:
            cleanText(
              load.brokerEmail,
            )
              ?.toLowerCase() ??
            null,


          origin_city:
            originCity,

          origin_state:
            originState
              .toUpperCase(),

          origin_zip:
            cleanText(
              load.originZip,
            ),

          origin_lat:
            numberOrNull(
              load.originLat,
            ),

          origin_lon:
            numberOrNull(
              load.originLon,
            ),


          destination_city:
            destinationCity,

          destination_state:
            destinationState
              .toUpperCase(),

          destination_zip:
            cleanText(
              load.destinationZip,
            ),

          destination_lat:
            numberOrNull(
              load.destinationLat,
            ),

          destination_lon:
            numberOrNull(
              load.destinationLon,
            ),


          pickup_start:
            isoOrNull(
              load.pickupStart,
            ),

          pickup_end:
            isoOrNull(
              load.pickupEnd,
            ),

          delivery_start:
            isoOrNull(
              load.deliveryStart,
            ),

          delivery_end:
            isoOrNull(
              load.deliveryEnd,
            ),


          equipment_type:
            cleanText(
              load.equipmentType,
            ),

          trailer_length_ft:
            integerOrNull(
              load.trailerLengthFt,
            ),

          commodity:
            cleanText(
              load.commodity,
            ),

          weight_lbs:
            integerOrNull(
              load.weightLbs,
            ),


          posted_rate:
            numberOrNull(
              load.postedRate,
            ),

          loaded_miles:
            integerOrNull(
              load.loadedMiles,
            ),

          deadhead_miles:
            Math.max(
              0,
              integerOrNull(
                load.deadheadMiles,
              ) ??
                0,
            ),


          booking_method:
            load.bookingMethod ??
            "unknown",

          book_now_available:
            Boolean(
              load.bookNowAvailable,
            ),


          provider_payload_hash:
            payloadHash(
              load,
            ),

          provider_metadata:
            load.providerMetadata ??
            {},


          freshness_status:
            "live",

          provider_posted_at:
            isoOrNull(
              load.providerPostedAt,
            ),

          provider_updated_at:
            isoOrNull(
              load.providerUpdatedAt,
            ),

          first_seen_at:
            nowIso,

          last_seen_at:
            nowIso,

          expires_at:
            isoOrNull(
              load.expiresAt,
            ) ??
            defaultExpiry,
        };
      },
    );


  const {
    error,
  } =
    await supabase
      .from(
        "load_search_results",
      )
      .insert(
        rows,
      );


  if (
    error
  ) {
    throw new Error(
      error.message,
    );
  }


  return {
    inserted:
      rows.length,

    rejected:
      loads.length -
      rows.length,
  };
}


async function runProviderSearches({
  sessionId,
  truckId,
  onboardingId,
  sourceCodes,
  input,
}: {
  sessionId:
    string;

  truckId:
    string;

  onboardingId:
    string;

  sourceCodes:
    string[];

  input:
    ProviderSearchInput;
}) {
  const supabase =
    createAdminSupabase();


  if (
    sourceCodes.length ===
    0
  ) {
    return [];
  }


  const {
    data:
      sourceData,

    error:
      sourceError,
  } =
    await supabase
      .from(
        "loadboard_source_status",
      )
      .select(`
        source_id,
        code,
        display_name,
        enabled,
        search_supported,
        connection_status,
        data_retention_minutes,
        minimum_refresh_seconds
      `)
      .in(
        "code",
        sourceCodes,
      );


  if (
    sourceError
  ) {
    throw new Error(
      sourceError.message,
    );
  }


  const sources =
    (
      sourceData ??
      []
    ) as SourceStatusRow[];


  const summaries:
    Array<
      Record<
        string,
        unknown
      >
    > =
      [];


  for (
    const source
    of sources
  ) {
    const startedAt =
      new Date();


    const {
      data:
        run,

      error:
        runError,
    } =
      await supabase
        .from(
          "load_search_provider_runs",
        )
        .insert({
          session_id:
            sessionId,

          source_id:
            source.source_id,

          attempt_no:
            1,

          status:
            "running",

          request_started_at:
            startedAt
              .toISOString(),
        })
        .select(
          "id",
        )
        .single();


    if (
      runError ||
      !run
    ) {
      summaries.push({
        source:
          source.code,

        status:
          "failed",

        resultCount:
          0,

        errorMessage:
          runError
            ?.message ??
          "Could not create provider run.",
      });


      continue;
    }


    try {
      const outcome =
        await searchProvider(
          source.code,
          input,
        );


      let inserted =
        0;

      let rejected =
        0;


      if (
        outcome.loads.length >
        0
      ) {
        const insertion =
          await insertProviderLoads({
            sessionId,
            truckId,
            onboardingId,
            source,
            providerRunId:
              run.id,
            loads:
              outcome.loads,
          });


        inserted =
          insertion.inserted;

        rejected =
          insertion.rejected;
      }


      const completedAt =
        new Date();


      const latencyMs =
        completedAt.getTime() -
        startedAt.getTime();


      const {
        error:
          updateRunError,
      } =
        await supabase
          .from(
            "load_search_provider_runs",
          )
          .update({
            status:
              outcome.status,

            provider_request_id:
              outcome.providerRequestId ??
              null,

            request_completed_at:
              completedAt
                .toISOString(),

            latency_ms:
              latencyMs,

            result_count:
              inserted,

            error_code:
              outcome.errorCode ??
              null,

            error_message:
              outcome.errorMessage ??
              null,

            rate_limit_remaining:
              outcome.rateLimitRemaining ??
              null,

            rate_limit_resets_at:
              outcome.rateLimitResetsAt ??
              null,

            metadata: {
              ...(
                outcome.metadata ??
                {}
              ),

              rejected_results:
                rejected,
            },
          })
          .eq(
            "id",
            run.id,
          );


      if (
        updateRunError
      ) {
        throw new Error(
          updateRunError
            .message,
        );
      }


      if (
        outcome.status ===
          "failed" ||
        outcome.status ===
          "rate_limited"
      ) {
        await supabase
          .from(
            "load_source_events",
          )
          .insert({
            source_id:
              source.source_id,

            event_type:
              "search_failure",

            severity:
              outcome.status ===
              "failed"
                ? "error"
                : "warning",

            message:
              outcome.errorMessage ??
              `Load search failed for ${source.display_name}.`,

            metadata: {
              session_id:
                sessionId,

              provider_run_id:
                run.id,

              error_code:
                outcome.errorCode ??
                null,
            },
          });
      }


      summaries.push({
        source:
          source.code,

        name:
          source.display_name,

        status:
          outcome.status,

        resultCount:
          inserted,

        rejectedCount:
          rejected,

        latencyMs,

        errorCode:
          outcome.errorCode ??
          null,

        errorMessage:
          outcome.errorMessage ??
          null,
      });
    } catch (
      caught:
        unknown
    ) {
      const completedAt =
        new Date();


      const message =
        caught instanceof
        Error
          ? caught.message
          : String(
              caught,
            );


      await supabase
        .from(
          "load_search_provider_runs",
        )
        .update({
          status:
            "failed",

          request_completed_at:
            completedAt
              .toISOString(),

          latency_ms:
            completedAt.getTime() -
            startedAt.getTime(),

          error_code:
            "provider_adapter_exception",

          error_message:
            message,
        })
        .eq(
          "id",
          run.id,
        );


      await supabase
        .from(
          "load_source_events",
        )
        .insert({
          source_id:
            source.source_id,

          event_type:
            "provider_adapter_exception",

          severity:
            "error",

          message,

          metadata: {
            session_id:
              sessionId,

            provider_run_id:
              run.id,
          },
        });


      summaries.push({
        source:
          source.code,

        name:
          source.display_name,

        status:
          "failed",

        resultCount:
          0,

        errorCode:
          "provider_adapter_exception",

        errorMessage:
          message,
      });
    }
  }


  return summaries;
}


export async function GET(
  request:
    NextRequest,
) {
  try {
    const snapshot =
      await getSnapshot();


    const sessionId =
      request.nextUrl
        .searchParams
        .get(
          "sessionId",
        );


    const results =
      sessionId
        ? await getResults(
            sessionId,
          )
        : [];


    return NextResponse.json(
      {
        success:
          true,

        ...snapshot,

        results,
      },
      {
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  } catch (
    caught:
      unknown
  ) {
    console.error(
      "LOADBOARD GET ERROR:",
      caught,
    );


    return NextResponse.json(
      {
        success:
          false,

        error:
          caught instanceof
          Error
            ? caught.message
            : "Could not load the SlateLane load board.",
      },
      {
        status:
          500,
      },
    );
  }
}


export async function POST(
  request:
    NextRequest,
) {
  const supabase =
    createAdminSupabase();


  try {
    const parsedBody:
      unknown =
      await request
        .json()
        .catch(
          () =>
            null,
        );


    if (
      parsedBody ===
        null ||
      typeof parsedBody !==
        "object" ||
      Array.isArray(
        parsedBody,
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Invalid request body.",
        },
        {
          status:
            400,
        },
      );
    }


    const body =
      parsedBody as JsonBody;


    const action =
      cleanText(
        body.action,
      );


    /*
     * =========================================================
     * SEARCH LOADS
     * =========================================================
     */

    if (
      action ===
      "search"
    ) {
      const truckId =
        cleanText(
          body.truckId,
        );


      if (
        !truckId
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "Select a truck before searching.",
          },
          {
            status:
              400,
          },
        );
      }


      const {
        error:
          freshnessError,
      } =
        await supabase.rpc(
          "refresh_loadboard_freshness",
        );


      if (
        freshnessError
      ) {
        throw new Error(
          freshnessError.message,
        );
      }


      const requestedSources =
        stringArray(
          body.sourceCodes,
        );


      const searchArguments = {
        p_truck_id:
          truckId,

        p_origin_city:
          cleanText(
            body.originCity,
          ),

        p_origin_state:
          cleanText(
            body.originState,
          ),

        p_origin_zip:
          cleanText(
            body.originZip,
          ),

        p_origin_radius_miles:
          integerOrNull(
            body.originRadiusMiles,
          ) ??
          100,

        p_destination_city:
          cleanText(
            body.destinationCity,
          ),

        p_destination_state:
          cleanText(
            body.destinationState,
          ),

        p_destination_zip:
          cleanText(
            body.destinationZip,
          ),

        p_destination_radius_miles:
          integerOrNull(
            body.destinationRadiusMiles,
          ),

        p_equipment_type:
          cleanText(
            body.equipmentType,
          ),

        p_pickup_start:
          isoOrNull(
            body.pickupStart,
          ),

        p_pickup_end:
          isoOrNull(
            body.pickupEnd,
          ),

        p_minimum_rate:
          numberOrNull(
            body.minimumRate,
          ),

        p_minimum_rate_per_mile:
          numberOrNull(
            body.minimumRatePerMile,
          ),

        p_minimum_trip_miles:
          integerOrNull(
            body.minimumTripMiles,
          ),

        p_maximum_trip_miles:
          integerOrNull(
            body.maximumTripMiles,
          ),

        p_maximum_deadhead_miles:
          integerOrNull(
            body.maximumDeadheadMiles,
          ),

        p_requested_source_codes:
          requestedSources.length >
          0
            ? requestedSources
            : null,
      };


      const {
        data:
          startResult,

        error:
          startError,
      } =
        await supabase.rpc(
          "start_loadboard_search",
          searchArguments,
        );


      if (
        startError
      ) {
        throw new Error(
          startError.message,
        );
      }


      if (
        !startResult ||
        startResult.success !==
          true
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              startResult
                ?.reason ??
              "Could not start the load search.",

            details:
              startResult,
          },
          {
            status:
              400,
          },
        );
      }


      const sessionId =
        String(
          startResult
            .session_id,
        );


      const onboardingId =
        String(
          startResult
            .onboarding_id,
        );


      const connectedSources =
        stringArray(
          startResult
            .connected_sources,
        );


      const providerInput:
        ProviderSearchInput =
        {
          sessionId,

          truckId,

          originCity:
            searchArguments
              .p_origin_city,

          originState:
            searchArguments
              .p_origin_state,

          originZip:
            searchArguments
              .p_origin_zip,

          originRadiusMiles:
            searchArguments
              .p_origin_radius_miles,

          destinationCity:
            searchArguments
              .p_destination_city,

          destinationState:
            searchArguments
              .p_destination_state,

          destinationZip:
            searchArguments
              .p_destination_zip,

          destinationRadiusMiles:
            searchArguments
              .p_destination_radius_miles,

          equipmentType:
            searchArguments
              .p_equipment_type,

          pickupStart:
            searchArguments
              .p_pickup_start,

          pickupEnd:
            searchArguments
              .p_pickup_end,

          minimumRate:
            searchArguments
              .p_minimum_rate,

          minimumRatePerMile:
            searchArguments
              .p_minimum_rate_per_mile,

          minimumTripMiles:
            searchArguments
              .p_minimum_trip_miles,

          maximumTripMiles:
            searchArguments
              .p_maximum_trip_miles,

          maximumDeadheadMiles:
            searchArguments
              .p_maximum_deadhead_miles,
        };


      const providerRuns =
        await runProviderSearches({
          sessionId,

          truckId,

          onboardingId,

          sourceCodes:
            connectedSources,

          input:
            providerInput,
        });


      const {
        error:
          scoreError,
      } =
        await supabase.rpc(
          "score_loadboard_session",
          {
            p_session_id:
              sessionId,
          },
        );


      if (
        scoreError
      ) {
        throw new Error(
          scoreError.message,
        );
      }


      const providerProblem =
        providerRuns.some(
          (
            run:
              Record<
                string,
                unknown
              >,
          ) =>
            run.status ===
              "failed" ||
            run.status ===
              "rate_limited" ||
            run.status ===
              "skipped",
        );


      const finalStatus =
        connectedSources.length >
          0 &&
        providerProblem
          ? "partial"
          : "completed";


      const {
        error:
          completionError,
      } =
        await supabase.rpc(
          "complete_loadboard_search",
          {
            p_session_id:
              sessionId,

            p_status:
              finalStatus,
          },
        );


      if (
        completionError
      ) {
        throw new Error(
          completionError
            .message,
        );
      }


      const results =
        await getResults(
          sessionId,
        );


      return NextResponse.json({
        success:
          true,

        sessionId,

        sessionStatus:
          finalStatus,

        connectedSources,

        providerRuns,

        results,
      });
    }


    /*
     * =========================================================
     * MANUAL BROKER LOAD
     * =========================================================
     */

    if (
      action ===
      "manual"
    ) {
      const sessionId =
        cleanText(
          body.sessionId,
        );


      if (
        !sessionId
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "Start a truck search before adding a manual load.",
          },
          {
            status:
              400,
          },
        );
      }


      const {
        data:
          manualResult,

        error:
          manualError,
      } =
        await supabase.rpc(
          "add_manual_loadboard_result",
          {
            p_session_id:
              sessionId,

            p_origin_city:
              cleanText(
                body.originCity,
              ),

            p_origin_state:
              cleanText(
                body.originState,
              ),

            p_destination_city:
              cleanText(
                body.destinationCity,
              ),

            p_destination_state:
              cleanText(
                body.destinationState,
              ),

            p_origin_zip:
              cleanText(
                body.originZip,
              ),

            p_destination_zip:
              cleanText(
                body.destinationZip,
              ),

            p_pickup_start:
              isoOrNull(
                body.pickupStart,
              ),

            p_pickup_end:
              isoOrNull(
                body.pickupEnd,
              ),

            p_delivery_start:
              isoOrNull(
                body.deliveryStart,
              ),

            p_delivery_end:
              isoOrNull(
                body.deliveryEnd,
              ),

            p_equipment_type:
              cleanText(
                body.equipmentType,
              ),

            p_commodity:
              cleanText(
                body.commodity,
              ),

            p_weight_lbs:
              integerOrNull(
                body.weightLbs,
              ),

            p_posted_rate:
              numberOrNull(
                body.postedRate,
              ),

            p_loaded_miles:
              integerOrNull(
                body.loadedMiles,
              ),

            p_deadhead_miles:
              Math.max(
                0,
                integerOrNull(
                  body.deadheadMiles,
                ) ??
                  0,
              ),

            p_broker_name:
              cleanText(
                body.brokerName,
              ),

            p_broker_mc_number:
              cleanText(
                body.brokerMcNumber,
              ),

            p_broker_phone:
              cleanText(
                body.brokerPhone,
              ),

            p_broker_email:
              cleanText(
                body.brokerEmail,
              ),

            p_broker_load_number:
              cleanText(
                body.brokerLoadNumber,
              ),

            p_notes:
              cleanText(
                body.notes,
              ),
          },
        );


      if (
        manualError
      ) {
        throw new Error(
          manualError.message,
        );
      }


      if (
        !manualResult ||
        manualResult.success !==
          true
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              manualResult
                ?.reason ??
              "Could not add the manual load.",

            details:
              manualResult,
          },
          {
            status:
              400,
          },
        );
      }


      const {
        error:
          scoringError,
      } =
        await supabase.rpc(
          "score_loadboard_session",
          {
            p_session_id:
              sessionId,
          },
        );


      if (
        scoringError
      ) {
        throw new Error(
          scoringError.message,
        );
      }


      const results =
        await getResults(
          sessionId,
        );


      return NextResponse.json({
        success:
          true,

        resultId:
          manualResult
            .result_id,

        results,
      });
    }


    /*
     * =========================================================
     * SAVE LOAD TO OPPORTUNITIES
     * =========================================================
     */

    if (
      action ===
      "save"
    ) {
      const resultId =
        cleanText(
          body.resultId,
        );


      if (
        !resultId
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "Load result ID is required.",
          },
          {
            status:
              400,
          },
        );
      }


      const {
        data:
          saveResult,

        error:
          saveError,
      } =
        await supabase.rpc(
          "save_load_search_result_to_opportunity",
          {
            p_result_id:
              resultId,
          },
        );


      if (
        saveError
      ) {
        throw new Error(
          saveError.message,
        );
      }


      if (
        !saveResult ||
        saveResult.success !==
          true
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              saveResult
                ?.reason ??
              "Could not save the load opportunity.",

            details:
              saveResult,
          },
          {
            status:
              400,
          },
        );
      }


      return NextResponse.json({
        success:
          true,

        opportunityId:
          saveResult
            .opportunity_id,

        alreadySaved:
          Boolean(
            saveResult
              .already_saved,
          ),
      });
    }


    /*
     * =========================================================
     * RESCORE EXISTING RESULTS
     * =========================================================
     */

    if (
      action ===
      "rescore"
    ) {
      const sessionId =
        cleanText(
          body.sessionId,
        );


      if (
        !sessionId
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "Search session ID is required.",
          },
          {
            status:
              400,
          },
        );
      }


      const {
        error:
          scoringError,
      } =
        await supabase.rpc(
          "score_loadboard_session",
          {
            p_session_id:
              sessionId,
          },
        );


      if (
        scoringError
      ) {
        throw new Error(
          scoringError.message,
        );
      }


      return NextResponse.json({
        success:
          true,

        results:
          await getResults(
            sessionId,
          ),
      });
    }


    return NextResponse.json(
      {
        success:
          false,

        error:
          "Unsupported load-board action.",
      },
      {
        status:
          400,
      },
    );
  } catch (
    caught:
      unknown
  ) {
    console.error(
      "LOADBOARD POST ERROR:",
      caught,
    );


    return NextResponse.json(
      {
        success:
          false,

        error:
          caught instanceof
          Error
            ? caught.message
            : "SlateLane could not process the load-board request.",
      },
      {
        status:
          500,
      },
    );
  }
}