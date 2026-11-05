import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import {
  assessSmsCarrier,
  CENSUS_DATASET_ID,
  CENSUS_SELECT,
  CENSUS_WHERE,
  fleetSegment,
  isNewerCensusRow,
  normalizeDot,
  PAGE_SIZE,
  SMS_DATASET_ID,
} from "./fmcsa-sms-discovery-core.mjs";

loadEnvConfig(process.cwd());

const SOCRATA_BASE = "https://data.transportation.gov";
const MAX_PAGES_PER_DATASET = 200;
const MAX_ROWS_PER_DATASET = 5_000_000;
const SUPABASE_PAGE_SIZE = 1_000;

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function timestampToIso(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  const milliseconds = numeric > 1_000_000_000_000
    ? numeric
    : numeric * 1_000;

  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function metadataVersion(metadata) {
  return [
    metadata.rowsUpdatedAt ?? "",
    metadata.dataUpdatedAt ?? "",
  ].join("|");
}

function summarizeMetadata(datasetId, metadata) {
  return {
    datasetId,
    name: metadata.name ?? null,
    rowsUpdatedAt: metadata.rowsUpdatedAt ?? null,
    dataUpdatedAt: metadata.dataUpdatedAt ?? null,
    rowsUpdatedAtIso: timestampToIso(metadata.rowsUpdatedAt),
    dataUpdatedAtIso: timestampToIso(metadata.dataUpdatedAt),
  };
}

async function fetchJsonWithRetry(url, label) {
  const headers = { accept: "application/json" };
  const appToken = process.env.SOCRATA_APP_TOKEN;

  if (appToken) {
    headers["X-App-Token"] = appToken;
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    let response;

    try {
      response = await fetch(url, { headers });
    } catch (error) {
      if (attempt === 5) {
        throw new Error(
          label + " network request failed: " +
          (error instanceof Error ? error.message : String(error)),
        );
      }

      await sleep(Math.min(30_000, 500 * (2 ** attempt)));
      continue;
    }

    if (response.ok) {
      return response.json();
    }

    const retryable = [429, 500, 502, 503, 504].includes(response.status);

    if (retryable && attempt < 5) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1_000
        : 500 * (2 ** attempt);

      await sleep(Math.min(30_000, backoff));
      continue;
    }

    const body = (await response.text()).slice(0, 500);
    throw new Error(
      label + " returned HTTP " + response.status + ": " + body,
    );
  }

  throw new Error(label + " exhausted its retry attempts.");
}

async function fetchDatasetMetadata(datasetId) {
  const url = SOCRATA_BASE + "/api/views/" + datasetId + ".json";
  return fetchJsonWithRetry(url, "Dataset metadata " + datasetId);
}

async function* fetchSocrataPages({
  datasetId,
  select,
  where,
  label,
}) {
  let offset = 0;
  let pageCount = 0;
  let totalRows = 0;

  while (true) {
    pageCount += 1;

    if (pageCount > MAX_PAGES_PER_DATASET) {
      throw new Error(label + " exceeded the page safety limit.");
    }

    const url = new URL(
      SOCRATA_BASE + "/resource/" + datasetId + ".json",
    );

    url.searchParams.set("$select", select);
    url.searchParams.set("$where", where);
    url.searchParams.set("$order", "dot_number ASC");
    url.searchParams.set("$limit", String(PAGE_SIZE));
    url.searchParams.set("$offset", String(offset));

    const batch = await fetchJsonWithRetry(url.toString(), label);

    if (!Array.isArray(batch)) {
      throw new Error(label + " did not return a JSON array.");
    }

    totalRows += batch.length;

    if (totalRows > MAX_ROWS_PER_DATASET) {
      throw new Error(label + " exceeded the row safety limit.");
    }

    yield batch;

    if (batch.length < PAGE_SIZE) {
      break;
    }

    offset += batch.length;
    await sleep(150);
  }
}

async function readExistingDotNumbers(supabase) {
  const dots = new Set();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("carriers")
      .select("dot_number")
      .not("dot_number", "is", null)
      .range(offset, offset + SUPABASE_PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        "Could not read existing CRM DOT numbers: " + error.message,
      );
    }

    for (const row of data ?? []) {
      const dot = normalizeDot(row.dot_number);
      if (dot) dots.add(dot);
    }

    if ((data ?? []).length < SUPABASE_PAGE_SIZE) {
      break;
    }

    offset += SUPABASE_PAGE_SIZE;
  }

  return dots;
}

function emptyFleetCounts() {
  return {
    "1_5": 0,
    "6_20": 0,
    "21_50": 0,
    "51_100": 0,
    "101_plus": 0,
    unknown: 0,
  };
}

function sortedCounts(counts) {
  return Object.fromEntries(
    Object.entries(counts).sort((a, b) => b[1] - a[1]),
  );
}

async function main() {
  const startedAt = Date.now();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and " +
      "SUPABASE_SERVICE_ROLE_KEY in your local environment.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  console.log("Reading FMCSA dataset publication metadata...");
  const smsMetadataBefore = await fetchDatasetMetadata(SMS_DATASET_ID);
  const censusMetadataBefore = await fetchDatasetMetadata(CENSUS_DATASET_ID);

  console.log("Reading SMS AB PassProperty USDOT universe...");
  const smsDots = new Set();
  let smsRowsRead = 0;

  for await (const page of fetchSocrataPages({
    datasetId: SMS_DATASET_ID,
    select: "dot_number",
    where: "dot_number IS NOT NULL",
    label: "SMS AB PassProperty",
  })) {
    smsRowsRead += page.length;

    for (const row of page) {
      const dot = normalizeDot(row.dot_number);
      if (dot) smsDots.add(dot);
    }

    console.log(
      "SMS rows read: " + smsRowsRead.toLocaleString() +
      " | unique USDOTs: " + smsDots.size.toLocaleString(),
    );
  }

  console.log("Reading active interstate carrier rows from Company Census...");
  const candidateRows = new Map();
  const matchedCensusDots = new Set();
  const excludedReasonCounts = {};
  let censusRowsRead = 0;
  let censusRowsMatchedSms = 0;
  let duplicateCensusDotRows = 0;

  for await (const page of fetchSocrataPages({
    datasetId: CENSUS_DATASET_ID,
    select: CENSUS_SELECT,
    where: CENSUS_WHERE,
    label: "FMCSA Company Census",
  })) {
    censusRowsRead += page.length;

    for (const row of page) {
      const dot = normalizeDot(row.dot_number);

      if (!dot || !smsDots.has(dot)) {
        continue;
      }

      censusRowsMatchedSms += 1;
      matchedCensusDots.add(dot);

      const assessment = assessSmsCarrier(row);

      if (!assessment.eligible) {
        for (const reason of assessment.reasons) {
          excludedReasonCounts[reason] =
            (excludedReasonCounts[reason] ?? 0) + 1;
        }
        continue;
      }

      const current = candidateRows.get(dot);

      if (current) {
        duplicateCensusDotRows += 1;

        if (isNewerCensusRow(row, current.raw)) {
          candidateRows.set(dot, {
            raw: row,
            carrier: assessment.carrier,
          });
        }
      } else {
        candidateRows.set(dot, {
          raw: row,
          carrier: assessment.carrier,
        });
      }
    }

    console.log(
      "Census rows read: " + censusRowsRead.toLocaleString() +
      " | SMS-matched rows: " + censusRowsMatchedSms.toLocaleString() +
      " | qualified unique carriers: " + candidateRows.size.toLocaleString(),
    );
  }

  console.log("Reading current CRM DOT numbers for deduplication...");
  const existingDots = await readExistingDotNumbers(supabase);

  console.log("Rechecking dataset publication metadata...");
  const smsMetadataAfter = await fetchDatasetMetadata(SMS_DATASET_ID);
  const censusMetadataAfter = await fetchDatasetMetadata(CENSUS_DATASET_ID);

  if (
    metadataVersion(smsMetadataBefore) !== metadataVersion(smsMetadataAfter) ||
    metadataVersion(censusMetadataBefore) !== metadataVersion(censusMetadataAfter)
  ) {
    throw new Error(
      "A source dataset changed while the dry-run was running. " +
      "Discard these counts and rerun against a stable snapshot.",
    );
  }

  const fleetSegments = emptyFleetCounts();
  const cargoSignalCounts = {};
  let existingCrmOverlap = 0;
  let newToCrmBaseQualified = 0;
  let newToCrmContactable = 0;
  let newToCrmWithEmail = 0;
  let newToCrmWithPhone = 0;
  let newToCrmWithBoth = 0;
  let newToCrmNoContact = 0;

  for (const [dot, entry] of candidateRows) {
    if (existingDots.has(dot)) {
      existingCrmOverlap += 1;
      continue;
    }

    newToCrmBaseQualified += 1;

    const carrier = entry.carrier;
    const hasEmail = Boolean(carrier.email);
    const hasPhone = Boolean(carrier.phone || carrier.cell_phone);

    if (hasEmail) newToCrmWithEmail += 1;
    if (hasPhone) newToCrmWithPhone += 1;
    if (hasEmail && hasPhone) newToCrmWithBoth += 1;

    if (!hasEmail && !hasPhone) {
      newToCrmNoContact += 1;
      continue;
    }

    newToCrmContactable += 1;
    fleetSegments[fleetSegment(carrier.power_units)] += 1;

    for (const signal of carrier.cargo) {
      cargoSignalCounts[signal] =
        (cargoSignalCounts[signal] ?? 0) + 1;
    }
  }

  const report = {
    mode: "READ_ONLY_DRY_RUN",
    generatedAt: new Date().toISOString(),
    elapsedSeconds: Math.round((Date.now() - startedAt) / 1_000),
    writesPerformed: false,
    emailVerificationTriggered: false,
    leadCreationTriggered: false,
    sequenceEnrollmentTriggered: false,
    datasets: {
      smsAbPassProperty: summarizeMetadata(
        SMS_DATASET_ID,
        smsMetadataAfter,
      ),
      companyCensus: summarizeMetadata(
        CENSUS_DATASET_ID,
        censusMetadataAfter,
      ),
    },
    filters: {
      smsMembershipRequired: true,
      registrationStatus: "A",
      carrierOperation: "A (interstate)",
      acceptedEntityTypes: ["C (carrier)", "B (carrier and broker)"],
      minimumPowerUnits: 1,
      maximumPowerUnits: null,
      activeMcDocketRequired: true,
      propertyCargoClassificationRequired: true,
      registrationAgeLimitDays: null,
      driverCountMinimum: null,
      contactMethodRequiredForImportPreview: true,
      contactMethodDefinition: "Valid email or usable phone/cell phone",
    },
    counts: {
      smsRowsRead,
      smsUniqueUsdots: smsDots.size,
      censusFilteredRowsRead: censusRowsRead,
      censusRowsMatchedToSms: censusRowsMatchedSms,
      censusUniqueUsdotsMatchedToSms: matchedCensusDots.size,
      qualifiedUniquePropertyCarriers: candidateRows.size,
      duplicateCensusDotRows,
      currentCrmUniqueUsdots: existingDots.size,
      existingCrmOverlap: existingCrmOverlap,
      newToCrmBaseQualified: newToCrmBaseQualified,
      newToCrmContactablePreview: newToCrmContactable,
      newToCrmWithEmail: newToCrmWithEmail,
      newToCrmWithPhone: newToCrmWithPhone,
      newToCrmWithBothEmailAndPhone: newToCrmWithBoth,
      newToCrmWithoutContactMethod: newToCrmNoContact,
      newToCrmFleetSegments: fleetSegments,
      newToCrmCargoSignals: sortedCounts(cargoSignalCounts),
      excludedReasonCounts: sortedCounts(excludedReasonCounts),
    },
    safetyNotes: [
      "This script performs SELECT requests only. It does not insert or update CRM rows.",
      "It does not call email verification, create leads, enroll sequences, or send email.",
      "Existing CRM rows are counted as overlap and are never changed.",
      "No 30-day registration-age cutoff or maximum fleet-size cutoff is applied.",
      "Cargo classifications are not confirmed equipment types. They do not prove box truck, dry van, reefer, or flatbed equipment.",
      "The current outreach eligibility rules and daily sending limits are not changed by this dry-run.",
    ],
  };

  console.log("");
  console.log("FMCSA SMS DISCOVERY DRY-RUN REPORT");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(
    "FMCSA SMS dry-run failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
