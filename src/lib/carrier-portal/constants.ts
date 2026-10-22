export const PORTAL_DOCUMENT_REQUIREMENTS = [
  {
    type: "dispatch_agreement",
    label: "Dispatch Agreement",
    required: true,
    uploadable: false,
    description: "Complete the secure signing link SlateLane sends separately.",
  },
  {
    type: "carrier_packet",
    label: "Carrier Credential Packet",
    required: true,
    uploadable: false,
    description: "Complete the secure carrier packet form sent by SlateLane.",
  },
  {
    type: "authority",
    label: "MC Operating Authority",
    required: true,
    uploadable: true,
    description: "Upload a PDF copy of your active operating authority.",
  },
  {
    type: "w9",
    label: "Completed W-9",
    required: true,
    uploadable: true,
    description: "Upload your completed, signed W-9 as a PDF.",
  },
  {
    type: "coi",
    label: "Certificate of Insurance",
    required: true,
    uploadable: true,
    description: "Upload your current certificate of insurance as a PDF.",
  },
  {
    type: "limited_power_of_attorney",
    label: "Limited Power of Attorney",
    required: true,
    uploadable: true,
    description: "Upload the signed limited power of attorney as a PDF.",
  },
  {
    type: "factoring_agreement",
    label: "Factoring Agreement",
    required: false,
    uploadable: true,
    description: "Upload this if you use a factoring company.",
  },
  {
    type: "factoring_noa",
    label: "Notice of Assignment (NOA)",
    required: false,
    uploadable: true,
    description: "Upload this if your factoring company requires an NOA.",
  },
] as const;

export const PORTAL_UPLOAD_DOCUMENT_TYPES = [
  "authority",
  "w9",
  "coi",
  "factoring_agreement",
  "factoring_noa",
  "limited_power_of_attorney",
] as const;

export type PortalDocumentType =
  (typeof PORTAL_DOCUMENT_REQUIREMENTS)[number]["type"];

export type PortalUploadDocumentType =
  (typeof PORTAL_UPLOAD_DOCUMENT_TYPES)[number];

export function isPortalUploadDocumentType(
  value: string
): value is PortalUploadDocumentType {
  return (
    PORTAL_UPLOAD_DOCUMENT_TYPES as readonly string[]
  ).includes(value);
}

export function portalDocumentLabel(value: string) {
  return (
    PORTAL_DOCUMENT_REQUIREMENTS.find(
      (item) => item.type === value
    )?.label ?? "Carrier document"
  );
}
