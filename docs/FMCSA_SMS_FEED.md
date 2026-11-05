# FMCSA SMS active-carrier discovery — dry-run phase

## Purpose

Add a second, independent discovery source alongside the existing daily Motus authority feed.

- Feed 1 remains unchanged: Motus recent authority events.
- Proposed Feed 2 uses FMCSA SMS AB PassProperty (dataset 4y6x-dmck) as a broad DOT-number universe and joins those DOT numbers to the daily FMCSA Company Census (dataset az4n-8mr2).
- This phase adds read-only dry-run tooling only. It does not import carriers.

Official source pages:

- SMS AB PassProperty: https://data.transportation.gov/Trucking-and-Motorcoaches/SMS-AB-PassProperty/4y6x-dmck
- Company Census File: https://data.transportation.gov/Trucking-and-Motorcoaches/Company-Census-File/az4n-8mr2

## Dry-run qualification rules

A Company Census row must:

1. Match a USDOT number present in SMS AB PassProperty.
2. Have active registration (status_code = A).
3. Be interstate (carrier_operation = A).
4. Be a carrier (carship = C) or combined carrier/broker (carship = B).
5. Report at least one power unit. There is no maximum fleet-size limit.
6. Have an active MC docket in one of the three docket slots.
7. Have at least one property/freight cargo classification.
8. Have a legal name and a two-letter state value.

The report separates:
- All new-to-CRM qualified records.
- New-to-CRM records with a usable email or phone (the contactable preview).
- Email-only, phone-only, both-contact, and no-contact counts.
- Fleet bands: 1–5, 6–20, 21–50, 51–100, and 101+ power units.
- Cargo classifications reported by FMCSA.

There is deliberately no 30-day registration-age cutoff, no maximum power-unit cutoff, and no minimum driver-count rule.

## Equipment data limitation

Company Census cargo classifications describe the freight a carrier reports handling. They do not confirm the physical equipment it operates.

Examples:
- refrigerated_food is a cargo signal, not proof of a reefer trailer.
- general_freight is not proof of a dry van.
- building_materials, metal_sheets_coils_rolls, and logs_poles_beams_lumber are not proof of a flatbed.
- The census cargo fields do not reliably identify a box truck.

The dry-run reports cargo signals only. It must not populate or market an inferred cargo category as confirmed equipment. Confirmed equipment should come from carrier self-report or a separately validated source.

## Run the read-only dry-run

Use a trusted local environment with the repository dependencies installed. Set these values in .env.local or the shell:

- NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
- SUPABASE_SERVICE_ROLE_KEY
- Optional: SOCRATA_APP_TOKEN (helps with Socrata rate limits)

Never commit or paste the service-role key.

Commands:

- npm run test:fmcsa:sms
- npm run fmcsa:sms:dry-run

The script:
- Reads the SMS and Company Census dataset metadata before and after the scan.
- Pages through the SMS DOT-number universe and filtered active interstate Company Census rows.
- Aborts if either source changes while the scan is running.
- Reads only carriers.dot_number from Supabase for deduplication.
- Prints aggregate counts only; it does not print carrier names, emails, phone numbers, or addresses.

## Production safety boundaries

This phase does not:
- Insert or update any carrier.
- Change the Motus importer or its settings.
- Change CRM or Resend daily sending limits.
- Create leads or sequence enrollments.
- Call email verification.
- Send email.
- Deploy an Edge Function or create a cron job.

The existing outreach pipeline has its own strict eligibility rules, including a 1–5 power-unit constraint in its current candidate view. This project does not widen those rules. Larger fleets discovered by this source are for CRM review until a separately approved outreach-policy change is made.

## Next gate

After the dry-run is executed in an environment that can reach Socrata, review the exact net-new and contactable counts, fleet distribution, cargo-signal coverage, and overlap with the current CRM. Only then design the production insert path. Any production migration, deployment, scheduled import, or live carrier insertion requires separate explicit approval.
