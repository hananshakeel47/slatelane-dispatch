"use server";

import { revalidatePath } from "next/cache";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";


const VALID_ACTIONS = new Set([
  "handled",
  "call_lead",
  "sent_rates",
  "interested",
  "not_interested",
  "wrong_contact",
  "unsubscribe",
]);


function leadStatusForAction(
  action: string
) {
  switch (action) {
    case "interested":
      return "interested";

    case "call_lead":
    case "sent_rates":
      return "follow_up";

    case "not_interested":
    case "wrong_contact":
    case "unsubscribe":
      return "not_interested";

    default:
      return null;
  }
}


function dueDateFromDelay(
  delay: string
) {
  const now =
    Date.now();

  switch (delay) {
    case "1h":
      return new Date(
        now + 60 * 60 * 1000
      ).toISOString();

    case "2h":
      return new Date(
        now + 2 * 60 * 60 * 1000
      ).toISOString();

    case "24h":
      return new Date(
        now + 24 * 60 * 60 * 1000
      ).toISOString();

    case "3d":
      return new Date(
        now + 3 * 24 * 60 * 60 * 1000
      ).toISOString();

    case "7d":
      return new Date(
        now + 7 * 24 * 60 * 60 * 1000
      ).toISOString();

    default:
      return new Date(
        now + 24 * 60 * 60 * 1000
      ).toISOString();
  }
}


async function stopLeadSequences(
  leadId: string
) {
  const supabase =
    createAdminSupabase();

  const now =
    new Date().toISOString();

  const {
    error,
  } = await supabase
    .from(
      "email_sequence_enrollments"
    )
    .update({
      status: "stopped",
      stopped_at: now,
      next_send_at: null,
      updated_at: now,
    })
    .eq(
      "lead_id",
      leadId
    )
    .in(
      "status",
      [
        "active",
        "paused",
      ]
    );

  if (error) {
    console.error(
      "Could not stop sequence:",
      error.message
    );
  }
}


async function createFollowUpTask({
  replyId,
  leadId,
  action,
  followUpDelay,
  note,
  leadName,
}: {
  replyId: string;
  leadId: string;
  action: string;
  followUpDelay: string;
  note: string;
  leadName: string;
}) {
  const supabase =
    createAdminSupabase();


  let taskType:
    | "call"
    | "follow_up"
    | null = null;

  let title:
    string | null = null;

  let priority:
    "normal"
    | "high" = "normal";


  if (
    action ===
    "call_lead"
  ) {
    taskType =
      "call";

    title =
      `Call ${leadName}`;

    priority =
      "high";
  }


  if (
    action ===
    "sent_rates"
  ) {
    taskType =
      "follow_up";

    title =
      `Follow up after sending rates — ${leadName}`;

    priority =
      "high";
  }


  if (
    action ===
    "interested"
  ) {
    taskType =
      "follow_up";

    title =
      `Follow up with interested lead — ${leadName}`;

    priority =
      "normal";
  }


  /*
   * Actions such as Mark Handled,
   * Not Interested, Wrong Contact,
   * Unsubscribe do not create tasks.
   */
  if (
    !taskType ||
    !title
  ) {
    return null;
  }


  /*
   * Double-click / duplicate protection.
   */
  const {
    data: existing,
    error:
      existingError,
  } = await supabase
    .from(
      "lead_tasks"
    )
    .select("id")
    .eq(
      "source_reply_id",
      replyId
    )
    .eq(
      "task_type",
      taskType
    )
    .eq(
      "status",
      "open"
    )
    .limit(1)
    .maybeSingle();


  if (existingError) {
    throw new Error(
      `Could not check existing task: ${existingError.message}`
    );
  }


  if (existing) {
    return existing;
  }


  const {
    data: task,
    error,
  } = await supabase
    .from(
      "lead_tasks"
    )
    .insert({
      lead_id:
        leadId,

      source_reply_id:
        replyId,

      task_type:
        taskType,

      title,

      note:
        note || null,

      status:
        "open",

      priority,

      due_at:
        dueDateFromDelay(
          followUpDelay
        ),

      updated_at:
        new Date().toISOString(),
    })
    .select("id")
    .single();


  if (
    error ||
    !task
  ) {
    throw new Error(
      `Could not create follow-up task: ${
        error?.message ||
        "Unknown error"
      }`
    );
  }


  return task;
}


export async function handleReplyAction(
  formData: FormData
) {
  const replyId =
    String(
      formData.get(
        "replyId"
      ) ?? ""
    ).trim();


  const leadId =
    String(
      formData.get(
        "leadId"
      ) ?? ""
    ).trim();


  const action =
    String(
      formData.get(
        "action"
      ) ?? ""
    ).trim();


  const followUpDelay =
    String(
      formData.get(
        "followUpDelay"
      ) ?? "24h"
    ).trim();


  const note =
    String(
      formData.get(
        "note"
      ) ?? ""
    )
      .trim()
      .slice(
        0,
        1000
      );


  if (
    !replyId ||
    !leadId
  ) {
    throw new Error(
      "Missing reply or lead ID."
    );
  }


  if (
    !VALID_ACTIONS.has(
      action
    )
  ) {
    throw new Error(
      "Invalid reply action."
    );
  }


  const supabase =
    createAdminSupabase();


  // ==========================================================
  // VERIFY REPLY
  // ==========================================================

  const {
    data: reply,
    error:
      replyError,
  } = await supabase
    .from(
      "email_replies"
    )
    .select(`
      id,
      lead_id,
      handled
    `)
    .eq(
      "id",
      replyId
    )
    .eq(
      "lead_id",
      leadId
    )
    .maybeSingle();


  if (
    replyError ||
    !reply
  ) {
    throw new Error(
      replyError?.message ||
      "Reply not found."
    );
  }


  // ==========================================================
  // LOAD LEAD
  // ==========================================================

  const {
    data: lead,
    error:
      leadError,
  } = await supabase
    .from("leads")
    .select(`
      id,
      name,
      company_name,
      email
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


  const leadName =
    lead.company_name ||
    lead.name ||
    lead.email ||
    "Lead";


  /*
   * Create the task BEFORE marking the reply handled.
   * If task creation fails, the reply stays open.
   */
  await createFollowUpTask({
    replyId,
    leadId,
    action,
    followUpDelay,
    note,
    leadName,
  });


  const now =
    new Date().toISOString();


  // ==========================================================
  // MARK REPLY HANDLED
  // ==========================================================

  const {
    error:
      replyUpdateError,
  } = await supabase
    .from(
      "email_replies"
    )
    .update({
      handled:
        true,

      handled_at:
        now,

      handled_action:
        action,

      handled_note:
        note || null,

      requires_attention:
        false,
    })
    .eq(
      "id",
      replyId
    );


  if (
    replyUpdateError
  ) {
    throw new Error(
      `Could not handle reply: ${replyUpdateError.message}`
    );
  }


  // ==========================================================
  // UPDATE LEAD
  // ==========================================================

  const leadUpdate:
    Record<
      string,
      unknown
    > = {
    updated_at:
      now,
  };


  const status =
    leadStatusForAction(
      action
    );


  if (status) {
    leadUpdate.status =
      status;
  }


  // ==========================================================
  // UNSUBSCRIBE
  // ==========================================================

  if (
    action ===
    "unsubscribe"
  ) {
    leadUpdate.email_opt_out =
      true;

    leadUpdate.unsubscribed_at =
      now;


    if (lead.email) {
      const email =
        lead.email
          .trim()
          .toLowerCase();


      const {
        error:
          suppressionError,
      } = await supabase
        .from(
          "email_suppressions"
        )
        .upsert(
          {
            email,

            reason:
              "unsubscribe",

            source:
              "reply_handling",
          },
          {
            onConflict:
              "email",
          }
        );


      if (
        suppressionError
      ) {
        console.error(
          "Could not suppress email:",
          suppressionError.message
        );
      }
    }
  }


  await stopLeadSequences(
    leadId
  );


  // ==========================================================
  // REMAINING OPEN REPLIES
  // ==========================================================

  const {
    count:
      remainingAttention,
    error:
      attentionError,
  } = await supabase
    .from(
      "email_replies"
    )
    .select(
      "id",
      {
        count:
          "exact",

        head:
          true,
      }
    )
    .eq(
      "lead_id",
      leadId
    )
    .eq(
      "requires_attention",
      true
    )
    .eq(
      "handled",
      false
    );


  if (
    attentionError
  ) {
    console.error(
      "Could not count open replies:",
      attentionError.message
    );
  }


  leadUpdate.reply_requires_attention =
    (
      remainingAttention ??
      0
    ) > 0;


  const {
    error:
      leadUpdateError,
  } = await supabase
    .from("leads")
    .update(
      leadUpdate
    )
    .eq(
      "id",
      leadId
    );


  if (
    leadUpdateError
  ) {
    throw new Error(
      `Could not update lead: ${leadUpdateError.message}`
    );
  }


  revalidatePath(
    "/admin/replies"
  );

  revalidatePath(
    "/admin/tasks"
  );

  revalidatePath(
    "/admin/dashboard"
  );

  revalidatePath(
    "/admin/leads"
  );

  revalidatePath(
    `/admin/leads/${leadId}`
  );
}