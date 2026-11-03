-- Make daily capacity reservations match the read-only portion of the final
-- carrier send-eligibility gate. Do not call email_enrollment_send_eligibility
-- here: that gate can refresh local verification and is intentionally mutating.

CREATE OR REPLACE FUNCTION public.email_enrollment_reservation_eligible(
    p_enrollment_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.email_sequence_enrollments ese
        JOIN public.leads l
          ON l.id = ese.lead_id
        JOIN public.carriers c
          ON c.dot_number = l.carrier_dot_number
        JOIN public.email_verifalia_latest v
          ON v.carrier_id = c.id
         AND lower(trim(COALESCE(v.email_normalized, ''))) =
             lower(trim(COALESCE(c.email, '')))
        WHERE ese.id = p_enrollment_id
          AND ese.status = 'active'
          AND NULLIF(BTRIM(COALESCE(l.email, '')), '') IS NOT NULL
          AND length(split_part(lower(trim(l.email)), '@', 1)) >= 2
          AND NOT COALESCE(l.email_opt_out, false)
          AND NOT COALESCE(l.email_bounced, false)
          AND NOT COALESCE(l.email_complained, false)
          AND NOT COALESCE(l.has_replied, false)
          AND COALESCE(l.reply_count, 0) = 0
          AND NOT EXISTS (
              SELECT 1
              FROM public.email_suppressions s
              WHERE lower(trim(s.email)) = lower(trim(l.email))
          )
          AND NOT COALESCE(
              (SELECT ss.auto_paused
               FROM public.email_safety_status ss
               LIMIT 1),
              false
          )
          AND lower(trim(COALESCE(c.email, ''))) = lower(trim(l.email))
          AND COALESCE(c.email_verification_status, '') = 'verified_format'
          AND c.email_verification_checked_at IS NOT NULL
          AND COALESCE(c.email_risk_score, 100) < 70
          AND NOT COALESCE(c.email_disposable, false)
          AND COALESCE(c.email_health_status, 'unknown') NOT IN (
              'bounced', 'complained', 'opted_out', 'suppressed'
          )
          AND NOT COALESCE(c.client, false)
          AND COALESCE(c.status_code, '') = 'A'
          AND COALESCE(c.carrier_operation, '') = 'A'
          AND COALESCE(c.authority_status, '') = 'Active'
          AND NULLIF(BTRIM(c.authority_type), '') IS NOT NULL
          AND c.authority_type ILIKE '%property%'
          AND COALESCE(
              CURRENT_DATE - COALESCE(
                  c.motus_authority_event_date,
                  c.authority_date
              ),
              c.authority_age_days
          ) >= 14
          AND COALESCE(c.power_units, 0) BETWEEN 1 AND 5
          AND COALESCE(c.drivers, 0) >= 1
          AND lower(COALESCE(v.status, '')) = 'deliverable'
          AND lower(COALESCE(v.classification, '')) = 'deliverable'
          AND v.expires_at > now()
    );
$function$;

-- This helper is for backend capacity accounting only. The public view that
-- consumes it is already restricted to service_role; do not expose the helper
-- to browser roles.
REVOKE ALL ON FUNCTION public.email_enrollment_reservation_eligible(uuid)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_enrollment_reservation_eligible(uuid)
    TO service_role;

DO $migration$
DECLARE
    v_definition text;
    v_old text;
    v_new text;
    v_occurrences integer;
    v_view_definition text;
BEGIN
    -- Active hourly feeder: run_daily_fixed_20_plus_followups(false).
    SELECT pg_get_functiondef(
        'public.run_daily_fixed_20_plus_followups(boolean)'::regprocedure
    )
    INTO v_definition;

    v_old := 'AND ese.next_send_at < v_today_end_utc;';
    v_occurrences :=
        (length(v_definition) - length(replace(v_definition, v_old, '')))
        / length(v_old);

    IF v_occurrences <> 1 THEN
        RAISE EXCEPTION
            'Expected one daily reservation predicate in run_daily_fixed_20_plus_followups; found %',
            v_occurrences;
    END IF;

    v_new := 'AND ese.next_send_at < v_today_end_utc'
        || E'\n      AND public.email_enrollment_reservation_eligible(ese.id);';
    v_definition := replace(v_definition, v_old, v_new);

    v_old := 'AND ese.next_send_at < (v_local_end AT TIME ZONE v_timezone)';
    v_occurrences :=
        (length(v_definition) - length(replace(v_definition, v_old, '')))
        / length(v_old);

    IF v_occurrences <> 1 THEN
        RAISE EXCEPTION
            'Expected one slot-reservation predicate in run_daily_fixed_20_plus_followups; found %',
            v_occurrences;
    END IF;

    v_new := 'AND ese.next_send_at < (v_local_end AT TIME ZONE v_timezone)'
        || E'\n          AND public.email_enrollment_reservation_eligible(ese.id)';
    v_definition := replace(v_definition, v_old, v_new);
    EXECUTE v_definition;

    -- Recovery fallback feeder: used by the automatic safety-recovery path.
    -- Its same-day reservation count and latest-follow-up scheduling anchor
    -- must use the same sendable-only predicate.
    SELECT pg_get_functiondef(
        'public.run_daily_outreach_capacity_manager(boolean)'::regprocedure
    )
    INTO v_definition;

    v_old := 'AND ese.next_send_at < v_today_end_utc;';
    v_occurrences :=
        (length(v_definition) - length(replace(v_definition, v_old, '')))
        / length(v_old);

    IF v_occurrences <> 2 THEN
        RAISE EXCEPTION
            'Expected two due-enrollment predicates in run_daily_outreach_capacity_manager; found %',
            v_occurrences;
    END IF;

    v_new := 'AND ese.next_send_at < v_today_end_utc'
        || E'\n      AND public.email_enrollment_reservation_eligible(ese.id);';
    v_definition := replace(v_definition, v_old, v_new);
    EXECUTE v_definition;

    -- Dashboard capacity must report the same eligible reservation count.
    SELECT pg_get_viewdef(
        'public.email_daily_outreach_status'::regclass,
        true
    )
    INTO v_view_definition;

    v_old := 'ese.next_send_at < ((date_trunc(''day''::text, lc_1.local_now) + make_interval(hours => lc_1.sending_hour_end)) AT TIME ZONE lc_1.sending_timezone)';
    v_occurrences :=
        (length(v_view_definition) - length(replace(v_view_definition, v_old, '')))
        / length(v_old);

    IF v_occurrences <> 1 THEN
        RAISE EXCEPTION
            'Expected one reserved_due predicate in email_daily_outreach_status; found %',
            v_occurrences;
    END IF;

    v_new := v_old
        || ' AND public.email_enrollment_reservation_eligible(ese.id)';
    v_view_definition := replace(v_view_definition, v_old, v_new);

    EXECUTE
        'CREATE OR REPLACE VIEW public.email_daily_outreach_status AS '
        || v_view_definition;
END;
$migration$;
