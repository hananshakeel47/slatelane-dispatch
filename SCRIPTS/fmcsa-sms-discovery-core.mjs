export const SMS_DATASET_ID = "4y6x-dmck";
export const CENSUS_DATASET_ID = "az4n-8mr2";
export const PAGE_SIZE = 50000;

export const CENSUS_SELECT = [
  "dot_number",
  "legal_name",
  "dba_name",
  "carship",
  "classdef",
  "status_code",
  "carrier_operation",
  "business_org_desc",
  "phone",
  "cell_phone",
  "email_address",
  "phy_street",
  "phy_city",
  "phy_state",
  "phy_zip",
  "phy_cnty",
  "power_units",
  "truck_units",
  "bus_units",
  "total_drivers",
  "total_cdl",
  "safety_rating",
  "safety_rating_date",
  "review_date",
  "hm_ind",
  "add_date",
  "mcs150_date",
  "docket1prefix",
  "docket1",
  "docket1_status_code",
  "docket2prefix",
  "docket2",
  "docket2_status_code",
  "docket3prefix",
  "docket3",
  "docket3_status_code",
  "crgo_genfreight",
  "crgo_household",
  "crgo_metalsheet",
  "crgo_motoveh",
  "crgo_drivetow",
  "crgo_logpole",
  "crgo_bldgmat",
  "crgo_mobilehome",
  "crgo_machlrg",
  "crgo_produce",
  "crgo_liqgas",
  "crgo_intermodal",
  "crgo_passengers",
  "crgo_oilfield",
  "crgo_livestock",
  "crgo_grainfeed",
  "crgo_coalcoke",
  "crgo_meat",
  "crgo_garbage",
  "crgo_usmail",
  "crgo_chem",
  "crgo_drybulk",
  "crgo_coldfood",
  "crgo_beverages",
  "crgo_paperprod",
  "crgo_utility",
  "crgo_farmsupp",
  "crgo_construct",
  "crgo_waterwell",
  "crgo_cargoothr",
  "crgo_cargoothr_desc",
].join(",");

export const CENSUS_WHERE =
  "status_code = 'A' AND carrier_operation = 'A' " +
  "AND (carship = 'C' OR carship = 'B') AND power_units > 0";

const CARGO_FIELDS = {
  crgo_genfreight: "general_freight",
  crgo_household: "household_goods",
  crgo_metalsheet: "metal_sheets_coils_rolls",
  crgo_motoveh: "motor_vehicles",
  crgo_drivetow: "driveaway_towaway",
  crgo_logpole: "logs_poles_beams_lumber",
  crgo_bldgmat: "building_materials",
  crgo_mobilehome: "mobile_homes",
  crgo_machlrg: "machinery_large_objects",
  crgo_produce: "fresh_produce",
  crgo_liqgas: "liquids_gases",
  crgo_intermodal: "intermodal_containers",
  crgo_oilfield: "oilfield_equipment",
  crgo_livestock: "livestock",
  crgo_grainfeed: "grain_feed_hay",
  crgo_coalcoke: "coal_coke",
  crgo_meat: "meat",
  crgo_garbage: "garbage_refuse_trash",
  crgo_usmail: "us_mail",
  crgo_chem: "chemicals",
  crgo_drybulk: "dry_bulk",
  crgo_coldfood: "refrigerated_food",
  crgo_beverages: "beverages",
  crgo_paperprod: "paper_products",
  crgo_utility: "utility",
  crgo_farmsupp: "farm_supplies",
  crgo_construct: "construction",
  crgo_waterwell: "water_well",
  crgo_cargoothr: "other_cargo",
};

export function clean(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function upper(value) {
  return clean(value).toUpperCase();
}

export function numberValue(value) {
  const raw = clean(value).replace(/,/g, "");
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeDot(value) {
  const digits = clean(value).replace(/\D/g, "");
  if (!digits || digits.length > 12) return null;

  try {
    const normalized = BigInt(digits);
    return normalized > 0n ? normalized.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeEmail(value) {
  const email = clean(value).toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

export function normalizePhone(value) {
  const digits = clean(value).replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

export function isMarked(value) {
  return ["X", "Y", "1", "TRUE"].includes(upper(value));
}

export function getActiveMcNumber(row) {
  for (let index = 1; index <= 3; index += 1) {
    const prefix = upper(row["docket" + index + "prefix"]);
    const docket = clean(row["docket" + index]);
    const status = upper(row["docket" + index + "_status_code"]);

    if (prefix === "MC" && docket && status === "A") {
      return "MC-" + docket;
    }
  }

  return null;
}

export function getCargoSignals(row) {
  const signals = [];

  for (const [field, label] of Object.entries(CARGO_FIELDS)) {
    if (isMarked(row[field])) {
      signals.push(label);
    }
  }

  if (
    isMarked(row.crgo_cargoothr) &&
    clean(row.crgo_cargoothr_desc)
  ) {
    signals.push("other:" + clean(row.crgo_cargoothr_desc));
  }

  return signals;
}

export function assessSmsCarrier(row) {
  const reasons = [];
  const dotNumber = normalizeDot(row.dot_number);
  const legalName = clean(row.legal_name);
  const statusCode = upper(row.status_code);
  const carrierOperation = upper(row.carrier_operation);
  const entityType = upper(row.carship);
  const powerUnits = numberValue(row.power_units);
  const state = upper(row.phy_state);
  const mcNumber = getActiveMcNumber(row);
  const cargo = getCargoSignals(row);

  if (!dotNumber) reasons.push("missing_dot_number");
  if (!legalName) reasons.push("missing_legal_name");
  if (statusCode !== "A") reasons.push("registration_not_active");
  if (carrierOperation !== "A") reasons.push("not_interstate");
  if (!["C", "B"].includes(entityType)) reasons.push("not_carrier_entity");
  if (powerUnits < 1) reasons.push("no_power_units");
  if (!/^[A-Z]{2}$/.test(state)) reasons.push("missing_or_invalid_state");
  if (!mcNumber) reasons.push("no_active_mc_docket");
  if (cargo.length === 0) reasons.push("no_property_cargo_classification");

  const email = normalizeEmail(row.email_address || row.email);
  const phone = normalizePhone(row.phone || row.telephone);
  const cellPhone = normalizePhone(row.cell_phone);

  return {
    eligible: reasons.length === 0,
    reasons,
    contactable: Boolean(email || phone || cellPhone),
    carrier: {
      dot_number: dotNumber,
      legal_name: legalName,
      dba_name: clean(row.dba_name) || null,
      mc_number: mcNumber,
      entity_type: entityType || null,
      classification: clean(row.classdef) || null,
      status_code: statusCode || null,
      carrier_operation: carrierOperation || null,
      phone,
      cell_phone: cellPhone,
      email,
      street: clean(row.phy_street) || null,
      city: clean(row.phy_city) || null,
      state: state || null,
      zip: clean(row.phy_zip) || null,
      county: clean(row.phy_cnty) || null,
      power_units: powerUnits,
      truck_units: numberValue(row.truck_units),
      bus_units: numberValue(row.bus_units),
      drivers: numberValue(row.total_drivers),
      total_cdl: numberValue(row.total_cdl),
      safety_rating: upper(row.safety_rating) || null,
      hazmat: isMarked(row.hm_ind),
      cargo,
      add_date: clean(row.add_date) || null,
      mcs150_date: clean(row.mcs150_date) || null,
    },
  };
}

export function fleetSegment(value) {
  const units = numberValue(value);
  if (units < 1) return "unknown";
  if (units <= 5) return "1_5";
  if (units <= 20) return "6_20";
  if (units <= 50) return "21_50";
  if (units <= 100) return "51_100";
  return "101_plus";
}

function dateKey(value) {
  const digits = clean(value).replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(0, 8) : "";
}

export function isNewerCensusRow(candidate, current) {
  const candidateMcs = dateKey(candidate.mcs150_date);
  const currentMcs = dateKey(current.mcs150_date);

  if (candidateMcs !== currentMcs) {
    return candidateMcs > currentMcs;
  }

  return dateKey(candidate.add_date) > dateKey(current.add_date);
}
