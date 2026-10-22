import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { portalDocumentLabel } from "@/lib/carrier-portal/constants";
import {
  getPortalSession,
  PORTAL_DOCUMENT_BUCKET,
  PORTAL_MAX_DOCUMENT_SIZE_BYTES,
  privateNoStoreHeaders,
  recordPortalAudit,
  sameOrigin,
} from "@/lib/carrier-portal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: privateNoStoreHeaders(),
  });
}

async function discardUpload(
  supabase: ReturnType<typeof createAdminSupabase>,
  storagePath: string,
  intentId: string
) {
  await supabase.storage
    .from(PORTAL_DOCUMENT_BUCKET)
    .remove([storagePath]);

  await supabase
    .from("carrier_portal_upload_intents")
    .update({ finalized_at: new Date().toISOString() })
    .eq("id", intentId)
    .is("finalized_at", null);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return json({ ok: false, message: "Request origin was not accepted." }, 403);
  }

  try {
    const session = await getPortalSession();

    if (!session) {
      return json({ ok: false, message: "Please sign in again." }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const intentId = String(body?.intent_id ?? "").trim();

    if (!/^[0-9a-f-]{36}$/i.test(intentId)) {
      return json({ ok: false, message: "Upload request was not found." }, 400);
    }

    const supabase = createAdminSupabase();
    const { data: intent, error: intentError } = await supabase
      .from("carrier_portal_upload_intents")
      .select(
        "id, portal_access_id, onboarding_id, email, document_type, storage_path, file_name, file_size_bytes, expires_at, finalized_at"
      )
      .eq("id", intentId)
      .eq("email", session.email)
      .is("finalized_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (intentError || !intent) {
      return json(
        { ok: false, message: "Upload request expired. Please start the upload again." },
        404
      );
    }

    const access = session.access.find(
      (item) =>
        item.id === intent.portal_access_id &&
        item.onboarding_id === intent.onboarding_id &&
        item.status === "active"
    );

    if (!access) {
      return json({ ok: false, message: "You do not have access to this onboarding." }, 403);
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from(PORTAL_DOCUMENT_BUCKET)
      .download(intent.storage_path);

    if (downloadError || !blob) {
      return json(
        { ok: false, message: "The PDF upload was not found. Please try again." },
        400
      );
    }

    if (
      blob.size !== Number(intent.file_size_bytes) ||
      blob.size <= 0 ||
      blob.size > PORTAL_MAX_DOCUMENT_SIZE_BYTES ||
      (await blob.slice(0, 5).text()) !== "%PDF-"
    ) {
      await discardUpload(supabase, intent.storage_path, intent.id);

      return json(
        { ok: false, message: "The uploaded file is not a valid PDF or exceeds 15 MB." },
        400
      );
    }

    const { data: claimedIntent, error: claimError } = await supabase
      .from("carrier_portal_upload_intents")
      .update({ finalized_at: new Date().toISOString() })
      .eq("id", intent.id)
      .is("finalized_at", null)
      .select("id")
      .maybeSingle();

    if (claimError || !claimedIntent) {
      return json(
        { ok: false, message: "This upload has already been processed. Refresh your portal." },
        409
      );
    }

    const { data: onboarding, error: onboardingError } = await supabase
      .from("carrier_onboardings")
      .select("id, carrier_id")
      .eq("id", intent.onboarding_id)
      .maybeSingle();

    if (onboardingError || !onboarding) {
      await discardUpload(supabase, intent.storage_path, intent.id);

      return json({ ok: false, message: "Onboarding record was not found." }, 404);
    }

    const bytes = Buffer.from(await blob.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const now = new Date().toISOString();

    const { data: document, error: documentError } = await supabase
      .from("carrier_document_records")
      .insert({
        onboarding_id: intent.onboarding_id,
        carrier_id: onboarding.carrier_id ?? null,
        document_type: intent.document_type,
        status: "received",
        storage_bucket: PORTAL_DOCUMENT_BUCKET,
        storage_path: intent.storage_path,
        file_name: intent.file_name,
        mime_type: "application/pdf",
        file_size_bytes: blob.size,
        sha256,
        received_at: now,
        metadata: {
          uploaded_from: "carrier_portal",
          portal_document_key: intent.document_type,
        },
      })
      .select("id, document_type, status, file_name, received_at")
      .single();

    if (documentError || !document) {
      await supabase
        .from("carrier_portal_upload_intents")
        .update({ finalized_at: null })
        .eq("id", intent.id);

      await supabase.storage
        .from(PORTAL_DOCUMENT_BUCKET)
        .remove([intent.storage_path]);

      console.error(
        "CARRIER_PORTAL_DOCUMENT_RECORD_FAILED",
        documentError?.message ?? "missing document record"
      );

      return json(
        { ok: false, message: "The PDF could not be saved to your onboarding record." },
        503
      );
    }

    await supabase
      .from("carrier_document_events")
      .insert({
        onboarding_id: intent.onboarding_id,
        document_id: document.id,
        event_type: "uploaded",
        from_status: null,
        to_status: "received",
        actor: "carrier_portal",
        note: portalDocumentLabel(intent.document_type) + " uploaded by carrier.",
        metadata: {
          file_size_bytes: blob.size,
          sha256,
        },
      });

    await recordPortalAudit({
      onboardingId: intent.onboarding_id,
      accessId: access.id,
      sessionId: session.sessionId,
      documentId: document.id,
      eventType: "document_uploaded",
      metadata: {
        document_type: intent.document_type,
        file_size_bytes: blob.size,
      },
    });

    return json({
      ok: true,
      document: {
        id: document.id,
        document_type: document.document_type,
        status: document.status,
        file_name: document.file_name,
        received_at: document.received_at,
      },
      message: "Document uploaded successfully. SlateLane will review it shortly.",
    });
  } catch (error) {
    console.error(
      "CARRIER_PORTAL_UPLOAD_FINALIZE_FAILED",
      error instanceof Error ? error.message : "unknown error"
    );

    return json(
      { ok: false, message: "Could not finish the upload. Please try again." },
      503
    );
  }
}
