import { createClient } from "@supabase/supabase-js";

const DOCUMENT_BUCKET = "carrier-document-vault";
const MAX_PDF_SIZE = 15 * 1024 * 1024;

export type CarrierDocumentType =
  | "dispatch_agreement"
  | "carrier_packet"
  | "w9"
  | "w8"
  | "coi"
  | "authority"
  | "factoring_noa"
  | "payment_setup"
  | "rate_confirmation"
  | "pod"
  | "broker_packet"
  | "other";

export type CarrierDocumentStatus =
  | "requested"
  | "sent"
  | "received"
  | "signed"
  | "approved"
  | "expired"
  | "rejected"
  | "archived";

export type UploadCarrierDocumentInput = {
  onboardingId: string;
  carrierId?: number | null;
  documentType: CarrierDocumentType;
  file: File;
  expiresAt?: string | null;
  notes?: string | null;
};

export type MarkDocumentStatusInput = {
  documentId: string;
  status: CarrierDocumentStatus;
  signerName?: string | null;
  signerTitle?: string | null;
  note?: string | null;
};

export type CreateSentDocumentInput = {
  onboardingId: string;
  documentType: "dispatch_agreement" | "carrier_packet";
  email: string;
  note?: string | null;
};

function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not configured."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function cleanFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

  if (!cleaned) {
    return "document.pdf";
  }

  return cleaned
    .toLowerCase()
    .endsWith(".pdf")
    ? cleaned
    : `${cleaned}.pdf`;
}

function assertPdf(file: File) {
  if (!file) {
    throw new Error(
      "No document was provided."
    );
  }

  if (file.size <= 0) {
    throw new Error(
      "The uploaded PDF is empty."
    );
  }

  if (
    file.size >
    MAX_PDF_SIZE
  ) {
    throw new Error(
      "PDF is too large. Maximum allowed size is 15 MB."
    );
  }

  const extensionIsPdf =
    file.name
      .toLowerCase()
      .endsWith(".pdf");

  const mimeIsPdf =
    file.type ===
    "application/pdf";

  if (
    !extensionIsPdf &&
    !mimeIsPdf
  ) {
    throw new Error(
      "Only PDF documents are allowed."
    );
  }
}

export async function getCarrierDocumentVault(
  onboardingId: string
) {
  if (!onboardingId) {
    throw new Error(
      "Onboarding ID is required."
    );
  }

  const supabase =
    getSupabaseAdmin();

  const [
    onboardingResult,
    documentsResult,
    readinessResult,
  ] = await Promise.all([
    supabase
      .from(
        "carrier_onboardings"
      )
      .select(
        `
        id,
        carrier_id,
        lead_id,
        company_name,
        dot_number,
        mc_number,
        primary_contact_name,
        primary_contact_email,
        primary_contact_phone,
        status,
        agreement_status,
        agreement_signed_at,
        load_board_access_status,
        factoring_company,
        insurance_company,
        insurance_expiration,
        updated_at
        `
      )
      .eq(
        "id",
        onboardingId
      )
      .maybeSingle(),

    supabase
      .from(
        "carrier_document_records"
      )
      .select(
        `
        id,
        onboarding_id,
        carrier_id,
        template_id,
        document_type,
        status,
        storage_bucket,
        storage_path,
        file_name,
        mime_type,
        file_size_bytes,
        sent_to_email,
        sent_at,
        received_at,
        signed_at,
        approved_at,
        expires_at,
        signer_name,
        signer_title,
        rejection_reason,
        notes,
        metadata,
        created_at,
        updated_at
        `
      )
      .eq(
        "onboarding_id",
        onboardingId
      )
      .neq(
        "status",
        "archived"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      ),

    supabase
      .from(
        "carrier_document_vault_status"
      )
      .select("*")
      .eq(
        "onboarding_id",
        onboardingId
      )
      .maybeSingle(),
  ]);

  if (
    onboardingResult.error
  ) {
    throw new Error(
      onboardingResult.error
        .message
    );
  }

  if (
    !onboardingResult.data
  ) {
    throw new Error(
      "Carrier onboarding record was not found."
    );
  }

  if (
    documentsResult.error
  ) {
    throw new Error(
      documentsResult.error
        .message
    );
  }

  if (
    readinessResult.error
  ) {
    throw new Error(
      readinessResult.error
        .message
    );
  }

  return {
    onboarding:
      onboardingResult.data,

    documents:
      documentsResult.data ??
      [],

    readiness:
      readinessResult.data,
  };
}

export async function uploadCarrierDocument(
  input: UploadCarrierDocumentInput
) {
  const {
    onboardingId,
    carrierId,
    documentType,
    file,
    expiresAt,
    notes,
  } = input;

  if (!onboardingId) {
    throw new Error(
      "Onboarding ID is required."
    );
  }

  if (!documentType) {
    throw new Error(
      "Document type is required."
    );
  }

  assertPdf(file);

  const supabase =
    getSupabaseAdmin();

  const {
    data: onboarding,
    error: onboardingError,
  } = await supabase
    .from(
      "carrier_onboardings"
    )
    .select(
      "id, carrier_id, company_name"
    )
    .eq(
      "id",
      onboardingId
    )
    .maybeSingle();

  if (
    onboardingError
  ) {
    throw new Error(
      onboardingError.message
    );
  }

  if (!onboarding) {
    throw new Error(
      "Carrier onboarding record was not found."
    );
  }

  const safeFileName =
    cleanFileName(
      file.name
    );

  const objectPath = [
    onboardingId,
    documentType,
    `${Date.now()}-${crypto.randomUUID()}-${safeFileName}`,
  ].join("/");

  const arrayBuffer =
    await file.arrayBuffer();

  const uploadResult =
    await supabase.storage
      .from(
        DOCUMENT_BUCKET
      )
      .upload(
        objectPath,
        arrayBuffer,
        {
          contentType:
            "application/pdf",

          upsert: false,
        }
      );

  if (
    uploadResult.error
  ) {
    throw new Error(
      `PDF upload failed: ${uploadResult.error.message}`
    );
  }

  const finalCarrierId =
    carrierId ??
    onboarding.carrier_id ??
    null;

  const {
    data:
      documentRecord,
    error:
      insertError,
  } = await supabase
    .from(
      "carrier_document_records"
    )
    .insert({
      onboarding_id:
        onboardingId,

      carrier_id:
        finalCarrierId,

      document_type:
        documentType,

      status:
        "received",

      storage_bucket:
        DOCUMENT_BUCKET,

      storage_path:
        objectPath,

      file_name:
        safeFileName,

      mime_type:
        "application/pdf",

      file_size_bytes:
        file.size,

      received_at:
        new Date().toISOString(),

      expires_at:
        expiresAt ||
        null,

      notes:
        notes?.trim() ||
        null,

      metadata: {
        original_file_name:
          file.name,

        uploaded_from:
          "slatelane_admin",
      },
    })
    .select("*")
    .single();

  if (
    insertError
  ) {
    await supabase.storage
      .from(
        DOCUMENT_BUCKET
      )
      .remove([
        objectPath,
      ]);

    throw new Error(
      `Document record could not be saved: ${insertError.message}`
    );
  }

  const {
    error:
      eventError,
  } = await supabase
    .from(
      "carrier_document_events"
    )
    .insert({
      onboarding_id:
        onboardingId,

      document_id:
        documentRecord.id,

      event_type:
        "uploaded",

      from_status:
        null,

      to_status:
        "received",

      actor:
        "crm",

      note:
        `Uploaded ${safeFileName}`,

      metadata: {
        document_type:
          documentType,

        file_size_bytes:
          file.size,
      },
    });

  if (
    eventError
  ) {
    console.error(
      "DOCUMENT EVENT ERROR:",
      eventError
    );
  }

  return {
    success: true,
    document:
      documentRecord,
  };
}

export async function markCarrierDocumentStatus(
  input: MarkDocumentStatusInput
) {
  const supabase =
    getSupabaseAdmin();

  const {
    documentId,
    status,
    signerName,
    signerTitle,
    note,
  } = input;

  if (!documentId) {
    throw new Error(
      "Document ID is required."
    );
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "set_carrier_document_status",
    {
      p_document_id:
        documentId,

      p_status:
        status,

      p_signer_name:
        signerName?.trim() ||
        null,

      p_signer_title:
        signerTitle?.trim() ||
        null,

      p_note:
        note?.trim() ||
        null,
    }
  );

  if (error) {
    throw new Error(
      error.message
    );
  }

  return data;
}

export async function getCarrierDocumentDownloadUrl(
  documentId: string
) {
  if (!documentId) {
    throw new Error(
      "Document ID is required."
    );
  }

  const supabase =
    getSupabaseAdmin();

  const {
    data: document,
    error:
      documentError,
  } = await supabase
    .from(
      "carrier_document_records"
    )
    .select(
      `
      id,
      onboarding_id,
      storage_bucket,
      storage_path,
      file_name
      `
    )
    .eq(
      "id",
      documentId
    )
    .maybeSingle();

  if (
    documentError
  ) {
    throw new Error(
      documentError.message
    );
  }

  if (!document) {
    throw new Error(
      "Document was not found."
    );
  }

  if (
    !document.storage_path
  ) {
    throw new Error(
      "This document does not have an uploaded PDF."
    );
  }

  const bucket =
    document.storage_bucket ||
    DOCUMENT_BUCKET;

  const {
    data:
      signedUrl,
    error:
      signedUrlError,
  } = await supabase.storage
    .from(bucket)
    .createSignedUrl(
      document.storage_path,
      600,
      {
        download:
          document.file_name ||
          "document.pdf",
      }
    );

  if (
    signedUrlError
  ) {
    throw new Error(
      signedUrlError.message
    );
  }

  await supabase
    .from(
      "carrier_document_events"
    )
    .insert({
      onboarding_id:
        document.onboarding_id,

      document_id:
        document.id,

      event_type:
        "downloaded",

      actor:
        "crm",

      note:
        "Private document download URL created.",

      metadata: {
        expires_in_seconds:
          600,
      },
    });

  return {
    success: true,

    url:
      signedUrl.signedUrl,

    expiresIn:
      600,
  };
}

export async function createSentDocumentRecord(
  input: CreateSentDocumentInput
) {
  const {
    onboardingId,
    documentType,
    email,
    note,
  } = input;

  if (!onboardingId) {
    throw new Error(
      "Onboarding ID is required."
    );
  }

  if (
    ![
      "dispatch_agreement",
      "carrier_packet",
    ].includes(
      documentType
    )
  ) {
    throw new Error(
      "Unsupported document type."
    );
  }

  const normalizedEmail =
    email
      .trim()
      .toLowerCase();

  if (!normalizedEmail) {
    throw new Error(
      "Carrier email is required."
    );
  }

  const supabase =
    getSupabaseAdmin();

  const {
    data:
      onboarding,
    error:
      onboardingError,
  } = await supabase
    .from(
      "carrier_onboardings"
    )
    .select(
      "id, carrier_id, company_name"
    )
    .eq(
      "id",
      onboardingId
    )
    .maybeSingle();

  if (
    onboardingError
  ) {
    throw new Error(
      onboardingError.message
    );
  }

  if (!onboarding) {
    throw new Error(
      "Carrier onboarding record was not found."
    );
  }

  const {
    data: record,
    error,
  } = await supabase
    .from(
      "carrier_document_records"
    )
    .insert({
      onboarding_id:
        onboardingId,

      carrier_id:
        onboarding.carrier_id,

      document_type:
        documentType,

      status:
        "sent",

      sent_to_email:
        normalizedEmail,

      sent_at:
        new Date().toISOString(),

      notes:
        note ||
        `${documentType} sent to carrier.`,

      metadata: {
        source:
          "document_vault",

        delivery:
          "resend",
      },
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      error.message
    );
  }

  await supabase
    .from(
      "carrier_document_events"
    )
    .insert({
      onboarding_id:
        onboardingId,

      document_id:
        record.id,

      event_type:
        "template_sent",

      from_status:
        null,

      to_status:
        "sent",

      actor:
        "crm",

      note:
        `${documentType} sent to ${normalizedEmail}`,

      metadata: {
        email:
          normalizedEmail,

        document_type:
          documentType,
      },
    });

  if (
    documentType ===
    "dispatch_agreement"
  ) {
    await supabase
      .from(
        "carrier_onboardings"
      )
      .update({
        agreement_status:
          "sent",

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        onboardingId
      )
      .neq(
        "agreement_status",
        "signed"
      );
  }

  return {
    success: true,
    document: record,
  };
}

export async function createSentAgreementRecord(
  onboardingId: string,
  email: string
) {
  return createSentDocumentRecord(
    {
      onboardingId,

      documentType:
        "dispatch_agreement",

      email,

      note:
        "Slate Lane Carrier-Dispatcher Agreement sent to carrier.",
    }
  );
}