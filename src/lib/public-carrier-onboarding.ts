import "server-only";

import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  readFile,
} from "node:fs/promises";

import path from "node:path";

import {
  PDFDocument,
  PDFFont,
  StandardFonts,
  rgb,
} from "pdf-lib";

import {
  createClient,
} from "@supabase/supabase-js";

export type PublicDocumentType =
  | "dispatch_agreement"
  | "carrier_packet";

const DOCUMENT_BUCKET =
  "carrier-document-vault";

const AGREEMENT_VERSION =
  "1.0 - September 2026";

const PACKET_VERSION =
  "1.0 - September 2026";

const LINK_LIFETIME_HOURS =
  168;

function adminClient() {
  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase service-role configuration is missing."
    );
  }

  return createClient(
    url,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function sha256(
  value: string
) {
  return createHash(
    "sha256"
  )
    .update(value)
    .digest("hex");
}

function clean(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function bool(
  value: unknown
) {
  return (
    value === true ||
    value === "true"
  );
}

function today() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function safeFileName(
  value: string
) {
  return value
    .replace(
      /[^a-zA-Z0-9._-]+/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    )
    .replace(
      /^[-.]+|[-.]+$/g,
      ""
    )
    .slice(
      0,
      120
    );
}

function checkbox(
  form: ReturnType<
    PDFDocument["getForm"]
  >,
  name: string,
  checked: boolean
) {
  try {
    const field =
      form.getCheckBox(
        name
      );

    if (checked) {
      field.check();
    } else {
      field.uncheck();
    }
  } catch {
    // Template version may not contain every optional field.
  }
}

function textField(
  form: ReturnType<
    PDFDocument["getForm"]
  >,
  name: string,
  value: unknown
) {
  try {
    form
      .getTextField(
        name
      )
      .setText(
        clean(value)
      );
  } catch {
    // Template version may not contain every optional field.
  }
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const words =
    text
      .replace(
        /\s+/g,
        " "
      )
      .trim()
      .split(" ");

  const lines:
    string[] = [];

  let line =
    "";

  for (
    const word of words
  ) {
    const candidate =
      line
        ? `${line} ${word}`
        : word;

    const width =
      font.widthOfTextAtSize(
        candidate,
        size
      );

    if (
      width >
        maxWidth &&
      line
    ) {
      lines.push(
        line
      );

      line =
        word;
    } else {
      line =
        candidate;
    }
  }

  if (line) {
    lines.push(
      line
    );
  }

  return lines;
}

async function appendSubmissionSummary(
  pdf: PDFDocument,
  title: string,
  rows: Array<
    [
      string,
      string
    ]
  >
) {
  const regular =
    await pdf.embedFont(
      StandardFonts.Helvetica
    );

  const bold =
    await pdf.embedFont(
      StandardFonts.HelveticaBold
    );

  const pageWidth =
    612;

  const pageHeight =
    792;

  const margin =
    48;

  let page =
    pdf.addPage([
      pageWidth,
      pageHeight,
    ]);

  let y =
    744;

  function newPage() {
    page =
      pdf.addPage([
        pageWidth,
        pageHeight,
      ]);

    y =
      744;
  }

  function ensureSpace(
    amount: number
  ) {
    if (
      y - amount <
      55
    ) {
      newPage();
    }
  }

  page.drawText(
    "SLATE LANE DISPATCH",
    {
      x: margin,
      y,
      size: 11,
      font: bold,
      color:
        rgb(
          0.06,
          0.09,
          0.16
        ),
    }
  );

  y -= 28;

  page.drawText(
    title,
    {
      x: margin,
      y,
      size: 18,
      font: bold,
      color:
        rgb(
          0.06,
          0.09,
          0.16
        ),
    }
  );

  y -= 16;

  page.drawText(
    "Electronic submission summary incorporated into the completed onboarding record.",
    {
      x: margin,
      y,
      size: 9,
      font: regular,
      color:
        rgb(
          0.35,
          0.4,
          0.48
        ),
    }
  );

  y -= 26;

  for (
    const [
      label,
      value,
    ] of rows
  ) {
    const safeValue =
      value ||
      "—";

    const valueLines =
      wrapText(
        safeValue,
        regular,
        9.5,
        330
      );

    const height =
      Math.max(
        22,
        valueLines.length *
          13 +
          8
      );

    ensureSpace(
      height
    );

    page.drawText(
      label,
      {
        x: margin,
        y,
        size: 8.5,
        font: bold,
        color:
          rgb(
            0.35,
            0.4,
            0.48
          ),
      }
    );

    let valueY =
      y;

    for (
      const line of valueLines
    ) {
      page.drawText(
        line,
        {
          x: 205,
          y: valueY,
          size: 9.5,
          font: regular,
          color:
            rgb(
              0.08,
              0.11,
              0.18
            ),
        }
      );

      valueY -=
        13;
    }

    y -=
      height;

    page.drawLine({
      start: {
        x: margin,
        y: y + 8,
      },

      end: {
        x:
          pageWidth -
          margin,
        y: y + 8,
      },

      thickness:
        0.5,

      color:
        rgb(
          0.88,
          0.9,
          0.93
        ),
    });
  }
}

export async function createPublicCarrierLink(
  input: {
    onboardingId: string;

    documentType:
      PublicDocumentType;

    recipientEmail: string;
  }
) {
  const supabase =
    adminClient();

  const token =
    randomBytes(
      32
    ).toString(
      "base64url"
    );

  const tokenHash =
    sha256(
      token
    );

  const expiresAt =
    new Date(
      Date.now() +
        LINK_LIFETIME_HOURS *
          60 *
          60 *
          1000
    ).toISOString();

  await supabase
    .from(
      "carrier_onboarding_links"
    )
    .update({
      status:
        "revoked",

      revoked_at:
        new Date().toISOString(),
    })
    .eq(
      "onboarding_id",
      input.onboardingId
    )
    .eq(
      "document_type",
      input.documentType
    )
    .eq(
      "status",
      "active"
    );

  const {
    data,
    error,
  } = await supabase
    .from(
      "carrier_onboarding_links"
    )
    .insert({
      onboarding_id:
        input.onboardingId,

      document_type:
        input.documentType,

      token_hash:
        tokenHash,

      recipient_email:
        input.recipientEmail
          .trim()
          .toLowerCase(),

      status:
        "active",

      expires_at:
        expiresAt,

      metadata: {
        delivery:
          "secure_browser_form",

        link_version:
          1,
      },
    })
    .select(
      "id,expires_at"
    )
    .single();

  if (error) {
    throw new Error(
      error.message
    );
  }

  return {
    linkId:
      data.id,

    token,

    expiresAt:
      data.expires_at,
  };
}

export async function revokePublicCarrierLink(
  linkId: string
) {
  const supabase =
    adminClient();

  await supabase
    .from(
      "carrier_onboarding_links"
    )
    .update({
      status:
        "revoked",

      revoked_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      linkId
    );
}

export async function attachSentDocumentToPublicLink(
  linkId: string,
  documentId: string
) {
  const supabase =
    adminClient();

  await supabase
    .from(
      "carrier_onboarding_links"
    )
    .update({
      sent_document_id:
        documentId,
    })
    .eq(
      "id",
      linkId
    );
}

async function resolveLink(
  token: string,
  markOpened = false
) {
  const supabase =
    adminClient();

  const tokenHash =
    sha256(
      token
    );

  const {
    data: link,
    error,
  } = await supabase
    .from(
      "carrier_onboarding_links"
    )
    .select(
      `
      id,
      onboarding_id,
      document_type,
      recipient_email,
      status,
      expires_at,
      completed_at,
      submission_document_id,
      created_at
      `
    )
    .eq(
      "token_hash",
      tokenHash
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  if (!link) {
    throw new Error(
      "This onboarding link is invalid."
    );
  }

  const expired =
    new Date(
      link.expires_at
    ).getTime() <
    Date.now();

  if (
    expired &&
    link.status ===
      "active"
  ) {
    await supabase
      .from(
        "carrier_onboarding_links"
      )
      .update({
        status:
          "expired",
      })
      .eq(
        "id",
        link.id
      );

    link.status =
      "expired";
  }

  if (
    markOpened &&
    link.status ===
      "active"
  ) {
    await supabase
      .from(
        "carrier_onboarding_links"
      )
      .update({
        last_opened_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        link.id
      );
  }

  const {
    data: onboarding,
    error:
      onboardingError,
  } = await supabase
    .from(
      "carrier_onboardings"
    )
    .select(
      `
      id,
      carrier_id,
      company_name,
      dot_number,
      mc_number,
      primary_contact_name,
      primary_contact_email,
      primary_contact_phone,
      factoring_company
      `
    )
    .eq(
      "id",
      link.onboarding_id
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

  return {
    link,
    onboarding,
  };
}

export async function getPublicCarrierOnboarding(
  token: string
) {
  const {
    link,
    onboarding,
  } =
    await resolveLink(
      token,
      true
    );

  return {
    documentType:
      link.document_type as PublicDocumentType,

    status:
      link.status,

    expiresAt:
      link.expires_at,

    completedAt:
      link.completed_at,

    onboarding: {
      companyName:
        onboarding.company_name,

      dotNumber:
        onboarding.dot_number,

      mcNumber:
        onboarding.mc_number,

      contactName:
        onboarding.primary_contact_name,

      email:
        link.recipient_email ||
        onboarding.primary_contact_email,

      phone:
        onboarding.primary_contact_phone,

      factoringCompany:
        onboarding.factoring_company,
    },
  };
}

async function fillAgreementPdf(
  payload: Record<
    string,
    unknown
  >
) {
  const sourcePath =
    path.join(
      process.cwd(),
      "public",
      "documents",
      "SlateLane_Carrier_Dispatcher_Agreement_Fillable.pdf"
    );

  const bytes =
    await readFile(
      sourcePath
    );

  const pdf =
    await PDFDocument.load(
      bytes
    );

  const form =
    pdf.getForm();

  const font =
    await pdf.embedFont(
      StandardFonts.Helvetica
    );

  const dispatcherLegalName =
    process.env
      .SLATELANE_LEGAL_NAME ||
    "Slate Lane Dispatch";

  const dispatcherEmail =
    process.env
      .RESEND_REPLY_TO ||
    "dispatch@slatelanedispatch.com";

  const dispatcherPhone =
    process.env
      .SLATELANE_PHONE ||
    "";

  textField(
    form,
    "dispatcher_legal_name",
    dispatcherLegalName
  );

  textField(
    form,
    "dispatcher_dba",
    "Slate Lane Dispatch"
  );

  textField(
    form,
    "dispatcher_email",
    dispatcherEmail
  );

  textField(
    form,
    "dispatcher_phone",
    dispatcherPhone
  );

  textField(
    form,
    "carrier_legal_name",
    payload.carrierLegalName
  );

  textField(
    form,
    "carrier_dba",
    payload.carrierDba
  );

  textField(
    form,
    "carrier_usdot",
    payload.usdot
  );

  textField(
    form,
    "carrier_mc",
    payload.mc
  );

  textField(
    form,
    "effective_date",
    payload.effectiveDate ||
      today()
  );

  checkbox(
    form,
    "svc_loads",
    true
  );

  checkbox(
    form,
    "svc_rates",
    true
  );

  checkbox(
    form,
    "svc_setup",
    true
  );

  checkbox(
    form,
    "svc_ratecon",
    true
  );

  checkbox(
    form,
    "svc_calls",
    true
  );

  checkbox(
    form,
    "svc_docs",
    true
  );

  checkbox(
    form,
    "svc_invoice",
    true
  );

  checkbox(
    form,
    "svc_loadboard",
    true
  );

  checkbox(
    form,
    "sign_ratecon_authorized",
    bool(
      payload.rateConfirmationAuthorization
    )
  );

  checkbox(
    form,
    "sign_setup_authorized",
    bool(
      payload.brokerSetupAuthorization
    )
  );

  checkbox(
    form,
    "no_general_poa",
    true
  );

  textField(
    form,
    "equipment_types",
    payload.equipmentTypes
  );

  textField(
    form,
    "truck_units",
    payload.truckUnits
  );

  textField(
    form,
    "home_base",
    payload.homeBase
  );

  textField(
    form,
    "preferred_lanes",
    payload.preferredLanes
  );

  textField(
    form,
    "avoid_regions",
    payload.avoidRegions
  );

  textField(
    form,
    "max_deadhead",
    payload.maxDeadhead
  );

  textField(
    form,
    "min_rpm",
    payload.minRpm
  );

  textField(
    form,
    "min_load_rate",
    payload.minLoadRate
  );

  textField(
    form,
    "commodity_restrictions",
    payload.commodityRestrictions
  );

  textField(
    form,
    "home_time",
    payload.homeTime
  );

  textField(
    form,
    "dispatch_special_instructions",
    payload.specialInstructions
  );

  checkbox(
    form,
    "fee_percentage",
    payload.feeType ===
      "percentage"
  );

  checkbox(
    form,
    "fee_flat_load",
    payload.feeType ===
      "flat_load"
  );

  checkbox(
    form,
    "fee_weekly",
    payload.feeType ===
      "weekly_flat"
  );

  checkbox(
    form,
    "basis_linehaul",
    payload.feeBasis !==
      "accessorial"
  );

  checkbox(
    form,
    "basis_accessorial",
    payload.feeBasis ===
      "accessorial"
  );

  textField(
    form,
    "invoice_frequency",
    payload.invoiceFrequency ||
      "Weekly"
  );

  textField(
    form,
    "payment_due_days",
    payload.paymentDue ||
      "7 days"
  );

  textField(
    form,
    "payment_method",
    payload.paymentMethod
  );

  checkbox(
    form,
    "factor_preapproval",
    bool(
      payload.factoringPreapproval
    )
  );

  textField(
    form,
    "factor_company",
    payload.factoringCompany
  );

  checkbox(
    form,
    "credential_consent",
    bool(
      payload.credentialConsent
    )
  );

  textField(
    form,
    "initial_term",
    "Month-to-month"
  );

  textField(
    form,
    "termination_notice",
    "7 days written notice"
  );

  textField(
    form,
    "notice_carrier_email",
    payload.email
  );

  textField(
    form,
    "notice_dispatcher_email",
    dispatcherEmail
  );

  textField(
    form,
    "governing_law",
    payload.governingLaw
  );

  textField(
    form,
    "venue",
    payload.venue
  );

  checkbox(
    form,
    "carrier_esign_consent",
    bool(
      payload.esignConsent
    )
  );

  textField(
    form,
    "carrier_signer_name",
    payload.signerName
  );

  textField(
    form,
    "carrier_signer_title",
    payload.signerTitle
  );

  textField(
    form,
    "carrier_signature_typed",
    payload.typedSignature
  );

  textField(
    form,
    "carrier_signature_date",
    today()
  );

  textField(
    form,
    "sched_truck_id",
    payload.truckUnits
  );

  textField(
    form,
    "sched_equipment",
    payload.equipmentTypes
  );

  textField(
    form,
    "sched_current_location",
    payload.homeBase
  );

  textField(
    form,
    "sched_destination",
    payload.preferredLanes
  );

  textField(
    form,
    "sched_min_rate",
    `${clean(
      payload.minRpm
    )} / ${clean(
      payload.minLoadRate
    )}`
  );

  textField(
    form,
    "sched_deadhead",
    payload.maxDeadhead
  );

  textField(
    form,
    "sched_availability",
    payload.homeTime
  );

  textField(
    form,
    "sched_restrictions",
    `${clean(
      payload.avoidRegions
    )} ${clean(
      payload.commodityRestrictions
    )}`.trim()
  );

  textField(
    form,
    "sched_allocation_rule",
    payload.specialInstructions
  );

  checkbox(
    form,
    "sched_confirm_specific",
    true
  );

  checkbox(
    form,
    "sched_confirm_no_reassign",
    true
  );

  form.updateFieldAppearances(
    font
  );

  form.flatten();

  await appendSubmissionSummary(
    pdf,
    "Electronic Agreement Submission & Audit Summary",
    [
      [
        "Carrier legal name",
        clean(
          payload.carrierLegalName
        ),
      ],

      [
        "USDOT / MC",
        `${clean(
          payload.usdot
        )} / ${clean(
          payload.mc
        )}`,
      ],

      [
        "Carrier contact",
        `${clean(
          payload.contactName
        )} | ${clean(
          payload.email
        )} | ${clean(
          payload.phone
        )}`,
      ],

      [
        "Fee structure",
        `${clean(
          payload.feeType
        )}: ${clean(
          payload.feeValue
        )}`,
      ],

      [
        "Fee basis",
        clean(
          payload.feeBasis
        ),
      ],

      [
        "Invoice frequency",
        clean(
          payload.invoiceFrequency
        ),
      ],

      [
        "Payment due",
        clean(
          payload.paymentDue
        ),
      ],

      [
        "Payment method",
        clean(
          payload.paymentMethod
        ),
      ],

      [
        "Home base",
        clean(
          payload.homeBase
        ),
      ],

      [
        "Equipment",
        clean(
          payload.equipmentTypes
        ),
      ],

      [
        "Preferred lanes",
        clean(
          payload.preferredLanes
        ),
      ],

      [
        "Avoid regions",
        clean(
          payload.avoidRegions
        ),
      ],

      [
        "Maximum deadhead",
        clean(
          payload.maxDeadhead
        ),
      ],

      [
        "Target / minimum RPM",
        clean(
          payload.minRpm
        ),
      ],

      [
        "Minimum load rate",
        clean(
          payload.minLoadRate
        ),
      ],

      [
        "Special instructions",
        clean(
          payload.specialInstructions
        ),
      ],

      [
        "Governing law",
        clean(
          payload.governingLaw
        ),
      ],

      [
        "Venue",
        clean(
          payload.venue
        ),
      ],

      [
        "Signer",
        `${clean(
          payload.signerName
        )} — ${clean(
          payload.signerTitle
        )}`,
      ],

      [
        "Typed electronic signature",
        clean(
          payload.typedSignature
        ),
      ],

      [
        "Electronic consent",
        bool(
          payload.esignConsent
        )
          ? "Accepted"
          : "Not accepted",
      ],

      [
        "Agreement version",
        AGREEMENT_VERSION,
      ],

      [
        "Submission timestamp",
        new Date().toISOString(),
      ],
    ]
  );

  return pdf.save();
}

async function fillCarrierPacketPdf(
  payload: Record<
    string,
    unknown
  >
) {
  const sourcePath =
    path.join(
      process.cwd(),
      "public",
      "documents",
      "SlateLane_Carrier_Credential_Onboarding_Packet_Fillable.pdf"
    );

  const bytes =
    await readFile(
      sourcePath
    );

  const pdf =
    await PDFDocument.load(
      bytes
    );

  const form =
    pdf.getForm();

  const font =
    await pdf.embedFont(
      StandardFonts.Helvetica
    );

  textField(
    form,
    "pkt_legal_name",
    payload.legalName
  );

  textField(
    form,
    "pkt_dba",
    payload.dba
  );

  textField(
    form,
    "pkt_usdot",
    payload.usdot
  );

  textField(
    form,
    "pkt_mc",
    payload.mc
  );

  textField(
    form,
    "pkt_state_entity",
    payload.stateEntity
  );

  textField(
    form,
    "pkt_physical_address",
    payload.physicalAddress
  );

  textField(
    form,
    "pkt_mailing_address",
    payload.mailingAddress
  );

  textField(
    form,
    "pkt_city_state_zip",
    payload.cityStateZip
  );

  textField(
    form,
    "pkt_country",
    payload.country ||
      "United States"
  );

  textField(
    form,
    "pkt_phone",
    payload.phone
  );

  textField(
    form,
    "pkt_email",
    payload.email
  );

  textField(
    form,
    "pkt_mcs150",
    payload.mcs150Date
  );

  textField(
    form,
    "pkt_authority_since",
    payload.authoritySince
  );

  checkbox(
    form,
    "pkt_authority_property",
    bool(
      payload.authorityProperty
    )
  );

  checkbox(
    form,
    "pkt_usdot_active",
    bool(
      payload.usdotActive
    )
  );

  checkbox(
    form,
    "pkt_boc3",
    bool(
      payload.boc3
    )
  );

  checkbox(
    form,
    "pkt_ucr",
    bool(
      payload.ucr
    )
  );

  textField(
    form,
    "pkt_owner",
    payload.ownerName
  );

  textField(
    form,
    "pkt_owner_phone",
    payload.ownerPhone
  );

  textField(
    form,
    "pkt_dispatch_contact",
    payload.dispatchContact
  );

  textField(
    form,
    "pkt_dispatch_phone",
    payload.dispatchPhone
  );

  textField(
    form,
    "pkt_billing_contact",
    payload.billingContact
  );

  textField(
    form,
    "pkt_billing_email",
    payload.billingEmail
  );

  textField(
    form,
    "pkt_emergency_contact",
    payload.emergencyContact
  );

  textField(
    form,
    "pkt_emergency_phone",
    payload.emergencyPhone
  );

  textField(
    form,
    "pkt_insurer",
    payload.insurer
  );

  textField(
    form,
    "pkt_agent",
    payload.insuranceAgent
  );

  textField(
    form,
    "pkt_agent_phone",
    payload.insuranceAgentPhone
  );

  textField(
    form,
    "pkt_agent_email",
    payload.insuranceAgentEmail
  );

  textField(
    form,
    "pkt_auto_limit",
    payload.autoLimit
  );

  textField(
    form,
    "pkt_auto_exp",
    payload.autoExpiration
  );

  textField(
    form,
    "pkt_cargo_limit",
    payload.cargoLimit
  );

  textField(
    form,
    "pkt_cargo_exp",
    payload.cargoExpiration
  );

  textField(
    form,
    "pkt_trailer_interchange",
    payload.trailerInterchange
  );

  textField(
    form,
    "pkt_general_liability",
    payload.generalLiability
  );

  checkbox(
    form,
    "pkt_reefer_breakdown",
    bool(
      payload.reeferBreakdown
    )
  );

  checkbox(
    form,
    "pkt_hazmat_insurance",
    bool(
      payload.hazmatInsurance
    )
  );

  textField(
    form,
    "pkt_power_units",
    payload.powerUnits
  );

  textField(
    form,
    "pkt_drivers",
    payload.drivers
  );

  textField(
    form,
    "pkt_primary_equipment",
    payload.primaryEquipment
  );

  textField(
    form,
    "pkt_trailer_length",
    payload.trailerLength
  );

  textField(
    form,
    "pkt_payload",
    payload.payloadCapacity
  );

  textField(
    form,
    "pkt_home_base",
    payload.homeBase
  );

  const equipment =
    Array.isArray(
      payload.equipmentOptions
    )
      ? payload.equipmentOptions.map(
          String
        )
      : [];

  const equipmentMap = [
    "dry_van",
    "reefer",
    "flatbed",
    "step_deck",
    "box_truck",
    "hotshot",
    "power_only",
    "sprinter",
    "other",
  ];

  equipmentMap.forEach(
    (
      value,
      index
    ) => {
      checkbox(
        form,
        `pkt_eq_${index}`,
        equipment.includes(
          value
        )
      );
    }
  );

  textField(
    form,
    "pkt_equipment_details",
    payload.equipmentDetails
  );

  textField(
    form,
    "pkt_preferred_origin",
    payload.preferredOrigin
  );

  textField(
    form,
    "pkt_preferred_dest",
    payload.preferredDestination
  );

  textField(
    form,
    "pkt_avoid",
    payload.avoidRegions
  );

  textField(
    form,
    "pkt_deadhead",
    payload.maxDeadhead
  );

  textField(
    form,
    "pkt_min_rpm",
    payload.minRpm
  );

  textField(
    form,
    "pkt_min_rate",
    payload.minRate
  );

  textField(
    form,
    "pkt_home_time",
    payload.homeTime
  );

  textField(
    form,
    "pkt_weekly_target",
    payload.weeklyTarget
  );

  textField(
    form,
    "pkt_commodity_limits",
    payload.commodityLimits
  );

  checkbox(
    form,
    "pkt_factored",
    bool(
      payload.factored
    )
  );

  textField(
    form,
    "pkt_factor_name",
    payload.factorName
  );

  textField(
    form,
    "pkt_factor_phone",
    payload.factorPhone
  );

  textField(
    form,
    "pkt_factor_email",
    payload.factorEmail
  );

  textField(
    form,
    "pkt_factor_portal",
    payload.factorPortal
  );

  textField(
    form,
    "pkt_remittance",
    payload.remittanceInstructions
  );

  textField(
    form,
    "pkt_quickpay",
    payload.quickPay
  );

  checkbox(
    form,
    "pkt_dat_auth",
    bool(
      payload.datAuthorization
    )
  );

  checkbox(
    form,
    "pkt_truckstop_auth",
    bool(
      payload.truckstopAuthorization
    )
  );

  checkbox(
    form,
    "pkt_other_board_auth",
    bool(
      payload.otherBoardAuthorization
    )
  );

  textField(
    form,
    "pkt_other_boards",
    payload.otherBoards
  );

  checkbox(
    form,
    "pkt_broker_setup_auth",
    bool(
      payload.brokerSetupAuthorization
    )
  );

  checkbox(
    form,
    "pkt_ratecon_auth",
    bool(
      payload.rateConfirmationAuthorization
    )
  );

  checkbox(
    form,
    "cert_true",
    bool(
      payload.certify
    )
  );

  checkbox(
    form,
    "cert_authority",
    bool(
      payload.certify
    )
  );

  checkbox(
    form,
    "cert_insurance",
    bool(
      payload.certify
    )
  );

  checkbox(
    form,
    "cert_no_rebroker",
    bool(
      payload.certify
    )
  );

  checkbox(
    form,
    "cert_safety",
    bool(
      payload.certify
    )
  );

  checkbox(
    form,
    "cert_notify",
    bool(
      payload.certify
    )
  );

  checkbox(
    form,
    "pkt_esign_consent",
    bool(
      payload.esignConsent
    )
  );

  textField(
    form,
    "pkt_signer_name",
    payload.signerName
  );

  textField(
    form,
    "pkt_signer_title",
    payload.signerTitle
  );

  textField(
    form,
    "pkt_signature_typed",
    payload.typedSignature
  );

  textField(
    form,
    "pkt_signature_date",
    today()
  );

  textField(
    form,
    "cover_carrier_name",
    payload.legalName
  );

  textField(
    form,
    "cover_dba",
    payload.dba
  );

  textField(
    form,
    "cover_usdot",
    payload.usdot
  );

  textField(
    form,
    "cover_mc",
    payload.mc
  );

  textField(
    form,
    "cover_contact",
    payload.ownerName
  );

  textField(
    form,
    "cover_phone",
    payload.phone
  );

  textField(
    form,
    "cover_email",
    payload.email
  );

  textField(
    form,
    "cover_auto",
    payload.autoLimit
  );

  textField(
    form,
    "cover_cargo",
    payload.cargoLimit
  );

  textField(
    form,
    "cover_factor",
    payload.factorName
  );

  textField(
    form,
    "cover_remit",
    payload.remittanceInstructions
  );

  textField(
    form,
    "cover_equipment",
    payload.primaryEquipment
  );

  textField(
    form,
    "cover_dispatch_contact",
    payload.dispatchContact
  );

  form.updateFieldAppearances(
    font
  );

  form.flatten();

  await appendSubmissionSummary(
    pdf,
    "Electronic Carrier Packet Submission Summary",
    [
      [
        "Carrier legal name",
        clean(
          payload.legalName
        ),
      ],

      [
        "USDOT / MC",
        `${clean(
          payload.usdot
        )} / ${clean(
          payload.mc
        )}`,
      ],

      [
        "Owner",
        clean(
          payload.ownerName
        ),
      ],

      [
        "Carrier email",
        clean(
          payload.email
        ),
      ],

      [
        "Primary equipment",
        clean(
          payload.primaryEquipment
        ),
      ],

      [
        "Power units",
        clean(
          payload.powerUnits
        ),
      ],

      [
        "Drivers",
        clean(
          payload.drivers
        ),
      ],

      [
        "Home base",
        clean(
          payload.homeBase
        ),
      ],

      [
        "Preferred origin",
        clean(
          payload.preferredOrigin
        ),
      ],

      [
        "Preferred destinations",
        clean(
          payload.preferredDestination
        ),
      ],

      [
        "Target RPM",
        clean(
          payload.minRpm
        ),
      ],

      [
        "Minimum load rate",
        clean(
          payload.minRate
        ),
      ],

      [
        "Insurance carrier",
        clean(
          payload.insurer
        ),
      ],

      [
        "Auto liability",
        `${clean(
          payload.autoLimit
        )} | Expires ${clean(
          payload.autoExpiration
        )}`,
      ],

      [
        "Cargo coverage",
        `${clean(
          payload.cargoLimit
        )} | Expires ${clean(
          payload.cargoExpiration
        )}`,
      ],

      [
        "Factoring company",
        clean(
          payload.factorName
        ),
      ],

      [
        "Signer",
        `${clean(
          payload.signerName
        )} — ${clean(
          payload.signerTitle
        )}`,
      ],

      [
        "Typed electronic signature",
        clean(
          payload.typedSignature
        ),
      ],

      [
        "Certification",
        bool(
          payload.certify
        )
          ? "Accepted"
          : "Not accepted",
      ],

      [
        "Electronic signature consent",
        bool(
          payload.esignConsent
        )
          ? "Accepted"
          : "Not accepted",
      ],

      [
        "Packet version",
        PACKET_VERSION,
      ],

      [
        "Submission timestamp",
        new Date().toISOString(),
      ],
    ]
  );

  return pdf.save();
}

function validateAgreement(
  payload: Record<
    string,
    unknown
  >
) {
  const required = [
    [
      "carrierLegalName",
      "Carrier legal name",
    ],

    [
      "usdot",
      "USDOT number",
    ],

    [
      "contactName",
      "Carrier contact name",
    ],

    [
      "email",
      "Carrier email",
    ],

    [
      "signerName",
      "Signer name",
    ],

    [
      "signerTitle",
      "Signer title",
    ],

    [
      "typedSignature",
      "Typed signature",
    ],
  ];

  for (
    const [
      key,
      label,
    ] of required
  ) {
    if (
      !clean(
        payload[key]
      )
    ) {
      throw new Error(
        `${label} is required.`
      );
    }
  }

  if (
    !bool(
      payload.reviewAccepted
    )
  ) {
    throw new Error(
      "You must confirm that you reviewed the agreement."
    );
  }

  if (
    !bool(
      payload.esignConsent
    )
  ) {
    throw new Error(
      "Electronic signature consent is required."
    );
  }

  if (
    clean(
      payload.typedSignature
    ).toLowerCase() !==
    clean(
      payload.signerName
    ).toLowerCase()
  ) {
    throw new Error(
      "Typed signature must match the signer name."
    );
  }
}

function validatePacket(
  payload: Record<
    string,
    unknown
  >
) {
  const required = [
    [
      "legalName",
      "Carrier legal name",
    ],

    [
      "usdot",
      "USDOT number",
    ],

    [
      "email",
      "Carrier email",
    ],

    [
      "ownerName",
      "Owner / authorized representative",
    ],

    [
      "primaryEquipment",
      "Primary equipment",
    ],

    [
      "signerName",
      "Signer name",
    ],

    [
      "signerTitle",
      "Signer title",
    ],

    [
      "typedSignature",
      "Typed signature",
    ],
  ];

  for (
    const [
      key,
      label,
    ] of required
  ) {
    if (
      !clean(
        payload[key]
      )
    ) {
      throw new Error(
        `${label} is required.`
      );
    }
  }

  if (
    !bool(
      payload.certify
    )
  ) {
    throw new Error(
      "Carrier certification is required."
    );
  }

  if (
    !bool(
      payload.esignConsent
    )
  ) {
    throw new Error(
      "Electronic signature consent is required."
    );
  }

  if (
    clean(
      payload.typedSignature
    ).toLowerCase() !==
    clean(
      payload.signerName
    ).toLowerCase()
  ) {
    throw new Error(
      "Typed signature must match the signer name."
    );
  }
}

export async function submitPublicCarrierOnboarding(
  token: string,
  payload: Record<
    string,
    unknown
  >,
  userAgent: string | null
) {
  const {
    link,
    onboarding,
  } =
    await resolveLink(
      token,
      false
    );

  if (
    link.status ===
    "completed"
  ) {
    throw new Error(
      "This form has already been submitted."
    );
  }

  if (
    link.status !==
    "active"
  ) {
    throw new Error(
      "This onboarding link is no longer active."
    );
  }

  let pdfBytes:
    Uint8Array;

  let fileName:
    string;

  let signerName:
    string;

  let signerTitle:
    string;

  let version:
    string;

  if (
    link.document_type ===
    "dispatch_agreement"
  ) {
    validateAgreement(
      payload
    );

    pdfBytes =
      await fillAgreementPdf(
        payload
      );

    signerName =
      clean(
        payload.signerName
      );

    signerTitle =
      clean(
        payload.signerTitle
      );

    version =
      AGREEMENT_VERSION;

    fileName =
      safeFileName(
        `${onboarding.company_name || "Carrier"}-SlateLane-Dispatch-Agreement-Signed.pdf`
      );
  } else {
    validatePacket(
      payload
    );

    pdfBytes =
      await fillCarrierPacketPdf(
        payload
      );

    signerName =
      clean(
        payload.signerName
      );

    signerTitle =
      clean(
        payload.signerTitle
      );

    version =
      PACKET_VERSION;

    fileName =
      safeFileName(
        `${onboarding.company_name || "Carrier"}-SlateLane-Carrier-Packet.pdf`
      );
  }

  const supabase =
    adminClient();

  const storagePath =
    [
      onboarding.id,
      link.document_type,
      `${Date.now()}-${fileName}`,
    ].join("/");

  const {
    error:
      storageError,
  } =
    await supabase.storage
      .from(
        DOCUMENT_BUCKET
      )
      .upload(
        storagePath,
        pdfBytes,
        {
          contentType:
            "application/pdf",

          upsert:
            false,
        }
      );

  if (
    storageError
  ) {
    throw new Error(
      `Completed PDF could not be stored: ${storageError.message}`
    );
  }

  const submittedAt =
    new Date().toISOString();

  const {
    data:
      documentRecord,
    error:
      documentError,
  } = await supabase
    .from(
      "carrier_document_records"
    )
    .insert({
      onboarding_id:
        onboarding.id,

      carrier_id:
        onboarding.carrier_id,

      document_type:
        link.document_type,

      status:
        "received",

      storage_bucket:
        DOCUMENT_BUCKET,

      storage_path:
        storagePath,

      file_name:
        fileName,

      mime_type:
        "application/pdf",

      file_size_bytes:
        pdfBytes.length,

      sent_to_email:
        link.recipient_email,

      received_at:
        submittedAt,

      signer_name:
        signerName,

      signer_title:
        signerTitle,

      notes:
        "Completed through secure Slate Lane browser onboarding.",

      metadata: {
        submission_method:
          "secure_browser_form",

        carrier_signed:
          true,

        agreement_version:
          version,

        link_id:
          link.id,

        submitted_at:
          submittedAt,
      },
    })
    .select(
      "id"
    )
    .single();

  if (
    documentError
  ) {
    await supabase.storage
      .from(
        DOCUMENT_BUCKET
      )
      .remove([
        storagePath,
      ]);

    throw new Error(
      documentError.message
    );
  }

  const {
    error:
      linkError,
  } = await supabase
    .from(
      "carrier_onboarding_links"
    )
    .update({
      status:
        "completed",

      completed_at:
        submittedAt,

      submission_document_id:
        documentRecord.id,
    })
    .eq(
      "id",
      link.id
    );

  if (
    linkError
  ) {
    console.error(
      "ONBOARDING LINK COMPLETION ERROR:",
      linkError
    );
  }

  const {
    error:
      auditError,
  } = await supabase
    .from(
      "carrier_onboarding_submissions"
    )
    .insert({
      link_id:
        link.id,

      onboarding_id:
        onboarding.id,

      document_type:
        link.document_type,

      signer_name:
        signerName,

      signer_title:
        signerTitle,

      signer_email:
        clean(
          payload.email
        ) ||
        link.recipient_email,

      agreement_version:
        version,

      consented_at:
        submittedAt,

      generated_document_id:
        documentRecord.id,

      submission_data:
        payload,

      audit_data: {
        submitted_at:
          submittedAt,

        user_agent:
          userAgent,

        link_created_at:
          link.created_at,

        recipient_email:
          link.recipient_email,
      },
    });

  if (
    auditError
  ) {
    console.error(
      "ONBOARDING AUDIT ERROR:",
      auditError
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
        onboarding.id,

      document_id:
        documentRecord.id,

      event_type:
        "uploaded",

      from_status:
        null,

      to_status:
        "received",

      actor:
        "carrier",

      note:
        "Carrier completed secure browser onboarding form.",

      metadata: {
        source:
          "secure_browser_form",

        link_id:
          link.id,

        signer_name:
          signerName,
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
    documentId:
      documentRecord.id,

    documentType:
      link.document_type as PublicDocumentType,

    companyName:
      onboarding.company_name ||
      "Carrier",

    recipientEmail:
      clean(
        payload.email
      ) ||
      link.recipient_email,

    fileName,

    pdfBytes,
  };
}