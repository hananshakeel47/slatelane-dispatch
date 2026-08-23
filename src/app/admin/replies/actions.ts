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
      replyLookupError,
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
    replyLookupError ||
    !reply
  ) {
    throw new Error(
      replyLookupError?.message ||
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
      handled: true,

      handled_at: now,

      handled_action:
        action,

      handled_note:
        note || null,

      /*
       * It leaves the active attention queue
       * after a human has handled it.
       */
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
  // LEAD STATUS
  // ==========================================================

  const leadUpdate:
    Record<
      string,
      unknown
    > = {
    updated_at: now,
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
  // UNSUBSCRIBE ACTION
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


  /*
   * A replied lead should never resume
   * automated follow-ups.
   */
  await stopLeadSequences(
    leadId
  );


  // ==========================================================
  // CHECK WHETHER THIS LEAD HAS OTHER OPEN REPLIES
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
      "Could not count remaining replies:",
      attentionError.message
    );
  }


  leadUpdate.reply_requires_attention =
    (
      remainingAttention ??
      0
    ) > 0;


  // ==========================================================
  // UPDATE LEAD
  // ==========================================================

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


  // ==========================================================
  // REFRESH CRM
  // ==========================================================

  revalidatePath(
    "/admin/replies"
  );

  revalidatePath(
    "/admin/leads"
  );

  revalidatePath(
    `/admin/leads/${leadId}`
  );
}