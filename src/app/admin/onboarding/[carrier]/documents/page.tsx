"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useParams } from "next/navigation";

type DocumentStatus =
  | "requested"
  | "sent"
  | "received"
  | "signed"
  | "approved"
  | "expired"
  | "rejected"
  | "archived";

type DocumentType =
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

type SendableDocument =
  | "dispatch_agreement"
  | "carrier_packet";

type OnboardingRecord = {
  id: string;

  carrier_id: number | null;
  lead_id: string | null;

  company_name: string | null;

  dot_number: number | null;
  mc_number: string | null;

  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;

  status: string | null;

  agreement_status: string | null;
  agreement_signed_at: string | null;

  load_board_access_status: string | null;

  factoring_company: string | null;

  insurance_company: string | null;
  insurance_expiration: string | null;

  updated_at: string | null;
};

type DocumentRecord = {
  id: string;

  onboarding_id: string;
  carrier_id: number | null;

  template_id: string | null;

  document_type: DocumentType;

  status: DocumentStatus;

  storage_bucket: string | null;
  storage_path: string | null;

  file_name: string | null;
  mime_type: string | null;

  file_size_bytes: number | null;

  sent_to_email: string | null;
  sent_at: string | null;

  received_at: string | null;
  signed_at: string | null;
  approved_at: string | null;

  expires_at: string | null;

  signer_name: string | null;
  signer_title: string | null;

  rejection_reason: string | null;

  notes: string | null;

  metadata: Record<string, unknown> | null;

  created_at: string;
  updated_at: string;
};

type Readiness = {
  onboarding_id: string;

  carrier_id: number | null;

  company_name: string | null;

  dot_number: number | null;
  mc_number: string | null;

  dispatch_agreement_status: string | null;
  carrier_packet_status: string | null;

  w9_status: string | null;
  w8_status: string | null;

  coi_status: string | null;
  authority_status: string | null;
  factoring_noa_status: string | null;

  coi_expires_at: string | null;

  agreement_ready: boolean;
  carrier_packet_ready: boolean;
  tax_form_ready: boolean;
  insurance_ready: boolean;
  authority_ready: boolean;
  factoring_ready: boolean;

  missing_documents: string[] | null;

  broker_packet_ready: boolean;
};

type VaultResponse = {
  success: boolean;

  onboarding: OnboardingRecord;

  documents: DocumentRecord[];

  readiness: Readiness | null;
};

type UploadState = {
  documentType: DocumentType;

  file: File | null;

  expiresAt: string;

  notes: string;
};

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  dispatch_agreement: "Carrier-Dispatcher Agreement",

  carrier_packet: "Carrier Credential Packet",

  w9: "W-9",

  w8: "W-8",

  coi: "Certificate of Insurance",

  authority: "Operating Authority",

  factoring_noa: "Factoring NOA",

  payment_setup: "Payment Setup",

  rate_confirmation: "Rate Confirmation",

  pod: "Proof of Delivery",

  broker_packet: "Broker Packet",

  other: "Other Document",
};

const STATUS_LABELS: Record<DocumentStatus, string> = {
  requested: "Requested",

  sent: "Sent",

  received: "Received",

  signed: "Signed",

  approved: "Approved",

  expired: "Expired",

  rejected: "Rejected",

  archived: "Archived",
};

const REQUIREMENTS = [
  {
    key: "dispatch_agreement",

    title: "Dispatch Agreement",

    uploadType: "dispatch_agreement" as DocumentType,

    description:
      "Signed carrier-dispatcher agreement establishing Slate Lane as the carrier's dispatch agent.",
  },

  {
    key: "carrier_packet",

    title: "Carrier Packet",

    uploadType: "carrier_packet" as DocumentType,

    description:
      "Completed carrier credential and onboarding packet.",
  },

  {
    key: "tax_form",

    title: "W-9 / W-8",

    uploadType: "w9" as DocumentType,

    description:
      "Current tax identification form used for carrier and broker setup.",
  },

  {
    key: "coi",

    title: "Certificate of Insurance",

    uploadType: "coi" as DocumentType,

    description:
      "Current insurance certificate with coverage and expiration information.",
  },

  {
    key: "authority",

    title: "Operating Authority",

    uploadType: "authority" as DocumentType,

    description:
      "Carrier operating authority and compliance record.",
  },

  {
    key: "factoring_noa",

    title: "Factoring NOA",

    uploadType: "factoring_noa" as DocumentType,

    description:
      "Notice of Assignment when the carrier uses a factoring company.",
  },
] as const;

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatBytes(value?: number | null) {
  if (!value || value <= 0) {
    return "—";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(
    value /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function statusClasses(status?: string | null) {
  switch (status) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "signed":
      return "border-green-200 bg-green-50 text-green-700";

    case "received":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "sent":
      return "border-sky-200 bg-sky-50 text-sky-700";

    case "requested":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "expired":
      return "border-orange-200 bg-orange-50 text-orange-700";

    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function latestDocument(
  documents: DocumentRecord[],
  types: DocumentType[]
) {
  return documents.find((document) =>
    types.includes(document.document_type)
  );
}

export default function CarrierDocumentVaultPage() {
  const params = useParams();

  const carrierParam = params?.carrier;

  const onboardingId = Array.isArray(carrierParam)
    ? carrierParam[0]
    : carrierParam;

  const [vault, setVault] =
    useState<VaultResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    busySend,
    setBusySend,
  ] =
    useState<SendableDocument | null>(
      null
    );

  const [
    busyDocumentId,
    setBusyDocumentId,
  ] =
    useState<string | null>(
      null
    );

  const [
    uploading,
    setUploading,
  ] =
    useState(false);

  const [
    showUpload,
    setShowUpload,
  ] =
    useState(false);

  const [upload, setUpload] =
    useState<UploadState>({
      documentType: "other",

      file: null,

      expiresAt: "",

      notes: "",
    });

  const loadVault = useCallback(
    async () => {
      if (!onboardingId) {
        return;
      }

      setLoading(true);

      setError("");

      try {
        const response =
          await fetch(
            `/api/admin/onboarding/${encodeURIComponent(
              onboardingId
            )}/documents`,
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              "Could not load document vault."
          );
        }

        setVault(data);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load document vault."
        );
      } finally {
        setLoading(false);
      }
    },
    [onboardingId]
  );

  useEffect(() => {
    loadVault();
  }, [loadVault]);

  const onboarding =
    vault?.onboarding;

  const documents =
    vault?.documents ?? [];

  const readiness =
    vault?.readiness;

  /*
  |--------------------------------------------------------------------------
  | COI EXPIRATION MONITOR
  |--------------------------------------------------------------------------
  */

  const coiDaysRemaining =
    useMemo(() => {
      if (
        !readiness?.coi_expires_at
      ) {
        return null;
      }

      const expiration =
        new Date(
          readiness.coi_expires_at
        );

      if (
        Number.isNaN(
          expiration.getTime()
        )
      ) {
        return null;
      }

      const now =
        new Date();

      return Math.ceil(
        (
          expiration.getTime() -
          now.getTime()
        ) /
          (1000 *
            60 *
            60 *
            24)
      );
    }, [
      readiness?.coi_expires_at,
    ]);

  const coiWarning =
    coiDaysRemaining !== null &&
    coiDaysRemaining <= 30;

  /*
  |--------------------------------------------------------------------------
  | LATEST DOCUMENTS
  |--------------------------------------------------------------------------
  */

  const latest =
    useMemo(
      () => ({
        dispatch_agreement:
          latestDocument(
            documents,
            [
              "dispatch_agreement",
            ]
          ),

        carrier_packet:
          latestDocument(
            documents,
            [
              "carrier_packet",
            ]
          ),

        tax_form:
          latestDocument(
            documents,
            ["w9", "w8"]
          ),

        coi:
          latestDocument(
            documents,
            ["coi"]
          ),

        authority:
          latestDocument(
            documents,
            ["authority"]
          ),

        factoring_noa:
          latestDocument(
            documents,
            [
              "factoring_noa",
            ]
          ),
      }),
      [documents]
    );

  const readyMap = {
    dispatch_agreement:
      readiness?.agreement_ready ??
      false,

    carrier_packet:
      readiness?.carrier_packet_ready ??
      false,

    tax_form:
      readiness?.tax_form_ready ??
      false,

    coi:
      readiness?.insurance_ready ??
      false,

    authority:
      readiness?.authority_ready ??
      false,

    factoring_noa:
      readiness?.factoring_ready ??
      false,
  };

  function resetMessages() {
    setError("");
    setSuccessMessage("");
  }

  /*
  |--------------------------------------------------------------------------
  | SEND AGREEMENT / CARRIER PACKET
  |--------------------------------------------------------------------------
  */

  async function sendDocument(
    documentType: SendableDocument
  ) {
    if (
      !onboardingId ||
      !onboarding
    ) {
      return;
    }

    resetMessages();

    const email =
      onboarding
        .primary_contact_email
        ?.trim()
        .toLowerCase() || "";

    if (!email) {
      setError(
        "Carrier does not have a primary contact email."
      );

      return;
    }

    const current =
      latest[documentType];

    if (
      current &&
      [
        "received",
        "signed",
        "approved",
      ].includes(
        current.status
      )
    ) {
      setError(
        "A returned copy has already been received. Do not resend over the active returned document."
      );

      return;
    }

    const label =
      documentType ===
      "dispatch_agreement"
        ? "Carrier-Dispatcher Agreement"
        : "Carrier Credential Packet";

    const confirmed =
      window.confirm(
        `${
          current?.status ===
          "sent"
            ? "Resend"
            : "Send"
        } ${label} to:\n\n${email}\n\nCarrier: ${
          onboarding.company_name ||
          "Unknown"
        }`
      );

    if (!confirmed) {
      return;
    }

    setBusySend(
      documentType
    );

    try {
      const response =
        await fetch(
          `/api/admin/onboarding/${encodeURIComponent(
            onboardingId
          )}/send-document`,
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body: JSON.stringify({
              documentType,
              email,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Document could not be sent."
        );
      }

      setSuccessMessage(
        `${label} sent successfully to ${email}.`
      );

      await loadVault();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Document could not be sent."
      );
    } finally {
      setBusySend(null);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | OPEN UPLOAD
  |--------------------------------------------------------------------------
  */

  function openUpload(
    documentType: DocumentType
  ) {
    resetMessages();

    setUpload({
      documentType,

      file: null,

      expiresAt: "",

      notes: "",
    });

    setShowUpload(true);

    setTimeout(() => {
      document
        .getElementById(
          "vault-upload"
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 50);
  }

  function handleFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setUpload(
      (current) => ({
        ...current,

        file:
          event.target
            .files?.[0] ??
          null,
      })
    );
  }

  /*
  |--------------------------------------------------------------------------
  | UPLOAD
  |--------------------------------------------------------------------------
  */

  async function handleUpload(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!onboardingId) {
      return;
    }

    resetMessages();

    if (!upload.file) {
      setError(
        "Choose a PDF first."
      );

      return;
    }

    if (
      upload.file.type !==
        "application/pdf" &&
      !upload.file.name
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      setError(
        "Only PDF files are allowed."
      );

      return;
    }

    if (
      upload.file.size >
      15 *
        1024 *
        1024
    ) {
      setError(
        "Maximum file size is 15 MB."
      );

      return;
    }

    setUploading(true);

    try {
      const data =
        new FormData();

      data.append(
        "action",
        "upload"
      );

      data.append(
        "documentType",
        upload.documentType
      );

      data.append(
        "file",
        upload.file
      );

      if (
        onboarding
          ?.carrier_id
      ) {
        data.append(
          "carrierId",
          String(
            onboarding.carrier_id
          )
        );
      }

      if (
        upload.expiresAt
      ) {
        data.append(
          "expiresAt",
          new Date(
            `${upload.expiresAt}T23:59:59`
          ).toISOString()
        );
      }

      if (
        upload.notes.trim()
      ) {
        data.append(
          "notes",
          upload.notes.trim()
        );
      }

      const response =
        await fetch(
          `/api/admin/onboarding/${encodeURIComponent(
            onboardingId
          )}/documents`,
          {
            method: "POST",

            body: data,
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ||
            "Upload failed."
        );
      }

      setSuccessMessage(
        `${
          DOCUMENT_LABELS[
            upload.documentType
          ]
        } uploaded successfully.`
      );

      setShowUpload(false);

      setUpload({
        documentType: "other",

        file: null,

        expiresAt: "",

        notes: "",
      });

      await loadVault();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Upload failed."
      );
    } finally {
      setUploading(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | STATUS
  |--------------------------------------------------------------------------
  */

  async function setStatus(
    document: DocumentRecord,
    status: DocumentStatus
  ) {
    if (!onboardingId) {
      return;
    }

    resetMessages();

    let signerName:
      | string
      | null = null;

    let signerTitle:
      | string
      | null = null;

    if (
      status ===
        "signed" &&
      document.document_type ===
        "dispatch_agreement"
    ) {
      signerName =
        window.prompt(
          "Carrier signer name:",
          onboarding
            ?.primary_contact_name ||
            ""
        );

      if (
        signerName === null
      ) {
        return;
      }

      signerTitle =
        window.prompt(
          "Signer title:",
          "Authorized Representative"
        );

      if (
        signerTitle === null
      ) {
        return;
      }
    }

    if (
      status ===
        "approved" &&
      !window.confirm(
        `Approve ${
          DOCUMENT_LABELS[
            document.document_type
          ]
        }?`
      )
    ) {
      return;
    }

    setBusyDocumentId(
      document.id
    );

    try {
      const response =
        await fetch(
          `/api/admin/onboarding/${encodeURIComponent(
            onboardingId
          )}/documents`,
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body: JSON.stringify({
              action: "set_status",

              documentId:
                document.id,

              status,

              signerName,

              signerTitle,

              note:
                status ===
                "signed"
                  ? "Signed carrier agreement verified in Slate Lane Document Vault."
                  : status ===
                      "approved"
                    ? "Document approved for carrier onboarding and broker setup."
                    : null,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Status update failed."
        );
      }

      setSuccessMessage(
        `${
          DOCUMENT_LABELS[
            document.document_type
          ]
        } marked ${
          STATUS_LABELS[
            status
          ].toLowerCase()
        }.`
      );

      await loadVault();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Status update failed."
      );
    } finally {
      setBusyDocumentId(null);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | DOWNLOAD
  |--------------------------------------------------------------------------
  */

  async function downloadDocument(
    document: DocumentRecord
  ) {
    if (!onboardingId) {
      return;
    }

    resetMessages();

    setBusyDocumentId(
      document.id
    );

    try {
      const response =
        await fetch(
          `/api/admin/onboarding/${encodeURIComponent(
            onboardingId
          )}/documents?documentId=${encodeURIComponent(
            document.id
          )}&download=1`,
          {
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success ||
        !data.url
      ) {
        throw new Error(
          data.message ||
            "Download failed."
        );
      }

      window.open(
        data.url,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Download failed."
      );
    } finally {
      setBusyDocumentId(null);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | LOADING
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">

          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />

          <p className="mt-4 text-sm font-medium text-slate-600">
            Loading Document Vault...
          </p>

        </div>
      </main>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | LOAD ERROR
  |--------------------------------------------------------------------------
  */

  if (
    !vault ||
    !onboarding
  ) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">

        <div className="mx-auto max-w-4xl rounded-2xl border border-red-200 bg-red-50 p-6">

          <h1 className="font-bold text-red-900">
            Document Vault unavailable
          </h1>

          <p className="mt-2 text-sm text-red-700">
            {error ||
              "Carrier onboarding could not be loaded."}
          </p>

        </div>

      </main>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | PAGE
  |--------------------------------------------------------------------------
  */

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-7xl px-5 py-7 lg:px-8">

        {/* HEADER */}

        <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

          <div>

            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Carrier Operations · Document Vault
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              {onboarding.company_name ||
                "Carrier"}
            </h1>

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">

              <span>
                DOT{" "}
                <strong className="font-semibold text-slate-700">
                  {onboarding.dot_number ||
                    "—"}
                </strong>
              </span>

              <span>
                MC{" "}
                <strong className="font-semibold text-slate-700">
                  {onboarding.mc_number ||
                    "—"}
                </strong>
              </span>

              <span>
                Contact{" "}
                <strong className="font-semibold text-slate-700">
                  {onboarding.primary_contact_name ||
                    "—"}
                </strong>
              </span>

              <span>
                Email{" "}
                <strong className="font-semibold text-slate-700">
                  {onboarding.primary_contact_email ||
                    "—"}
                </strong>
              </span>

            </div>

          </div>

          {/* BROKER READINESS */}

          <div
            className={`min-w-[300px] rounded-2xl border px-5 py-4 shadow-sm ${
              readiness?.broker_packet_ready
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >

            <div className="flex items-center justify-between gap-4">

              <div>

                <p
                  className={`text-xs font-bold uppercase tracking-[0.15em] ${
                    readiness?.broker_packet_ready
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }`}
                >
                  Broker Setup
                </p>

                <p
                  className={`mt-1 text-lg font-bold ${
                    readiness?.broker_packet_ready
                      ? "text-emerald-900"
                      : "text-amber-900"
                  }`}
                >
                  {readiness?.broker_packet_ready
                    ? "Broker Packet Ready"
                    : "Documents Required"}
                </p>

              </div>

              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold ${
                  readiness?.broker_packet_ready
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {readiness?.broker_packet_ready
                  ? "✓"
                  : "!"}
              </div>

            </div>

            {!readiness?.broker_packet_ready &&
            readiness?.missing_documents
              ?.length ? (

              <p className="mt-2 max-w-sm text-xs leading-5 text-amber-800">
                Missing:{" "}
                {readiness.missing_documents.join(
                  ", "
                )}
              </p>

            ) : null}

          </div>

        </div>

        {/* MESSAGES */}

        {error ? (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {/* COI WARNING */}

        {coiWarning ? (

          <section
            className={`mb-6 rounded-2xl border p-4 shadow-sm ${
              (coiDaysRemaining ??
                0) <= 0
                ? "border-red-200 bg-red-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >

            <div className="flex items-start gap-3">

              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${
                  (coiDaysRemaining ??
                    0) <= 0
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                !
              </div>

              <div>

                <h3
                  className={`font-bold ${
                    (coiDaysRemaining ??
                      0) <= 0
                      ? "text-red-900"
                      : "text-amber-900"
                  }`}
                >
                  {(coiDaysRemaining ??
                    0) <= 0
                    ? "Carrier insurance has expired"
                    : "Carrier insurance expires soon"}
                </h3>

                <p
                  className={`mt-1 text-sm leading-6 ${
                    (coiDaysRemaining ??
                      0) <= 0
                      ? "text-red-700"
                      : "text-amber-700"
                  }`}
                >
                  {(coiDaysRemaining ??
                    0) <= 0
                    ? `The current COI expired on ${formatDate(
                        readiness?.coi_expires_at
                      )}. Upload a renewed Certificate of Insurance before dispatching.`
                    : `The current COI expires in ${coiDaysRemaining} day${
                        coiDaysRemaining ===
                        1
                          ? ""
                          : "s"
                      } on ${formatDate(
                        readiness?.coi_expires_at
                      )}. Request a renewed COI from the carrier.`
                  }
                </p>

              </div>

            </div>

          </section>

        ) : null}

        {/* SEND CENTER */}

        <section className="mb-6">

          <div className="mb-4">

            <h2 className="text-lg font-bold text-slate-950">
              Carrier onboarding send center
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Send fillable onboarding documents directly to the carrier.
            </p>

          </div>

          <div className="grid gap-4 lg:grid-cols-2">

            <SendCard
              title="Carrier-Dispatcher Agreement"

              description="Formal dispatch services agreement. The carrier completes, signs, saves and returns the fillable PDF."

              document={
                latest.dispatch_agreement
              }

              busy={
                busySend ===
                "dispatch_agreement"
              }

              onSend={() =>
                sendDocument(
                  "dispatch_agreement"
                )
              }
            />

            <SendCard
              title="Carrier Credential Packet"

              description="Collect company, authority, equipment, insurance, factoring, lanes and dispatch preferences."

              document={
                latest.carrier_packet
              }

              busy={
                busySend ===
                "carrier_packet"
              }

              onSend={() =>
                sendDocument(
                  "carrier_packet"
                )
              }
            />

          </div>

        </section>

        {/* OFFICIAL TAX FORMS */}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Official Tax Forms
              </p>

              <h2 className="mt-1 text-lg font-bold text-slate-950">
                IRS Carrier Tax Documents
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Always use the official IRS source instead of storing an outdated blank tax form. Have the carrier complete the applicable form and upload the returned PDF here.
              </p>

            </div>

            <div className="flex flex-wrap gap-2">

              <a
                href="https://www.irs.gov/forms-pubs/about-form-w-9"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Official W-9
              </a>

              <a
                href="https://www.irs.gov/forms-pubs/about-form-w-8-ben-e"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Official W-8BEN-E
              </a>

            </div>

          </div>

        </section>

        {/* REQUIREMENTS */}

        <section className="mb-6">

          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">

            <div>

              <h2 className="text-lg font-bold text-slate-950">
                Broker packet requirements
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                All required carrier credentials in one private vault.
              </p>

            </div>

            <button
              type="button"
              onClick={() =>
                openUpload(
                  "other"
                )
              }
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              + Upload Document
            </button>

          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

            {REQUIREMENTS.map(
              (requirement) => {
                const document =
                  latest[
                    requirement.key as keyof typeof latest
                  ];

                const ready =
                  readyMap[
                    requirement.key as keyof typeof readyMap
                  ];

                return (
                  <div
                    key={
                      requirement.key
                    }
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >

                    <div className="flex items-start justify-between gap-3">

                      <div>

                        <h3 className="font-semibold text-slate-900">
                          {requirement.title}
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {requirement.description}
                        </p>

                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          ready
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}
                      >
                        {ready
                          ? "Ready"
                          : "Required"}
                      </span>

                    </div>

                    {document ? (

                      <div className="mt-4 rounded-xl bg-slate-50 p-3">

                        <div className="flex items-center justify-between gap-3">

                          <div className="min-w-0">

                            <p className="truncate text-xs font-semibold text-slate-700">
                              {document.file_name ||
                                document.sent_to_email ||
                                DOCUMENT_LABELS[
                                  document.document_type
                                ]}
                            </p>

                            <p className="mt-1 text-[11px] text-slate-400">
                              {formatDateTime(
                                document.updated_at
                              )}
                            </p>

                          </div>

                          <span
                            className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClasses(
                              document.status
                            )}`}
                          >
                            {
                              STATUS_LABELS[
                                document.status
                              ]
                            }
                          </span>

                        </div>

                      </div>

                    ) : (

                      <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-400">
                        No document yet.
                      </div>

                    )}

                    <div className="mt-4 flex flex-wrap gap-2">

                      <button
                        type="button"
                        onClick={() =>
                          openUpload(
                            requirement.uploadType
                          )
                        }
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Upload PDF
                      </button>

                      {document?.storage_path ? (

                        <button
                          type="button"
                          onClick={() =>
                            downloadDocument(
                              document
                            )
                          }
                          disabled={
                            busyDocumentId ===
                            document.id
                          }
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                        >
                          Download
                        </button>

                      ) : null}

                      {document?.document_type ===
                        "dispatch_agreement" &&
                      document.status ===
                        "received" ? (

                        <button
                          type="button"
                          disabled={
                            busyDocumentId ===
                            document.id
                          }
                          onClick={() =>
                            setStatus(
                              document,
                              "signed"
                            )
                          }
                          className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
                        >
                          Mark Signed
                        </button>

                      ) : null}

                      {document &&
                      [
                        "received",
                        "signed",
                      ].includes(
                        document.status
                      ) ? (

                        <button
                          type="button"
                          disabled={
                            busyDocumentId ===
                            document.id
                          }
                          onClick={() =>
                            setStatus(
                              document,
                              "approved"
                            )
                          }
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
                        >
                          Approve
                        </button>

                      ) : null}

                    </div>

                  </div>
                );
              }
            )}

          </div>

        </section>

        {/* UPLOAD */}

        {showUpload ? (

          <section
            id="vault-upload"
            className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >

            <div className="mb-5 flex items-center justify-between gap-4">

              <div>

                <h2 className="text-lg font-bold text-slate-950">
                  Upload document
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  PDF only · Maximum 15 MB · Stored privately
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowUpload(
                    false
                  )
                }
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
              >
                Close
              </button>

            </div>

            <form
              onSubmit={
                handleUpload
              }
              className="grid gap-4 md:grid-cols-2"
            >

              <div>

                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Document Type
                </label>

                <select
                  value={
                    upload.documentType
                  }
                  onChange={(
                    event
                  ) =>
                    setUpload(
                      (current) => ({
                        ...current,

                        documentType:
                          event.target
                            .value as DocumentType,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                >

                  {Object.entries(
                    DOCUMENT_LABELS
                  ).map(
                    ([
                      value,
                      label,
                    ]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    )
                  )}

                </select>

              </div>

              <div>

                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Expiration Date
                </label>

                <input
                  type="date"
                  value={
                    upload.expiresAt
                  }
                  onChange={(
                    event
                  ) =>
                    setUpload(
                      (current) => ({
                        ...current,

                        expiresAt:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                />

                <p className="mt-1 text-[11px] text-slate-400">
                  Required for COI and other expiring credentials.
                </p>

              </div>

              <div className="md:col-span-2">

                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  PDF File
                </label>

                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={
                    handleFile
                  }
                  className="block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white"
                />

              </div>

              <div className="md:col-span-2">

                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Internal Notes
                </label>

                <textarea
                  rows={3}
                  value={
                    upload.notes
                  }
                  onChange={(
                    event
                  ) =>
                    setUpload(
                      (current) => ({
                        ...current,

                        notes:
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="Optional notes..."
                  className="w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-400"
                />

              </div>

              <div className="md:col-span-2 flex justify-end gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setShowUpload(
                      false
                    )
                  }
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    uploading
                  }
                  className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {uploading
                    ? "Uploading..."
                    : "Upload to Vault"}
                </button>

              </div>

            </form>

          </section>

        ) : null}

        {/* HISTORY */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-100 px-5 py-4">

            <div className="flex items-center justify-between gap-4">

              <div>

                <h2 className="font-bold text-slate-950">
                  Document history
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Complete carrier document activity and stored PDFs.
                </p>

              </div>

              <span className="text-xs font-medium text-slate-400">
                {documents.length} record
                {documents.length ===
                1
                  ? ""
                  : "s"}
              </span>

            </div>

          </div>

          {documents.length ===
          0 ? (

            <div className="p-12 text-center">

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                PDF
              </div>

              <h3 className="mt-4 font-semibold text-slate-800">
                No carrier documents yet
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                Send the onboarding documents above or upload a returned carrier PDF.
              </p>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full min-w-[1000px] text-left">

                <thead>

                  <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">

                    <th className="px-5 py-3">
                      Document
                    </th>

                    <th className="px-4 py-3">
                      Status
                    </th>

                    <th className="px-4 py-3">
                      Date
                    </th>

                    <th className="px-4 py-3">
                      Expires
                    </th>

                    <th className="px-4 py-3">
                      Size
                    </th>

                    <th className="px-4 py-3">
                      Signer
                    </th>

                    <th className="px-5 py-3 text-right">
                      Action
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {documents.map(
                    (document) => (

                      <tr
                        key={
                          document.id
                        }
                        className="border-t border-slate-100 transition hover:bg-slate-50/60"
                      >

                        <td className="px-5 py-4">

                          <p className="text-sm font-semibold text-slate-800">
                            {
                              DOCUMENT_LABELS[
                                document.document_type
                              ]
                            }
                          </p>

                          <p className="mt-1 max-w-[300px] truncate text-xs text-slate-400">
                            {document.file_name ||
                              document.sent_to_email ||
                              "Email record"}
                          </p>

                        </td>

                        <td className="px-4 py-4">

                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                              document.status
                            )}`}
                          >
                            {
                              STATUS_LABELS[
                                document.status
                              ]
                            }
                          </span>

                        </td>

                        <td className="px-4 py-4 text-sm text-slate-500">
                          {formatDate(
                            document.received_at ||
                              document.sent_at ||
                              document.created_at
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-500">
                          {formatDate(
                            document.expires_at
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-500">
                          {formatBytes(
                            document.file_size_bytes
                          )}
                        </td>

                        <td className="px-4 py-4">

                          <p className="text-sm text-slate-700">
                            {document.signer_name ||
                              "—"}
                          </p>

                          {document.signer_title ? (
                            <p className="mt-1 text-xs text-slate-400">
                              {document.signer_title}
                            </p>
                          ) : null}

                        </td>

                        <td className="px-5 py-4">

                          <div className="flex justify-end gap-2">

                            {document.storage_path ? (

                              <button
                                type="button"
                                disabled={
                                  busyDocumentId ===
                                  document.id
                                }
                                onClick={() =>
                                  downloadDocument(
                                    document
                                  )
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
                              >
                                Download
                              </button>

                            ) : (

                              <span className="text-xs text-slate-400">
                                Email record
                              </span>

                            )}

                            {document.document_type ===
                              "dispatch_agreement" &&
                            document.status ===
                              "received" ? (

                              <button
                                type="button"
                                disabled={
                                  busyDocumentId ===
                                  document.id
                                }
                                onClick={() =>
                                  setStatus(
                                    document,
                                    "signed"
                                  )
                                }
                                className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
                              >
                                Mark Signed
                              </button>

                            ) : null}

                            {[
                              "received",
                              "signed",
                            ].includes(
                              document.status
                            ) ? (

                              <button
                                type="button"
                                disabled={
                                  busyDocumentId ===
                                  document.id
                                }
                                onClick={() =>
                                  setStatus(
                                    document,
                                    "approved"
                                  )
                                }
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
                              >
                                Approve
                              </button>

                            ) : null}

                          </div>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </section>

        {/* SECURITY NOTE */}

        <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500">

          Carrier files are stored inside the private{" "}

          <strong className="font-semibold text-slate-700">
            carrier-document-vault
          </strong>{" "}

          bucket. Generated download links expire after 10 minutes.

        </div>

      </div>

    </main>
  );
}

/*
|--------------------------------------------------------------------------
| SEND CARD
|--------------------------------------------------------------------------
*/

function SendCard({
  title,
  description,
  document,
  busy,
  onSend,
}: {
  title: string;

  description: string;

  document?: DocumentRecord;

  busy: boolean;

  onSend: () => void;
}) {
  const returned =
    document &&
    [
      "received",
      "signed",
      "approved",
    ].includes(
      document.status
    );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex items-start gap-4">

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white">
          PDF
        </div>

        <div className="min-w-0 flex-1">

          <div className="flex items-start justify-between gap-3">

            <div>

              <h3 className="font-bold text-slate-900">
                {title}
              </h3>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                {description}
              </p>

            </div>

            {document ? (

              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                  document.status
                )}`}
              >
                {
                  STATUS_LABELS[
                    document.status
                  ]
                }
              </span>

            ) : (

              <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
                Not Sent
              </span>

            )}

          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">

            <p className="text-xs text-slate-400">
              {document?.sent_at
                ? `Last sent ${formatDateTime(
                    document.sent_at
                  )}`
                : "Not sent yet"}
            </p>

            {returned ? (

              <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                ✓ Returned
              </span>

            ) : (

              <button
                type="button"
                disabled={busy}
                onClick={onSend}
                className="rounded-lg bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy
                  ? "Sending..."
                  : document?.status ===
                      "sent"
                    ? "Resend"
                    : "Send"}
              </button>

            )}

          </div>

        </div>

      </div>

    </div>
  );
}