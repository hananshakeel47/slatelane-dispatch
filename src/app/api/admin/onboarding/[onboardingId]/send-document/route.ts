import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    onboardingId: string;
  }>;
};

function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL",
    );
  }

  if (!supabaseKey) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function getResend() {
  const apiKey =
    process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing RESEND_API_KEY",
    );
  }

  return new Resend(apiKey);
}

function getAppUrl() {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://www.slatelanedispatch.com"
  ).replace(/\/$/, "");
}

function sha256(value: string) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function clean(
  value: unknown,
  max = 500,
) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function response(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
    },
  });
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { onboardingId } =
      await context.params;

    if (!onboardingId) {
      return response(
        {
          ok: false,
          error:
            "Missing onboarding ID.",
        },
        400,
      );
    }

    const supabase =
      getSupabaseAdmin();

    const resend =
      getResend();

    let body: Record<
      string,
      unknown
    > = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }

    /*
     * Load onboarding
     */
    const {
      data: onboarding,
      error: onboardingError,
    } = await supabase
      .from("carrier_onboardings")
      .select("*")
      .eq("id", onboardingId)
      .maybeSingle();

    if (onboardingError) {
      console.error(
        "Failed to load onboarding:",
        onboardingError,
      );

      return response(
        {
          ok: false,
          error:
            "Unable to load carrier onboarding.",
        },
        500,
      );
    }

    if (!onboarding) {
      return response(
        {
          ok: false,
          error:
            "Carrier onboarding was not found.",
        },
        404,
      );
    }

    /*
     * Recipient
     *
     * Allows your admin UI to provide
     * recipientEmail, but defaults to
     * the primary carrier email.
     */
    const recipientEmail =
      clean(
        body.recipientEmail ||
          body.recipient_email ||
          onboarding.primary_contact_email,
        320,
      );

    if (
      !recipientEmail ||
      !validEmail(recipientEmail)
    ) {
      return response(
        {
          ok: false,
          error:
            "Carrier does not have a valid email address.",
        },
        400,
      );
    }

    const companyName =
      clean(
        onboarding.company_name ||
          "Carrier",
        300,
      );

    const contactName =
      clean(
        onboarding.primary_contact_name ||
          "Carrier",
        200,
      );

    /*
     * Generate secure raw token.
     *
     * IMPORTANT:
     * Only the HASH is stored in Supabase.
     * The raw token only exists in the
     * carrier's email URL.
     */
    const rawToken =
      randomBytes(32).toString(
        "hex",
      );

    const tokenHash =
      sha256(rawToken);

    /*
     * Link expires in 7 days.
     */
    const now =
      new Date();

    const expiresAt =
      new Date(
        now.getTime() +
          7 *
            24 *
            60 *
            60 *
            1000,
      );

    /*
     * THIS is the permanent localhost fix.
     *
     * We deliberately do NOT use:
     *
     * request.nextUrl.origin
     *
     * because sending from your local
     * development CRM would produce
     * http://localhost:3000.
     */
    const appUrl =
      getAppUrl();

    const onboardingUrl =
      `${appUrl}/carrier/onboarding/${encodeURIComponent(
        rawToken,
      )}`;

    /*
     * Create outgoing document record first.
     *
     * There is no PDF yet because the carrier
     * will complete the browser form first.
     * The final PDF is generated when signed.
     */
    const {
      data: sentDocument,
      error: sentDocumentError,
    } = await supabase
      .from(
        "carrier_document_records",
      )
      .insert({
        onboarding_id:
          onboarding.id,

        carrier_id:
          onboarding.carrier_id ||
          null,

        document_type:
          "dispatch_agreement",

        status:
          "sent",

        sent_to_email:
          recipientEmail,

        sent_at:
          now.toISOString(),

        metadata: {
          delivery:
            "secure_browser_form",

          agreement_type:
            "carrier_dispatcher_agreement",

          link_version: 1,

          browser_fillable: true,

          automatic_pdf_generation:
            true,
        },

        updated_at:
          now.toISOString(),
      })
      .select("*")
      .single();

    if (sentDocumentError) {
      console.error(
        "Failed to create sent document:",
        sentDocumentError,
      );

      return response(
        {
          ok: false,
          error:
            "Unable to prepare carrier agreement.",
        },
        500,
      );
    }

    /*
     * Create secure onboarding link.
     */
    const {
      data: onboardingLink,
      error: linkError,
    } = await supabase
      .from(
        "carrier_onboarding_links",
      )
      .insert({
        onboarding_id:
          onboarding.id,

        document_type:
          "dispatch_agreement",

        recipient_email:
          recipientEmail,

        token_hash:
          tokenHash,

        status:
          "active",

        expires_at:
          expiresAt.toISOString(),

        sent_document_id:
          sentDocument.id,

        metadata: {
          delivery:
            "secure_browser_form",

          link_version: 1,

          production_origin:
            appUrl,
        },

        updated_at:
          now.toISOString(),
      })
      .select("*")
      .single();

    if (linkError) {
      console.error(
        "Failed to create onboarding link:",
        linkError,
      );

      /*
       * Clean up sent record if secure
       * link creation failed.
       */
      await supabase
        .from(
          "carrier_document_records",
        )
        .delete()
        .eq(
          "id",
          sentDocument.id,
        );

      return response(
        {
          ok: false,
          error:
            "Unable to create secure onboarding link.",
        },
        500,
      );
    }

    /*
     * Email sender.
     */
    const fromEmail =
      process.env.RESEND_FROM_EMAIL ||
      process.env.EMAIL_FROM ||
      process.env.FROM_EMAIL ||
      "SlateLane Dispatch <contact@slatelanedispatch.com>";

    const safeCompany =
      escapeHtml(companyName);

    const safeContact =
      escapeHtml(contactName);

    const expirationText =
      expiresAt.toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        },
      );

    /*
     * Browser-fillable carrier agreement
     * email.
     */
    const emailHtml = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f4f6f8;
    font-family:Arial,Helvetica,sans-serif;
    color:#111827;
  "
>
  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="background:#f4f6f8;padding:32px 12px;"
  >
    <tr>
      <td align="center">

        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            max-width:620px;
            background:#ffffff;
            border-radius:16px;
            overflow:hidden;
            border:1px solid #e5e7eb;
          "
        >

          <tr>
            <td
              style="
                padding:28px 32px;
                background:#0f172a;
                color:#ffffff;
              "
            >
              <div
                style="
                  font-size:12px;
                  letter-spacing:2px;
                  text-transform:uppercase;
                  color:#94a3b8;
                  font-weight:700;
                "
              >
                Slate Lane Dispatch
              </div>

              <div
                style="
                  margin-top:8px;
                  font-size:24px;
                  line-height:32px;
                  font-weight:700;
                "
              >
                Carrier-Dispatcher Agreement
              </div>
            </td>
          </tr>

          <tr>
            <td
              style="
                padding:32px;
                font-size:15px;
                line-height:24px;
                color:#374151;
              "
            >

              <p
                style="
                  margin:0 0 18px;
                "
              >
                Hi ${safeContact},
              </p>

              <p
                style="
                  margin:0 0 18px;
                "
              >
                Your secure Slate Lane Dispatch
                carrier onboarding agreement for
                <strong>${safeCompany}</strong>
                is ready.
              </p>

              <p
                style="
                  margin:0 0 22px;
                "
              >
                You can complete and electronically
                sign the agreement directly in your
                browser. No PDF editor, special
                application, or document download is
                required.
              </p>

              <table
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="margin:28px 0;"
              >
                <tr>
                  <td
                    align="center"
                    bgcolor="#0f172a"
                    style="
                      border-radius:10px;
                    "
                  >
                    <a
                      href="${onboardingUrl}"
                      style="
                        display:inline-block;
                        padding:15px 24px;
                        color:#ffffff;
                        text-decoration:none;
                        font-size:14px;
                        font-weight:700;
                      "
                    >
                      Complete &amp; Sign Agreement
                    </a>
                  </td>
                </tr>
              </table>

              <div
                style="
                  background:#f8fafc;
                  border:1px solid #e2e8f0;
                  border-radius:12px;
                  padding:16px;
                  margin:24px 0;
                "
              >
                <strong
                  style="
                    color:#0f172a;
                  "
                >
                  What happens next?
                </strong>

                <div
                  style="
                    margin-top:8px;
                    color:#64748b;
                    font-size:14px;
                    line-height:22px;
                  "
                >
                  1. Review your carrier information
                  and dispatch terms.<br />
                  2. Type your authorized electronic
                  signature.<br />
                  3. Submit the secure form.<br />
                  4. Slate Lane automatically creates
                  the signed PDF and stores it in your
                  carrier Document Vault.
                </div>
              </div>

              <p
                style="
                  margin:20px 0 0;
                  color:#64748b;
                  font-size:13px;
                  line-height:20px;
                "
              >
                This secure link expires on
                <strong>${escapeHtml(
                  expirationText,
                )}</strong>.
              </p>

              <p
                style="
                  margin:12px 0 0;
                  color:#64748b;
                  font-size:13px;
                  line-height:20px;
                "
              >
                For security, please do not forward
                this onboarding link to another
                person.
              </p>

            </td>
          </tr>

          <tr>
            <td
              style="
                padding:22px 32px;
                background:#f8fafc;
                border-top:1px solid #e5e7eb;
                color:#94a3b8;
                font-size:12px;
                line-height:18px;
              "
            >
              Slate Lane Dispatch<br />
              Secure Carrier Onboarding
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`;

    const subject =
      `Carrier-Dispatcher Agreement — ${companyName}`;

    /*
     * Send with Resend.
     */
    const {
      data: resendData,
      error: resendError,
    } = await resend.emails.send({
      from:
        fromEmail,

      to: [
        recipientEmail,
      ],

      subject,

      html:
        emailHtml,
    });

    if (resendError) {
      console.error(
        "Resend email error:",
        resendError,
      );

      /*
       * Remove secure link so a failed
       * email does not leave an unused
       * active token behind.
       */
      await supabase
        .from(
          "carrier_onboarding_links",
        )
        .delete()
        .eq(
          "id",
          onboardingLink.id,
        );

      await supabase
        .from(
          "carrier_document_records",
        )
        .delete()
        .eq(
          "id",
          sentDocument.id,
        );

      return response(
        {
          ok: false,
          error:
            "The agreement was prepared, but the email could not be sent.",
        },
        500,
      );
    }

    /*
     * Store provider ID in document metadata.
     */
    await supabase
      .from(
        "carrier_document_records",
      )
      .update({
        metadata: {
          ...(sentDocument.metadata ||
            {}),

          delivery:
            "secure_browser_form",

          resend_email_id:
            resendData?.id ||
            null,

          production_origin:
            appUrl,
        },

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        sentDocument.id,
      );

    /*
     * Mark agreement as sent.
     */
    const {
      error: onboardingUpdateError,
    } = await supabase
      .from(
        "carrier_onboardings",
      )
      .update({
        agreement_status:
          "sent",

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        onboarding.id,
      );

    if (
      onboardingUpdateError
    ) {
      console.error(
        "Failed updating onboarding agreement status:",
        onboardingUpdateError,
      );
    }

    /*
     * Create audit event.
     */
    const {
      error: eventError,
    } = await supabase
      .from(
        "carrier_document_events",
      )
      .insert({
        onboarding_id:
          onboarding.id,

        document_id:
          sentDocument.id,

        event_type:
          "template_sent",

        to_status:
          "sent",

        actor:
          "admin",

        note:
          `Carrier-Dispatcher Agreement sent to ${recipientEmail}`,

        metadata: {
          delivery:
            "secure_browser_form",

          recipient_email:
            recipientEmail,

          expires_at:
            expiresAt.toISOString(),

          secure_link_id:
            onboardingLink.id,

          resend_email_id:
            resendData?.id ||
            null,

          production_origin:
            appUrl,
        },
      });

    if (eventError) {
      /*
       * Do NOT fail the whole request if
       * only the audit event failed because
       * the actual email has already been
       * successfully sent.
       */
      console.error(
        "Document event error:",
        eventError,
      );
    }

    return response({
      ok: true,

      message:
        `Agreement sent successfully to ${recipientEmail}.`,

      recipient_email:
        recipientEmail,

      expires_at:
        expiresAt.toISOString(),

      document_id:
        sentDocument.id,

      link_id:
        onboardingLink.id,

      email_id:
        resendData?.id ||
        null,
    });
  } catch (error) {
    console.error(
      "Send onboarding document error:",
      error,
    );

    return response(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to send carrier agreement.",
      },
      500,
    );
  }
}