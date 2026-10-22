import { NextResponse } from "next/server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { PORTAL_DOCUMENT_REQUIREMENTS } from "@/lib/carrier-portal/constants";
import {
  getPortalSession,
  privateNoStoreHeaders,
} from "@/lib/carrier-portal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: privateNoStoreHeaders(),
  });
}

function statusLabel(status: string) {
  switch (status) {
    case "requested":
      return "Requested";
    case "sent":
      return "Sent to you";
    case "received":
      return "Received — awaiting review";
    case "signed":
      return "Signed";
    case "approved":
      return "Approved";
    case "expired":
      return "Expired";
    case "rejected":
      return "Needs correction";
    case "archived":
      return "Archived";
    default:
      return "Not submitted";
  }
}

export async function GET() {
  try {
    const session = await getPortalSession();

    if (!session) {
      return json(
        { ok: false, message: "Please sign in to view your onboarding." },
        401
      );
    }

    const onboardingIds = Array.from(
      new Set(session.access.map((item) => item.onboarding_id))
    );

    const supabase = createAdminSupabase();

    const [onboardingResult, documentResult] = await Promise.all([
      supabase
        .from("carrier_onboardings")
        .select(
          "id, company_name, dot_number, mc_number, status, agreement_status, agreement_signed_at, created_at, updated_at"
        )
        .in("id", onboardingIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("carrier_document_records")
        .select(
          "id, onboarding_id, document_type, status, storage_path, file_name, received_at, signed_at, approved_at, expires_at, rejection_reason, created_at"
        )
        .in("onboarding_id", onboardingIds)
        .neq("status", "archived")
        .order("created_at", { ascending: false }),
    ]);

    if (onboardingResult.error || documentResult.error) {
      console.error(
        "CARRIER_PORTAL_SUMMARY_FAILED",
        onboardingResult.error?.message ??
          documentResult.error?.message ??
          "unknown error"
      );

      return json(
        { ok: false, message: "Could not load onboarding status right now." },
        503
      );
    }

    const allDocuments = documentResult.data ?? [];
    const onboardings = (onboardingResult.data ?? []).map((onboarding) => {
      const docs = allDocuments.filter(
        (document) => document.onboarding_id === onboarding.id
      );
      const latestByType = new Map<string, (typeof docs)[number]>();

      for (const document of docs) {
        if (!latestByType.has(document.document_type)) {
          latestByType.set(document.document_type, document);
        }
      }

      const documents = PORTAL_DOCUMENT_REQUIREMENTS.map((requirement) => {
        const record = latestByType.get(requirement.type);
        let status = record?.status ?? "missing";

        if (
          requirement.type === "dispatch_agreement" &&
          !record &&
          onboarding.agreement_status === "signed"
        ) {
          status = "signed";
        }

        const isAgreement =
          requirement.type === "dispatch_agreement" ||
          requirement.type === "carrier_packet";

        const satisfied = isAgreement
          ? status === "signed" || status === "approved"
          : status === "received" ||
            status === "signed" ||
            status === "approved";

        return {
          type: requirement.type,
          label: requirement.label,
          description: requirement.description,
          required: requirement.required,
          uploadable: requirement.uploadable,
          status,
          status_label: statusLabel(status),
          satisfied,
          document_id: record?.id ?? null,
          file_name: record?.file_name ?? null,
          has_file: Boolean(record?.storage_path),
          received_at: record?.received_at ?? null,
          signed_at: record?.signed_at ?? null,
          approved_at: record?.approved_at ?? null,
          expires_at: record?.expires_at ?? null,
          rejection_reason:
            status === "rejected" ? record?.rejection_reason ?? null : null,
        };
      });

      const requiredDocuments = documents.filter((document) => document.required);
      const submittedCount = requiredDocuments.filter(
        (document) => document.satisfied
      ).length;
      const allSubmitted = submittedCount === requiredDocuments.length;
      const allApproved = requiredDocuments.every(
        (document) =>
          document.status === "approved" || document.status === "signed"
      );

      const portalStatus = allApproved
        ? "complete"
        : allSubmitted
          ? "under_review"
          : "documents_needed";

      return {
        id: onboarding.id,
        company_name: onboarding.company_name,
        dot_number: onboarding.dot_number,
        mc_number: onboarding.mc_number,
        onboarding_status: onboarding.status,
        agreement_status: onboarding.agreement_status,
        created_at: onboarding.created_at,
        updated_at: onboarding.updated_at,
        portal_status: portalStatus,
        progress: {
          submitted: submittedCount,
          required: requiredDocuments.length,
          percent: requiredDocuments.length
            ? Math.round((submittedCount / requiredDocuments.length) * 100)
            : 100,
        },
        documents,
      };
    });

    return json({
      ok: true,
      email: session.email,
      onboardings,
    });
  } catch (error) {
    console.error(
      "CARRIER_PORTAL_SUMMARY_FAILED",
      error instanceof Error ? error.message : "unknown error"
    );

    return json(
      { ok: false, message: "Could not load onboarding status right now." },
      503
    );
  }
}
