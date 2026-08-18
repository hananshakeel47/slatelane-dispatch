export const DEFAULT_SEQUENCE_NAME =
  "SlateLane Dispatch Outreach";


export const STOP_LEAD_STATUSES =
  new Set([
    "client",
    "not_interested",
  ]);


export const STOP_EMAIL_FLAGS = [
  "email_opt_out",
  "email_bounced",
  "email_complained",
] as const;