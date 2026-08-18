import {
  loadEnvConfig,
} from "@next/env";


loadEnvConfig(
  process.cwd()
);


async function main() {
  const rawDot =
    process.argv[2];

  if (!rawDot) {
    console.error(`
Usage:

npx tsx scripts/test-motus.ts <USDOT_NUMBER>

Example:

npx tsx scripts/test-motus.ts 3309605
`);

    process.exit(1);
  }


  const dotNumber =
    Number(rawDot);


  if (
    !Number.isFinite(
      dotNumber
    ) ||
    dotNumber <= 0
  ) {
    throw new Error(
      "Invalid USDOT number."
    );
  }


  console.log("");
  console.log(
    "SlateLane MOTUS Authority Test"
  );
  console.log(
    "============================="
  );
  console.log(
    `USDOT: ${dotNumber}`
  );
  console.log("");


  const {
    enrichCarrierAuthority,
  } =
    await import(
      "../src/lib/fmcsa/motus"
    );


  const result =
    await enrichCarrierAuthority(
      dotNumber
    );


  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  console.log("");
  console.log(
    "MOTUS ENRICHMENT COMPLETE"
  );
  console.log("");
}


main().catch(
  (error) => {
    console.error("");
    console.error(
      "MOTUS TEST FAILED"
    );

    console.error(
      error
    );

    process.exit(1);
  }
);