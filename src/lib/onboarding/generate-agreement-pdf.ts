import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";

import {
  DISPATCH_AGREEMENT_SECTIONS,
  DISPATCH_AGREEMENT_VERSION,
  DispatchAgreementFormData,
  formatDispatchFee,
} from "./dispatch-agreement";

type OnboardingIdentity = {
  id: string;
  company_name: string;
  dot_number: number | string | null;
  mc_number: string | null;
};

type GenerateAgreementPdfArgs = {
  onboarding: OnboardingIdentity;
  form: DispatchAgreementFormData;
  signedAt: string;
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
const LINE_HEIGHT = 13;

function safeText(input: unknown) {
  return String(input ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
) {
  const words = safeText(text).split(/\s+/);
  const lines: string[] = [];

  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);

  return lines;
}

export async function generateDispatchAgreementPdf({
  onboarding,
  form,
  signedAt,
  audit,
}: GenerateAgreementPdfArgs) {
  const pdf = await PDFDocument.create();

  pdf.setTitle(
    `Slate Lane Carrier-Dispatcher Agreement - ${form.company_name}`,
  );
  pdf.setAuthor("Slate Lane Dispatch");
  pdf.setSubject("Carrier-Dispatcher Agreement");
  pdf.setCreator("Slate Lane Dispatch CRM");
  pdf.setProducer("Slate Lane Dispatch CRM");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pages: PDFPage[] = [];

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);

  let y = TOP_Y;

  const contentWidth = PAGE_WIDTH - MARGIN_X * 2;

  const addPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = TOP_Y;

    page.drawText("SLATE LANE DISPATCH", {
      x: MARGIN_X,
      y,
      size: 9,
      font: bold,
      color: rgb(0.25, 0.25, 0.25),
    });

    y -= 22;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < BOTTOM_Y) {
      addPage();
    }
  };

  const drawLine = (
    text: string,
    font: PDFFont = regular,
    size = BODY_SIZE,
    indent = 0,
  ) => {
    ensureSpace(LINE_HEIGHT);

    page.drawText(safeText(text), {
      x: MARGIN_X + indent,
      y,
      size,
      font,
      color: rgb(0.08, 0.08, 0.08),
    });

    y -= LINE_HEIGHT;
  };

  const drawParagraph = (
    text: string,
    options?: {
      font?: PDFFont;
      size?: number;
      spacingAfter?: number;
      indent?: number;
    },
  ) => {
    const font = options?.font ?? regular;
    const size = options?.size ?? BODY_SIZE;
    const spacingAfter = options?.spacingAfter ?? 7;
    const indent = options?.indent ?? 0;

    const lines = wrapText(
      text,
      font,
      size,
      contentWidth - indent,
    );

    for (const line of lines) {
      ensureSpace(LINE_HEIGHT);

      page.drawText(line, {
        x: MARGIN_X + indent,
        y,
        size,
        font,
        color: rgb(0.08, 0.08, 0.08),
      });

      y -= LINE_HEIGHT;
    }

    y -= spacingAfter;
  };

  const drawHeading = (text: string) => {
    ensureSpace(26);

    y -= 4;

    page.drawText(safeText(text), {
      x: MARGIN_X,
      y,
      size: 11,
      font: bold,
      color: rgb(0.05, 0.05, 0.05),
    });

    y -= 18;
  };

  page.drawText("SLATE LANE DISPATCH", {
    x: MARGIN_X,
    y,
    size: 12,
    font: bold,
    color: rgb(0.15, 0.15, 0.15),
  });

  y -= 30;

  page.drawText("CARRIER-DISPATCHER AGREEMENT", {
    x: MARGIN_X,
    y,
    size: 18,
    font: bold,
    color: rgb(0, 0, 0),
  });

  y -= 20;

  page.drawText(`Agreement Version: ${DISPATCH_AGREEMENT_VERSION}`, {
    x: MARGIN_X,
    y,
    size: 8,
    font: regular,
    color: rgb(0.35, 0.35, 0.35),
  });

  y -= 28;

  drawHeading("Carrier Information");

  drawLine(`Legal / Company Name: ${form.company_name}`);
  drawLine(`USDOT Number: ${form.dot_number || "N/A"}`);
  drawLine(`MC Number: ${form.mc_number || "N/A"}`);

  y -= 10;

  drawHeading("Commercial Terms");

  drawLine(
    `Dispatch Fee: ${formatDispatchFee(
      form.dispatch_fee_type,
      form.dispatch_fee_value,
    )}`,
  );

  drawLine(
    `Minimum Rate Preference: ${
      form.minimum_rate_per_mile
        ? `$${Number(form.minimum_rate_per_mile).toFixed(2)} per mile`
        : "Not specified"
    }`,
  );

  drawLine(
    `Preferred States: ${form.preferred_states || "Not specified"}`,
  );

  drawLine(
    `Preferred Lanes: ${form.preferred_lanes || "Not specified"}`,
  );

  drawLine(
    `Regions to Avoid: ${form.regions_to_avoid || "Not specified"}`,
  );

  y -= 10;

  drawHeading("Operational Information");

  drawParagraph(
    `Factoring Company: ${form.factoring_company || "Not specified"}`,
    { spacingAfter: 2 },
  );

  drawParagraph(
    `Insurance Company: ${form.insurance_company || "Not specified"}`,
    { spacingAfter: 2 },
  );

  drawParagraph(
    `Insurance Expiration: ${
      form.insurance_expiration || "Not specified"
    }`,
    { spacingAfter: 2 },
  );

  drawParagraph(
    `Home Time Notes: ${form.home_time_notes || "Not specified"}`,
    { spacingAfter: 2 },
  );

  drawParagraph(
    `Operating Notes: ${form.operating_notes || "Not specified"}`,
  );

  for (const section of DISPATCH_AGREEMENT_SECTIONS) {
    drawHeading(section.title);

    for (const paragraph of section.paragraphs) {
      drawParagraph(paragraph);
    }
  }

  drawHeading("Electronic Signature");

  drawParagraph(
    "By submitting the secure Slate Lane onboarding form, the undersigned represents that they are authorized to execute this agreement on behalf of the Carrier and agrees to the terms above.",
  );

  drawLine(`Authorized Signer: ${form.signer_name}`);
  drawLine(`Title: ${form.signer_title}`);
  drawLine(`Email: ${form.signer_email}`);
  drawLine(`Electronic Signature: ${form.electronic_signature}`);
  drawLine(`Signed At: ${new Date(signedAt).toUTCString()}`);
  drawLine(`Agreement Version: ${DISPATCH_AGREEMENT_VERSION}`);

  if (audit?.ip) {
    drawLine(`Submission IP: ${safeText(audit.ip)}`, regular, 8);
  }

  if (audit?.userAgent) {
    drawParagraph(
      `Browser Audit: ${safeText(audit.userAgent)}`,
      {
        size: 7.5,
        spacingAfter: 0,
      },
    );
  }

  const allPages = pdf.getPages();

  allPages.forEach((pdfPage, index) => {
    const pageNumber = `${index + 1} of ${allPages.length}`;

    pdfPage.drawText("Slate Lane Dispatch - Confidential Carrier Record", {
      x: MARGIN_X,
      y: 30,
      size: 7,
      font: regular,
      color: rgb(0.45, 0.45, 0.45),
    });

    const width = regular.widthOfTextAtSize(pageNumber, 7);

    pdfPage.drawText(pageNumber, {
      x: PAGE_WIDTH - MARGIN_X - width,
      y: 30,
      size: 7,
      font: regular,
      color: rgb(0.45, 0.45, 0.45),
    });
  });

  return pdf.save();
}