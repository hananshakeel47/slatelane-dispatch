export const CARRIER_PACKET_VERSION =
  "2026-09-14-v1";

export type CarrierPacketFormData = {
  company_name: string;
  dot_number: string;
  mc_number: string;

  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone: string;

  business_address: string;
  city: string;
  state: string;
  zip_code: string;

  home_terminal: string;

  operation_type: string;

  equipment_type: string;
  trailer_type: string;

  truck_count: string;
  driver_count: string;

  minimum_rate_per_mile: string;
  weekly_revenue_target: string;

  preferred_lanes: string;
  preferred_states: string;
  regions_to_avoid: string;

  home_time_notes: string;
  operating_notes: string;

  factoring_company: string;
  factoring_contact_email: string;

  insurance_company: string;
  insurance_policy_number: string;
  insurance_expiration: string;

  auto_liability_limit: string;
  cargo_limit: string;

  load_board_provider: string;

  emergency_contact_name: string;
  emergency_contact_phone: string;

  certification_name: string;
  certification_title: string;
  certification_email: string;
  electronic_signature: string;

  consent: boolean;
};