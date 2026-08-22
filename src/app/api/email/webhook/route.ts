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

    tags?: Record<
      string,
      string
    >;

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

export async function GET() {
  return NextResponse.json({
    success: true,

    service:
      "SlateLane Resend Webhook",

    status: "ready",
  });
}

function extractEmailAddress(
  value:
    string | null | undefined
) {
  if (!value) {
    return null;
  }

  const angleMatch =
    value.match(
      /<([^<>]+@[^<>]+)>/
    );

  const email =
    angleMatch?.[1] ??
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
    email.slice(0, atIndex);

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

  return match?.[1] ?? null;
}

function normalizeHeaders(
  headers:
    Record<
      string,
      string
    > | null | undefined
) {
  const normalized:
    Record<
      string,
      string
    > = {};

  if (!headers) {
    return normalized;
  }

  for (
    const [key, value]
    of Object.entries(headers)
  ) {
    normalized[
      key.toLowerCase()
    ] = String(value);
  }

  return normalized;
}

function extractMessageIds(
  value:
    string | null | undefined
) {
  if (!value) {
    return [];
  }

  const matches =
    value.match(/<[^<>]+>/g);

  if (
    matches &&
    matches.length > 0
  ) {
    return matches;
  }

  return [
    value.trim(),
  ].filter(Boolean);
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
    .eq("lead_id", leadId)
    .in(
      "status",
      ["active", "paused"]
    );

  if (error) {
    console.error(
      "Could not stop lead sequences:",
      error.message
    );
  }
}

async function suppressLeadEmail(
  leadId: string,

  email: string | null,

  reason: string,

  flag:
    | "email_bounced"
    | "email_complained"
) {
  const supabase =
    createAdminSupabase();

  const now =
    new Date().toISOString();

  const {
    error: leadUpdateError,
  } = await supabase
    .from("leads")
    .update({
      [flag]: true,
      updated_at: now,
    })
    .eq("id", leadId);

  if (leadUpdateError) {
    console.error(
      "Could not update lead suppression flag:",
      leadUpdateError.message
    );
  }

  if (email) {
    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    const {
      error: suppressionError,
    } = await supabase
      .from(
        "email_suppressions"
      )
      .upsert(
        {
          email:
            normalizedEmail,

          reason,

          source: "resend",
        },
        {
          onConflict: "email",
        }
      );

    if (suppressionError) {
      console.error(
        "Could not create suppression:",
        suppressionError.message
      );
    }
  }

  await stopLeadSequences(
    leadId
  );
}

async function findLeadFromThreadHeaders(
  headers:
    Record<string, string>
) {
  const supabase =
    createAdminSupabase();

  const candidates = [
    ...extractMessageIds(
      headers["in-reply-to"]
    ),

    ...extractMessageIds(
      headers["references"]
    ),
  ];

  const uniqueCandidates =
    [...new Set(candidates)];

  for (
    const messageId
    of uniqueCandidates
  ) {
    const {
      data: send,
    } = await supabase
      .from("email_sends")
      .select("lead_id")
      .eq(
        "message_id",
        messageId
      )
      .not(
        "lead_id",
        "is",
        null
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (send?.lead_id) {
      return String(
        send.lead_id
      );
    }
  }

  return null;
}

async function processInboundEmail(
  event: ResendWebhookEvent
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
      .get(receivedEmailId);

  if (
    receiveError ||
    !received
  ) {
    throw new Error(
      `Could not retrieve received email: ${
        receiveError?.message ||
        "Unknown Resend receiving error."
      }`
    );
  }

  const config =
    getEmailConfig();

  const toAddresses =
    Array.isArray(received.to)
      ? received.to
      : event.data?.to ?? [];

  let leadId:
    string | null = null;

  let matchedToAddress:
    string | null = null;

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
      leadId = candidate;

      matchedToAddress =
        extractEmailAddress(
          address
        );

      break;
    }
  }

  const headers =
    normalizeHeaders(
      received.headers as Record<
        string,
        string
      >
    );

  if (!leadId) {
    leadId =
      await findLeadFromThreadHeaders(
        headers
      );
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
    .eq("id", leadId)
    .maybeSingle();

  if (
    leadError ||
    !lead
  ) {
    throw new Error(
      leadError?.message ||
      "Matched inbound lead no longer exists."
    );
  }

  const fromEmail =
    extractEmailAddress(
      received.from ??
      event.data?.from
    );

  if (!fromEmail) {
    throw new Error(
      "Could not determine inbound sender email address."
    );
  }

  const toEmail =
    matchedToAddress ??
    extractEmailAddress(
      toAddresses[0]
    );

  if (!toEmail) {
    throw new Error(
      "Could not determine inbound recipient address."
    );
  }

  const receivedAt =
    received.created_at ??
    event.created_at ??
    new Date().toISOString();

  const inboundMessageId =
    received.message_id ??
    event.data?.message_id ??
    null;

  const attachments =
    Array.isArray(
      received.attachments
    )
      ? received.attachments
      : [];

  const {
    error: replyInsertError,
  } = await supabase
    .from("email_replies")
    .insert({
      lead_id:
        lead.id,

      resend_received_email_id:
        receivedEmailId,

      message_id:
        inboundMessageId,

      from_email:
        fromEmail,

      to_email:
        toEmail,

      subject:
        received.subject ??
        event.data?.subject ??
        null,

      text_body:
        received.text ?? null,

      html_body:
        received.html ?? null,

      raw_headers:
        headers,

      attachment_count:
        attachments.length,

      received_at:
        receivedAt,
    });

  if (
    replyInsertError?.code ===
    "23505"
  ) {
    return {
      matched: true,

      duplicate: true,

      leadId:
        lead.id,

      receivedEmailId,
    };
  }

  if (replyInsertError) {
    throw new Error(
      `Could not save inbound reply: ${replyInsertError.message}`
    );
  }

  const now =
    new Date().toISOString();

  const nextReplyCount =
    (lead.reply_count ?? 0) + 1;

  const {
    error: leadUpdateError,
  } = await supabase
    .from("leads")
    .update({
      has_replied: true,

      reply_count:
        nextReplyCount,

      last_reply_at:
        receivedAt,

      last_reply_from:
        fromEmail,

      last_reply_subject:
        received.subject ??
        event.data?.subject ??
        null,

      updated_at: now,
    })
    .eq("id", lead.id);

  if (leadUpdateError) {
    throw new Error(
      `Could not update replied lead: ${leadUpdateError.message}`
    );
  }

  await stopLeadSequences(
    lead.id
  );

  console.log(
    `Inbound reply stored. Lead ${lead.id} automation stopped.`
  );

  return {
    matched: true,

    duplicate: false,

    leadId:
      lead.id,

    receivedEmailId,
  };
}

export async function POST(
  request: Request
) {
  try {
    const webhookSecret =
      process.env
        .RESEND_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error(
        "RESEND_WEBHOOK_SECRET is missing."
      );

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
            id: svixId,

            timestamp:
              svixTimestamp,

            signature:
              svixSignature,
          },

          webhookSecret,
        }) as ResendWebhookEvent;
    } catch (error) {
      console.error(
        "Invalid Resend webhook signature:",
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

    const {
      error: webhookInsertError,
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

        payload: event,
      });

    const duplicateWebhook =
      webhookInsertError?.code ===
      "23505";

    if (
      webhookInsertError &&
      !duplicateWebhook
    ) {
      console.error(
        "Could not save webhook event:",
        webhookInsertError.message
      );

      return NextResponse.json(
        {
          success: false,

          message:
            "Could not store webhook event.",
        },
        {
          status: 500,
        }
      );
    }

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

        reason:
          "No email_id in event.",
      });
    }

    const {
      data: send,
      error: sendLookupError,
    } = await supabase
      .from("email_sends")
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
      console.error(
        "Could not locate email send:",
        sendLookupError.message
      );

      return NextResponse.json(
        {
          success: false,

          message:
            "Email lookup failed.",
        },
        {
          status: 500,
        }
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

    const updatedAt =
      new Date().toISOString();

    const messageId =
      event.data?.message_id ??
      null;

    if (
      event.type ===
      "email.sent"
    ) {
      if (
        [
          "queued",
          "sending",
          "sent",
        ].includes(send.status)
      ) {
        await supabase
          .from("email_sends")
          .update({
            status: "sent",

            sent_at: eventTime,

            ...(messageId
              ? {
                  message_id:
                    messageId,
                }
              : {}),

            updated_at:
              updatedAt,
          })
          .eq("id", send.id);
      }
    } else if (
      event.type ===
      "email.delivered"
    ) {
      await supabase
        .from("email_sends")
        .update({
          status: "delivered",

          delivered_at:
            eventTime,

          ...(messageId
            ? {
                message_id:
                  messageId,
              }
            : {}),

          updated_at:
            updatedAt,
        })
        .eq("id", send.id);
    } else if (
      event.type ===
      "email.bounced"
    ) {
      const bounceMessage =
        event.data
          ?.bounce
          ?.message ||
        "Email permanently bounced.";

      await supabase
        .from("email_sends")
        .update({
          status: "bounced",

          bounced_at:
            eventTime,

          error_message:
            bounceMessage,

          ...(messageId
            ? {
                message_id:
                  messageId,
              }
            : {}),

          updated_at:
            updatedAt,
        })
        .eq("id", send.id);

      if (send.lead_id) {
        await suppressLeadEmail(
          send.lead_id,
          send.to_email,
          "hard_bounce",
          "email_bounced"
        );
      }
    } else if (
      event.type ===
      "email.complained"
    ) {
      await supabase
        .from("email_sends")
        .update({
          status:
            "complained",

          complained_at:
            eventTime,

          error_message:
            "Recipient marked the message as spam.",

          ...(messageId
            ? {
                message_id:
                  messageId,
              }
            : {}),

          updated_at:
            updatedAt,
        })
        .eq("id", send.id);

      if (send.lead_id) {
        await suppressLeadEmail(
          send.lead_id,
          send.to_email,
          "spam_complaint",
          "email_complained"
        );
      }
    } else if (
      event.type ===
      "email.failed"
    ) {
      if (
        ![
          "delivered",
          "bounced",
          "complained",
        ].includes(send.status)
      ) {
        const failureReason =
          event.data
            ?.failed
            ?.reason ||
          "Resend reported an email failure.";

        await supabase
          .from("email_sends")
          .update({
            status: "failed",

            failed_at:
              eventTime,

            error_message:
              failureReason,

            ...(messageId
              ? {
                  message_id:
                    messageId,
                }
              : {}),

            updated_at:
              updatedAt,
          })
          .eq("id", send.id);
      }
    } else if (
      event.type ===
      "email.suppressed"
    ) {
      const suppressionReason =
        event.data
          ?.suppressed
          ?.message ||
        "Email was suppressed by Resend.";

      await supabase
        .from("email_sends")
        .update({
          status: "suppressed",

          failed_at:
            eventTime,

          error_message:
            suppressionReason,

          ...(messageId
            ? {
                message_id:
                  messageId,
              }
            : {}),

          updated_at:
            updatedAt,
        })
        .eq("id", send.id);

      if (send.to_email) {
        await supabase
          .from(
            "email_suppressions"
          )
          .upsert(
            {
              email:
                send.to_email
                  .trim()
                  .toLowerCase(),

              reason:
                "resend_suppression",

              source:
                "resend",
            },
            {
              onConflict: "email",
            }
          );
      }

      if (send.lead_id) {
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

      resendEmailId,
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