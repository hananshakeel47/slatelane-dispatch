import {
  createAdminSupabase,
} from "@/lib/supabase/admin";


export type ReliabilitySource =
  | "email"
  | "webhook"
  | "contact"
  | "onboarding"
  | "operations"
  | "system";


export type ReliabilitySeverity =
  | "info"
  | "warning"
  | "error"
  | "critical";


type ReliabilityEventInput = {
  source:
    ReliabilitySource;

  eventType:
    string;

  severity:
    ReliabilitySeverity;

  message:
    string;

  entityType?:
    string |
    null;

  entityId?:
    string |
    null;

  metadata?:
    Record<
      string,
      unknown
    >;
};


function safeMetadata(
  metadata:
    Record<
      string,
      unknown
    > |
    undefined,
) {
  if (
    !metadata
  ) {
    return {};
  }


  try {
    return JSON.parse(
      JSON.stringify(
        metadata,
      ),
    ) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}


/*
 * Observability must never break the business workflow.
 *
 * If writing the reliability event itself fails,
 * the original operation continues and we fall back
 * to the platform console log.
 */
export async function recordReliabilityEvent(
  input:
    ReliabilityEventInput,
) {
  try {
    const supabase =
      createAdminSupabase();


    const {
      error,
    } =
      await supabase
        .from(
          "reliability_events",
        )
        .insert({
          source:
            input.source,

          event_type:
            input.eventType,

          severity:
            input.severity,

          message:
            input.message,

          entity_type:
            input.entityType ??
            null,

          entity_id:
            input.entityId ??
            null,

          metadata:
            safeMetadata(
              input.metadata,
            ),

          occurred_at:
            new Date()
              .toISOString(),
        });


    if (
      error
    ) {
      console.error(
        "RELIABILITY EVENT WRITE ERROR:",
        error.message,
      );
    }
  } catch (
    error
  ) {
    console.error(
      "RELIABILITY EVENT EXCEPTION:",
      error,
    );
  }
}