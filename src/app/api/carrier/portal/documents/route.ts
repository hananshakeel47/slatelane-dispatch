import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  isPortalUploadDocumentType,
} from "@/lib/carrier-portal/constants";
import {
  getPortalSession,
  PORTAL_DOCUMENT_BUCKET,
  PORTAL_MAX_DOCUMENT_SIZE_BYTES,
  privateNoStoreHeaders,
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

function validPdfName(value: string) {
  return value.toLowerCase().endsWith(".pdf");
}

function safeFileName(value: string) {
  const base = value.split(/[\\/]/).pop() || "document.pdf";
  const cleaned = base
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);

  return cleaned.toLowerCase().endsWith(".pdf")
    ? cleaned
    : cleaned + ".pdf";
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
    const onboardingId = String(body?.onboarding_id ?? "").trim();
    const documentType = String(body?.document_type ?? "").trim();
    const originalName = String(body?.file_name ?? "").trim();
    const fileSize = Number(body?.file_size_bytes);

    const access = session.access.find(
      (item) => item.onboarding_id === onboardingId && item.status === "active"
    );

    if (!access) {
      return json({ ok: false, message: "Onboarding record was not found." }, 404);
    }

    if (!isPortalUploadDocumentType(documentType)) {
      return json({ ok: false, message: "This document type cannot be uploaded here." }, 400);
    }

    if (
      !originalName ||
      !validPdfName(originalName) ||
      !Number.isSafeInteger(fileSize) ||
      fileSize <= 0 ||
      fileSize > PORTAL_MAX_DOCUMENT_SIZE_BYTES
    ) {
      return json(
        { ok: false, message: "Choose a PDF document up to 15 MB." },
        400
      );
    }

    const supabase = createAdminSupabase();
    const safeName = safeFileName(originalName);
    const storagePath =
      onboardingId +
      "/" +
      documentType +
      "/" +
      randomUUID() +
      "-" +
      safeName;

    const { data: signedUpload, error: signedUploadError } =
      await supabase.storage
        .from(PORTAL_DOCUMENT_BUCKET)
        .createSignedUploadUrl(storagePath, { upsert: false });

    if (signedUploadError || !signedUpload?.token) {
      console.error(
        "CARRIER_PORTAL_SIGNED_UPLOAD_FAILED",
        signedUploadError?.message ?? "missing upload token"
      );

      return json(
        { ok: false, message: "Could not prepare a secure upload. Please try again." },
        503
      );
    }

    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const { data: intent, error: intentError } = await supabase
      .from("carrier_portal_upload_intents")
      .insert({
        portal_access_id: access.id,
        onboarding_id: onboardingId,
        email: session.email,
        document_type: documentType,
        storage_path: storagePath,
        file_name: safeName,
        file_size_bytes: fileSize,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (intentError || !intent) {
      console.error(
        "CARRIER_PORTAL_UPLOAD_INTENT_FAILED",
        intentError?.message ?? "missing upload intent"
      );

      return json(
        { ok: false, message: "Could not prepare a secure upload. Please try again." },
        503
      );
    }

    return json({
      ok: true,
      intent_id: intent.id,
      path: signedUpload.path || storagePath,
      token: signedUpload.token,
    });
  } catch (error) {
    console.error(
      "CARRIER_PORTAL_UPLOAD_PREPARE_FAILED",
      error instanceof Error ? error.message : "unknown error"
    );

    return json(
      { ok: false, message: "Could not prepare a secure upload. Please try again." },
      503
    );
  }
}
