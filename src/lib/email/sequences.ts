import {
  createAdminSupabase,
} from "@/lib/supabase/admin";

import {
  sendTemplateEmail,
} from "./sender";

import {
  STOP_LEAD_STATUSES,
} from "./templates";


function dateAfterHours(
  hours: number
) {
  const date =
    new Date();

  date.setHours(
    date.getHours() +
      hours
  );

  return date.toISOString();
}


async function stopEnrollment(
  enrollmentId: string
) {
  const supabase =
    createAdminSupabase();

  const now =
    new Date().toISOString();

  await supabase
    .from(
      "email_sequence_enrollments"
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
      enrollmentId
    );
}


export async function enrollLeadInSequence(
  leadId: string,
  sequenceId: string
) {
  const supabase =
    createAdminSupabase();


  // ==========================================================
  // LEAD
  // ==========================================================

  const {
    data: lead,
    error: leadError,
  } = await supabase
    .from("leads")
    .select(`
      id,
      email,
      status,
      email_opt_out,
      email_bounced,
      email_complained
    `)
    .eq(
      "id",
      leadId
    )
    .maybeSingle();


  if (
    leadError ||
    !lead
  ) {
    throw new Error(
      leadError?.message ||
      "Lead not found."
    );
  }


  if (!lead.email) {
    throw new Error(
      "Lead has no email address."
    );
  }


  if (
    lead.email_opt_out
  ) {
    throw new Error(
      "Lead has unsubscribed."
    );
  }


  if (
    lead.email_bounced
  ) {
    throw new Error(
      "Lead email previously bounced."
    );
  }


  if (
    lead.email_complained
  ) {
    throw new Error(
      "Lead previously complained."
    );
  }


  if (
    STOP_LEAD_STATUSES.has(
      lead.status
    )
  ) {
    throw new Error(
      `Lead status '${lead.status}' blocks email automation.`
    );
  }


  // ==========================================================
  // SEQUENCE
  // ==========================================================

  const {
    data: sequence,
    error:
      sequenceError,
  } = await supabase
    .from(
      "email_sequences"
    )
    .select(`
      id,
      active
    `)
    .eq(
      "id",
      sequenceId
    )
    .maybeSingle();


  if (
    sequenceError ||
    !sequence
  ) {
    throw new Error(
      sequenceError?.message ||
      "Sequence not found."
    );
  }


  if (
    !sequence.active
  ) {
    throw new Error(
      "Sequence is inactive."
    );
  }


  // ==========================================================
  // CHECK EXISTING ENROLLMENT
  // ==========================================================

  const {
    data: existing,
    error:
      existingError,
  } = await supabase
    .from(
      "email_sequence_enrollments"
    )
    .select(`
      id,
      status,
      current_step,
      next_send_at
    `)
    .eq(
      "lead_id",
      leadId
    )
    .eq(
      "sequence_id",
      sequenceId
    )
    .maybeSingle();


  if (existingError) {
    throw new Error(
      existingError.message
    );
  }


  if (existing) {
    return existing;
  }


  // ==========================================================
  // FIRST STEP
  // ==========================================================

  const {
    data: firstStep,
    error:
      firstStepError,
  } = await supabase
    .from(
      "email_sequence_steps"
    )
    .select(`
      id,
      step_order,
      delay_hours
    `)
    .eq(
      "sequence_id",
      sequenceId
    )
    .eq(
      "active",
      true
    )
    .order(
      "step_order",
      {
        ascending: true,
      }
    )
    .limit(1)
    .maybeSingle();


  if (
    firstStepError ||
    !firstStep
  ) {
    throw new Error(
      firstStepError?.message ||
      "Sequence has no active steps."
    );
  }


  // ==========================================================
  // CREATE ENROLLMENT
  // ==========================================================

  const {
    data: enrollment,
    error:
      enrollmentError,
  } = await supabase
    .from(
      "email_sequence_enrollments"
    )
    .insert({
      lead_id:
        leadId,

      sequence_id:
        sequenceId,

      status:
        "active",

      current_step:
        firstStep.step_order,

      next_send_at:
        dateAfterHours(
          firstStep.delay_hours
        ),

      updated_at:
        new Date().toISOString(),
    })
    .select(`
      id,
      status,
      current_step,
      next_send_at
    `)
    .single();


  if (
    enrollmentError ||
    !enrollment
  ) {
    throw new Error(
      `Could not enroll lead: ${
        enrollmentError?.message ||
        "Unknown error"
      }`
    );
  }


  return enrollment;
}


async function processEnrollment(
  enrollment: {
    id: string;
    lead_id: string;
    sequence_id: string;
    current_step: number;
  }
) {
  const supabase =
    createAdminSupabase();


  // ==========================================================
  // RECHECK LEAD BEFORE EACH EMAIL
  // ==========================================================

  const {
    data: lead,
    error: leadError,
  } = await supabase
    .from("leads")
    .select(`
      id,
      email,
      status,
      email_opt_out,
      email_bounced,
      email_complained
    `)
    .eq(
      "id",
      enrollment.lead_id
    )
    .maybeSingle();


  if (
    leadError ||
    !lead
  ) {
    await stopEnrollment(
      enrollment.id
    );

    return {
      status:
        "stopped",

      reason:
        "lead_missing",
    };
  }


  if (
    !lead.email ||
    lead.email_opt_out ||
    lead.email_bounced ||
    lead.email_complained ||
    STOP_LEAD_STATUSES.has(
      lead.status
    )
  ) {
    await stopEnrollment(
      enrollment.id
    );

    return {
      status:
        "stopped",

      reason:
        "lead_blocked",
    };
  }


  // ==========================================================
  // CURRENT STEP
  // ==========================================================

  const {
    data: step,
    error: stepError,
  } = await supabase
    .from(
      "email_sequence_steps"
    )
    .select(`
      id,
      template_id,
      step_order
    `)
    .eq(
      "sequence_id",
      enrollment.sequence_id
    )
    .eq(
      "step_order",
      enrollment.current_step
    )
    .eq(
      "active",
      true
    )
    .maybeSingle();


  if (
    stepError ||
    !step
  ) {
    const now =
      new Date().toISOString();

    await supabase
      .from(
        "email_sequence_enrollments"
      )
      .update({
        status:
          "completed",

        next_send_at:
          null,

        completed_at:
          now,

        updated_at:
          now,
      })
      .eq(
        "id",
        enrollment.id
      );


    return {
      status:
        "completed",
    };
  }


  // ==========================================================
  // SEND EMAIL
  // ==========================================================

  const sendResult =
    await sendTemplateEmail({
      leadId:
        enrollment.lead_id,

      templateId:
        step.template_id,

      enrollmentId:
        enrollment.id,

      sequenceStepId:
        step.id,
    });


  // ==========================================================
  // FIND NEXT STEP
  // ==========================================================

  const {
    data: nextStep,
    error: nextStepError,
  } = await supabase
    .from(
      "email_sequence_steps"
    )
    .select(`
      id,
      step_order,
      delay_hours
    `)
    .eq(
      "sequence_id",
      enrollment.sequence_id
    )
    .eq(
      "active",
      true
    )
    .gt(
      "step_order",
      step.step_order
    )
    .order(
      "step_order",
      {
        ascending: true,
      }
    )
    .limit(1)
    .maybeSingle();


  if (nextStepError) {
    throw new Error(
      nextStepError.message
    );
  }


  // ==========================================================
  // COMPLETE SEQUENCE
  // ==========================================================

  if (!nextStep) {
    const now =
      new Date().toISOString();

    await supabase
      .from(
        "email_sequence_enrollments"
      )
      .update({
        status:
          "completed",

        current_step:
          step.step_order,

        next_send_at:
          null,

        completed_at:
          now,

        updated_at:
          now,
      })
      .eq(
        "id",
        enrollment.id
      );


    return {
      status:
        "completed",

      send:
        sendResult,
    };
  }


  // ==========================================================
  // SCHEDULE NEXT STEP
  // ==========================================================

  await supabase
    .from(
      "email_sequence_enrollments"
    )
    .update({
      current_step:
        nextStep.step_order,

      next_send_at:
        dateAfterHours(
          nextStep.delay_hours
        ),

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      enrollment.id
    );


  return {
    status:
      "sent",

    nextStep:
      nextStep.step_order,

    nextSendAt:
      dateAfterHours(
        nextStep.delay_hours
      ),

    send:
      sendResult,
  };
}


// ============================================================
// PROCESS ONE SPECIFIC ENROLLMENT
// ============================================================

export async function processEmailEnrollment(
  enrollmentId: string
) {
  const supabase =
    createAdminSupabase();


  const {
    data: enrollment,
    error,
  } = await supabase
    .from(
      "email_sequence_enrollments"
    )
    .select(`
      id,
      lead_id,
      sequence_id,
      current_step,
      status,
      next_send_at
    `)
    .eq(
      "id",
      enrollmentId
    )
    .maybeSingle();


  if (
    error ||
    !enrollment
  ) {
    throw new Error(
      error?.message ||
      "Enrollment not found."
    );
  }


  if (
    enrollment.status !==
    "active"
  ) {
    return {
      status:
        enrollment.status,

      processed:
        false,
    };
  }


  return processEnrollment(
    enrollment
  );
}


// ============================================================
// PROCESS ALL DUE EMAILS
// ============================================================

export async function processDueEmailEnrollments(
  limit = 10
) {
  const supabase =
    createAdminSupabase();


  const safeLimit =
    Math.max(
      1,
      Math.min(
        limit,
        25
      )
    );


  const now =
    new Date().toISOString();


  const {
    data: enrollments,
    error,
  } = await supabase
    .from(
      "email_sequence_enrollments"
    )
    .select(`
      id,
      lead_id,
      sequence_id,
      current_step,
      next_send_at
    `)
    .eq(
      "status",
      "active"
    )
    .lte(
      "next_send_at",
      now
    )
    .order(
      "next_send_at",
      {
        ascending:
          true,
      }
    )
    .limit(
      safeLimit
    );


  if (error) {
    throw new Error(
      `Could not load due emails: ${error.message}`
    );
  }


  const results = [];


  for (
    const enrollment
    of enrollments ?? []
  ) {
    try {
      const result =
        await processEnrollment(
          enrollment
        );


      results.push({
        enrollmentId:
          enrollment.id,

        success:
          true,

        result,
      });

    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error";


      await supabase
        .from(
          "email_sequence_enrollments"
        )
        .update({
          status:
            "paused",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          enrollment.id
        );


      results.push({
        enrollmentId:
          enrollment.id,

        success:
          false,

        error:
          message,
      });
    }
  }


  return {
    processed:
      results.length,

    results,
  };
}