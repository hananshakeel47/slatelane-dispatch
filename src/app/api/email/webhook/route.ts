import {
  NextResponse,
} from "next/server";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";

import {
  getEmailConfig,
  getResendClient,
} from "@/lib/email/resend";

import {
  classifyReply,
} from "@/lib/email/classify-reply";


export const runtime =
  "nodejs";


type ResendWebhookEvent = {
  type: string;

  created_at?: string;

  data?: {
    email_id?: string;
    message_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    attachments?: unknown[];

    failed?: {
      reason?: string;
    };

    suppressed?: {
      message?: string;
      type?: string;
    };

    bounce?: {
      message?: string;
      type?: string;
      subType?: string;
    };
  };
};


// ============================================================
// HEALTH CHECK
// ============================================================

export async function GET() {
  return NextResponse.json({
    success: true,
    service:
      "SlateLane Resend Webhook",
    status: "ready",
  });
}


// ============================================================
// HELPERS
// ============================================================

function extractEmailAddress(
  value:
    string | null | undefined
) {
  if (!value) {
    return null;
  }

  const match =
    value.match(
      /<([^<>]+@[^<>]+)>/
    );

  const email =
    match?.[1] ??
    value;

  const cleaned =
    email
      .trim()
      .toLowerCase();

  return cleaned.includes("@")
    ? cleaned
    : null;
}


function extractLeadIdFromAddress(
  value:
    string | null | undefined,

  inboundDomain: string
) {
  const email =
    extractEmailAddress(value);

  if (!email) {
    return null;
  }

  const atIndex =
    email.lastIndexOf("@");

  if (atIndex <= 0) {
    return null;
  }

  const local =
    email.slice(
      0,
      atIndex
    );

  const domain =
    email
      .slice(atIndex + 1)
      .toLowerCase();

  if (
    domain !==
    inboundDomain.toLowerCase()
  ) {
    return null;
  }

  const match =
    local.match(
      /^lead-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i
    );

  return match?.[1] ??
    null;
}


function normalizeHeaders(
  headers:
    Record<
      string,
      string
    > | null | undefined
) {
  const output:
    Record<
      string,
      string
    > = {};

  if (!headers) {
    return output;
  }

  for (
    const [key, value]
    of Object.entries(headers)
  ) {
    output[
      key.toLowerCase()
    ] = String(value);
  }

  return output;
}


// ============================================================
// STOP AUTOMATION
// ============================================================

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
      "Could not stop lead sequences:",
      error.message
    );
  }
}


// ============================================================
// OUTBOUND BOUNCE / COMPLAINT SUPPRESSION
// ============================================================

async function suppressLeadEmail(
  leadId: string,

  email:
    string | null,

  reason: string,

  flag:
    | "email_bounced"
    | "email_complained"
) {
  const supabase =
    createAdminSupabase();

  const now =
    new Date().toISOString();

  await supabase
    .from("leads")
    .update({
      [flag]: true,
      updated_at: now,
    })
    .eq("id", leadId);

  if (email) {
    await supabase
      .from(
        "email_suppressions"
      )
      .upsert(
        {
          email:
            email
              .trim()
              .toLowerCase(),

          reason,

          source:
            "resend",
        },
        {
          onConflict:
            "email",
        }
      );
  }

  await stopLeadSequences(
    leadId
  );
}


// ============================================================
// APPLY REPLY CLASSIFICATION TO LEAD
// ============================================================

async function applyClassificationToLead(
  lead: {
    id: string;

    email:
      string | null;

    reply_count:
      number | null;
  },

  classification:
    ReturnType<
      typeof classifyReply
    >,

  receivedAt: string,

  fromEmail: string,

  subject:
    string | null,

  incrementReplyCount: boolean
) {
  const supabase =
    createAdminSupabase();

  const now =
    new Date().toISOString();


  const update:
    Record<
      string,
      unknown
    > = {
    has_replied:
      true,

    last_reply_at:
      receivedAt,

    last_reply_from:
      fromEmail,

    last_reply_subject:
      subject,

    last_reply_classification:
      classification.classification,

    reply_requires_attention:
      classification.requiresAttention,

    updated_at:
      now,
  };


  if (
    incrementReplyCount
  ) {
    update.reply_count =
      (
        lead.reply_count ??
        0
      ) + 1;
  }


  if (
    classification.leadStatus
  ) {
    update.status =
      classification.leadStatus;
  }


  // ==========================================================
  // UNSUBSCRIBE AUTOMATICALLY
  // ==========================================================

  if (
    classification.classification ===
    "unsubscribe"
  ) {
    update.email_opt_out =
      true;

    update.unsubscribed_at =
      now;


    if (lead.email) {
      await supabase
        .from(
          "email_suppressions"
        )
        .upsert(
          {
            email:
              lead.email
                .trim()
                .toLowerCase(),

            reason:
              "unsubscribe",

            source:
              "reply_classifier",
          },
          {
            onConflict:
              "email",
          }
        );
    }
  }


  const {
    error,
  } = await supabase
    .from("leads")
    .update(update)
    .eq(
      "id",
      lead.id
    );


  if (error) {
    throw new Error(
      `Could not update classified lead: ${error.message}`
    );
  }


  /*
   * Any genuine reply stops automated follow-ups.
   */
  await stopLeadSequences(
    lead.id
  );
}


// ============================================================
// PROCESS INBOUND EMAIL
// ============================================================

async function processInboundEmail(
  event:
    ResendWebhookEvent
) {
  const receivedEmailId =
    event.data?.email_id;

  if (!receivedEmailId) {
    throw new Error(
      "email.received event is missing email_id."
    );
  }


  const resend =
    getResendClient();


  const {
    data: received,
    error: receiveError,
  } =
    await resend
      .emails
      .receiving
      .get(
        receivedEmailId
      );


  if (
    receiveError ||
    !received
  ) {
    throw new Error(
      `Could not retrieve received email: ${
        receiveError?.message ||
        "Unknown error"
      }`
    );
  }


  const config =
    getEmailConfig();


  const toAddresses =
    Array.isArray(
      received.to
    )
      ? received.to
      : (
          event.data?.to ??
          []
        );


  let leadId:
    string | null =
    null;

  let matchedToAddress:
    string | null =
    null;


  for (
    const address
    of toAddresses
  ) {
    const candidate =
      extractLeadIdFromAddress(
        address,
        config.inboundDomain
      );

    if (candidate) {
      leadId =
        candidate;

      matchedToAddress =
        extractEmailAddress(
          address
        );

      break;
    }
  }


  if (!leadId) {
    console.warn(
      "Inbound email could not be matched to a SlateLane lead:",
      receivedEmailId
    );

    return {
      matched: false,
      receivedEmailId,
    };
  }


  const supabase =
    createAdminSupabase();


  const {
    data: lead,
    error: leadError,
  } = await supabase
    .from("leads")
    .select(`
      id,
      email,
      reply_count
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
      "Matched lead does not exist."
    );
  }


  const fromEmail =
    extractEmailAddress(
      received.from ??
      event.data?.from
    );


  if (!fromEmail) {
    throw new Error(
      "Could not determine inbound sender email."
    );
  }


  const toEmail =
    matchedToAddress ??
    extractEmailAddress(
      toAddresses[0]
    );


  if (!toEmail) {
    throw new Error(
      "Could not determine inbound recipient."
    );
  }


  const subject =
    received.subject ??
    event.data?.subject ??
    null;


  // ==========================================================
  // CLASSIFY + CLEAN REPLY
  // ==========================================================

  const classification =
    classifyReply(
      received.text ??
      null,
      subject
    );


  const replyText =
    classification.cleanedText ||
    received.text ||
    null;


  const receivedAt =
    received.created_at ??
    event.created_at ??
    new Date().toISOString();


  const messageId =
    received.message_id ??
    event.data?.message_id ??
    null;


  const attachments =
    Array.isArray(
      received.attachments
    )
      ? received.attachments
      : [];


  const headers =
    normalizeHeaders(
      received.headers as
        Record<
          string,
          string
        >
    );


  const classifiedAt =
    new Date().toISOString();


  // ==========================================================
  // INSERT REPLY
  // ==========================================================

  const {
    error: replyError,
  } = await supabase
    .from(
      "email_replies"
    )
    .insert({
      lead_id:
        lead.id,

      resend_received_email_id:
        receivedEmailId,

      message_id:
        messageId,

      from_email:
        fromEmail,

      to_email:
        toEmail,

      subject,

      /*
       * Store CLEAN text so Gmail quote history disappears
       * from the CRM interface.
       */
      text_body:
        replyText,

      html_body:
        received.html ??
        null,

      raw_headers:
        headers,

      attachment_count:
        attachments.length,

      received_at:
        receivedAt,

      classification:
        classification.classification,

      classification_confidence:
        classification.confidence,

      classification_reason:
        classification.reason,

      classified_at:
        classifiedAt,

      requires_attention:
        classification.requiresAttention,
    });


  // ==========================================================
  // DUPLICATE / REPLAY
  //
  // This lets us replay your OLD test email.received webhooks
  // and classify the existing replies without increasing
  // reply_count again.
  // ==========================================================

  if (
    replyError?.code ===
    "23505"
  ) {
    const {
      data:
        existingReply,
    } = await supabase
      .from(
        "email_replies"
      )
      .select(
        "id"
      )
      .eq(
        "resend_received_email_id",
        receivedEmailId
      )
      .maybeSingle();


    if (
      existingReply
    ) {
      await supabase
        .from(
          "email_replies"
        )
        .update({
          text_body:
            replyText,

          classification:
            classification.classification,

          classification_confidence:
            classification.confidence,

          classification_reason:
            classification.reason,

          classified_at:
            classifiedAt,

          requires_attention:
            classification.requiresAttention,
        })
        .eq(
          "id",
          existingReply.id
        );


      await applyClassificationToLead(
        lead,
        classification,
        receivedAt,
        fromEmail,
        subject,
        false
      );
    }


    return {
      matched: true,
      duplicate: true,
      classified:
        classification.classification,
      leadId:
        lead.id,
      receivedEmailId,
    };
  }


  if (replyError) {
    throw new Error(
      `Could not save inbound reply: ${replyError.message}`
    );
  }


  // ==========================================================
  // UPDATE LEAD + STOP AUTOMATION
  // ==========================================================

  await applyClassificationToLead(
    lead,
    classification,
    receivedAt,
    fromEmail,
    subject,
    true
  );


  console.log(
    `Reply classified: ${classification.classification} for lead ${lead.id}`
  );


  return {
    matched: true,

    duplicate: false,

    classified:
      classification.classification,

    confidence:
      classification.confidence,

    leadId:
      lead.id,

    receivedEmailId,
  };
}


// ============================================================
// POST WEBHOOK
// ============================================================

export async function POST(
  request: Request
) {
  try {
    const webhookSecret =
      process.env
        .RESEND_WEBHOOK_SECRET;


    if (!webhookSecret) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Webhook secret is not configured.",
        },
        {
          status: 500,
        }
      );
    }


    const payload =
      await request.text();


    const svixId =
      request.headers.get(
        "svix-id"
      );

    const svixTimestamp =
      request.headers.get(
        "svix-timestamp"
      );

    const svixSignature =
      request.headers.get(
        "svix-signature"
      );


    if (
      !svixId ||
      !svixTimestamp ||
      !svixSignature
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Missing webhook signature headers.",
        },
        {
          status: 400,
        }
      );
    }


    let event:
      ResendWebhookEvent;


    try {
      const resend =
        getResendClient();


      event =
        resend.webhooks.verify({
          payload,

          headers: {
            id:
              svixId,

            timestamp:
              svixTimestamp,

            signature:
              svixSignature,
          },

          webhookSecret,
        }) as
          ResendWebhookEvent;

    } catch (error) {
      console.error(
        "Invalid webhook signature:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid webhook signature.",
        },
        {
          status: 400,
        }
      );
    }


    const supabase =
      createAdminSupabase();


    const resendEmailId =
      event.data?.email_id ??
      null;


    // ========================================================
    // STORE WEBHOOK
    // ========================================================

    const {
      error:
        webhookInsertError,
    } = await supabase
      .from(
        "email_webhook_events"
      )
      .insert({
        svix_id:
          svixId,

        event_type:
          event.type,

        resend_email_id:
          resendEmailId,

        payload:
          event,
      });


    const duplicateWebhook =
      webhookInsertError?.code ===
      "23505";


    if (
      webhookInsertError &&
      !duplicateWebhook
    ) {
      throw new Error(
        webhookInsertError.message
      );
    }


    /*
     * email.received is intentionally allowed through again
     * when replayed so existing replies can be classified.
     */
    if (
      duplicateWebhook &&
      event.type !==
        "email.received"
    ) {
      return NextResponse.json({
        success: true,
        duplicate: true,
      });
    }


    // ========================================================
    // INBOUND REPLY
    // ========================================================

    if (
      event.type ===
      "email.received"
    ) {
      const result =
        await processInboundEmail(
          event
        );

      return NextResponse.json({
        success: true,
        type:
          "email.received",
        ...result,
      });
    }


    if (!resendEmailId) {
      return NextResponse.json({
        success: true,
        ignored: true,
      });
    }


    // ========================================================
    // FIND OUTBOUND SEND
    // ========================================================

    const {
      data: send,
      error:
        sendLookupError,
    } = await supabase
      .from(
        "email_sends"
      )
      .select(`
        id,
        lead_id,
        to_email,
        status
      `)
      .eq(
        "resend_email_id",
        resendEmailId
      )
      .maybeSingle();


    if (sendLookupError) {
      throw new Error(
        sendLookupError.message
      );
    }


    if (!send) {
      return NextResponse.json({
        success: true,
        tracked: false,
      });
    }


    const eventTime =
      event.created_at ??
      new Date().toISOString();

    const now =
      new Date().toISOString();

    const messageId =
      event.data?.message_id ??
      null;


    // ========================================================
    // SENT
    // ========================================================

    if (
      event.type ===
      "email.sent"
    ) {
      await supabase
        .from(
          "email_sends"
        )
        .update({
          status:
            "sent",

          sent_at:
            eventTime,

          ...(messageId
            ? {
                message_id:
                  messageId,
              }
            : {}),

          updated_at:
            now,
        })
        .eq(
          "id",
          send.id
        );
    }


    // ========================================================
    // DELIVERED
    // ========================================================

    else if (
      event.type ===
      "email.delivered"
    ) {
      await supabase
        .from(
          "email_sends"
        )
        .update({
          status:
            "delivered",

          delivered_at:
            eventTime,

          ...(messageId
            ? {
                message_id:
                  messageId,
              }
            : {}),

          updated_at:
            now,
        })
        .eq(
          "id",
          send.id
        );
    }


    // ========================================================
    // BOUNCED
    // ========================================================

    else if (
      event.type ===
      "email.bounced"
    ) {
      const reason =
        event.data
          ?.bounce
          ?.message ||
        "Email bounced.";


      await supabase
        .from(
          "email_sends"
        )
        .update({
          status:
            "bounced",

          bounced_at:
            eventTime,

          error_message:
            reason,

          updated_at:
            now,
        })
        .eq(
          "id",
          send.id
        );


      if (
        send.lead_id
      ) {
        await suppressLeadEmail(
          send.lead_id,
          send.to_email,
          "hard_bounce",
          "email_bounced"
        );
      }
    }


    // ========================================================
    // COMPLAINT
    // ========================================================

    else if (
      event.type ===
      "email.complained"
    ) {
      await supabase
        .from(
          "email_sends"
        )
        .update({
          status:
            "complained",

          complained_at:
            eventTime,

          error_message:
            "Recipient marked the email as spam.",

          updated_at:
            now,
        })
        .eq(
          "id",
          send.id
        );


      if (
        send.lead_id
      ) {
        await suppressLeadEmail(
          send.lead_id,
          send.to_email,
          "spam_complaint",
          "email_complained"
        );
      }
    }


    // ========================================================
    // FAILED
    // ========================================================

    else if (
      event.type ===
      "email.failed"
    ) {
      await supabase
        .from(
          "email_sends"
        )
        .update({
          status:
            "failed",

          failed_at:
            eventTime,

          error_message:
            event.data
              ?.failed
              ?.reason ||
            "Resend reported failure.",

          updated_at:
            now,
        })
        .eq(
          "id",
          send.id
        );
    }


    // ========================================================
    // SUPPRESSED
    // ========================================================

    else if (
      event.type ===
      "email.suppressed"
    ) {
      await supabase
        .from(
          "email_sends"
        )
        .update({
          status:
            "suppressed",

          failed_at:
            eventTime,

          error_message:
            event.data
              ?.suppressed
              ?.message ||
            "Email suppressed.",

          updated_at:
            now,
        })
        .eq(
          "id",
          send.id
        );


      if (
        send.lead_id
      ) {
        await stopLeadSequences(
          send.lead_id
        );
      }
    }


    return NextResponse.json({
      success: true,
      event:
        event.type,
      tracked: true,
    });

  } catch (error) {
    console.error(
      "RESEND WEBHOOK ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Unknown webhook error.",
      },
      {
        status: 500,
      }
    );
  }
}