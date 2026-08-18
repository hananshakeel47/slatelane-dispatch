import fs from "fs";
import path from "path";
import csv from "csv-parser";

const inputPath = process.argv[2];
const outputPath = process.argv[3];
const targetCount = Number(process.argv[4] || 200000);

if (!inputPath || !outputPath) {
  console.error(`
Usage:

node scripts/build-fmcsa-best-subset.mjs "<INPUT CSV>" "<OUTPUT CSV>" 200000
`);
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}

if (!Number.isFinite(targetCount) || targetCount <= 0) {
  console.error("Target count must be a positive number.");
  process.exit(1);
}

function clean(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function upper(value) {
  return clean(value).toUpperCase();
}

function numberValue(value) {
  const parsed = Number(clean(value));

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function marked(value) {
  const v = upper(value);

  return (
    v === "X" ||
    v === "Y" ||
    v === "1" ||
    v === "TRUE"
  );
}

function getDot(row) {
  return clean(row.DOT_NUMBER);
}

function hasActiveAuthority(row) {
  for (let i = 1; i <= 3; i++) {
    const prefix =
      upper(row[`DOCKET${i}PREFIX`]);

    const number =
      clean(row[`DOCKET${i}`]);

    const status =
      upper(
        row[`DOCKET${i}_STATUS_CODE`]
      );

    if (
      ["MC", "MX"].includes(prefix) &&
      number &&
      status === "A"
    ) {
      return true;
    }
  }

  return false;
}

function hasAuthorityNumber(row) {
  for (let i = 1; i <= 3; i++) {
    const prefix =
      upper(row[`DOCKET${i}PREFIX`]);

    const number =
      clean(row[`DOCKET${i}`]);

    if (
      ["MC", "MX"].includes(prefix) &&
      number
    ) {
      return true;
    }
  }

  return false;
}

const FREIGHT_FIELDS = [
  "CRGO_GENFREIGHT",
  "CRGO_METALSHEET",
  "CRGO_MOTOVEH",
  "CRGO_LOGPOLE",
  "CRGO_BLDGMAT",
  "CRGO_MACHLRG",
  "CRGO_PRODUCE",
  "CRGO_LIQGAS",
  "CRGO_INTERMODAL",
  "CRGO_OILFIELD",
  "CRGO_LIVESTOCK",
  "CRGO_GRAINFEED",
  "CRGO_COALCOKE",
  "CRGO_MEAT",
  "CRGO_GARBAGE",
  "CRGO_CHEM",
  "CRGO_DRYBULK",
  "CRGO_COLDFOOD",
  "CRGO_BEVERAGES",
  "CRGO_PAPERPROD",
  "CRGO_FARMSUPP",
  "CRGO_CONSTRUCT",
  "CRGO_CARGOOTHR",
];

function hasFreightCargo(row) {
  return FREIGHT_FIELDS.some(
    (field) => marked(row[field])
  );
}

function passengerOnly(row) {
  return (
    marked(row.CRGO_PASSENGERS) &&
    !hasFreightCargo(row)
  );
}

function yearsSinceDate(value) {
  const raw = clean(value);

  if (!/^\d{8}$/.test(raw)) {
    return null;
  }

  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  const difference =
    Date.now() -
    date.getTime();

  return (
    difference /
    (365.25 *
      24 *
      60 *
      60 *
      1000)
  );
}

const PRIORITY_STATES =
  new Set([
    "TX",
    "CA",
    "FL",
    "IL",
    "GA",
    "OH",
    "PA",
    "NC",
    "TN",
    "IN",
    "NJ",
    "MI",
    "NY",
    "AZ",
    "MO",
  ]);

function eligible(row) {
  const dot = getDot(row);

  if (!dot) {
    return false;
  }

  // Active USDOT entity only.
  if (
    upper(row.STATUS_CODE) !== "A"
  ) {
    return false;
  }

  /*
   * FMCSA carrier entity types.
   *
   * C = Carrier
   * B = Both / carrier-related
   *
   * We intentionally exclude
   * broker-only, shipper-only,
   * registrant-only entities.
   */
  const entity =
    upper(row.CARSHIP);

  if (
    entity &&
    !["C", "B"].includes(entity)
  ) {
    return false;
  }

  const powerUnits =
    numberValue(
      row.POWER_UNITS
    );

  const drivers =
    numberValue(
      row.TOTAL_DRIVERS
    );

  // No operating equipment.
  if (powerUnits < 1) {
    return false;
  }

  /*
   * Focus on small/midsize carriers.
   * These are our highest-value
   * dispatch prospects.
   */
  if (powerUnits > 50) {
    return false;
  }

  if (drivers < 1) {
    return false;
  }

  if (drivers > 75) {
    return false;
  }

  const hasPhone =
    Boolean(clean(row.PHONE));

  const hasEmail =
    Boolean(
      clean(
        row.EMAIL_ADDRESS
      )
    );

  /*
   * There is little sales value in
   * storing a lead we cannot contact.
   */
  if (
    !hasPhone &&
    !hasEmail
  ) {
    return false;
  }

  /*
   * SlateLane is dispatch-focused,
   * not passenger transportation.
   */
  if (passengerOnly(row)) {
    return false;
  }

  return true;
}

function scoreCarrier(row) {
  let score = 0;

  const powerUnits =
    numberValue(
      row.POWER_UNITS
    );

  const drivers =
    numberValue(
      row.TOTAL_DRIVERS
    );

  const phone =
    clean(row.PHONE);

  const email =
    clean(
      row.EMAIL_ADDRESS
    );

  /*
   * ACTIVE AUTHORITY
   */
  if (
    hasActiveAuthority(row)
  ) {
    score += 35;
  } else if (
    hasAuthorityNumber(row)
  ) {
    score += 10;
  }

  /*
   * FLEET SIZE
   *
   * Small fleets are usually our
   * strongest dispatch prospects.
   */
  if (
    powerUnits >= 1 &&
    powerUnits <= 5
  ) {
    score += 30;
  } else if (
    powerUnits <= 10
  ) {
    score += 27;
  } else if (
    powerUnits <= 20
  ) {
    score += 20;
  } else if (
    powerUnits <= 35
  ) {
    score += 12;
  } else {
    score += 6;
  }

  /*
   * DRIVER COUNT
   */
  if (
    drivers >= 1 &&
    drivers <= 10
  ) {
    score += 15;
  } else if (
    drivers <= 25
  ) {
    score += 10;
  } else {
    score += 5;
  }

  /*
   * CONTACT QUALITY
   */
  if (phone) {
    score += 12;
  }

  if (email) {
    score += 18;
  }

  /*
   * CARGO
   */
  if (
    marked(
      row.CRGO_GENFREIGHT
    )
  ) {
    score += 20;
  }

  const valuableCargo = [
    "CRGO_COLDFOOD",
    "CRGO_PRODUCE",
    "CRGO_BLDGMAT",
    "CRGO_MACHLRG",
    "CRGO_METALSHEET",
    "CRGO_MOTOVEH",
    "CRGO_INTERMODAL",
    "CRGO_DRYBULK",
    "CRGO_BEVERAGES",
    "CRGO_FARMSUPP",
  ];

  if (
    valuableCargo.some(
      (field) =>
        marked(row[field])
    )
  ) {
    score += 10;
  }

  /*
   * RECENCY
   *
   * A recent MCS-150 filing is a
   * useful sign the information
   * is still being maintained.
   */
  const mcs150Age =
    yearsSinceDate(
      row.MCS150_DATE
    );

  if (
    mcs150Age !== null
  ) {
    if (mcs150Age <= 2) {
      score += 15;
    } else if (
      mcs150Age <= 4
    ) {
      score += 8;
    }
  }

  /*
   * Important freight markets get
   * only a SMALL boost.
   *
   * We do not throw away excellent
   * prospects in other states.
   */
  if (
    PRIORITY_STATES.has(
      upper(row.PHY_STATE)
    )
  ) {
    score += 5;
  }

  return score;
}


/*
 * ============================================================
 * MIN HEAP
 *
 * Keeps only the best N carriers
 * without storing millions of rows
 * in RAM.
 * ============================================================
 */

class MinHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  peek() {
    return this.items[0];
  }

  push(item) {
    this.items.push(item);
    this.bubbleUp(
      this.items.length - 1
    );
  }

  replaceRoot(item) {
    this.items[0] = item;
    this.bubbleDown(0);
  }

  bubbleUp(index) {
    while (index > 0) {
      const parent =
        Math.floor(
          (index - 1) / 2
        );

      if (
        this.items[parent].score <=
        this.items[index].score
      ) {
        break;
      }

      [
        this.items[parent],
        this.items[index],
      ] = [
        this.items[index],
        this.items[parent],
      ];

      index = parent;
    }
  }

  bubbleDown(index) {
    const length =
      this.items.length;

    while (true) {
      let smallest =
        index;

      const left =
        index * 2 + 1;

      const right =
        index * 2 + 2;

      if (
        left < length &&
        this.items[left].score <
          this.items[smallest].score
      ) {
        smallest = left;
      }

      if (
        right < length &&
        this.items[right].score <
          this.items[smallest].score
      ) {
        smallest = right;
      }

      if (
        smallest === index
      ) {
        break;
      }

      [
        this.items[index],
        this.items[smallest],
      ] = [
        this.items[smallest],
        this.items[index],
      ];

      index = smallest;
    }
  }
}

function csvEscape(value) {
  const text =
    value === undefined ||
    value === null
      ? ""
      : String(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return (
      '"' +
      text.replace(
        /"/g,
        '""'
      ) +
      '"'
    );
  }

  return text;
}


console.log("");
console.log(
  "SlateLane FMCSA Prospect Builder"
);
console.log(
  "==============================="
);
console.log(
  `Input:  ${inputPath}`
);
console.log(
  `Output: ${outputPath}`
);
console.log(
  `Target: ${targetCount.toLocaleString()} carriers`
);
console.log("");

const heap =
  new MinHeap();

let scanned = 0;
let eligibleCount = 0;


/*
 * ============================================================
 * PASS 1
 *
 * Scan entire Census file and identify
 * the strongest N USDOT numbers.
 * ============================================================
 */

console.log(
  "PASS 1: Ranking carriers..."
);

await new Promise(
  (resolve, reject) => {
    fs.createReadStream(
      inputPath
    )
      .pipe(
        csv({
          mapHeaders: ({
            header,
          }) =>
            header
              .replace(
                /^\uFEFF/,
                ""
              )
              .trim()
              .toUpperCase(),
        })
      )
      .on(
        "data",
        (row) => {
          scanned++;

          if (
            scanned %
              250000 ===
            0
          ) {
            console.log(
              `${scanned.toLocaleString()} scanned | ` +
              `${eligibleCount.toLocaleString()} eligible`
            );
          }

          if (!eligible(row)) {
            return;
          }

          eligibleCount++;

          const dot =
            getDot(row);

          const score =
            scoreCarrier(row);

          const candidate = {
            dot,
            score,
          };

          if (
            heap.size <
            targetCount
          ) {
            heap.push(
              candidate
            );

            return;
          }

          if (
            score >
            heap.peek().score
          ) {
            heap.replaceRoot(
              candidate
            );
          }
        }
      )
      .on(
        "end",
        resolve
      )
      .on(
        "error",
        reject
      );
  }
);

console.log("");
console.log(
  `Total scanned: ${scanned.toLocaleString()}`
);

console.log(
  `Eligible: ${eligibleCount.toLocaleString()}`
);

console.log(
  `Selected: ${heap.size.toLocaleString()}`
);

if (
  heap.size === 0
) {
  throw new Error(
    "No eligible carriers were found."
  );
}

const selectedDots =
  new Set(
    heap.items.map(
      (item) => item.dot
    )
  );

const minimumSelectedScore =
  heap.peek().score;

console.log(
  `Minimum selected score: ${minimumSelectedScore}`
);


/*
 * ============================================================
 * PASS 2
 *
 * Re-read Census and write only
 * selected carriers to output CSV.
 * ============================================================
 */

console.log("");
console.log(
  "PASS 2: Writing selected carriers..."
);

fs.mkdirSync(
  path.dirname(outputPath),
  {
    recursive: true,
  }
);

const output =
  fs.createWriteStream(
    outputPath
  );

let headers = null;
let written = 0;
let rescanned = 0;

await new Promise(
  (resolve, reject) => {
    const parser =
      fs
        .createReadStream(
          inputPath
        )
        .pipe(
          csv({
            mapHeaders: ({
              header,
            }) =>
              header
                .replace(
                  /^\uFEFF/,
                  ""
                )
                .trim()
                .toUpperCase(),
          })
        );

    parser.on(
      "data",
      (row) => {
        rescanned++;

        if (
          rescanned %
            250000 ===
          0
        ) {
          console.log(
            `${rescanned.toLocaleString()} rescanned | ` +
            `${written.toLocaleString()} written`
          );
        }

        if (!headers) {
          headers =
            Object.keys(row);

          output.write(
            headers
              .map(csvEscape)
              .join(",") +
              "\n"
          );
        }

        const dot =
          getDot(row);

        if (
          !selectedDots.has(dot)
        ) {
          return;
        }

        const line =
          headers
            .map(
              (header) =>
                csvEscape(
                  row[header]
                )
            )
            .join(",") +
          "\n";

        if (
          !output.write(line)
        ) {
          parser.pause();

          output.once(
            "drain",
            () =>
              parser.resume()
          );
        }

        written++;
      }
    );

    parser.on(
      "end",
      () => {
        output.end();
      }
    );

    parser.on(
      "error",
      reject
    );

    output.on(
      "finish",
      resolve
    );

    output.on(
      "error",
      reject
    );
  }
);

console.log("");
console.log(
  "================================"
);

console.log(
  "SlateLane prospect file COMPLETE"
);

console.log(
  "================================"
);

console.log(
  `Carriers written: ${written.toLocaleString()}`
);

console.log(
  `Minimum score: ${minimumSelectedScore}`
);

console.log(
  `Output: ${outputPath}`
);

console.log("");