import type {
  NormalizedCarrier,
} from "./types";

export function shouldImport(
  carrier: NormalizedCarrier
): boolean {
  return Boolean(
    carrier.dot_number &&
    carrier.legal_name
  );
}