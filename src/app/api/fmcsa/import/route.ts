import {
  NextResponse,
} from "next/server";

import fs from "fs";
import path from "path";

import {
  extractFMCSAZip,
} from "@/lib/fmcsa/extract";

import {
  validateFMCSACSV,
  validateFMCSAZipStructure,
  validateExtractedFMCSAData,
} from "@/lib/fmcsa/validator";

import {
  runFMCSAImport,
} from "@/lib/fmcsa/importer";

export const runtime =
  "nodejs";

export const maxDuration =
  300;

/**
 * TEST MODE
 *
 * Hard limited to 1,000 source rows.
 *
 * DO NOT remove this until the test
 * import is confirmed working.
 */
const TEST_IMPORT_LIMIT =
  1000;

export async function POST(
  request: Request
) {
  try {
    const formData =
      await request.formData();

    const file =
      formData.get(
        "file"
      ) as File | null;

    if (!file) {
      return NextResponse.json(
        {
          success: false,

          message:
            "No FMCSA file was uploaded.",
        },

        {
          status: 400,
        }
      );
    }

    const extension =
      path
        .extname(file.name)
        .toLowerCase();

    if (
      extension !== ".zip" &&
      extension !== ".csv"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Only FMCSA ZIP or CSV files are supported.",
        },

        {
          status: 400,
        }
      );
    }

    const uploadDirectory =
      path.join(
        process.cwd(),
        "uploads"
      );

    fs.mkdirSync(
      uploadDirectory,
      {
        recursive: true,
      }
    );

    const timestamp =
      Date.now();

    const safeOriginalName =
      path.basename(
        file.name
      );

    const storedFileName =
      `${timestamp}-${safeOriginalName}`;

    const storedPath =
      path.join(
        uploadDirectory,
        storedFileName
      );

    const bytes =
      await file.arrayBuffer();

    fs.writeFileSync(
      storedPath,
      Buffer.from(bytes)
    );

    let csvPath:
      string | null = null;

    let headers:
      string[] = [];

    /*
     * ============================================================
     * ZIP
     * ============================================================
     */
    if (
      extension === ".zip"
    ) {
      validateFMCSAZipStructure(
        storedPath
      );

      const extractedPath =
        await extractFMCSAZip(
          storedPath
        );

      const validation =
        validateExtractedFMCSAData(
          extractedPath
        );

      if (
        !validation.valid ||
        !validation.csvPath
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              validation.message,

            detectedHeaders:
              validation.headers,
          },

          {
            status: 400,
          }
        );
      }

      csvPath =
        validation.csvPath;

      headers =
        validation.headers;
    }

    /*
     * ============================================================
     * DIRECT CSV
     * ============================================================
     */
    if (
      extension === ".csv"
    ) {
      const validation =
        validateFMCSACSV(
          storedPath
        );

      if (
        !validation.valid
      ) {
        return NextResponse.json(
          {
            success: false,

            message:
              validation.message,

            detectedHeaders:
              validation.headers,
          },

          {
            status: 400,
          }
        );
      }

      csvPath =
        storedPath;

      headers =
        validation.headers;
    }

    if (!csvPath) {
      throw new Error(
        "FMCSA CSV could not be located."
      );
    }

    console.log(
      `FMCSA test import starting from ${csvPath}`
    );

    console.log(
      `Detected ${headers.length} FMCSA columns`
    );

    /*
     * ============================================================
     * FIRST TEST = MAX 1,000 SOURCE ROWS
     * ============================================================
     */

    const result =
      await runFMCSAImport({
        csvPath,

        fileName:
          safeOriginalName,

        limit:
          TEST_IMPORT_LIMIT,
      });

    return NextResponse.json({
      success: true,

      message:
        "FMCSA test import completed.",

      mode:
        "test",

      testLimit:
        TEST_IMPORT_LIMIT,

      dataset: {
        type:
          "company_census",

        detectedColumns:
          headers.length,

        csvFile:
          path.basename(
            csvPath
          ),
      },

      result,
    });
  } catch (error) {
    console.error(
      "FMCSA IMPORT ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unknown FMCSA import error.";

    return NextResponse.json(
      {
        success: false,
        message,
      },

      {
        status: 500,
      }
    );
  }
}