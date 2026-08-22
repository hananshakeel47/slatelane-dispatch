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

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function sendTemplateEmail(
  options: SendTemplateOptions
) {
  const supabase = createAdminSupabase();

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
      has_replied,
      unsubscribe_token
    `)
    .eq("id", options.leadId)
    .maybeSingle();

  if (leadError || !lead) {
    throw new Error(
      leadError?.message || "Lead not found."
    );
  }

  if (lead.has_replied) {
    throw new Error(
      "Lead has already replied. Automated email blocked."
    );
  }

  if (lead.email_opt_out) {
    throw new Error("Lead has unsubscribed.");
  }

  if (lead.email_bounced) {
    throw new Error(
      "Lead email previously bounced."
    );
  }

  if (lead.email_complained) {
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
    lead.email.trim().toLowerCase();

  if (!validEmail(toEmail)) {
    throw new Error(
      `Invalid email address: ${toEmail}`
    );
  }

  const {
    data: suppression,
    error: suppressionError,
  } = await supabase
    .from("email_suppressions")
    .select(`
      id,
      reason
    `)
    .eq("email", toEmail)
    .maybeSingle();

  if (suppressionError) {
    throw new Error(
      `Could not check email suppression: ${suppressionError.message}`
    );
  }

  if (suppression) {
    throw new Error(
      `Email suppressed: ${suppression.reason}`
    );
  }

  const {
    data: template,
    error: templateError,
  } = await supabase
    .from("email_templates")
    .select(`
      id,
      subject,
      html_body,
      text_body,
      active
    `)
    .eq("id", options.templateId)
    .maybeSingle();

  if (templateError || !template) {
    throw new Error(
      templateError?.message ||
        "Email template not found."
    );
  }

  if (!template.active) {
    throw new Error(
      "Email template is inactive."
    );
  }

  let token = lead.unsubscribe_token;

  if (!token) {
    token = crypto.randomUUID();

    const {
      error: tokenError,
    } = await supabase
      .from("leads")
      .update({
        unsubscribe_token: token,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    if (tokenError) {
      throw new Error(
        `Could not create unsubscribe token: ${tokenError.message}`
      );
    }
  }

  const config = getEmailConfig();

  const unsubscribeUrl =
    `${config.publicUrl}/api/email/unsubscribe?token=${token}`;

  const replyToAddress =
    `lead-${lead.id}@${config.inboundDomain}`;

  const rendered =
    renderEmailTemplate(
      template,
      lead,
      unsubscribeUrl,
      {
        senderName: config.senderName,
        businessAddress:
          config.businessAddress,
      }
    );

  if (
    options.enrollmentId &&
    options.sequenceStepId
  ) {
    const {
      data: existingSend,
      error: existingSendError,
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

    if (existingSendError) {
      throw new Error(
        `Could not check previous send: ${existingSendError.message}`
      );
    }

    if (
      existingSend &&
      ["sent", "delivered"].includes(
        existingSend.status
      )
    ) {
      return {
        sendId: existingSend.id,
        resendEmailId:
          existingSend.resend_email_id,
        alreadySent: true,
      };
    }

    if (
      existingSend &&
      [
        "bounced",
        "complained",
        "suppressed",
      ].includes(existingSend.status)
    ) {
      throw new Error(
        `Sequence step cannot be retried because previous status is ${existingSend.status}.`
      );
    }

    if (
      existingSend?.status === "failed"
    ) {
      const {
        error: deleteError,
      } = await supabase
        .from("email_sends")
        .delete()
        .eq("id", existingSend.id);

      if (deleteError) {
        throw new Error(
          `Could not reset failed email attempt: ${deleteError.message}`
        );
      }
    } else if (existingSend) {
      throw new Error(
        `Sequence step already has send status: ${existingSend.status}`
      );
    }
  }

  const {
    data: sendRecord,
    error: sendLogError,
  } = await supabase
    .from("email_sends")
    .insert({
      lead_id: lead.id,

      enrollment_id:
        options.enrollmentId ?? null,

      sequence_step_id:
        options.sequenceStepId ?? null,

      resend_email_id: null,

      message_id: null,

      reply_to_address:
        replyToAddress,

      to_email: toEmail,

      from_email:
        config.fromEmail,

      subject:
        rendered.subject,

      status: "queued",

      scheduled_at:
        new Date().toISOString(),

      sent_at: null,

      delivered_at: null,

      bounced_at: null,

      complained_at: null,

      failed_at: null,

      error_message: null,

      updated_at:
        new Date().toISOString(),
    })
    .select("id")
    .single();

  if (sendLogError || !sendRecord) {
    throw new Error(
      `Could not create email send record: ${
        sendLogError?.message ||
        "Unknown error"
      }`
    );
  }

  const sendId = sendRecord.id;

  try {
    const {
      error: sendingStatusError,
    } = await supabase
      .from("email_sends")
      .update({
        status: "sending",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", sendId);

    if (sendingStatusError) {
      throw new Error(
        `Could not mark email as sending: ${sendingStatusError.message}`
      );
    }

    const resend =
      getResendClient();

    const idempotencyKey =
      options.enrollmentId &&
      options.sequenceStepId
        ? `sequence/${options.enrollmentId}/${options.sequenceStepId}`
        : `send/${sendId}`;

    const {
      data,
      error: resendError,
    } = await resend.emails.send(
      {
        from: config.fromEmail,

        to: [toEmail],

        replyTo:
          replyToAddress,

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
            name: "lead_id",
            value: lead.id,
          },
          {
            name: "send_id",
            value: sendId,
          },
        ],
      },
      {
        idempotencyKey,
      }
    );

    if (resendError) {
      throw new Error(
        resendError.message
      );
    }

    if (!data?.id) {
      throw new Error(
        "Resend did not return an email ID."
      );
    }

    const now =
      new Date().toISOString();

    const {
      error: sentUpdateError,
    } = await supabase
      .from("email_sends")
      .update({
        resend_email_id:
          data.id,

        status: "sent",

        sent_at: now,

        failed_at: null,

        error_message: null,

        updated_at: now,
      })
      .eq("id", sendId);

    if (sentUpdateError) {
      console.error(
        "Email sent but SlateLane could not update email_sends:",
        sentUpdateError.message
      );
    }

    const {
      error: leadUpdateError,
    } = await supabase
      .from("leads")
      .update({
        last_email_sent_at:
          now,

        updated_at: now,
      })
      .eq("id", lead.id);

    if (leadUpdateError) {
      console.error(
        "Could not update lead last_email_sent_at:",
        leadUpdateError.message
      );
    }

    return {
      sendId,

      resendEmailId:
        data.id,

      replyToAddress,

      alreadySent: false,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown email send error.";

    console.error(
      `Email send failed for ${toEmail}:`,
      message
    );

    const now =
      new Date().toISOString();

    const {
      error: failureLogError,
    } = await supabase
      .from("email_sends")
      .update({
        status: "failed",

        failed_at: now,

        error_message:
          message,

        updated_at: now,
      })
      .eq("id", sendId);

    if (failureLogError) {
      console.error(
        "Could not save failed email status:",
        failureLogError.message
      );
    }

    throw error;
  }
}