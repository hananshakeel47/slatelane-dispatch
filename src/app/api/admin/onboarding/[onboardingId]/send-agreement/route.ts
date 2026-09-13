import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { Resend } from "resend";

import {
  createSentAgreementRecord,
  getCarrierDocumentVault,
} from "@/lib/documents/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    onboardingId: string;
  }>;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unknown agreement email error.";
}

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { onboardingId } = await context.params;

    if (!onboardingId) {
      return errorResponse(
        "Onboarding ID is required.",
        400
      );
    }

    const apiKey =
      process.env.RESEND_API_KEY;

    if (!apiKey) {
      return errorResponse(
        "RESEND_API_KEY is not configured.",
        500
      );
    }

    let body: {
      email?: string;
    } = {};

    try {
      body = await request.json();
    } catch {
      // Email can fall back to carrier onboarding record.
    }

    /*
    |--------------------------------------------------------------------------
    | LOAD CARRIER
    |--------------------------------------------------------------------------
    */

    const vault =
      await getCarrierDocumentVault(
        onboardingId
      );

    const onboarding =
      vault.onboarding;

    const carrierEmail =
      (
        body.email ||
        onboarding.primary_contact_email ||
        ""
      )
        .trim()
        .toLowerCase();

    if (!carrierEmail) {
      return errorResponse(
        "Carrier does not have an email address.",
        400
      );
    }

    const companyName =
      onboarding.company_name ||
      "your company";

    const contactName =
      onboarding.primary_contact_name ||
      "Carrier";

    /*
    |--------------------------------------------------------------------------
    | READ FILLABLE AGREEMENT PDF
    |--------------------------------------------------------------------------
    */

    const agreementPath =
      path.join(
        process.cwd(),
        "public",
        "documents",
        "SlateLane_Carrier_Dispatcher_Agreement_Fillable.pdf"
      );

    let agreementPdf: Buffer;

    try {
      agreementPdf =
        await readFile(
          agreementPath
        );
    } catch {
      return errorResponse(
        "SlateLane agreement PDF could not be found in public/documents.",
        500
      );
    }

    /*
    |--------------------------------------------------------------------------
    | RESEND
    |--------------------------------------------------------------------------
    */

    const resend =
      new Resend(apiKey);

    const fromEmail =
      process.env.RESEND_FROM_EMAIL ||
      "Slate Lane Dispatch <dispatch@slatelanedispatch.com>";

    const replyTo =
      process.env.RESEND_REPLY_TO ||
      process.env.RESEND_FROM_EMAIL ||
      "dispatch@slatelanedispatch.com";

    const safeCompany =
      escapeHtml(companyName);

    const safeContact =
      escapeHtml(contactName);

    const emailResult =
      await resend.emails.send({
        from: fromEmail,

        to: [
          carrierEmail,
        ],

        replyTo,

        subject:
          `Slate Lane Dispatch Agreement — ${companyName}`,

        html: `
<!DOCTYPE html>
<html>
  <body
    style="
      margin:0;
      padding:0;
      background:#f4f6f8;
      font-family:Arial,Helvetica,sans-serif;
      color:#1e293b;
    "
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="background:#f4f6f8;padding:32px 16px;"
    >
      <tr>
        <td align="center">

          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              max-width:620px;
              background:#ffffff;
              border:1px solid #e2e8f0;
              border-radius:16px;
              overflow:hidden;
            "
          >

            <tr>
              <td
                style="
                  background:#0f172a;
                  padding:26px 32px;
                "
              >
                <div
                  style="
                    color:#ffffff;
                    font-size:21px;
                    font-weight:700;
                    letter-spacing:-0.3px;
                  "
                >
                  Slate Lane Dispatch
                </div>

                <div
                  style="
                    color:#94a3b8;
                    font-size:12px;
                    margin-top:5px;
                  "
                >
                  Carrier Onboarding
                </div>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:32px;
                "
              >

                <p
                  style="
                    margin:0 0 18px;
                    font-size:15px;
                    line-height:24px;
                  "
                >
                  Hello ${safeContact},
                </p>

                <p
                  style="
                    margin:0 0 18px;
                    font-size:15px;
                    line-height:24px;
                  "
                >
                  Thank you for choosing
                  <strong>Slate Lane Dispatch</strong>
                  to support
                  <strong>${safeCompany}</strong>.
                </p>

                <p
                  style="
                    margin:0 0 18px;
                    font-size:15px;
                    line-height:24px;
                  "
                >
                  Attached is our
                  <strong>
                    Carrier-Dispatcher Agreement
                  </strong>.
                  Please review the agreement,
                  complete the applicable fillable
                  fields, sign it, and return the
                  completed PDF by replying to this
                  email.
                </p>

                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    margin:24px 0;
                    background:#f8fafc;
                    border:1px solid #e2e8f0;
                    border-radius:12px;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding:18px 20px;
                      "
                    >
                      <div
                        style="
                          font-size:12px;
                          font-weight:700;
                          color:#64748b;
                          text-transform:uppercase;
                          letter-spacing:0.7px;
                          margin-bottom:10px;
                        "
                      >
                        Next steps
                      </div>

                      <div
                        style="
                          font-size:14px;
                          line-height:24px;
                          color:#334155;
                        "
                      >
                        1. Open the attached PDF.<br />
                        2. Complete the carrier information.<br />
                        3. Review the service terms.<br />
                        4. Sign the agreement.<br />
                        5. Save the completed PDF.<br />
                        6. Reply to this email with the signed PDF attached.
                      </div>
                    </td>
                  </tr>
                </table>

                <p
                  style="
                    margin:0 0 18px;
                    font-size:15px;
                    line-height:24px;
                  "
                >
                  After we receive the signed
                  agreement, we will complete the
                  remaining carrier onboarding
                  documents and prepare your account
                  for broker setup and dispatch
                  operations.
                </p>

                <p
                  style="
                    margin:28px 0 0;
                    font-size:15px;
                    line-height:23px;
                  "
                >
                  Regards,<br />

                  <strong>
                    Slate Lane Dispatch
                  </strong><br />

                  <span
                    style="
                      color:#64748b;
                    "
                  >
                    Carrier Operations
                  </span>
                </p>

              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:18px 32px;
                  background:#f8fafc;
                  border-top:1px solid #e2e8f0;
                  color:#94a3b8;
                  font-size:11px;
                  line-height:18px;
                "
              >
                This email and attachment are intended
                for the carrier identified above.
                Please keep completed carrier documents
                secure because they may contain
                business and compliance information.
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

Thank you for choosing Slate Lane Dispatch to support ${companyName}.

Attached is our Carrier-Dispatcher Agreement.

Please:

1. Open the attached PDF.
2. Complete the applicable carrier information.
3. Review the service terms.
4. Sign the agreement.
5. Save the completed PDF.
6. Reply to this email with the signed PDF attached.

After we receive the signed agreement, we will complete the remaining carrier onboarding documents and prepare your account for broker setup and dispatch operations.

Regards,

Slate Lane Dispatch
Carrier Operations
        `.trim(),

        attachments: [
          {
            filename:
              "SlateLane_Carrier_Dispatcher_Agreement.pdf",

            content:
              agreementPdf,
          },
        ],
      });

    /*
    |--------------------------------------------------------------------------
    | RESEND ERROR
    |--------------------------------------------------------------------------
    */

    if (emailResult.error) {
      console.error(
        "RESEND AGREEMENT ERROR:",
        emailResult.error
      );

      return errorResponse(
        emailResult.error.message ||
          "Agreement email could not be sent.",
        500
      );
    }

    /*
    |--------------------------------------------------------------------------
    | ONLY MARK SENT AFTER RESEND ACCEPTS EMAIL
    |--------------------------------------------------------------------------
    */

    const documentRecord =
      await createSentAgreementRecord(
        onboardingId,
        carrierEmail
      );

    return NextResponse.json({
      success: true,

      message:
        "Carrier agreement sent successfully.",

      email:
        carrierEmail,

      resendId:
        emailResult.data?.id ||
        null,

      document:
        documentRecord.document,
    });
  } catch (error) {
    console.error(
      "SEND AGREEMENT ROUTE ERROR:",
      error
    );

    return errorResponse(
      getErrorMessage(error),
      500
    );
  }
}