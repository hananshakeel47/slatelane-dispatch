"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";

import {
  enrollLeadInSequence,
  processEmailEnrollment,
} from "@/lib/email/sequences";

import {
  DEFAULT_SEQUENCE_NAME,
} from "@/lib/email/templates";


const ALLOWED_STATUSES =
  new Set([
    "new",
    "contacted",
    "interested",
    "follow_up",
    "meeting",
    "client",
    "not_interested",
  ]);


const CONVERSION_TARGETS =
  new Set([
    "interested",
    "follow_up",
    "meeting",
    "client",
  ]);


const HUMAN_PIPELINE_STATUSES =
  new Set([
    "interested",
    "follow_up",
    "meeting",
    "client",
    "not_interested",
  ]);


function clean(
  value:
    FormDataEntryValue |
    null,
) {
  return String(
    value ??
      "",
  ).trim();
}


function dueFromHours(
  hours:
    number,
) {
  return new Date(
    Date.now() +
      hours *
        60 *
        60 *
        1000,
  ).toISOString();
}


function revalidateLeadPaths(
  leadId:
    string,

  dotNumber?:
    number |
    null,
) {
  revalidatePath(
    "/admin/leads",
  );

  revalidatePath(
    `/admin/leads/${leadId}`,
  );

  revalidatePath(
    "/admin/carriers",
  );

  revalidatePath(
    "/admin/dashboard",
  );

  revalidatePath(
    "/admin/tasks",
  );

  revalidatePath(
    "/admin/replies",
  );

  revalidatePath(
    "/admin/onboarding",
  );

  revalidatePath(
    "/admin/monitoring",
  );

  revalidatePath(
    "/admin/pilot/command",
  );


  if (
    dotNumber
  ) {
    revalidatePath(
      `/admin/carriers/${dotNumber}`,
    );
  }
}


/* ============================================================
   LOAD REAL LEAD SERVER-SIDE
============================================================ */

async function loadLead(
  leadId:
    string,
) {
  const db =
    createAdminSupabase();


  const {
    data:
      lead,

    error,
  } =
    await db
      .from(
        "leads",
      )
      .select(`
        id,
        name,
        company_name,
        email,
        status,
        carrier_dot_number,

        email_opt_out,
        email_bounced,
        email_complained,

        has_replied
      `)
      .eq(
        "id",
        leadId,
      )
      .maybeSingle();


  if (
    error
  ) {
    throw new Error(
      `Could not load lead: ${error.message}`,
    );
  }


  return lead;
}


/* ============================================================
   STOP AUTOMATION

   Human sales engagement must take precedence over prospecting.
============================================================ */

async function stopLeadSequences(
  leadId:
    string,
) {
  const db =
    createAdminSupabase();


  const now =
    new Date()
      .toISOString();


  const {
    error,
  } =
    await db
      .from(
        "email_sequence_enrollments",
      )
      .update({
        status:
          "stopped",

        stopped_at:
          now,

        next_send_at:
          null,

        updated_at:
          now,
      })
      .eq(
        "lead_id",
        leadId,
      )
      .in(
        "status",
        [
          "active",
          "paused",
        ],
      );


  if (
    error
  ) {
    throw new Error(
      `Could not stop lead sequence: ${error.message}`,
    );
  }
}


/* ============================================================
   SYNC DENORMALIZED CARRIER CRM FLAGS

   Lead.status remains the sales source of truth.

   carriers.contact / meeting / client fields are kept aligned
   so Carrier 360 and Lead 360 do not contradict each other.
============================================================ */

async function syncCarrierPipeline({
  dotNumber,
  previousStatus,
  newStatus,
}: {
  dotNumber:
    number |
    null;

  previousStatus:
    string |
    null;

  newStatus:
    string;
}) {
  if (
    !dotNumber
  ) {
    return;
  }


  const db =
    createAdminSupabase();


  const {
    data:
      carrier,

    error:
      carrierError,
  } =
    await db
      .from(
        "carriers",
      )
      .select(`
        id,
        contacted,
        meeting_booked,
        client
      `)
      .eq(
        "dot_number",
        dotNumber,
      )
      .maybeSingle();


  if (
    carrierError
  ) {
    console.error(
      "CARRIER PIPELINE LOOKUP ERROR:",
      carrierError.message,
    );

    return;
  }


  if (
    !carrier
  ) {
    return;
  }


  const update:
    Record<
      string,
      unknown
    > = {
      lead_status:
        newStatus,

      updated_at:
        new Date()
          .toISOString(),
  };


  /*
   * Once SlateLane has actually engaged
   * the carrier, preserve that history.
   */
  if (
    newStatus !==
    "new"
  ) {
    update.contacted =
      true;
  }


  /*
   * Meeting is historical — do not clear it
   * after progressing to Client.
   */
  if (
    newStatus ===
    "meeting"
  ) {
    update.meeting_booked =
      true;
  }


  if (
    newStatus ===
    "client"
  ) {
    update.client =
      true;
  }


  /*
   * If an operator explicitly moves a Client
   * out of Client status, remove the current
   * carrier.client flag.
   */
  if (
    previousStatus ===
      "client" &&
    newStatus !==
      "client"
  ) {
    update.client =
      false;
  }


  if (
    newStatus ===
    "not_interested"
  ) {
    update.client =
      false;
  }


  const {
    error:
      updateError,
  } =
    await db
      .from(
        "carriers",
      )
      .update(
        update,
      )
      .eq(
        "id",
        carrier.id,
      );


  if (
    updateError
  ) {
    /*
     * Lead status is the source of truth.
     * Do not undo the conversion because
     * a denormalized carrier flag failed.
     */
    console.error(
      "CARRIER PIPELINE SYNC ERROR:",
      updateError.message,
    );
  }
}


/* ============================================================
   UPDATE LEAD STATUS
============================================================ */

async function updateLeadStatus({
  leadId,
  previousStatus,
  newStatus,
  dotNumber,
}: {
  leadId:
    string;

  previousStatus:
    string |
    null;

  newStatus:
    string;

  dotNumber:
    number |
    null;
}) {
  const db =
    createAdminSupabase();


  const now =
    new Date()
      .toISOString();


  const {
    error,
  } =
    await db
      .from(
        "leads",
      )
      .update({
        status:
          newStatus,

        updated_at:
          now,
      })
      .eq(
        "id",
        leadId,
      );


  if (
    error
  ) {
    throw new Error(
      `Could not update lead status: ${error.message}`,
    );
  }


  await syncCarrierPipeline({
    dotNumber,
    previousStatus,
    newStatus,
  });
}


/* ============================================================
   CREATE CONVERSION TASK

   Only one open task of the same type is allowed.
============================================================ */

async function createConversionTask({
  leadId,
  taskType,
  title,
  note,
  priority,
  dueHours,
}: {
  leadId:
    string;

  taskType:
    "call" |
    "send_rates" |
    "follow_up" |
    "email" |
    "meeting" |
    "custom";

  title:
    string;

  note:
    string;

  priority:
    "low" |
    "normal" |
    "high" |
    "urgent";

  dueHours:
    number;
}) {
  const db =
    createAdminSupabase();


  const {
    data:
      existing,

    error:
      existingError,
  } =
    await db
      .from(
        "lead_tasks",
      )
      .select(
        "id",
      )
      .eq(
        "lead_id",
        leadId,
      )
      .eq(
        "task_type",
        taskType,
      )
      .eq(
        "status",
        "open",
      )
      .limit(
        1,
      )
      .maybeSingle();


  if (
    existingError
  ) {
    throw new Error(
      `Could not check existing task: ${existingError.message}`,
    );
  }


  if (
    existing
  ) {
    return existing;
  }


  const {
    data:
      task,

    error,
  } =
    await db
      .from(
        "lead_tasks",
      )
      .insert({
        lead_id:
          leadId,

        source_reply_id:
          null,

        task_type:
          taskType,

        title,

        note,

        status:
          "open",

        priority,

        due_at:
          dueFromHours(
            dueHours,
          ),

        updated_at:
          new Date()
            .toISOString(),
      })
      .select(
        "id",
      )
      .single();


  if (
    error ||
    !task
  ) {
    throw new Error(
      `Could not create conversion task: ${
        error?.message ||
        "Unknown error"
      }`,
    );
  }


  return task;
}


/* ============================================================
   CANCEL OPEN SALES TASKS AFTER CLIENT CONVERSION
============================================================ */

async function cancelOpenSalesTasks(
  leadId:
    string,
) {
  const db =
    createAdminSupabase();


  const now =
    new Date()
      .toISOString();


  const {
    error,
  } =
    await db
      .from(
        "lead_tasks",
      )
      .update({
        status:
          "cancelled",

        updated_at:
          now,
      })
      .eq(
        "lead_id",
        leadId,
      )
      .eq(
        "status",
        "open",
      );


  if (
    error
  ) {
    console.error(
      "CLIENT TASK CLEANUP ERROR:",
      error.message,
    );
  }
}


/* ============================================================
   3D-A — ADVANCE CONVERSION PIPELINE
============================================================ */

export async function advanceLeadConversionAction(
  formData:
    FormData,
) {
  const leadId =
    clean(
      formData.get(
        "leadId",
      ),
    );


  const target =
    clean(
      formData.get(
        "target",
      ),
    );


  if (
    !leadId ||
    !CONVERSION_TARGETS.has(
      target,
    )
  ) {
    return;
  }


  const lead =
    await loadLead(
      leadId,
    );


  if (
    !lead
  ) {
    return;
  }


  /*
   * A human conversion action means automated
   * prospecting should no longer continue.
   */
  await stopLeadSequences(
    lead.id,
  );


  await updateLeadStatus({
    leadId:
      lead.id,

    previousStatus:
      lead.status,

    newStatus:
      target,

    dotNumber:
      lead.carrier_dot_number,
  });


  const displayName =
    lead.company_name ||
    lead.name ||
    lead.email ||
    "carrier";


  /* ----------------------------------------------------------
     INTERESTED

     Create an immediate follow-up responsibility.
  ---------------------------------------------------------- */

  if (
    target ===
    "interested"
  ) {
    await createConversionTask({
      leadId:
        lead.id,

      taskType:
        "follow_up",

      title:
        `Follow up with interested carrier — ${displayName}`,

      note:
        "Lead was marked Interested from Lead 360. Continue the conversation and qualify the carrier for SlateLane services.",

      priority:
        "high",

      dueHours:
        24,
    });
  }


  /* ----------------------------------------------------------
     FOLLOW UP

     Keep one clear follow-up task open.
  ---------------------------------------------------------- */

  if (
    target ===
    "follow_up"
  ) {
    await createConversionTask({
      leadId:
        lead.id,

      taskType:
        "follow_up",

      title:
        `Sales follow-up — ${displayName}`,

      note:
        "Lead moved into Follow Up from the Lead 360 conversion pipeline.",

      priority:
        "high",

      dueHours:
        24,
    });
  }


  /* ----------------------------------------------------------
     MEETING

     Meeting state is synchronized to the Carrier record.
     We intentionally do not invent a meeting date.
  ---------------------------------------------------------- */

  if (
    target ===
    "meeting"
  ) {
    revalidateLeadPaths(
      lead.id,
      lead.carrier_dot_number,
    );

    return;
  }


  /* ----------------------------------------------------------
     CLIENT

     No more prospecting tasks.
     Continue immediately into onboarding.
  ---------------------------------------------------------- */

  if (
    target ===
    "client"
  ) {
    await cancelOpenSalesTasks(
      lead.id,
    );


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
        .select(
          "id",
        )
        .eq(
          "lead_id",
          lead.id,
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          },
        )
        .limit(
          1,
        )
        .maybeSingle();


    if (
      onboardingError
    ) {
      console.error(
        "CLIENT ONBOARDING LOOKUP ERROR:",
        onboardingError.message,
      );
    }


    revalidateLeadPaths(
      lead.id,
      lead.carrier_dot_number,
    );


    if (
      onboarding
    ) {
      redirect(
        `/admin/onboarding/${onboarding.id}/documents`,
      );
    }


    redirect(
      `/admin/onboarding/new?lead=${lead.id}`,
    );
  }


  revalidateLeadPaths(
    lead.id,
    lead.carrier_dot_number,
  );
}


/* ============================================================
   MANUAL STATUS SELECTOR
============================================================ */

export async function updateLeadStatusAction(
  formData:
    FormData,
) {
  const leadId =
    clean(
      formData.get(
        "leadId",
      ),
    );


  const newStatus =
    clean(
      formData.get(
        "status",
      ),
    );


  if (
    !leadId ||
    !ALLOWED_STATUSES.has(
      newStatus,
    )
  ) {
    return;
  }


  const lead =
    await loadLead(
      leadId,
    );


  if (
    !lead
  ) {
    return;
  }


  /*
   * Replied leads or human-stage leads must not
   * continue automated prospecting.
   */
  if (
    lead.has_replied ||
    HUMAN_PIPELINE_STATUSES.has(
      newStatus,
    )
  ) {
    await stopLeadSequences(
      lead.id,
    );
  }


  await updateLeadStatus({
    leadId:
      lead.id,

    previousStatus:
      lead.status,

    newStatus,

    dotNumber:
      lead.carrier_dot_number,
  });


  if (
    newStatus ===
    "client"
  ) {
    await cancelOpenSalesTasks(
      lead.id,
    );
  }


  revalidateLeadPaths(
    lead.id,
    lead.carrier_dot_number,
  );
}


/* ============================================================
   START EMAIL SEQUENCE
============================================================ */

export async function startLeadSequenceAction(
  formData:
    FormData,
) {
  const leadId =
    clean(
      formData.get(
        "leadId",
      ),
    );


  if (
    !leadId
  ) {
    return;
  }


  const lead =
    await loadLead(
      leadId,
    );


  if (
    !lead
  ) {
    return;
  }


  /*
   * UI state is never trusted.
   */
  const unsafe =
    !lead.email ||
    lead.email_opt_out ||
    lead.email_bounced ||
    lead.email_complained ||
    lead.has_replied ||
    lead.status ===
      "client" ||
    lead.status ===
      "not_interested" ||
    lead.status ===
      "interested" ||
    lead.status ===
      "follow_up" ||
    lead.status ===
      "meeting";


  if (
    unsafe
  ) {
    return;
  }


  const db =
    createAdminSupabase();


  const {
    data:
      sequence,

    error:
      sequenceError,
  } =
    await db
      .from(
        "email_sequences",
      )
      .select(
        "id",
      )
      .eq(
        "name",
        DEFAULT_SEQUENCE_NAME,
      )
      .eq(
        "active",
        true,
      )
      .maybeSingle();


  if (
    sequenceError
  ) {
    throw new Error(
      `Could not load default sequence: ${sequenceError.message}`,
    );
  }


  if (
    !sequence
  ) {
    throw new Error(
      "Default active email sequence was not found.",
    );
  }


  /*
   * Never restart an old enrollment.
   */
  const {
    data:
      existingEnrollment,

    error:
      enrollmentError,
  } =
    await db
      .from(
        "email_sequence_enrollments",
      )
      .select(`
        id,
        status
      `)
      .eq(
        "lead_id",
        lead.id,
      )
      .eq(
        "sequence_id",
        sequence.id,
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        },
      )
      .limit(
        1,
      )
      .maybeSingle();


  if (
    enrollmentError
  ) {
    throw new Error(
      `Could not verify enrollment: ${enrollmentError.message}`,
    );
  }


  if (
    existingEnrollment
  ) {
    return;
  }


  /*
   * Existing production email engine performs
   * another independent eligibility check.
   */
  const enrollment =
    await enrollLeadInSequence(
      lead.id,
      sequence.id,
    );


  if (
    enrollment.status ===
    "active"
  ) {
    await processEmailEnrollment(
      enrollment.id,
    );
  }


  revalidateLeadPaths(
    lead.id,
    lead.carrier_dot_number,
  );
}


/* ============================================================
   STOP SEQUENCE
============================================================ */

export async function stopLeadSequenceAction(
  formData:
    FormData,
) {
  const leadId =
    clean(
      formData.get(
        "leadId",
      ),
    );


  const enrollmentId =
    clean(
      formData.get(
        "enrollmentId",
      ),
    );


  if (
    !leadId ||
    !enrollmentId
  ) {
    return;
  }


  const lead =
    await loadLead(
      leadId,
    );


  if (
    !lead
  ) {
    return;
  }


  const db =
    createAdminSupabase();


  /*
   * Verify ownership of the supplied enrollment ID.
   */
  const {
    data:
      enrollment,

    error:
      enrollmentError,
  } =
    await db
      .from(
        "email_sequence_enrollments",
      )
      .select(`
        id,
        lead_id,
        status
      `)
      .eq(
        "id",
        enrollmentId,
      )
      .eq(
        "lead_id",
        lead.id,
      )
      .maybeSingle();


  if (
    enrollmentError
  ) {
    throw new Error(
      `Could not verify enrollment: ${enrollmentError.message}`,
    );
  }


  if (
    !enrollment ||
    ![
      "active",
      "paused",
    ].includes(
      enrollment.status,
    )
  ) {
    return;
  }


  const now =
    new Date()
      .toISOString();


  const {
    error:
      stopError,
  } =
    await db
      .from(
        "email_sequence_enrollments",
      )
      .update({
        status:
          "stopped",

        stopped_at:
          now,

        next_send_at:
          null,

        updated_at:
          now,
      })
      .eq(
        "id",
        enrollment.id,
      )
      .eq(
        "lead_id",
        lead.id,
      )
      .in(
        "status",
        [
          "active",
          "paused",
        ],
      );


  if (
    stopError
  ) {
    throw new Error(
      `Could not stop sequence: ${stopError.message}`,
    );
  }


  revalidateLeadPaths(
    lead.id,
    lead.carrier_dot_number,
  );
}


/* ============================================================
   COMPLETE NEXT TASK
============================================================ */

export async function completeLeadTaskAction(
  formData:
    FormData,
) {
  const leadId =
    clean(
      formData.get(
        "leadId",
      ),
    );


  const taskId =
    clean(
      formData.get(
        "taskId",
      ),
    );


  if (
    !leadId ||
    !taskId
  ) {
    return;
  }


  const lead =
    await loadLead(
      leadId,
    );


  if (
    !lead
  ) {
    return;
  }


  const db =
    createAdminSupabase();


  const {
    data:
      task,

    error:
      taskError,
  } =
    await db
      .from(
        "lead_tasks",
      )
      .select(`
        id,
        lead_id,
        status
      `)
      .eq(
        "id",
        taskId,
      )
      .eq(
        "lead_id",
        lead.id,
      )
      .maybeSingle();


  if (
    taskError
  ) {
    throw new Error(
      `Could not verify task: ${taskError.message}`,
    );
  }


  if (
    !task ||
    task.status !==
      "open"
  ) {
    return;
  }


  const now =
    new Date()
      .toISOString();


  const {
    error:
      completeError,
  } =
    await db
      .from(
        "lead_tasks",
      )
      .update({
        status:
          "completed",

        completed_at:
          now,

        updated_at:
          now,
      })
      .eq(
        "id",
        task.id,
      )
      .eq(
        "lead_id",
        lead.id,
      )
      .eq(
        "status",
        "open",
      );


  if (
    completeError
  ) {
    throw new Error(
      `Could not complete task: ${completeError.message}`,
    );
  }


  revalidateLeadPaths(
    lead.id,
    lead.carrier_dot_number,
  );
}