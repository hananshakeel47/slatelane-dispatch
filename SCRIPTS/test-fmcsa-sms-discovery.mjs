import assert from "node:assert/strict";

import {
  assessSmsCarrier,
  fleetSegment,
  getActiveMcNumber,
  getCargoSignals,
  isNewerCensusRow,
  normalizeDot,
  normalizeEmail,
  normalizePhone,
} from "./fmcsa-sms-discovery-core.mjs";

const validLargeCarrier = {
  dot_number: "00123456",
  legal_name: "Example Freight LLC",
  dba_name: "Example Freight",
  status_code: "A",
  carrier_operation: "A",
  carship: "C",
  phy_state: "TX",
  power_units: "125",
  truck_units: "120",
  total_drivers: "130",
  phone: "(214) 555-0100",
  cell_phone: "",
  email_address: "dispatch@example.com",
  docket1prefix: "MC",
  docket1: "123456",
  docket1_status_code: "A",
  crgo_genfreight: "X",
  crgo_coldfood: "Y",
};

const assessment = assessSmsCarrier(validLargeCarrier);

assert.equal(assessment.eligible, true);
assert.equal(assessment.contactable, true);
assert.equal(assessment.carrier.dot_number, "123456");
assert.equal(assessment.carrier.power_units, 125);
assert.equal(assessment.carrier.mc_number, "MC-123456");
assert.deepEqual(
  assessment.carrier.cargo,
  ["general_freight", "refrigerated_food"],
);
assert.equal(fleetSegment(125), "101_plus");

const passengerOnly = {
  ...validLargeCarrier,
  crgo_genfreight: "",
  crgo_coldfood: "",
  crgo_passengers: "X",
};
const passengerAssessment = assessSmsCarrier(passengerOnly);
assert.equal(passengerAssessment.eligible, false);
assert.ok(
  passengerAssessment.reasons.includes(
    "no_property_cargo_classification",
  ),
);

const noActiveAuthority = {
  ...validLargeCarrier,
  docket1_status_code: "I",
};
assert.equal(assessSmsCarrier(noActiveAuthority).eligible, false);
assert.ok(
  assessSmsCarrier(noActiveAuthority).reasons.includes(
    "no_active_mc_docket",
  ),
);

const noFleet = {
  ...validLargeCarrier,
  power_units: 0,
};
assert.equal(assessSmsCarrier(noFleet).eligible, false);
assert.ok(
  assessSmsCarrier(noFleet).reasons.includes("no_power_units"),
);

const carrierAndBroker = {
  ...validLargeCarrier,
  carship: "B",
  power_units: 20,
};
assert.equal(assessSmsCarrier(carrierAndBroker).eligible, true);
assert.equal(fleetSegment(20), "6_20");
assert.equal(fleetSegment(50), "21_50");
assert.equal(fleetSegment(100), "51_100");
assert.equal(fleetSegment(5), "1_5");
assert.equal(fleetSegment(0), "unknown");

const noContact = {
  ...validLargeCarrier,
  phone: "",
  cell_phone: "",
  email_address: "",
};
const noContactAssessment = assessSmsCarrier(noContact);
assert.equal(noContactAssessment.eligible, true);
assert.equal(noContactAssessment.contactable, false);

assert.equal(normalizeDot(" 00-123456 "), "123456");
assert.equal(normalizeDot("0"), null);
assert.equal(normalizeDot("not-a-dot"), null);
assert.equal(normalizeEmail(" OPS@Example.COM "), "ops@example.com");
assert.equal(normalizeEmail("not-an-email"), null);
assert.equal(normalizePhone("+1 (214) 555-0100"), "12145550100");
assert.equal(normalizePhone("123"), null);

assert.equal(
  getActiveMcNumber({
    docket1prefix: "MC",
    docket1: "111",
    docket1_status_code: "I",
    docket2prefix: "MC",
    docket2: "222",
    docket2_status_code: "A",
  }),
  "MC-222",
);

assert.deepEqual(
  getCargoSignals({
    crgo_cargoothr: "X",
    crgo_cargoothr_desc: "specialized freight",
  }),
  ["other_cargo", "other:specialized freight"],
);

assert.equal(
  isNewerCensusRow(
    { mcs150_date: "20261001", add_date: "20200101" },
    { mcs150_date: "20250901", add_date: "20250101" },
  ),
  true,
);

assert.equal(
  isNewerCensusRow(
    { mcs150_date: "20240101", add_date: "20200101" },
    { mcs150_date: "20250101", add_date: "20200101" },
  ),
  false,
);

console.log("FMCSA SMS discovery core tests passed.");
