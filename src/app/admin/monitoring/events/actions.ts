"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";


function clean(
  value:
    FormDataEntryValue |
    null,
) {
  return String(
    value ?? "",
  ).trim();
}


function revalidateReliability() {
  revalidatePath(
    "/admin/monitoring",
  );

  revalidatePath(
    "/admin/monitoring/reliability",
  );

  revalidatePath(
    "/admin/monitoring/events",
  );
}


export async function resolveReliabilityEventAction(
  formData:
    FormData,
) {
  const eventId =
    clean(
      formData.get(
        "eventId",
      ),
    );


  const note =
    clean(
      formData.get(
        "resolutionNote",
      ),
    );


  if (
    !eventId
  ) {
    throw new Error(
      "Reliability event ID is required.",
    );
  }


  if (
    note.length >
    1000
  ) {
    throw new Error(
      "Resolution note is too long.",
    );
  }


  const supabase =
    createAdminSupabase();


  const {
    data,
    error,
  } =
    await supabase
      .from(
        "reliability_events",
      )
      .update({
        resolved_at:
          new Date()
            .toISOString(),

        resolution_note:
          note ||
          null,
      })
      .eq(
        "id",
        eventId,
      )
      .is(
        "resolved_at",
        null,
      )
      .select(
        "id",
      )
      .maybeSingle();


  if (
    error
  ) {
    throw new Error(
      `Could not resolve reliability event: ${error.message}`,
    );
  }


  if (
    !data
  ) {
    throw new Error(
      "Reliability event was not found or is already resolved.",
    );
  }


  revalidateReliability();
}


export async function reopenReliabilityEventAction(
  formData:
    FormData,
) {
  const eventId =
    clean(
      formData.get(
        "eventId",
      ),
    );


  if (
    !eventId
  ) {
    throw new Error(
      "Reliability event ID is required.",
    );
  }


  const supabase =
    createAdminSupabase();


  const {
    data,
    error,
  } =
    await supabase
      .from(
        "reliability_events",
      )
      .update({
        resolved_at:
          null,

        resolution_note:
          null,
      })
      .eq(
        "id",
        eventId,
      )
      .not(
        "resolved_at",
        "is",
        null,
      )
      .select(
        "id",
      )
      .maybeSingle();


  if (
    error
  ) {
    throw new Error(
      `Could not reopen reliability event: ${error.message}`,
    );
  }


  if (
    !data
  ) {
    throw new Error(
      "Reliability event was not found or is already open.",
    );
  }


  revalidateReliability();
}