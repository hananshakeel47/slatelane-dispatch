import { NextResponse } from "next/server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  getPortalSession,
  PORTAL_DOCUMENT_BUCKET,
  privateNoStoreHeaders,
} from "@/lib/carrier-portal/server";
import { recordPortalAudit } from "@/lib/carrier-portal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: privateNoStoreHeaders(),
  });
}

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const session = await getPortalSession();

    if (!session) {
      return json({ ok: false, message: "Please sign in again." }, 401);
    }

    const { documentId } = await context.params;

    if (!/^[0-9a-f-]{36}$/i.test(documentId)) {
      return json({ ok: false, message: "Document was not found." }, 404);
    }

    const supabase = createAdminSupabase();
    const { data: document, error } = await supabase
      .from("carrier_document_records")
      .select("id, onboarding_id, storage_bucket, storage_path, file_name, status")
      .eq("id", documentId)
      .neq("status", "archived")
      .maybeSingle();

    if (error || !document || !document.storage_path) {
      return json({ ok: false, message: "Document was not found." }, 404);
    }

    const access = session.access.find(
      (item) =>
        item.onboarding_id === document.onboarding_id &&
        item.status === "active"
    );

    if (!access) {
      return json({ ok: false, message: "Document was not found." }, 404);
    }

    const bucket = document.storage_bucket || PORTAL_DOCUMENT_BUCKET;
    const { data: signed, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(document.storage_path, 300, {
        download: document.file_name || "carrier-document.pdf",
      });

    if (signedError || !signed?.signedUrl) {
      return json({ ok: false, message: "Could not prepare a secure download." }, 503);
    }

    await recordPortalAudit({
      onboardingId: document.onboarding_id,
      accessId: access.id,
      sessionId: session.sessionId,
      documentId: document.id,
      eventType: "document_downloaded",
      metadata: { expires_in_seconds: 300 },
    });

    return NextResponse.redirect(signed.signedUrl, {
      status: 302,
      headers: privateNoStoreHeaders(),
    });
  } catch (error) {
    console.error(
      "CARRIER_PORTAL_DOWNLOAD_FAILED",
      error instanceof Error ? error.message : "unknown error"
    );

    return json(
      { ok: false, message: "Could not prepare a secure download." },
      503
    );
  }
}
