import fs from "fs";
import csv from "csv-parser";

import type {
  FMCSARawRow,
  NormalizedCarrier,
} from "./types";

import {
  calculateLeadScore,
} from "./scoring";


function clean(
  value: unknown
): string | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const result = String(value).trim();

  if (!result) {
    return null;
  }

  return result;
}


function numberValue(
  value: unknown
): number {
  const cleaned = clean(value);

  if (!cleaned) {
    return 0;
  }

  const parsed = Number(cleaned);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}


function normalizeDate(
  value: unknown
): string | null {
  const cleaned = clean(value);

  if (!cleaned) {
    return null;
  }

  // Official Census dates normally use YYYYMMDD
  if (/^\d{8}$/.test(cleaned)) {
    const year = cleaned.slice(0, 4);
    const month = cleaned.slice(4, 6);
    const day = cleaned.slice(6, 8);

    return `${year}-${month}-${day}`;
  }

  return null;
}


function normalizePhone(
  value: unknown
): string | null {
  const cleaned = clean(value);

  if (!cleaned) {
    return null;
  }

  const digits =
    cleaned.replace(/\D/g, "");

  return digits.length >= 7
    ? digits
    : cleaned;
}


function isMarked(
  value: unknown
): boolean {
  const cleaned =
    clean(value)?.toUpperCase();

  return (
    cleaned === "X" ||
    cleaned === "Y" ||
    cleaned === "1" ||
    cleaned === "TRUE"
  );
}


interface DocketResult {
  mc_number: string | null;
  mx_number: string | null;
  ff_number: string | null;
}


function getDockets(
  row: FMCSARawRow
): DocketResult {
  const result: DocketResult = {
    mc_number: null,
    mx_number: null,
    ff_number: null,
  };

  const dockets = [1, 2, 3].map(
    (number) => ({
      prefix: clean(
        row[`DOCKET${number}PREFIX`]
      )?.toUpperCase(),

      value: clean(
        row[`DOCKET${number}`]
      ),

      status: clean(
        row[
          `DOCKET${number}_STATUS_CODE`
        ]
      )?.toUpperCase(),
    })
  );

  /*
   * Prefer active docket numbers.
   */
  dockets.sort((a, b) => {
    if (
      a.status === "A" &&
      b.status !== "A"
    ) {
      return -1;
    }

    if (
      b.status === "A" &&
      a.status !== "A"
    ) {
      return 1;
    }

    return 0;
  });

  for (const docket of dockets) {
    if (
      !docket.prefix ||
      !docket.value
    ) {
      continue;
    }

    const formatted =
      `${docket.prefix}-${docket.value}`;

    if (
      docket.prefix === "MC" &&
      !result.mc_number
    ) {
      result.mc_number = formatted;
    }

    if (
      docket.prefix === "MX" &&
      !result.mx_number
    ) {
      result.mx_number = formatted;
    }

    if (
      docket.prefix === "FF" &&
      !result.ff_number
    ) {
      result.ff_number = formatted;
    }
  }

  return result;
}


const CARGO_FIELDS: Record<
  string,
  string
> = {
  CRGO_GENFREIGHT:
    "general_freight",

  CRGO_HOUSEHOLD:
    "household_goods",

  CRGO_METALSHEET:
    "metal_sheets_coils_rolls",

  CRGO_MOTOVEH:
    "motor_vehicles",

  CRGO_DRIVETOW:
    "driveaway_towaway",

  CRGO_LOGPOLE:
    "logs_poles_beams_lumber",

  CRGO_BLDGMAT:
    "building_materials",

  CRGO_MOBILEHOME:
    "mobile_homes",

  CRGO_MACHLRG:
    "machinery_large_objects",

  CRGO_PRODUCE:
    "fresh_produce",

  CRGO_LIQGAS:
    "liquids_gases",

  CRGO_INTERMODAL:
    "intermodal_containers",

  CRGO_PASSENGERS:
    "passengers",

  CRGO_OILFIELD:
    "oilfield_equipment",

  CRGO_LIVESTOCK:
    "livestock",

  CRGO_GRAINFEED:
    "grain_feed_hay",

  CRGO_COALCOKE:
    "coal_coke",

  CRGO_MEAT:
    "meat",

  CRGO_GARBAGE:
    "garbage_refuse_trash",

  CRGO_USMAIL:
    "us_mail",

  CRGO_CHEM:
    "chemicals",

  CRGO_DRYBULK:
    "dry_bulk",

  CRGO_COLDFOOD:
    "refrigerated_food",

  CRGO_BEVERAGES:
    "beverages",

  CRGO_PAPERPROD:
    "paper_products",

  CRGO_UTILITY:
    "utility",

  CRGO_FARMSUPP:
    "farm_supplies",

  CRGO_CONSTRUCT:
    "construction",

  CRGO_WATERWELL:
    "water_well",
};


function getCargo(
  row: FMCSARawRow
): string[] {
  const cargo: string[] = [];

  for (
    const [field, name]
    of Object.entries(CARGO_FIELDS)
  ) {
    if (isMarked(row[field])) {
      cargo.push(name);
    }
  }

  if (isMarked(row.CRGO_CARGOOTHR)) {
    const description =
      clean(
        row.CRGO_CARGOOTHR_DESC
      );

    cargo.push(
      description
        ? `other:${description}`
        : "other"
    );
  }

  return cargo;
}


export function normalizeCarrier(
  row: FMCSARawRow
): NormalizedCarrier | null {
  const dotNumber =
    numberValue(row.DOT_NUMBER);

  if (!dotNumber) {
    return null;
  }

  const legalName =
    clean(row.LEGAL_NAME);

  if (!legalName) {
    return null;
  }

  const dockets =
    getDockets(row);

  const baseCarrier: Omit<
    NormalizedCarrier,
    "lead_score"
  > = {
    dot_number: dotNumber,

    mc_number:
      dockets.mc_number,

    mx_number:
      dockets.mx_number,

    ff_number:
      dockets.ff_number,

    legal_name: legalName,

    dba_name:
      clean(row.DBA_NAME),

    entity_type:
      clean(row.CARSHIP),

    classification:
      clean(row.CLASSDEF),

    status_code:
      clean(
        row.STATUS_CODE
      )?.toUpperCase() ?? null,

    carrier_operation:
      clean(
        row.CARRIER_OPERATION
      )?.toUpperCase() ?? null,

    business_type:
      clean(
        row.BUSINESS_ORG_DESC
      ),

    phone:
      normalizePhone(row.PHONE),

    cell_phone:
      normalizePhone(
        row.CELL_PHONE
      ),

    email:
      clean(
        row.EMAIL_ADDRESS
      )?.toLowerCase() ?? null,

    street:
      clean(row.PHY_STREET),

    city:
      clean(row.PHY_CITY),

    state:
      clean(
        row.PHY_STATE
      )?.toUpperCase() ?? null,

    zip:
      clean(row.PHY_ZIP),

    county:
      clean(row.PHY_CNTY),

    power_units:
      numberValue(
        row.POWER_UNITS
      ),

    truck_units:
      numberValue(
        row.TRUCK_UNITS
      ),

    bus_units:
      numberValue(
        row.BUS_UNITS
      ),

    drivers:
      numberValue(
        row.TOTAL_DRIVERS
      ),

    total_cdl:
      numberValue(
        row.TOTAL_CDL
      ),

    safety_rating:
      clean(
        row.SAFETY_RATING
      )?.toUpperCase() ?? null,

    safety_rating_date:
      normalizeDate(
        row.SAFETY_RATING_DATE
      ),

    review_date:
      normalizeDate(
        row.REVIEW_DATE
      ),

    hazmat:
      isMarked(row.HM_Ind),

    cargo:
      getCargo(row),

    add_date:
      normalizeDate(
        row.ADD_DATE
      ),

    mcs150_date:
      normalizeDate(
        row.MCS150_DATE
      ),
  };

  return {
    ...baseCarrier,

    lead_score:
      calculateLeadScore(
        baseCarrier
      ),
  };
}


export async function* parseFMCSAFile(
  filePath: string
): AsyncGenerator<NormalizedCarrier> {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `FMCSA CSV not found: ${filePath}`
    );
  }

  const stream =
    fs.createReadStream(filePath).pipe(
      csv({
        mapHeaders: ({
          header,
        }) =>
          header
            .replace(/^\uFEFF/, "")
            .trim()
            .toUpperCase(),
      })
    );

  for await (
    const rawRow of stream
  ) {
    const carrier =
      normalizeCarrier(
        rawRow as FMCSARawRow
      );

    if (carrier) {
      yield carrier;
    }
  }
}