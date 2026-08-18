import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

export interface FMCSAValidationResult {
  valid: boolean;
  csvPath: string | null;
  headers: string[];
  message: string;
}

const REQUIRED_HEADERS = [
  "DOT_NUMBER",
  "LEGAL_NAME",
  "PHY_STATE",
];

const MIN_EXPECTED_COLUMNS = 40;

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^"|"$/g, "")
    .toUpperCase();
}

/**
 * Parse a single CSV header line while respecting quoted commas.
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];

  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const character = line[i];

    if (character === '"') {
      if (
        insideQuotes &&
        line[i + 1] === '"'
      ) {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (
      character === "," &&
      !insideQuotes
    ) {
      values.push(
        normalizeHeader(current)
      );

      current = "";
      continue;
    }

    current += character;
  }

  values.push(
    normalizeHeader(current)
  );

  return values;
}

function readHeaders(
  filePath: string
): string[] {
  const fd = fs.openSync(
    filePath,
    "r"
  );

  try {
    const buffer = Buffer.alloc(
      256 * 1024
    );

    const bytesRead = fs.readSync(
      fd,
      buffer,
      0,
      buffer.length,
      0
    );

    const sample = buffer
      .subarray(0, bytesRead)
      .toString("utf8");

    const lineBreak =
      sample.search(/\r?\n/);

    if (lineBreak === -1) {
      throw new Error(
        "Could not read the CSV header."
      );
    }

    const firstLine =
      sample.slice(
        0,
        lineBreak
      );

    return parseCSVLine(
      firstLine
    );
  } finally {
    fs.closeSync(fd);
  }
}

function findCSVFiles(
  directory: string
): string[] {
  const files: string[] = [];

  for (
    const entry of fs.readdirSync(
      directory,
      {
        withFileTypes: true,
      }
    )
  ) {
    const fullPath =
      path.join(
        directory,
        entry.name
      );

    if (
      entry.isDirectory()
    ) {
      files.push(
        ...findCSVFiles(fullPath)
      );

      continue;
    }

    if (
      entry.name
        .toLowerCase()
        .endsWith(".csv")
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function headersLookLikeFMCSA(
  headers: string[]
): boolean {
  const hasRequired =
    REQUIRED_HEADERS.every(
      (header) =>
        headers.includes(header)
    );

  return (
    hasRequired &&
    headers.length >=
      MIN_EXPECTED_COLUMNS
  );
}

/**
 * Reject obvious project/source-code ZIP files
 * BEFORE extraction.
 */
export function validateFMCSAZipStructure(
  zipPath: string
): void {
  const zip =
    new AdmZip(zipPath);

  const entries =
    zip.getEntries();

  if (
    entries.length === 0
  ) {
    throw new Error(
      "The uploaded ZIP is empty."
    );
  }

  const suspiciousPatterns = [
    "node_modules/",
    ".git/",
    "package.json",
    "src/app/",
    "src/lib/",
    "next.config",
  ];

  const entryNames =
    entries.map((entry) =>
      entry.entryName
        .replace(/\\/g, "/")
        .toLowerCase()
    );

  const suspicious =
    entryNames.some(
      (entryName) =>
        suspiciousPatterns.some(
          (pattern) =>
            entryName.includes(
              pattern.toLowerCase()
            )
        )
    );

  if (suspicious) {
    throw new Error(
      "This appears to be a project/source-code ZIP, not an FMCSA dataset."
    );
  }

  const csvEntries =
    entries.filter(
      (entry) =>
        !entry.isDirectory &&
        entry.entryName
          .toLowerCase()
          .endsWith(".csv")
    );

  if (
    csvEntries.length === 0
  ) {
    throw new Error(
      "The ZIP does not contain a CSV file."
    );
  }
}

/**
 * Validate a directly uploaded CSV.
 */
export function validateFMCSACSV(
  csvPath: string
): FMCSAValidationResult {
  if (
    !fs.existsSync(csvPath)
  ) {
    return {
      valid: false,
      csvPath: null,
      headers: [],
      message:
        "CSV file does not exist.",
    };
  }

  const headers =
    readHeaders(csvPath);

  if (
    !headersLookLikeFMCSA(
      headers
    )
  ) {
    return {
      valid: false,
      csvPath: null,
      headers,
      message:
        `Invalid FMCSA Company Census CSV. ` +
        `Detected ${headers.length} columns. ` +
        `Required headers include DOT_NUMBER, LEGAL_NAME and PHY_STATE.`,
    };
  }

  return {
    valid: true,
    csvPath,
    headers,
    message:
      `FMCSA Company Census dataset detected successfully (${headers.length} columns).`,
  };
}

/**
 * Find and validate the FMCSA CSV after ZIP extraction.
 */
export function validateExtractedFMCSAData(
  extractedDirectory: string
): FMCSAValidationResult {
  const csvFiles =
    findCSVFiles(
      extractedDirectory
    );

  if (
    csvFiles.length === 0
  ) {
    return {
      valid: false,
      csvPath: null,
      headers: [],
      message:
        "No CSV file was found after extraction.",
    };
  }

  let bestFailure:
    FMCSAValidationResult | null =
    null;

  for (
    const csvPath of csvFiles
  ) {
    try {
      const result =
        validateFMCSACSV(
          csvPath
        );

      if (
        result.valid
      ) {
        return result;
      }

      if (
        !bestFailure ||
        result.headers.length >
          bestFailure.headers.length
      ) {
        bestFailure =
          result;
      }
    } catch {
      // Try next CSV.
    }
  }

  return (
    bestFailure ?? {
      valid: false,
      csvPath: null,
      headers: [],
      message:
        "No valid FMCSA Company Census CSV was detected.",
    }
  );
}