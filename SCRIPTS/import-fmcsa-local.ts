import fs from "fs";
import path from "path";

import {
  loadEnvConfig,
} from "@next/env";


loadEnvConfig(
  process.cwd()
);


async function main() {
  const input =
    process.argv[2];

  if (!input) {
    console.error(`
Usage:

npx tsx scripts/import-fmcsa-local.ts "<CSV PATH>"
`);

    process.exit(1);
  }

  const csvPath =
    path.resolve(input);

  if (
    !fs.existsSync(csvPath)
  ) {
    throw new Error(
      `CSV does not exist: ${csvPath}`
    );
  }

  console.log("");
  console.log(
    "SlateLane FMCSA Bulk Import"
  );
  console.log(
    "=========================="
  );

  console.log(
    `File: ${csvPath}`
  );

  console.log("");

  /*
   * Import AFTER .env.local has
   * been loaded.
   */
  const {
    runFMCSAImport,
  } = await import(
    "../src/lib/fmcsa/importer"
  );

  const started =
    Date.now();

  const result =
    await runFMCSAImport({
      csvPath,

      fileName:
        path.basename(
          csvPath
        ),
    });

  const seconds =
    Math.round(
      (Date.now() -
        started) /
        1000
    );

  console.log("");
  console.log(
    "=========================="
  );

  console.log(
    "FMCSA IMPORT COMPLETE"
  );

  console.log(
    "=========================="
  );

  console.log(
    `Job:       ${result.jobId}`
  );

  console.log(
    `Processed: ${result.processed.toLocaleString()}`
  );

  console.log(
    `Imported:  ${result.imported.toLocaleString()}`
  );

  console.log(
    `Skipped:   ${result.skipped.toLocaleString()}`
  );

  console.log(
    `Failed:    ${result.failed.toLocaleString()}`
  );

  console.log(
    `Time:      ${seconds}s`
  );

  console.log("");
}


main().catch(
  (error) => {
    console.error("");
    console.error(
      "FMCSA BULK IMPORT FAILED"
    );

    console.error(
      error
    );

    process.exit(1);
  }
);