import type { NormalizedCarrier } from "./types";

export function calculateLeadScore(
  carrier: Omit<NormalizedCarrier, "lead_score">
): number {
  let score = 0;

  // Active FMCSA entity
  if (carrier.status_code?.toUpperCase() === "A") {
    score += 20;
  }

  // Good dispatch prospect: small fleet
  if (
    carrier.power_units >= 1 &&
    carrier.power_units <= 5
  ) {
    score += 25;
  }

  // Small driver count
  if (
    carrier.drivers >= 1 &&
    carrier.drivers <= 5
  ) {
    score += 20;
  }

  // Contactable by email
  if (carrier.email) {
    score += 15;
  }

  // Interstate operation
  if (
    carrier.carrier_operation?.toUpperCase() === "A"
  ) {
    score += 10;
  }

  // General freight is useful for dispatch prospecting
  if (carrier.cargo.includes("general_freight")) {
    score += 10;
  }

  return Math.min(score, 100);
}