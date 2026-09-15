import {
  createHash,
  randomBytes,
} from "crypto";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  NextResponse,
} from "next/server";

import {
  Resend,
} from "resend";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "Missing Supabase URL.",
    );
  }

  if (!key) {
    throw new Error(
      "Missing Supabase server key.",
    );
  }

  return createClient(
    url,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function getResend() {
  const key =
    process.env.RESEND_API_KEY;

  if (!key) {
    throw new Error(
      "Missing RESEND_API_KEY.",
    );
  }

  return new Resend(
    key,
  );
}

function getAppUrl() {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://www.slatelanedispatch.com"
  ).replace(
    /\/$/,
    "",
  );
}

function hashToken(
  value: string,
) {
  return createHash(
    "sha256",
  )
    .update(value)
    .digest("hex");
}

function clean(
  value: unknown,
  max = 500,
) {
  return String(
    value ?? "",
  )
    .trim()
    .slice(
      0,
      max,
    );
}

function validEmail(
  value: string,
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function escapeHtml(
  value: unknown,
) {
  return String(
    value ?? "",
  )
    .replace(
      /&/g,
      "&amp;",
    )
    .replace(
      /</g,
      "&lt;",
    )
    .replace(
      />/g,
      "&gt;",
    )
    .replace(
      /"/g,
      "&quot;",
    )
    .replace(
      /'/g,
      "&#039;",
    );
}

function response(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    },
  );
}

export async function POST(
  _request: Request,
  context: RouteContext,
) {
  try {
    const {
      token,
    } =
      await context.params;

    if (
      !token ||
      token.length < 20
    ) {
      return response(
        {
          ok: false,
          error:
            "Invalid agreement token.",
        },
        404,
      );
    }

    const supabase =
      getSupabaseAdmin();

    /*
    |--------------------------------------------------------------------------
    | VERIFY AGREEMENT TOKEN
    |--------------------------------------------------------------------------
    */

    const tokenHash =
      hashToken(
        token,
      );

    const {
      data:
        agreementLink,

      error:
        agreementLinkError,
    } = await supabase
      .from(
        "carrier_onboarding_links",
      )
      .select("*")
      .eq(
        "token_hash",
        tokenHash,
      )
      .eq(
        "document_type",
        "dispatch_agreement",
      )
      .maybeSingle();

    if (
      agreementLinkError
    ) {
      console.error(
        "NEXT STEP AGREEMENT LINK ERROR:",
        agreementLinkError,
      );

      return response(
        {
          ok: false,
          error:
            "Unable to verify the completed agreement.",
        },
        500,
      );
    }

    if (
      !agreementLink
    ) {
      return response(
        {
          ok: false,
          error:
            "Agreement link was not found.",
        },
        404,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | AGREEMENT MUST BE COMPLETED
    |--------------------------------------------------------------------------
    */

    if (
      agreementLink.status !==
      "completed"
    ) {
      return response(
        {
          ok: false,
          error:
            "Complete the Carrier-Dispatcher Agreement before continuing to the Carrier Packet.",
        },
        409,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | LOAD ONBOARDING
    |--------------------------------------------------------------------------
    */

    const {
      data:
        onboarding,

      error:
        onboardingError,
    } = await supabase
      .from(
        "carrier_onboardings",
      )
      .select("*")
      .eq(
        "id",
        agreementLink.onboarding_id,
      )
      .maybeSingle();

    if (
      onboardingError
    ) {
      console.error(
        "NEXT STEP ONBOARDING ERROR:",
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

    if (
      !onboarding
    ) {
      return response(
        {
          ok: false,
          error:
            "Carrier onboarding was not found.",
        },
        404,
      );
    }

    if (
      onboarding.agreement_status !==
      "signed"
    ) {
      return response(
        {
          ok: false,
          error:
            "The agreement has not been recorded as signed.",
        },
        409,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | CHECK WHETHER PACKET IS ALREADY COMPLETE
    |--------------------------------------------------------------------------
    */

    const {
      data:
        completedPacket,

      error:
        completedPacketError,
    } = await supabase
      .from(
        "carrier_document_records",
      )
      .select(`
        id,
        status
      `)
      .eq(
        "onboarding_id",
        onboarding.id,
      )
      .eq(
        "document_type",
        "carrier_packet",
      )
      .in(
        "status",
        [
          "received",
          "signed",
          "approved",
        ],
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        },
      )
      .limit(1)
      .maybeSingle();

    if (
      completedPacketError
    ) {
      console.error(
        "COMPLETED PACKET LOOKUP ERROR:",
        completedPacketError,
      );
    }

    if (
      completedPacket
    ) {
      return response({
        ok: true,

        packet_ready:
          true,

        carrier_packet_sent:
          false,

        message:
          "Carrier Credential Packet is already complete.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CHECK EXISTING ACTIVE PACKET LINK
    |--------------------------------------------------------------------------
    */

    const {
      data:
        activePacketLink,

      error:
        activePacketError,
    } = await supabase
      .from(
        "carrier_onboarding_links",
      )
      .select(`
        id,
        expires_at
      `)
      .eq(
        "onboarding_id",
        onboarding.id,
      )
      .eq(
        "document_type",
        "carrier_packet",
      )
      .eq(
        "status",
        "active",
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        },
      )
      .limit(1)
      .maybeSingle();

    if (
      activePacketError
    ) {
      console.error(
        "ACTIVE PACKET LOOKUP ERROR:",
        activePacketError,
      );
    }

    if (
      activePacketLink
    ) {
      return response({
        ok: true,

        packet_ready:
          false,

        carrier_packet_sent:
          true,

        already_sent:
          true,

        expires_at:
          activePacketLink.expires_at,

        message:
          "Carrier Credential Packet has already been sent. Check the carrier email for the secure link.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | RECIPIENT
    |--------------------------------------------------------------------------
    */

    const recipientEmail =
      clean(
        agreementLink.recipient_email ||
          onboarding.primary_contact_email,
        320,
      ).toLowerCase();

    if (
      !recipientEmail ||
      !validEmail(
        recipientEmail,
      )
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
    |--------------------------------------------------------------------------
    | CREATE NEW SECURE PACKET TOKEN
    |--------------------------------------------------------------------------
    */

    const now =
      new Date();

    const rawPacketToken =
      randomBytes(
        32,
      ).toString(
        "hex",
      );

    const packetTokenHash =
      hashToken(
        rawPacketToken,
      );

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

    const carrierPacketUrl =
      `${appUrl}/carrier/onboarding/packet/${encodeURIComponent(
        rawPacketToken,
      )}`;

    /*
    |--------------------------------------------------------------------------
    | CREATE SENT DOCUMENT RECORD
    |--------------------------------------------------------------------------
    */

    const {
      data:
        sentDocument,

      error:
        sentDocumentError,
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
          "carrier_packet",

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
            "carrier_credential_packet",

          browser_fillable:
            true,

          automatic_pdf_generation:
            true,

          automatic_next_step:
            true,

          triggered_by:
            "dispatch_agreement_signed",

          link_version:
            3,

          production_origin:
            appUrl,
        },

        updated_at:
          now.toISOString(),
      })
      .select("*")
      .single();

    if (
      sentDocumentError ||
      !sentDocument
    ) {
      console.error(
        "AUTO PACKET DOCUMENT ERROR:",
        sentDocumentError,
      );

      return response(
        {
          ok: false,
          error:
            "Unable to prepare the Carrier Credential Packet.",
        },
        500,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | CREATE SECURE PACKET LINK
    |--------------------------------------------------------------------------
    */

    const {
      data:
        packetLink,

      error:
        packetLinkError,
    } = await supabase
      .from(
        "carrier_onboarding_links",
      )
      .insert({
        onboarding_id:
          onboarding.id,

        document_type:
          "carrier_packet",

        token_hash:
          packetTokenHash,

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
            "carrier_credential_packet",

          automatic_next_step:
            true,

          triggered_by:
            "dispatch_agreement_signed",

          link_version:
            3,

          production_origin:
            appUrl,

          browser_route:
            "/carrier/onboarding/packet",
        },

        updated_at:
          now.toISOString(),
      })
      .select("*")
      .single();

    if (
      packetLinkError ||
      !packetLink
    ) {
      console.error(
        "AUTO PACKET LINK ERROR:",
        packetLinkError,
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
            "Unable to create the secure Carrier Packet link.",
        },
        500,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | SEND EMAIL
    |--------------------------------------------------------------------------
    */

    const resend =
      getResend();

    const fromEmail =
      process.env.RESEND_FROM_EMAIL ||
      process.env.EMAIL_FROM ||
      process.env.FROM_EMAIL ||
      "SlateLane Dispatch <contact@slatelanedispatch.com>";

    const expirationText =
      expiresAt.toLocaleDateString(
        "en-US",
        {
          year:
            "numeric",

          month:
            "long",

          day:
            "numeric",
        },
      );

    const safeCompany =
      escapeHtml(
        companyName,
      );

    const safeContact =
      escapeHtml(
        contactName,
      );

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
                Next Step: Carrier Credential Packet
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
                Your Carrier-Dispatcher Agreement
                for
                <strong>${safeCompany}</strong>
                has been completed successfully.
              </p>

              <p style="margin:0 0 22px;">
                The next step is your Carrier
                Credential Packet. You can complete
                it directly from your phone or
                browser.
              </p>

              <table
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="margin:28px 0;"
              >
                <tr>
                  <td
                    bgcolor="#0f172a"
                    style="
                      border-radius:10px;
                    "
                  >
                    <a
                      href="${carrierPacketUrl}"
                      style="
                        display:inline-block;
                        padding:15px 24px;
                        color:#ffffff;
                        text-decoration:none;
                        font-size:14px;
                        font-weight:700;
                      "
                    >
                      Complete Carrier Packet
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
                  What you will provide
                </strong>

                <div
                  style="
                    margin-top:8px;
                    color:#64748b;
                    font-size:14px;
                    line-height:22px;
                  "
                >
                  Carrier contact information,
                  fleet and equipment details,
                  preferred lanes, dispatch
                  preferences, insurance and
                  factoring information.
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
                Please do not forward this private
                onboarding link.
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

    const {
      data:
        emailData,

      error:
        emailError,
    } =
      await resend.emails.send({
        from:
          fromEmail,

        to: [
          recipientEmail,
        ],

        subject:
          `Next Step: Carrier Credential Packet — ${companyName}`,

        html:
          emailHtml,
      });

    /*
    |--------------------------------------------------------------------------
    | EMAIL FAILURE CLEANUP
    |--------------------------------------------------------------------------
    */

    if (
      emailError
    ) {
      console.error(
        "AUTO PACKET EMAIL ERROR:",
        emailError,
      );

      await supabase
        .from(
          "carrier_onboarding_links",
        )
        .delete()
        .eq(
          "id",
          packetLink.id,
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
            "Agreement is complete, but the Carrier Packet email could not be sent automatically.",
        },
        500,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | SAVE DELIVERY METADATA
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
            emailData?.id ||
            null,

          secure_link_id:
            packetLink.id,

          automatic_next_step:
            true,

          production_origin:
            appUrl,
        },

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        sentDocument.id,
      );

    /*
    |--------------------------------------------------------------------------
    | AUDIT EVENT
    |--------------------------------------------------------------------------
    */

    const {
      error:
        eventError,
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
          "system",

        note:
          `Carrier Credential Packet automatically sent after signed agreement to ${recipientEmail}`,

        metadata: {
          automatic_next_step:
            true,

          triggered_by:
            "dispatch_agreement_signed",

          recipient_email:
            recipientEmail,

          secure_link_id:
            packetLink.id,

          resend_email_id:
            emailData?.id ||
            null,

          expires_at:
            expiresAt.toISOString(),

          production_origin:
            appUrl,
        },
      });

    if (
      eventError
    ) {
      console.error(
        "AUTO PACKET EVENT ERROR:",
        eventError,
      );
    }

    return response({
      ok: true,

      packet_ready:
        false,

      carrier_packet_sent:
        true,

      carrier_packet_url:
        carrierPacketUrl,

      expires_at:
        expiresAt.toISOString(),

      message:
        "Carrier Credential Packet has been emailed automatically and is ready to continue.",
    });
  } catch (
    error
  ) {
    console.error(
      "AUTO NEXT STEP ERROR:",
      error,
    );

    return response(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to prepare the next onboarding step.",
      },
      500,
    );
  }
}