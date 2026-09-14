import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";

import {
  CARRIER_PACKET_VERSION,
  CarrierPacketFormData,
} from "./carrier-packet";

type GenerateCarrierPacketPdfArgs = {
  form: CarrierPacketFormData;

  submittedAt: string;

  audit?: {
    ip?: string | null;
    userAgent?: string | null;
  };
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

const MARGIN_X = 52;

const TOP_Y = 740;
const BOTTOM_Y = 55;

const BODY_SIZE = 9.5;
const LINE_HEIGHT = 14;

function safeText(
  input: unknown,
) {
  return String(input ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function displayValue(
  value: unknown,
) {
  const text =
    safeText(value).trim();

  return text || "Not provided";
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
) {
  const words =
    safeText(text).split(/\s+/);

  const lines: string[] = [];

  let current = "";

  for (const word of words) {
    const candidate =
      current
        ? `${current} ${word}`
        : word;

    if (
      font.widthOfTextAtSize(
        candidate,
        fontSize,
      ) <= maxWidth
    ) {
      current =
        candidate;
    } else {
      if (current) {
        lines.push(
          current,
        );
      }

      current =
        word;
    }
  }

  if (current) {
    lines.push(
      current,
    );
  }

  return lines;
}

export async function generateCarrierPacketPdf({
  form,
  submittedAt,
  audit,
}: GenerateCarrierPacketPdfArgs) {
  const pdf =
    await PDFDocument.create();

  pdf.setTitle(
    `Slate Lane Carrier Credential Packet - ${form.company_name}`,
  );

  pdf.setAuthor(
    "Slate Lane Dispatch",
  );

  pdf.setSubject(
    "Carrier Credential Packet",
  );

  pdf.setCreator(
    "Slate Lane Dispatch CRM",
  );

  pdf.setProducer(
    "Slate Lane Dispatch CRM",
  );

  const regular =
    await pdf.embedFont(
      StandardFonts.Helvetica,
    );

  const bold =
    await pdf.embedFont(
      StandardFonts.HelveticaBold,
    );

  const pages: PDFPage[] =
    [];

  let page =
    pdf.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ]);

  pages.push(page);

  let y =
    TOP_Y;

  const contentWidth =
    PAGE_WIDTH -
    MARGIN_X * 2;

  function addPage() {
    page =
      pdf.addPage([
        PAGE_WIDTH,
        PAGE_HEIGHT,
      ]);

    pages.push(page);

    y =
      TOP_Y;

    page.drawText(
      "SLATE LANE DISPATCH",
      {
        x: MARGIN_X,
        y,
        size: 9,
        font: bold,

        color: rgb(
          0.25,
          0.25,
          0.25,
        ),
      },
    );

    y -= 24;
  }

  function ensureSpace(
    needed: number,
  ) {
    if (
      y - needed <
      BOTTOM_Y
    ) {
      addPage();
    }
  }

  function drawParagraph(
    text: string,
    options?: {
      font?: PDFFont;
      size?: number;
      spacingAfter?: number;
    },
  ) {
    const font =
      options?.font ??
      regular;

    const size =
      options?.size ??
      BODY_SIZE;

    const spacingAfter =
      options?.spacingAfter ??
      7;

    const lines =
      wrapText(
        text,
        font,
        size,
        contentWidth,
      );

    for (
      const line
      of lines
    ) {
      ensureSpace(
        LINE_HEIGHT,
      );

      page.drawText(
        line,
        {
          x: MARGIN_X,
          y,
          size,
          font,

          color: rgb(
            0.08,
            0.08,
            0.08,
          ),
        },
      );

      y -= LINE_HEIGHT;
    }

    y -= spacingAfter;
  }

  function drawSection(
    title: string,
  ) {
    ensureSpace(30);

    y -= 5;

    page.drawText(
      safeText(title),
      {
        x: MARGIN_X,
        y,
        size: 12,
        font: bold,

        color: rgb(
          0.05,
          0.05,
          0.05,
        ),
      },
    );

    y -= 20;
  }

  function drawField(
    label: string,
    value: unknown,
  ) {
    const text =
      `${label}: ${displayValue(
        value,
      )}`;

    drawParagraph(
      text,
      {
        spacingAfter: 3,
      },
    );
  }

  /*
  |--------------------------------------------------------------------------
  | HEADER
  |--------------------------------------------------------------------------
  */

  page.drawText(
    "SLATE LANE DISPATCH",
    {
      x: MARGIN_X,
      y,

      size: 12,

      font: bold,

      color: rgb(
        0.15,
        0.15,
        0.15,
      ),
    },
  );

  y -= 30;

  page.drawText(
    "CARRIER CREDENTIAL PACKET",
    {
      x: MARGIN_X,
      y,

      size: 18,

      font: bold,

      color: rgb(
        0,
        0,
        0,
      ),
    },
  );

  y -= 20;

  page.drawText(
    `Packet Version: ${CARRIER_PACKET_VERSION}`,
    {
      x: MARGIN_X,
      y,

      size: 8,

      font: regular,

      color: rgb(
        0.4,
        0.4,
        0.4,
      ),
    },
  );

  y -= 30;

  drawParagraph(
    "This Carrier Credential Packet contains information supplied by the motor carrier for Slate Lane Dispatch onboarding and operational setup.",
  );

  /*
  |--------------------------------------------------------------------------
  | CARRIER
  |--------------------------------------------------------------------------
  */

  drawSection(
    "1. Carrier & Authority Information",
  );

  drawField(
    "Legal / Company Name",
    form.company_name,
  );

  drawField(
    "USDOT Number",
    form.dot_number,
  );

  drawField(
    "MC Number",
    form.mc_number,
  );

  drawField(
    "Business Address",
    form.business_address,
  );

  drawField(
    "City",
    form.city,
  );

  drawField(
    "State",
    form.state,
  );

  drawField(
    "ZIP Code",
    form.zip_code,
  );

  drawField(
    "Home Terminal",
    form.home_terminal,
  );

  /*
  |--------------------------------------------------------------------------
  | CONTACT
  |--------------------------------------------------------------------------
  */

  drawSection(
    "2. Primary Contact",
  );

  drawField(
    "Contact Name",
    form.primary_contact_name,
  );

  drawField(
    "Contact Email",
    form.primary_contact_email,
  );

  drawField(
    "Contact Phone",
    form.primary_contact_phone,
  );

  /*
  |--------------------------------------------------------------------------
  | EQUIPMENT
  |--------------------------------------------------------------------------
  */

  drawSection(
    "3. Fleet & Equipment",
  );

  drawField(
    "Operation Type",
    form.operation_type,
  );

  drawField(
    "Primary Equipment Type",
    form.equipment_type,
  );

  drawField(
    "Trailer Type",
    form.trailer_type,
  );

  drawField(
    "Number of Trucks",
    form.truck_count,
  );

  drawField(
    "Number of Drivers",
    form.driver_count,
  );

  /*
  |--------------------------------------------------------------------------
  | DISPATCH
  |--------------------------------------------------------------------------
  */

  drawSection(
    "4. Dispatch Preferences",
  );

  drawField(
    "Minimum Rate Per Mile",
    form.minimum_rate_per_mile
      ? `$${form.minimum_rate_per_mile}`
      : "",
  );

  drawField(
    "Weekly Revenue Target",
    form.weekly_revenue_target
      ? `$${form.weekly_revenue_target}`
      : "",
  );

  drawField(
    "Preferred States",
    form.preferred_states,
  );

  drawField(
    "Preferred Lanes",
    form.preferred_lanes,
  );

  drawField(
    "Regions / States to Avoid",
    form.regions_to_avoid,
  );

  drawField(
    "Home Time Requirements",
    form.home_time_notes,
  );

  drawField(
    "Additional Operating Notes",
    form.operating_notes,
  );

  /*
  |--------------------------------------------------------------------------
  | FACTORING
  |--------------------------------------------------------------------------
  */

  drawSection(
    "5. Factoring Information",
  );

  drawField(
    "Factoring Company",
    form.factoring_company,
  );

  drawField(
    "Factoring Contact Email",
    form.factoring_contact_email,
  );

  /*
  |--------------------------------------------------------------------------
  | INSURANCE
  |--------------------------------------------------------------------------
  */

  drawSection(
    "6. Insurance Information",
  );

  drawField(
    "Insurance Company",
    form.insurance_company,
  );

  drawField(
    "Policy Number",
    form.insurance_policy_number,
  );

  drawField(
    "Insurance Expiration",
    form.insurance_expiration,
  );

  drawField(
    "Auto Liability Limit",
    form.auto_liability_limit,
  );

  drawField(
    "Cargo Coverage Limit",
    form.cargo_limit,
  );

  /*
  |--------------------------------------------------------------------------
  | LOAD BOARDS
  |--------------------------------------------------------------------------
  */

  drawSection(
    "7. Load Board Information",
  );

  drawField(
    "Primary Load Board Provider",
    form.load_board_provider,
  );

  /*
  |--------------------------------------------------------------------------
  | EMERGENCY
  |--------------------------------------------------------------------------
  */

  drawSection(
    "8. Emergency Contact",
  );

  drawField(
    "Emergency Contact Name",
    form.emergency_contact_name,
  );

  drawField(
    "Emergency Contact Phone",
    form.emergency_contact_phone,
  );

  /*
  |--------------------------------------------------------------------------
  | CERTIFICATION
  |--------------------------------------------------------------------------
  */

  drawSection(
    "9. Carrier Certification",
  );

  drawParagraph(
    "The carrier representative certifies that the information provided in this Carrier Credential Packet is accurate to the best of their knowledge and that Slate Lane Dispatch may use this information for authorized carrier onboarding and dispatch operations.",
  );

  drawField(
    "Authorized Representative",
    form.certification_name,
  );

  drawField(
    "Title",
    form.certification_title,
  );

  drawField(
    "Email",
    form.certification_email,
  );

  drawField(
    "Electronic Signature",
    form.electronic_signature,
  );

  drawField(
    "Submitted At",
    new Date(
      submittedAt,
    ).toUTCString(),
  );

  drawField(
    "Packet Version",
    CARRIER_PACKET_VERSION,
  );

  if (audit?.ip) {
    drawField(
      "Submission IP",
      audit.ip,
    );
  }

  if (
    audit?.userAgent
  ) {
    drawParagraph(
      `Browser Audit: ${safeText(
        audit.userAgent,
      )}`,
      {
        size: 7.5,
      },
    );
  }

  /*
  |--------------------------------------------------------------------------
  | FOOTER
  |--------------------------------------------------------------------------
  */

  const allPages =
    pdf.getPages();

  allPages.forEach(
    (
      pdfPage,
      index,
    ) => {
      const pageNumber =
        `${index + 1} of ${allPages.length}`;

      pdfPage.drawText(
        "Slate Lane Dispatch - Confidential Carrier Record",
        {
          x: MARGIN_X,
          y: 30,

          size: 7,

          font: regular,

          color: rgb(
            0.45,
            0.45,
            0.45,
          ),
        },
      );

      const numberWidth =
        regular.widthOfTextAtSize(
          pageNumber,
          7,
        );

      pdfPage.drawText(
        pageNumber,
        {
          x:
            PAGE_WIDTH -
            MARGIN_X -
            numberWidth,

          y: 30,

          size: 7,

          font: regular,

          color: rgb(
            0.45,
            0.45,
            0.45,
          ),
        },
      );
    },
  );

  return pdf.save();
}