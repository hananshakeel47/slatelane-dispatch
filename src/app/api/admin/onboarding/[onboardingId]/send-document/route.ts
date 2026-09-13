import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  Resend,
} from "resend";

import {
  createSentDocumentRecord,
  getCarrierDocumentVault,
} from "@/lib/documents/vault";

import {
  attachSentDocumentToPublicLink,
  createPublicCarrierLink,
  revokePublicCarrierLink,
  type PublicDocumentType,
} from "@/lib/public-carrier-onboarding";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type RouteContext = {
  params: Promise<{
    onboardingId: string;
  }>;
};

function errorResponse(
  message: string,
  status = 500
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
    }
  );
}

function escapeHtml(
  value: string
) {
  return value
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  let createdLinkId:
    string | null =
    null;

  try {
    const {
      onboardingId,
    } =
      await context.params;

    if (!onboardingId) {
      return errorResponse(
        "Onboarding ID is required.",
        400
      );
    }

    if (
      !process.env
        .RESEND_API_KEY
    ) {
      return errorResponse(
        "RESEND_API_KEY is not configured.",
        500
      );
    }

    const body =
      await request.json();

    const documentType =
      String(
        body.documentType ||
          ""
      ) as PublicDocumentType;

    if (
      ![
        "dispatch_agreement",
        "carrier_packet",
      ].includes(
        documentType
      )
    ) {
      return errorResponse(
        "Invalid document type.",
        400
      );
    }

    const vault =
      await getCarrierDocumentVault(
        onboardingId
      );

    const onboarding =
      vault.onboarding;

    const email =
      String(
        body.email ||
          onboarding.primary_contact_email ||
          ""
      )
        .trim()
        .toLowerCase();

    if (!email) {
      return errorResponse(
        "Carrier does not have an email address.",
        400
      );
    }

    const {
      linkId,
      token,
      expiresAt,
    } =
      await createPublicCarrierLink(
        {
          onboardingId,

          documentType,

          recipientEmail:
            email,
        }
      );

    createdLinkId =
      linkId;

    const secureUrl =
      `${request.nextUrl.origin}/carrier/onboarding/${encodeURIComponent(
        token
      )}`;

    const isAgreement =
      documentType ===
      "dispatch_agreement";

    const title =
      isAgreement
        ? "Carrier-Dispatcher Agreement"
        : "Carrier Credential & Onboarding Packet";

    const action =
      isAgreement
        ? "Complete & Sign Agreement"
        : "Complete Carrier Packet";

    const description =
      isAgreement
        ? "Please review and complete the Slate Lane Carrier-Dispatcher Agreement directly in your browser. No PDF editor or special software is required."
        : "Please complete your Slate Lane carrier profile directly in your browser. No PDF editor or special software is required.";

    const companyName =
      onboarding.company_name ||
      "your company";

    const contactName =
      onboarding.primary_contact_name ||
      "Carrier";

    const resend =
      new Resend(
        process.env
          .RESEND_API_KEY
      );

    const from =
      process.env
        .RESEND_FROM_EMAIL ||
      "Slate Lane Dispatch <dispatch@slatelanedispatch.com>";

    const replyTo =
      process.env
        .RESEND_REPLY_TO ||
      "dispatch@slatelanedispatch.com";

    const result =
      await resend.emails.send(
        {
          from,

          to: [
            email,
          ],

          replyTo,

          subject:
            `${title} — ${companyName}`,

          html: `
<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1e293b">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 16px;background:#f4f6f8">
<tr>
<td align="center">

<table width="100%" cellpadding="0" cellspacing="0" border="0"
style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">

<tr>
<td style="background:#0f172a;padding:26px 32px">
  <div style="color:#ffffff;font-size:21px;font-weight:700">
    Slate Lane Dispatch
  </div>

  <div style="color:#94a3b8;font-size:12px;margin-top:5px">
    Secure Carrier Onboarding
  </div>
</td>
</tr>

<tr>
<td style="padding:32px">

<p style="margin:0 0 18px;font-size:15px;line-height:24px">
  Hello ${escapeHtml(
    contactName
  )},
</p>

<p style="margin:0 0 18px;font-size:15px;line-height:24px">
  ${escapeHtml(
    description
  )}
</p>

<div style="margin:28px 0;text-align:center">

  <a
    href="${secureUrl}"
    style="
      display:inline-block;
      background:#0f172a;
      color:#ffffff;
      text-decoration:none;
      font-size:15px;
      font-weight:700;
      padding:14px 24px;
      border-radius:10px;
    "
  >
    ${escapeHtml(
      action
    )}
  </a>

</div>

<table width="100%" cellpadding="0" cellspacing="0" border="0"
style="margin:24px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">

<tr>
<td style="padding:18px 20px;font-size:13px;line-height:22px;color:#475569">

<strong>What happens next:</strong><br />

1. Open the secure link.<br />
2. Complete the form directly in your browser.<br />
3. Review the information.<br />
4. Type your electronic signature where required.<br />
5. Submit the form.<br />
6. Slate Lane automatically generates the completed PDF.<br />
7. A copy is stored securely for onboarding.

</td>
</tr>

</table>

<p style="margin:0;font-size:13px;line-height:21px;color:#64748b">
  The secure link expires on
  <strong>${new Date(
    expiresAt
  ).toLocaleDateString(
    "en-US"
  )}</strong>.
</p>

<p style="margin:26px 0 0;font-size:15px;line-height:23px">
  Regards,<br />
  <strong>Slate Lane Dispatch</strong><br />
  <span style="color:#64748b">Carrier Operations</span>
</p>

</td>
</tr>

<tr>
<td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;line-height:18px">
  Do not forward this secure onboarding link. It is intended for the carrier recipient only.
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
          `,

          text: `
Hello ${contactName},

${description}

Open your secure Slate Lane onboarding form:

${secureUrl}

No PDF editor or special software is required.

The link expires on ${new Date(
            expiresAt
          ).toLocaleDateString(
            "en-US"
          )}.

Regards,

Slate Lane Dispatch
Carrier Operations
          `.trim(),
        }
      );

    if (
      result.error
    ) {
      await revokePublicCarrierLink(
        linkId
      );

      return errorResponse(
        result.error.message ||
          "Secure onboarding email could not be sent.",
        500
      );
    }

    let sentDocumentId:
      string | null =
      null;

    try {
      const record =
        await createSentDocumentRecord(
          {
            onboardingId,

            documentType,

            email,

            note:
              `${title} secure browser link sent to carrier.`,
          }
        );

      sentDocumentId =
        record.document.id;

      await attachSentDocumentToPublicLink(
        linkId,
        record.document.id
      );
    } catch (
      recordError
    ) {
      console.error(
        "EMAIL SENT BUT DOCUMENT HISTORY RECORD FAILED:",
        recordError
      );
    }

    return NextResponse.json(
      {
        success: true,

        message:
          `${title} secure link sent successfully.`,

        documentType,

        email,

        linkExpiresAt:
          expiresAt,

        sentDocumentId,

        resendId:
          result.data?.id ||
          null,
      }
    );
  } catch (error) {
    if (
      createdLinkId
    ) {
      try {
        await revokePublicCarrierLink(
          createdLinkId
        );
      } catch {
        // Ignore cleanup failure.
      }
    }

    console.error(
      "SECURE ONBOARDING SEND ERROR:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Secure onboarding email could not be sent.",
      500
    );
  }
}