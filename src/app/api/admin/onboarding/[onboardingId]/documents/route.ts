import { NextRequest, NextResponse } from "next/server";

import {
  createSentAgreementRecord,
  getCarrierDocumentDownloadUrl,
  getCarrierDocumentVault,
  markCarrierDocumentStatus,
  uploadCarrierDocument,
  type CarrierDocumentStatus,
  type CarrierDocumentType,
} from "@/lib/documents/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    onboardingId: string;
  }>;
};

function jsonError(
  message: string,
  status = 500,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...extra,
    },
    { status }
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unknown document-vault error.";
}

/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
|
| GET /api/admin/onboarding/[onboardingId]/documents
|
| Returns:
| - onboarding record
| - uploaded documents
| - Broker Packet readiness
|
| Optional:
|
| ?documentId=UUID&download=1
|
| Returns a temporary private download URL.
|
*/

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { onboardingId } =
      await context.params;

    if (!onboardingId) {
      return jsonError(
        "Onboarding ID is required.",
        400
      );
    }

    const documentId =
      request.nextUrl.searchParams.get(
        "documentId"
      );

    const download =
      request.nextUrl.searchParams.get(
        "download"
      );

    if (
      documentId &&
      download === "1"
    ) {
      const result =
        await getCarrierDocumentDownloadUrl(
          documentId
        );

      return NextResponse.json(result);
    }

    const vault =
      await getCarrierDocumentVault(
        onboardingId
      );

    return NextResponse.json({
      success: true,
      ...vault,
    });
  } catch (error) {
    console.error(
      "DOCUMENT VAULT GET ERROR:",
      error
    );

    const message =
      getErrorMessage(error);

    const status =
      message.includes("not found") ||
      message.includes("was not found")
        ? 404
        : 500;

    return jsonError(
      message,
      status
    );
  }
}

/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
|
| Handles:
|
| 1. Upload returned PDF
| 2. Mark Signed / Approved / Rejected / Archived
| 3. Create "Agreement Sent" record
|
*/

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { onboardingId } =
      await context.params;

    if (!onboardingId) {
      return jsonError(
        "Onboarding ID is required.",
        400
      );
    }

    const contentType =
      request.headers.get(
        "content-type"
      ) || "";

    /*
    |--------------------------------------------------------------------------
    | MULTIPART PDF UPLOAD
    |--------------------------------------------------------------------------
    */

    if (
      contentType.includes(
        "multipart/form-data"
      )
    ) {
      const formData =
        await request.formData();

      const action =
        String(
          formData.get("action") ||
            "upload"
        ).trim();

      if (action !== "upload") {
        return jsonError(
          "Invalid multipart action.",
          400
        );
      }

      const fileValue =
        formData.get("file");

      if (
        !fileValue ||
        !(fileValue instanceof File)
      ) {
        return jsonError(
          "PDF file is required.",
          400
        );
      }

      const documentType =
        String(
          formData.get(
            "documentType"
          ) || ""
        ).trim() as CarrierDocumentType;

      if (!documentType) {
        return jsonError(
          "Document type is required.",
          400
        );
      }

      const allowedDocumentTypes:
        CarrierDocumentType[] = [
        "dispatch_agreement",
        "carrier_packet",
        "w9",
        "w8",
        "coi",
        "authority",
        "factoring_noa",
        "payment_setup",
        "rate_confirmation",
        "pod",
        "broker_packet",
        "other",
      ];

      if (
        !allowedDocumentTypes.includes(
          documentType
        )
      ) {
        return jsonError(
          "Invalid document type.",
          400
        );
      }

      const carrierIdRaw =
        String(
          formData.get(
            "carrierId"
          ) || ""
        ).trim();

      let carrierId:
        | number
        | null = null;

      if (carrierIdRaw) {
        const parsed =
          Number(carrierIdRaw);

        if (
          !Number.isFinite(parsed)
        ) {
          return jsonError(
            "Carrier ID is invalid.",
            400
          );
        }

        carrierId = parsed;
      }

      const expiresAt =
        String(
          formData.get(
            "expiresAt"
          ) || ""
        ).trim();

      const notes =
        String(
          formData.get(
            "notes"
          ) || ""
        ).trim();

      const result =
        await uploadCarrierDocument({
          onboardingId,
          carrierId,
          documentType,
          file: fileValue,
          expiresAt:
            expiresAt || null,
          notes:
            notes || null,
        });

      return NextResponse.json(
        result,
        {
          status: 201,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | JSON ACTIONS
    |--------------------------------------------------------------------------
    */

    let body: Record<
      string,
      unknown
    >;

    try {
      body =
        await request.json();
    } catch {
      return jsonError(
        "Invalid JSON request.",
        400
      );
    }

    const action =
      String(
        body.action || ""
      ).trim();

    /*
    |--------------------------------------------------------------------------
    | SEND AGREEMENT RECORD
    |--------------------------------------------------------------------------
    */

    if (
      action ===
      "send_agreement"
    ) {
      const email =
        String(
          body.email || ""
        ).trim();

      if (!email) {
        return jsonError(
          "Carrier email is required.",
          400
        );
      }

      const result =
        await createSentAgreementRecord(
          onboardingId,
          email
        );

      return NextResponse.json(
        result,
        {
          status: 201,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | CHANGE DOCUMENT STATUS
    |--------------------------------------------------------------------------
    */

    if (
      action ===
      "set_status"
    ) {
      const documentId =
        String(
          body.documentId || ""
        ).trim();

      const status =
        String(
          body.status || ""
        ).trim() as CarrierDocumentStatus;

      if (!documentId) {
        return jsonError(
          "Document ID is required.",
          400
        );
      }

      const allowedStatuses:
        CarrierDocumentStatus[] = [
        "requested",
        "sent",
        "received",
        "signed",
        "approved",
        "expired",
        "rejected",
        "archived",
      ];

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return jsonError(
          "Invalid document status.",
          400
        );
      }

      const result =
        await markCarrierDocumentStatus(
          {
            documentId,
            status,

            signerName:
              typeof body.signerName ===
              "string"
                ? body.signerName
                : null,

            signerTitle:
              typeof body.signerTitle ===
              "string"
                ? body.signerTitle
                : null,

            note:
              typeof body.note ===
              "string"
                ? body.note
                : null,
          }
        );

      return NextResponse.json(
        result
      );
    }

    return jsonError(
      "Unknown document-vault action.",
      400
    );
  } catch (error) {
    console.error(
      "DOCUMENT VAULT POST ERROR:",
      error
    );

    return jsonError(
      getErrorMessage(error),
      500
    );
  }
}