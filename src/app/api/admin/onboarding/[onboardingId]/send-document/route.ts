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

type SendableDocument =
  | "dispatch_agreement"
  | "carrier_packet";

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

function jsonResponse(
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

function isSendableDocument(
  value: string,
): value is SendableDocument {
  return (
    value === "dispatch_agreement" ||
    value === "carrier_packet"
  );
}

function getDocumentConfig(
  documentType: SendableDocument,
) {
  if (documentType === "carrier_packet") {
    return {
      documentType:
        "carrier_packet" as const,

      title:
        "Carrier Credential Packet",

      emailSubject:
        "Carrier Credential Packet",

      buttonText:
        "Complete Carrier Packet",

      routePrefix:
        "/carrier/onboarding/packet",

      description:
        "Complete your carrier credential packet directly in your browser.",

      introduction:
        "Slate Lane Dispatch needs your carrier credential information to complete onboarding and prepare your broker packet.",

      instructions: [
        "Review and complete your carrier and authority information.",
        "Enter your contact, insurance, factoring, operating and dispatch preference details.",
        "Review your information for accuracy.",
        "Submit the secure form.",
        "Slate Lane will automatically generate your completed Carrier Credential Packet PDF and save it to your private Document Vault.",
      ],

      successMessage:
        "Carrier Credential Packet sent successfully.",

      metadataType:
        "carrier_credential_packet",
    };
  }

  return {
    documentType:
      "dispatch_agreement" as const,

    title:
      "Carrier-Dispatcher Agreement",

    emailSubject:
      "Carrier-Dispatcher Agreement",

    buttonText:
      "Complete & Sign Agreement",

    routePrefix:
      "/carrier/onboarding",

    description:
      "Complete and electronically sign your Carrier-Dispatcher Agreement directly in your browser.",

    introduction:
      "Your secure Slate Lane Dispatch Carrier-Dispatcher Agreement is ready for review and electronic signature.",

    instructions: [
      "Review your carrier information and dispatch terms.",
      "Review the agreement.",
      "Enter your authorized signer information.",
      "Type your electronic signature.",
      "Submit the secure form.",
      "Slate Lane will automatically create the signed PDF and store it in your private Document Vault.",
    ],

    successMessage:
      "Carrier-Dispatcher Agreement sent successfully.",

    metadataType:
      "carrier_dispatcher_agreement",
  };
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { onboardingId } =
      await context.params;

    if (!onboardingId) {
      return jsonResponse(
        {
          success: false,
          message:
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
    |--------------------------------------------------------------------------
    | DOCUMENT TYPE
    |--------------------------------------------------------------------------
    |
    | The admin Document Vault sends:
    |
    | {
    |   documentType: "dispatch_agreement"
    | }
    |
    | or:
    |
    | {
    |   documentType: "carrier_packet"
    | }
    |
    */

    const requestedDocumentType =
      clean(
        body.documentType ||
          body.document_type,
        50,
      );

    if (
      !isSendableDocument(
        requestedDocumentType,
      )
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Invalid document type. Only Carrier-Dispatcher Agreement and Carrier Credential Packet can be sent from this endpoint.",
        },
        400,
      );
    }

    const config =
      getDocumentConfig(
        requestedDocumentType,
      );

    /*
    |--------------------------------------------------------------------------
    | LOAD ONBOARDING
    |--------------------------------------------------------------------------
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
        "Unable to load onboarding:",
        onboardingError,
      );

      return jsonResponse(
        {
          success: false,
          message:
            "Unable to load carrier onboarding.",
        },
        500,
      );
    }

    if (!onboarding) {
      return jsonResponse(
        {
          success: false,
          message:
            "Carrier onboarding was not found.",
        },
        404,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | RECIPIENT
    |--------------------------------------------------------------------------
    */

    const recipientEmail =
      clean(
        body.email ||
          body.recipientEmail ||
          body.recipient_email ||
          onboarding.primary_contact_email,
        320,
      ).toLowerCase();

    if (
      !recipientEmail ||
      !validEmail(recipientEmail)
    ) {
      return jsonResponse(
        {
          success: false,
          message:
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

    const now =
      new Date();

    /*
    |--------------------------------------------------------------------------
    | REVOKE OLD ACTIVE LINK FOR SAME DOCUMENT
    |--------------------------------------------------------------------------
    |
    | When Resend is clicked we do not want multiple valid secure links for
    | the same document.
    */

    const {
      data: oldActiveLinks,
      error: oldLinkQueryError,
    } = await supabase
      .from(
        "carrier_onboarding_links",
      )
      .select("id")
      .eq(
        "onboarding_id",
        onboarding.id,
      )
      .eq(
        "document_type",
        config.documentType,
      )
      .eq("status", "active");

    if (oldLinkQueryError) {
      console.error(
        "Unable to inspect previous secure links:",
        oldLinkQueryError,
      );
    }

    if (
      oldActiveLinks &&
      oldActiveLinks.length > 0
    ) {
      const ids =
        oldActiveLinks.map(
          (item) => item.id,
        );

      const {
        error: revokeError,
      } = await supabase
        .from(
          "carrier_onboarding_links",
        )
        .update({
          status: "revoked",
          revoked_at:
            now.toISOString(),
          updated_at:
            now.toISOString(),
        })
        .in("id", ids);

      if (revokeError) {
        console.error(
          "Unable to revoke old secure links:",
          revokeError,
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | CREATE SECURE TOKEN
    |--------------------------------------------------------------------------
    */

    const rawToken =
      randomBytes(32).toString(
        "hex",
      );

    const tokenHash =
      sha256(rawToken);

    const expiresAt =
      new Date(
        now.getTime() +
          7 *
            24 *
            60 *
            60 *
            1000,
      );

    const appUrl =
      getAppUrl();

    /*
    |--------------------------------------------------------------------------
    | DIFFERENT FORM URL FOR EACH DOCUMENT
    |--------------------------------------------------------------------------
    |
    | Agreement:
    |
    | /carrier/onboarding/TOKEN
    |
    | Carrier Packet:
    |
    | /carrier/onboarding/packet/TOKEN
    |
    */

    const onboardingUrl =
      `${appUrl}${config.routePrefix}/${encodeURIComponent(
        rawToken,
      )}`;

    /*
    |--------------------------------------------------------------------------
    | CREATE SENT DOCUMENT RECORD
    |--------------------------------------------------------------------------
    */

    const {
      data: sentDocument,
      error: documentError,
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
          config.documentType,

        status:
          "sent",

        sent_to_email:
          recipientEmail,

        sent_at:
          now.toISOString(),

        metadata: {
          delivery:
            "secure_browser_form",

          document_kind:
            config.metadataType,

          browser_fillable:
            true,

          automatic_pdf_generation:
            true,

          link_version: 2,

          production_origin:
            appUrl,
        },

        updated_at:
          now.toISOString(),
      })
      .select("*")
      .single();

    if (
      documentError ||
      !sentDocument
    ) {
      console.error(
        "Unable to create outgoing document record:",
        documentError,
      );

      return jsonResponse(
        {
          success: false,
          message:
            `Unable to prepare ${config.title}.`,
        },
        500,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | CREATE SECURE LINK
    |--------------------------------------------------------------------------
    */

    const {
      data: secureLink,
      error: linkError,
    } = await supabase
      .from(
        "carrier_onboarding_links",
      )
      .insert({
        onboarding_id:
          onboarding.id,

        document_type:
          config.documentType,

        token_hash:
          tokenHash,

        recipient_email:
          recipientEmail,

        status:
          "active",

        expires_at:
          expiresAt.toISOString(),

        sent_document_id:
          sentDocument.id,

        metadata: {
          delivery:
            "secure_browser_form",

          document_kind:
            config.metadataType,

          link_version: 2,

          production_origin:
            appUrl,

          browser_route:
            config.routePrefix,
        },

        updated_at:
          now.toISOString(),
      })
      .select("*")
      .single();

    if (
      linkError ||
      !secureLink
    ) {
      console.error(
        "Unable to create secure document link:",
        linkError,
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

      return jsonResponse(
        {
          success: false,
          message:
            `Unable to create secure ${config.title} link.`,
        },
        500,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | EMAIL
    |--------------------------------------------------------------------------
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

    const safeTitle =
      escapeHtml(config.title);

    const expirationText =
      expiresAt.toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        },
      );

    const instructionHtml =
      config.instructions
        .map(
          (instruction, index) =>
            `${index + 1}. ${escapeHtml(
              instruction,
            )}`,
        )
        .join("<br />");

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
    style="
      background:#f4f6f8;
      padding:32px 12px;
    "
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
                ${safeTitle}
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

              <p style="margin:0 0 18px;">
                Hi ${safeContact},
              </p>

              <p style="margin:0 0 18px;">
                ${escapeHtml(
                  config.introduction,
                )}
              </p>

              <p style="margin:0 0 22px;">
                Carrier:
                <strong>
                  ${safeCompany}
                </strong>
              </p>

              <p style="margin:0 0 22px;">
                ${escapeHtml(
                  config.description,
                )}
                No PDF editor or special
                application is required.
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
                      ${escapeHtml(
                        config.buttonText,
                      )}
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
                  ${instructionHtml}
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
                <strong>
                  ${escapeHtml(
                    expirationText,
                  )}
                </strong>.
              </p>

              <p
                style="
                  margin:12px 0 0;
                  color:#64748b;
                  font-size:13px;
                  line-height:20px;
                "
              >
                For security, please do not
                forward this private onboarding
                link.
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
      `${config.emailSubject} — ${companyName}`;

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
        "Resend error:",
        resendError,
      );

      /*
       * Remove newly-created records because the email
       * never reached the carrier.
       */

      await supabase
        .from(
          "carrier_onboarding_links",
        )
        .delete()
        .eq(
          "id",
          secureLink.id,
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

      return jsonResponse(
        {
          success: false,
          message:
            `${config.title} was prepared but the email could not be sent.`,
        },
        500,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE DOCUMENT METADATA
    |--------------------------------------------------------------------------
    */

    await supabase
      .from(
        "carrier_document_records",
      )
      .update({
        metadata: {
          ...(sentDocument.metadata ||
            {}),

          resend_email_id:
            resendData?.id ||
            null,

          secure_link_id:
            secureLink.id,

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
    |--------------------------------------------------------------------------
    | AGREEMENT-SPECIFIC STATUS
    |--------------------------------------------------------------------------
    |
    | Carrier Packet must NOT change agreement_status.
    */

    if (
      config.documentType ===
      "dispatch_agreement"
    ) {
      const {
        error:
          agreementUpdateError,
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
        agreementUpdateError
      ) {
        console.error(
          "Unable to update agreement status:",
          agreementUpdateError,
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | AUDIT EVENT
    |--------------------------------------------------------------------------
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

        from_status:
          null,

        to_status:
          "sent",

        actor:
          "admin",

        note:
          `${config.title} sent to ${recipientEmail}`,

        metadata: {
          document_type:
            config.documentType,

          delivery:
            "secure_browser_form",

          recipient_email:
            recipientEmail,

          secure_link_id:
            secureLink.id,

          resend_email_id:
            resendData?.id ||
            null,

          expires_at:
            expiresAt.toISOString(),

          production_origin:
            appUrl,

          browser_route:
            config.routePrefix,
        },
      });

    if (eventError) {
      console.error(
        "Unable to create document audit event:",
        eventError,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | SUCCESS
    |--------------------------------------------------------------------------
    */

    return jsonResponse({
      success: true,

      message:
        config.successMessage,

      documentType:
        config.documentType,

      recipientEmail,

      sentDocumentId:
        sentDocument.id,

      secureLinkId:
        secureLink.id,

      expiresAt:
        expiresAt.toISOString(),

      emailId:
        resendData?.id ||
        null,
    });
  } catch (error) {
    console.error(
      "Send onboarding document error:",
      error,
    );

    return jsonResponse(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Unable to send onboarding document.",
      },
      500,
    );
  }
}