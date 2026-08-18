import crypto from "crypto";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";

import {
  getEmailConfig,
  getResendClient,
} from "./resend";

import {
  renderEmailTemplate,
} from "./render";


type SendTemplateOptions = {
  leadId: string;

  templateId: string;

  enrollmentId?: string | null;

  sequenceStepId?: string | null;
};


function validEmail(
  email: string
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}


export async function sendTemplateEmail(
  options: SendTemplateOptions
) {
  const supabase =
    createAdminSupabase();


  // ==========================================================
  // LOAD LEAD
  // ==========================================================

  const {
    data: lead,
    error: leadError,
  } = await supabase
    .from("leads")
    .select(`
      id,
      name,
      company_name,
      email,
      carrier_dot_number,
      mc_number,

      status,

      email_opt_out,
      email_bounced,
      email_complained,

      unsubscribe_token
    `)
    .eq(
      "id",
      options.leadId
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


  // ==========================================================
  // EMAIL SAFETY CHECKS
  // ==========================================================

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


  if (!lead.email) {
    throw new Error(
      "Lead has no email address."
    );
  }


  const toEmail =
    lead.email
      .trim()
      .toLowerCase();


  if (
    !validEmail(
      toEmail
    )
  ) {
    throw new Error(
      `Invalid email address: ${toEmail}`
    );
  }


  // ==========================================================
  // LOCAL SUPPRESSION CHECK
  // ==========================================================

  const {
    data: suppression,
    error:
      suppressionError,
  } = await supabase
    .from(
      "email_suppressions"
    )
    .select(`
      id,
      reason
    `)
    .eq(
      "email",
      toEmail
    )
    .maybeSingle();


  if (
    suppressionError
  ) {
    throw new Error(
      `Could not check email suppression: ${suppressionError.message}`
    );
  }


  if (suppression) {
    throw new Error(
      `Email suppressed: ${suppression.reason}`
    );
  }


  // ==========================================================
  // LOAD EMAIL TEMPLATE
  // ==========================================================

  const {
    data: template,
    error:
      templateError,
  } = await supabase
    .from(
      "email_templates"
    )
    .select(`
      id,
      subject,
      html_body,
      text_body,
      active
    `)
    .eq(
      "id",
      options.templateId
    )
    .maybeSingle();


  if (
    templateError ||
    !template
  ) {
    throw new Error(
      templateError?.message ||
      "Email template not found."
    );
  }


  if (
    !template.active
  ) {
    throw new Error(
      "Email template is inactive."
    );
  }


  // ==========================================================
  // ENSURE UNSUBSCRIBE TOKEN EXISTS
  // ==========================================================

  let token =
    lead.unsubscribe_token;


  if (!token) {
    token =
      crypto.randomUUID();


    const {
      error:
        tokenError,
    } = await supabase
      .from("leads")
      .update({
        unsubscribe_token:
          token,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        lead.id
      );


    if (tokenError) {
      throw new Error(
        `Could not create unsubscribe token: ${tokenError.message}`
      );
    }
  }


  // ==========================================================
  // LOAD EMAIL CONFIGURATION
  // ==========================================================

  const config =
    getEmailConfig();


  const unsubscribeUrl =
    `${config.publicUrl}/api/email/unsubscribe?token=${token}`;


  // ==========================================================
  // RENDER TEMPLATE
  // ==========================================================

  const rendered =
    renderEmailTemplate(
      template,
      lead,
      unsubscribeUrl,
      {
        senderName:
          config.senderName,

        businessAddress:
          config.businessAddress,
      }
    );


  // ==========================================================
  // SEQUENCE DUPLICATE / RETRY PROTECTION
  // ==========================================================

  if (
    options.enrollmentId &&
    options.sequenceStepId
  ) {
    const {
      data: existingSend,
      error:
        existingSendError,
    } = await supabase
      .from("email_sends")
      .select(`
        id,
        resend_email_id,
        status,
        error_message
      `)
      .eq(
        "enrollment_id",
        options.enrollmentId
      )
      .eq(
        "sequence_step_id",
        options.sequenceStepId
      )
      .maybeSingle();


    if (
      existingSendError
    ) {
      throw new Error(
        `Could not check previous send: ${existingSendError.message}`
      );
    }


    // --------------------------------------------------------
    // ALREADY SUCCESSFULLY SENT
    // --------------------------------------------------------

    if (
      existingSend &&
      [
        "sent",
        "delivered",
      ].includes(
        existingSend.status
      )
    ) {
      return {
        sendId:
          existingSend.id,

        resendEmailId:
          existingSend
            .resend_email_id,

        alreadySent:
          true,
      };
    }


    // --------------------------------------------------------
    // NEVER RETRY BOUNCED / COMPLAINT
    // --------------------------------------------------------

    if (
      existingSend &&
      [
        "bounced",
        "complained",
      ].includes(
        existingSend.status
      )
    ) {
      throw new Error(
        `Sequence step cannot be retried because previous status is ${existingSend.status}.`
      );
    }


    // --------------------------------------------------------
    // FAILED SENDS ARE RETRYABLE
    //
    // Delete previous failed send so our unique
    // enrollment + step index allows a fresh attempt.
    // --------------------------------------------------------

    if (
      existingSend?.status ===
      "failed"
    ) {
      const {
        error:
          deleteError,
      } = await supabase
        .from("email_sends")
        .delete()
        .eq(
          "id",
          existingSend.id
        );


      if (deleteError) {
        throw new Error(
          `Could not reset failed email attempt: ${deleteError.message}`
        );
      }
    }


    // --------------------------------------------------------
    // QUEUED / SENDING = DO NOT DUPLICATE
    // --------------------------------------------------------

    else if (
      existingSend
    ) {
      throw new Error(
        `Sequence step already has send status: ${existingSend.status}`
      );
    }
  }


  // ==========================================================
  // CREATE EMAIL SEND LOG
  // ==========================================================

  const {
    data: sendRecord,
    error:
      sendLogError,
  } = await supabase
    .from("email_sends")
    .insert({
      lead_id:
        lead.id,

      enrollment_id:
        options
          .enrollmentId ??
        null,

      sequence_step_id:
        options
          .sequenceStepId ??
        null,

      resend_email_id:
        null,

      to_email:
        toEmail,

      from_email:
        config.fromEmail,

      subject:
        rendered.subject,

      status:
        "queued",

      scheduled_at:
        new Date()
          .toISOString(),

      sent_at:
        null,

      delivered_at:
        null,

      bounced_at:
        null,

      complained_at:
        null,

      failed_at:
        null,

      error_message:
        null,

      updated_at:
        new Date()
          .toISOString(),
    })
    .select(
      "id"
    )
    .single();


  if (
    sendLogError ||
    !sendRecord
  ) {
    throw new Error(
      `Could not create email send record: ${
        sendLogError?.message ||
        "Unknown error"
      }`
    );
  }


  const sendId =
    sendRecord.id;


  // ==========================================================
  // SEND THROUGH RESEND
  // ==========================================================

  try {

    // --------------------------------------------------------
    // MARK AS SENDING
    // --------------------------------------------------------

    const {
      error:
        sendingStatusError,
    } = await supabase
      .from("email_sends")
      .update({
        status:
          "sending",

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        sendId
      );


    if (
      sendingStatusError
    ) {
      throw new Error(
        `Could not mark email as sending: ${sendingStatusError.message}`
      );
    }


    // --------------------------------------------------------
    // RESEND CLIENT
    // --------------------------------------------------------

    const resend =
      getResendClient();


    // --------------------------------------------------------
    // IDEMPOTENCY KEY
    // --------------------------------------------------------

    const idempotencyKey =
      options.enrollmentId &&
      options.sequenceStepId

        ? `sequence/${options.enrollmentId}/${options.sequenceStepId}`

        : `send/${sendId}`;


    // --------------------------------------------------------
    // SEND EMAIL
    // --------------------------------------------------------

    const {
      data,
      error:
        resendError,
    } =
      await resend.emails.send(
        {
          from:
            config.fromEmail,

          to: [
            toEmail,
          ],

          ...(config.replyTo
            ? {
                replyTo:
                  config.replyTo,
              }
            : {}),

          subject:
            rendered.subject,

          html:
            rendered.html,

          text:
            rendered.text,

          headers: {
            "List-Unsubscribe":
              `<${unsubscribeUrl}>`,

            "List-Unsubscribe-Post":
              "List-Unsubscribe=One-Click",
          },

          tags: [
            {
              name:
                "lead_id",

              value:
                lead.id,
            },

            {
              name:
                "send_id",

              value:
                sendId,
            },
          ],
        },

        {
          idempotencyKey,
        }
      );


    if (
      resendError
    ) {
      throw new Error(
        resendError.message
      );
    }


    if (
      !data?.id
    ) {
      throw new Error(
        "Resend did not return an email ID."
      );
    }


    const now =
      new Date()
        .toISOString();


    // ========================================================
    // MARK SEND AS SUCCESSFUL
    // ========================================================

    const {
      error:
        sentUpdateError,
    } = await supabase
      .from("email_sends")
      .update({
        resend_email_id:
          data.id,

        status:
          "sent",

        sent_at:
          now,

        failed_at:
          null,

        error_message:
          null,

        updated_at:
          now,
      })
      .eq(
        "id",
        sendId
      );


    if (
      sentUpdateError
    ) {
      console.error(
        "Email was sent through Resend, but SlateLane could not update email_sends:",
        sentUpdateError.message
      );
    }


    // ========================================================
    // UPDATE LEAD
    // ========================================================

    const {
      error:
        leadUpdateError,
    } = await supabase
      .from("leads")
      .update({
        last_email_sent_at:
          now,

        updated_at:
          now,
      })
      .eq(
        "id",
        lead.id
      );


    if (
      leadUpdateError
    ) {
      console.error(
        "Could not update lead last_email_sent_at:",
        leadUpdateError.message
      );
    }


    return {
      sendId,

      resendEmailId:
        data.id,

      alreadySent:
        false,
    };

  } catch (
    error
  ) {

    // ========================================================
    // FAILURE HANDLING
    // ========================================================

    const message =
      error instanceof Error
        ? error.message
        : "Unknown email send error.";


    console.error(
      `Email send failed for ${toEmail}:`,
      message
    );


    const now =
      new Date()
        .toISOString();


    const {
      error:
        failureLogError,
    } = await supabase
      .from("email_sends")
      .update({
        status:
          "failed",

        failed_at:
          now,

        error_message:
          message,

        updated_at:
          now,
      })
      .eq(
        "id",
        sendId
      );


    if (
      failureLogError
    ) {
      console.error(
        "Could not save failed email status:",
        failureLogError.message
      );
    }


    throw error;
  }
}