export type FMCSARawRow = Record<
  string,
  string | number | null | undefined
>;

export interface NormalizedCarrier {
  dot_number: number;

  mc_number: string | null;
  mx_number: string | null;
  ff_number: string | null;

  legal_name: string;
  dba_name: string | null;

  entity_type: string | null;
  classification: string | null;

  status_code: string | null;
  carrier_operation: string | null;
  business_type: string | null;

  phone: string | null;
  cell_phone: string | null;
  email: string | null;

  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;

  power_units: number;
  truck_units: number;
  bus_units: number;

  drivers: number;
  total_cdl: number;

  safety_rating: string | null;
  safety_rating_date: string | null;
  review_date: string | null;

  hazmat: boolean;

  cargo: string[];

  add_date: string | null;
  mcs150_date: string | null;

  lead_score: number;
}