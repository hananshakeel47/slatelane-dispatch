import fs from "fs";

import {
  parseFMCSAFile,
} from "./parser";

import {
  shouldImport,
} from "./filter";

import {
  createServerSupabase,
} from "./supabase/server";

import type {
  NormalizedCarrier,
} from "./types";


const BATCH_SIZE = 500;
const PROGRESS_INTERVAL = 5000;


export interface ImportResult {
  jobId: string;

  processed: number;
  imported: number;
  skipped: number;
  failed: number;
}


export interface ImportOptions {
  csvPath: string;
  fileName: string;

  /*
   * Very useful for our first test.
   *
   * Example:
   * limit: 1000
   *
   * undefined = entire dataset.
   */
  limit?: number;
}


export async function runFMCSAImport(
  options: ImportOptions
): Promise<ImportResult> {
  const {
    csvPath,
    fileName,
    limit,
  } = options;

  if (!fs.existsSync(csvPath)) {
    throw new Error(
      `FMCSA CSV does not exist: ${csvPath}`
    );
  }

  const supabase =
    createServerSupabase();

  const {
    data: job,
    error: jobError,
  } = await supabase
    .from("fmcsa_import_jobs")
    .insert({
      file_name: fileName,
      dataset_type:
        "company_census",

      status: "running",

      started_at:
        new Date().toISOString(),
    })
    .select("id")
    .single();

  if (
    jobError ||
    !job
  ) {
    throw new Error(
      `Could not create FMCSA import job: ${
        jobError?.message ??
        "Unknown error"
      }`
    );
  }

  const jobId =
    job.id as string;

  let processed = 0;
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  let batch:
    NormalizedCarrier[] = [];


  async function updateProgress() {
    const { error } =
      await supabase
        .from(
          "fmcsa_import_jobs"
        )
        .update({
          processed_rows:
            processed,

          imported_rows:
            imported,

          skipped_rows:
            skipped,

          failed_rows:
            failed,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq("id", jobId);

    if (error) {
      console.error(
        "Could not update import progress:",
        error.message
      );
    }
  }


  async function flushBatch() {
    if (
      batch.length === 0
    ) {
      return;
    }

    const syncTime =
      new Date().toISOString();

    /*
     * IMPORTANT:
     * These rows contain ONLY FMCSA-owned
     * columns + lead_score.
     *
     * Existing CRM fields such as:
     *
     * contacted
     * meeting_booked
     * client
     * notes
     * website
     * authority_date
     * authority_age
     * dispatcher_probability
     *
     * are NOT included and therefore are
     * not part of this import payload.
     */

    const rows =
      batch.map(
        (carrier) => ({
          ...carrier,

          last_fmcsa_sync:
            syncTime,

          updated_at:
            syncTime,
        })
      );

    const { error } =
      await supabase
        .from("carriers")
        .upsert(
          rows,
          {
            onConflict:
              "dot_number",

            ignoreDuplicates:
              false,
          }
        );

    if (error) {
      throw new Error(
        `FMCSA batch upsert failed: ${error.message}`
      );
    }

    imported +=
      batch.length;

    batch = [];
  }


  try {
    for await (
      const carrier
      of parseFMCSAFile(
        csvPath
      )
    ) {
      processed++;

      if (
        !shouldImport(
          carrier
        )
      ) {
        skipped++;
      } else {
        batch.push(
          carrier
        );
      }

      if (
        batch.length >=
        BATCH_SIZE
      ) {
        await flushBatch();
      }

      if (
        processed %
          PROGRESS_INTERVAL ===
        0
      ) {
        await updateProgress();

        console.log(
          [
            "FMCSA:",
            `${processed.toLocaleString()} processed`,
            `${imported.toLocaleString()} imported`,
            `${skipped.toLocaleString()} skipped`,
          ].join(" ")
        );
      }

      if (
        limit &&
        processed >= limit
      ) {
        break;
      }
    }

    await flushBatch();

    await supabase
      .from(
        "fmcsa_import_jobs"
      )
      .update({
        status:
          "completed",

        processed_rows:
          processed,

        imported_rows:
          imported,

        skipped_rows:
          skipped,

        failed_rows:
          failed,

        completed_at:
          new Date()
            .toISOString(),

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq("id", jobId);

    return {
      jobId,
      processed,
      imported,
      skipped,
      failed,
    };
  } catch (error) {
    failed++;

    const message =
      error instanceof Error
        ? error.message
        : "Unknown FMCSA import error";

    await supabase
      .from(
        "fmcsa_import_jobs"
      )
      .update({
        status:
          "failed",

        processed_rows:
          processed,

        imported_rows:
          imported,

        skipped_rows:
          skipped,

        failed_rows:
          failed,

        error_message:
          message,

        completed_at:
          new Date()
            .toISOString(),

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq("id", jobId);

    throw error;
  }
}