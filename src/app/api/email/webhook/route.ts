import {
  NextResponse,
} from "next/server";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";

import {
  getResendClient,
} from "@/lib/email/resend";


export const runtime =
  "nodejs";


type ResendWebhookEvent = {
  type: string;

  created_at?: string;

  data?: {
    email_id?: string;

    to?: string[];

    subject?: string;

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
    status:
      "ready",
  });
}


// ============================================================
// STOP ALL EMAIL AUTOMATION FOR LEAD
// ============================================================

async function stopLeadSequences(
  leadId: string
) {
  const supabase =
    createAdminSupabase();

  const now =
    new Date()
      .toISOString();


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
}


// ============================================================
// SUPPRESS EMAIL
// ============================================================

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
    new Date()
      .toISOString();


  const {
    error:
      leadUpdateError,
  } = await supabase
    .from("leads")
    .update({
      [flag]:
        true,

      updated_at:
        now,
    })
    .eq(
      "id",
      leadId
    );


  if (
    leadUpdateError
  ) {
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
      error:
        suppressionError,
    } = await supabase
      .from(
        "email_suppressions"
      )
      .upsert(
        {
          email:
            normalizedEmail,

          reason,

          source:
            "resend",
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
        "Could not create suppression:",
        suppressionError.message
      );
    }
  }


  await stopLeadSequences(
    leadId
  );
}


// ============================================================
// RESEND WEBHOOK
// ============================================================

export async function POST(
  request: Request
) {
  try {

    // ========================================================
    // WEBHOOK SECRET
    // ========================================================

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


    // ========================================================
    // RAW REQUEST BODY
    //
    // REQUIRED for Resend / Svix verification.
    // Do NOT call request.json() before verification.
    // ========================================================

    const payload =
      await request.text();


    // ========================================================
    // SIGNATURE HEADERS
    // ========================================================

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


    // ========================================================
    // VERIFY WEBHOOK
    // ========================================================

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
        }) as ResendWebhookEvent;

    } catch (
      error
    ) {
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


    // ========================================================
    // DATABASE
    // ========================================================

    const supabase =
      createAdminSupabase();


    const resendEmailId =
      event.data
        ?.email_id ??
      null;


    // ========================================================
    // STORE RAW WEBHOOK EVENT
    //
    // svix_id is unique so Resend retries
    // cannot process the same event twice.
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


    // Duplicate webhook delivery.
    if (
      webhookInsertError
        ?.code ===
      "23505"
    ) {
      return NextResponse.json({
        success: true,
        duplicate: true,
      });
    }


    if (
      webhookInsertError
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


    // ========================================================
    // EVENT DOESN'T CONTAIN EMAIL ID
    // ========================================================

    if (!resendEmailId) {
      return NextResponse.json({
        success: true,
        ignored: true,
        reason:
          "No email_id in event.",
      });
    }


    // ========================================================
    // FIND SLATELANE EMAIL SEND
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


    if (
      sendLookupError
    ) {
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


    /*
     * The webhook may belong to another
     * email sent from the same Resend
     * account but outside SlateLane.
     */
    if (!send) {
      return NextResponse.json({
        success: true,
        tracked: false,
      });
    }


    const eventTime =
      event.created_at ||
      new Date()
        .toISOString();


    const updatedAt =
      new Date()
        .toISOString();


    // ========================================================
    // EMAIL SENT
    // ========================================================

    if (
      event.type ===
      "email.sent"
    ) {
      if (
        [
          "queued",
          "sending",
          "sent",
        ].includes(
          send.status
        )
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

            updated_at:
              updatedAt,
          })
          .eq(
            "id",
            send.id
          );
      }
    }


    // ========================================================
    // EMAIL DELIVERED
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

          updated_at:
            updatedAt,
        })
        .eq(
          "id",
          send.id
        );
    }


    // ========================================================
    // EMAIL BOUNCED
    // ========================================================

    else if (
      event.type ===
      "email.bounced"
    ) {
      const bounceMessage =
        event.data
          ?.bounce
          ?.message ||
        "Email permanently bounced.";


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
            bounceMessage,

          updated_at:
            updatedAt,
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
    // SPAM COMPLAINT
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
            "Recipient marked the message as spam.",

          updated_at:
            updatedAt,
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
    // EMAIL FAILED
    // ========================================================

    else if (
      event.type ===
      "email.failed"
    ) {
      /*
       * Don't downgrade a final state
       * if webhook events arrive in a
       * different order.
       */
      if (
        ![
          "delivered",
          "bounced",
          "complained",
        ].includes(
          send.status
        )
      ) {
        const failureReason =
          event.data
            ?.failed
            ?.reason ||
          "Resend reported an email failure.";


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
              failureReason,

            updated_at:
              updatedAt,
          })
          .eq(
            "id",
            send.id
          );
      }
    }


    // ========================================================
    // RESEND SUPPRESSION
    // ========================================================

    else if (
      event.type ===
      "email.suppressed"
    ) {
      const suppressionReason =
        event.data
          ?.suppressed
          ?.message ||
        "Email was suppressed by Resend.";


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
            suppressionReason,

          updated_at:
            updatedAt,
        })
        .eq(
          "id",
          send.id
        );


      if (
        send.to_email
      ) {
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
              onConflict:
                "email",
            }
          );
      }


      if (
        send.lead_id
      ) {
        await stopLeadSequences(
          send.lead_id
        );
      }
    }


    // ========================================================
    // SUCCESS
    // ========================================================

    return NextResponse.json({
      success: true,

      event:
        event.type,

      tracked: true,

      resendEmailId,
    });

  } catch (
    error
  ) {
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