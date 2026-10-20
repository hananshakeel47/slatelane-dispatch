-- Replace carrier-name identity checks in the dormant capacity-manager workflow.
-- DOT is the durable identity for FMCSA candidates. Same-name carriers with
-- different DOT numbers must remain eligible as distinct carriers.
-- This migration changes only the function definition; it does not run the
-- capacity manager, create enrollments, or send email.

BEGIN;

DO $preflight$
DECLARE
  v_source text;
  v_old_predicate text := $old$WHERE lower(btrim(l.name)) = lower(btrim(COALESCE(p.legal_name, 'Carrier ' || p.dot_number::text)))$old$;
  v_matches integer;
BEGIN
  SELECT p.prosrc
    INTO v_source
  FROM pg_proc p
  WHERE p.oid = 'public.run_daily_outreach_capacity_manager(boolean)'::regprocedure;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'run_daily_outreach_capacity_manager(boolean) is missing; refusing to patch.';
  END IF;

  v_matches := (length(v_source) - length(replace(v_source, v_old_predicate, '')))
               / length(v_old_predicate);

  IF v_matches <> 3 THEN
    RAISE EXCEPTION 'Expected 3 name-based carrier identity checks, found %; refusing to patch.', v_matches;
  END IF;
END
$preflight$;

CREATE OR REPLACE FUNCTION public.run_daily_outreach_capacity_manager(p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_cfg public.email_daily_outreach_settings%ROWTYPE;
    v_launch public.email_launch_settings%ROWTYPE;
    v_safety public.email_safety_state%ROWTYPE;

    v_timezone text;
    v_local_now timestamp without time zone;
    v_operational_date date;
    v_local_start timestamp without time zone;
    v_local_end timestamp without time zone;
    v_today_start_utc timestamptz;
    v_today_end_utc timestamptz;

    v_existing_run public.email_daily_outreach_runs%ROWTYPE;

    v_sequence_id uuid;
    v_sequence_count integer := 0;

    v_sent_today integer := 0;
    v_reserved_today integer := 0;
    v_active_total integer := 0;
    v_remaining_daily integer := 0;
    v_concurrency_room integer := 0;
    v_new_slots integer := 0;

    v_candidate_count integer := 0;
    v_verify_result jsonb;

    v_latest_existing_local timestamp without time zone;
    v_next_slot_local timestamp without time zone;
    v_base_local timestamp without time zone;
    v_available_batch_slots integer := 0;
    v_time_capacity integer := 0;

    v_batch_id uuid;
    v_lead_id uuid;
    v_enrollment_id uuid;
    v_send_at timestamptz;

    v_created integer := 0;
    v_created_members integer := 0;
    v_first_send timestamptz;
    v_last_send timestamptz;

    v_unsafe_replied integer := 0;
    r record;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('slatelane-phase-027g-daily-outreach'));

    SELECT * INTO v_cfg
    FROM public.email_daily_outreach_settings
    WHERE id = 1
    FOR UPDATE;

    IF NOT FOUND OR COALESCE(v_cfg.enabled, false) = false THEN
        RETURN jsonb_build_object(
            'success', true,
            'launched', false,
            'reason', 'daily_outreach_disabled'
        );
    END IF;

    SELECT * INTO v_launch
    FROM public.email_launch_settings
    ORDER BY id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'launched', false, 'reason', 'launch_settings_missing');
    END IF;

    v_timezone := COALESCE(NULLIF(btrim(v_launch.sending_timezone), ''), 'America/Chicago');
    v_local_now := now() AT TIME ZONE v_timezone;
    v_operational_date := v_local_now::date;

    -- Normal cron runs hourly at minute 45. Only the configured local hour
    -- is allowed to materialize a new daily batch. Manual p_force bypasses this.
    IF NOT p_force
       AND extract(hour FROM v_local_now)::integer <> v_cfg.preparation_local_hour THEN
        RETURN jsonb_build_object(
            'success', true,
            'launched', false,
            'reason', 'outside_daily_preparation_hour',
            'local_now', v_local_now,
            'timezone', v_timezone,
            'configured_hour', v_cfg.preparation_local_hour
        );
    END IF;

    SELECT * INTO v_existing_run
    FROM public.email_daily_outreach_runs
    WHERE operational_date = v_operational_date
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'launched', v_existing_run.status = 'launched',
            'already_ran', true,
            'operational_date', v_operational_date,
            'status', v_existing_run.status,
            'pilot_batch_id', v_existing_run.pilot_batch_id,
            'created_enrollments', v_existing_run.created_enrollments,
            'first_send_at', v_existing_run.first_send_at,
            'last_send_at', v_existing_run.last_send_at,
            'note', v_existing_run.note
        );
    END IF;

    IF COALESCE(v_launch.sending_enabled, false) = false THEN
        INSERT INTO public.email_daily_outreach_runs (
            operational_date,status,daily_send_cap,note,metadata
        ) VALUES (
            v_operational_date,'blocked',COALESCE(v_launch.daily_send_cap,0),
            'Master Sending is disabled. Daily auto-enrollment was not created.',
            jsonb_build_object('reason','master_sending_disabled')
        );

        RETURN jsonb_build_object('success', true, 'launched', false, 'reason', 'master_sending_disabled');
    END IF;

    SELECT * INTO v_safety
    FROM public.email_safety_state
    WHERE id = 1;

    IF FOUND AND COALESCE(v_safety.auto_paused, false) = true THEN
        INSERT INTO public.email_daily_outreach_runs (
            operational_date,status,daily_send_cap,note,metadata
        ) VALUES (
            v_operational_date,'blocked',COALESCE(v_launch.daily_send_cap,0),
            'Email safety state is auto-paused. Daily auto-enrollment was not created.',
            jsonb_build_object('reason','email_safety_auto_paused','pause_reason',v_safety.pause_reason)
        );

        RETURN jsonb_build_object('success', true, 'launched', false, 'reason', 'email_safety_auto_paused');
    END IF;

    SELECT COALESCE(replied_leads_still_running,0)
    INTO v_unsafe_replied
    FROM public.email_reply_integrity_status
    LIMIT 1;

    IF COALESCE(v_unsafe_replied,0) > 0 THEN
        INSERT INTO public.email_daily_outreach_runs (
            operational_date,status,daily_send_cap,note,metadata
        ) VALUES (
            v_operational_date,'blocked',COALESCE(v_launch.daily_send_cap,0),
            'Reply integrity gate is unsafe. Daily auto-enrollment was not created.',
            jsonb_build_object('reason','unsafe_replied_leads','count',v_unsafe_replied)
        );

        RETURN jsonb_build_object('success', true, 'launched', false, 'reason', 'unsafe_replied_leads');
    END IF;

    SELECT count(*)
    INTO v_sequence_count
    FROM public.email_sequences
    WHERE active = true;

    IF v_sequence_count = 1 THEN
        SELECT id
        INTO v_sequence_id
        FROM public.email_sequences
        WHERE active = true
        ORDER BY created_at DESC
        LIMIT 1;
    ELSE
        v_sequence_id := NULL;
    END IF;

    IF v_sequence_count <> 1 OR v_sequence_id IS NULL THEN
        INSERT INTO public.email_daily_outreach_runs (
            operational_date,status,daily_send_cap,note,metadata
        ) VALUES (
            v_operational_date,'blocked',COALESCE(v_launch.daily_send_cap,0),
            'Expected exactly one active email sequence.',
            jsonb_build_object('reason','active_sequence_count_invalid','count',v_sequence_count)
        );

        RETURN jsonb_build_object('success', true, 'launched', false, 'reason', 'active_sequence_count_invalid');
    END IF;

    v_local_start := date_trunc('day', v_local_now) + make_interval(hours => v_launch.sending_hour_start);
    v_local_end := date_trunc('day', v_local_now) + make_interval(hours => v_launch.sending_hour_end);
    v_today_start_utc := v_local_start AT TIME ZONE v_timezone;
    v_today_end_utc := v_local_end AT TIME ZONE v_timezone;

    SELECT count(*)::integer
    INTO v_sent_today
    FROM public.email_sends es
    WHERE es.sent_at >= v_today_start_utc
      AND es.sent_at < v_today_end_utc;

    -- Reserve capacity for every active enrollment due before the end of
    -- today's operational window, including overdue follow-ups.
    SELECT count(*)::integer
    INTO v_reserved_today
    FROM public.email_sequence_enrollments ese
    WHERE ese.status = 'active'
      AND ese.next_send_at IS NOT NULL
      AND ese.next_send_at < v_today_end_utc;

    SELECT count(*)::integer
    INTO v_active_total
    FROM public.email_sequence_enrollments ese
    WHERE ese.status = 'active';

    v_remaining_daily := GREATEST(COALESCE(v_launch.daily_send_cap,0) - v_sent_today - v_reserved_today, 0);
    v_concurrency_room := GREATEST(v_cfg.max_concurrent_enrollments - v_active_total, 0);

    v_new_slots := LEAST(
        v_cfg.target_new_carriers_per_day,
        v_remaining_daily,
        v_concurrency_room
    );

    IF v_new_slots <= 0 THEN
        INSERT INTO public.email_daily_outreach_runs (
            operational_date,status,daily_send_cap,sends_already_today,
            existing_reserved_today,new_slots_available,note,metadata
        ) VALUES (
            v_operational_date,'no_capacity',COALESCE(v_launch.daily_send_cap,0),v_sent_today,
            v_reserved_today,0,
            'No safe daily capacity remains after existing sends/follow-ups and concurrency protection.',
            jsonb_build_object(
                'active_enrollments',v_active_total,
                'max_concurrent_enrollments',v_cfg.max_concurrent_enrollments,
                'followups_first',v_cfg.followups_first
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'launched', false,
            'reason', 'no_safe_daily_capacity',
            'sent_today', v_sent_today,
            'reserved_today', v_reserved_today,
            'daily_send_cap', v_launch.daily_send_cap,
            'active_enrollments', v_active_total
        );
    END IF;

    SELECT count(*)::integer
    INTO v_candidate_count
    FROM public.email_ramp_20_candidate_preview p
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.leads l
        WHERE l.carrier_dot_number = p.dot_number
    );

    IF v_candidate_count < v_cfg.verification_refill_threshold THEN
        v_verify_result := public.verify_carrier_email_batch(v_cfg.verification_refill_batch);

        SELECT count(*)::integer
        INTO v_candidate_count
        FROM public.email_ramp_20_candidate_preview p
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.leads l
            WHERE l.carrier_dot_number = p.dot_number
        );
    END IF;

    v_new_slots := LEAST(v_new_slots, v_candidate_count);

    IF v_new_slots <= 0 THEN
        INSERT INTO public.email_daily_outreach_runs (
            operational_date,status,daily_send_cap,sends_already_today,
            existing_reserved_today,new_slots_available,candidates_available,note,metadata
        ) VALUES (
            v_operational_date,'blocked',COALESCE(v_launch.daily_send_cap,0),v_sent_today,
            v_reserved_today,0,v_candidate_count,
            'No verified eligible carrier candidates are currently available.',
            jsonb_build_object('reason','no_verified_candidates','verification_refill_result',v_verify_result)
        );

        RETURN jsonb_build_object('success', true, 'launched', false, 'reason', 'no_verified_candidates');
    END IF;

    -- Put fresh Step-1 traffic after existing follow-ups scheduled for today.
    SELECT max(ese.next_send_at AT TIME ZONE v_timezone)
    INTO v_latest_existing_local
    FROM public.email_sequence_enrollments ese
    WHERE ese.status = 'active'
      AND ese.next_send_at IS NOT NULL
      AND ese.next_send_at < v_today_end_utc;

    -- Next quarter-hour at least five minutes from now.
    v_next_slot_local := date_trunc('hour', v_local_now + interval '5 minutes')
        + (ceil(extract(minute FROM (v_local_now + interval '5 minutes')) / 15.0) * 15)::integer * interval '1 minute';

    v_base_local := v_local_start;

    IF v_local_now >= v_local_start THEN
        v_base_local := GREATEST(v_base_local, v_next_slot_local);
    END IF;

    IF v_latest_existing_local IS NOT NULL THEN
        v_base_local := GREATEST(v_base_local, v_latest_existing_local + interval '15 minutes');
    END IF;

    IF v_base_local >= v_local_end THEN
        INSERT INTO public.email_daily_outreach_runs (
            operational_date,status,daily_send_cap,sends_already_today,
            existing_reserved_today,new_slots_available,candidates_available,note,metadata
        ) VALUES (
            v_operational_date,'no_capacity',COALESCE(v_launch.daily_send_cap,0),v_sent_today,
            v_reserved_today,0,v_candidate_count,
            'Daily capacity exists, but there is no safe send-window time remaining today.',
            jsonb_build_object('reason','send_window_exhausted','base_local',v_base_local,'local_end',v_local_end)
        );

        RETURN jsonb_build_object('success', true, 'launched', false, 'reason', 'send_window_exhausted');
    END IF;

    v_available_batch_slots := GREATEST(
        floor(extract(epoch FROM (v_local_end - v_base_local - interval '1 second')) / 900)::integer + 1,
        0
    );

    v_time_capacity := v_available_batch_slots * GREATEST(v_launch.max_batch_size,1);
    v_new_slots := LEAST(v_new_slots, v_time_capacity);

    IF v_new_slots <= 0 THEN
        INSERT INTO public.email_daily_outreach_runs (
            operational_date,status,daily_send_cap,sends_already_today,
            existing_reserved_today,new_slots_available,candidates_available,note,metadata
        ) VALUES (
            v_operational_date,'no_capacity',COALESCE(v_launch.daily_send_cap,0),v_sent_today,
            v_reserved_today,0,v_candidate_count,
            'No safe processor batch slot remains inside today''s sending window.',
            jsonb_build_object('reason','no_batch_slot_remaining')
        );

        RETURN jsonb_build_object('success', true, 'launched', false, 'reason', 'no_batch_slot_remaining');
    END IF;

    INSERT INTO public.email_pilot_batches (
        sequence_id,status,requested_count,prepared_count,minimum_score,
        notes,prepared_at,armed_at,updated_at
    ) VALUES (
        v_sequence_id,'armed',v_new_slots,v_new_slots,COALESCE(v_launch.minimum_carrier_score,80),
        'Phase 027G automatic daily capacity-managed outreach for ' || v_operational_date::text || '.',
        now(),now(),now()
    ) RETURNING id INTO v_batch_id;

    FOR r IN
        SELECT p.*
        FROM public.email_ramp_20_candidate_preview p
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.leads l
            WHERE l.carrier_dot_number = p.dot_number
        )
        ORDER BY p.outreach_priority_score DESC NULLS LAST, p.motus_authority_event_date DESC NULLS LAST, p.lead_score DESC NULLS LAST, p.dot_number DESC
        LIMIT v_new_slots
    LOOP
        v_send_at := (
            v_base_local
            + floor(v_created::numeric / GREATEST(v_launch.max_batch_size,1))::integer * interval '15 minutes'
        ) AT TIME ZONE v_timezone;

        INSERT INTO public.leads (
            name,company_name,email,phone,message,carrier_dot_number,mc_number,
            source,status,notes,updated_at
        ) VALUES (
            COALESCE(NULLIF(btrim(r.legal_name),''),'Carrier ' || r.dot_number::text),
            COALESCE(NULLIF(btrim(r.legal_name),''),'Carrier ' || r.dot_number::text),
            lower(btrim(r.email)),
            NULLIF(btrim(COALESCE(r.phone,'')),''),
            'Automatically selected verified carrier prospect under Phase 027G daily capacity management.',
            r.dot_number,
            NULLIF(btrim(COALESCE(r.mc_number,'')),''),
            'fmcsa_daily_auto',
            'new',
            'Automatic daily outreach; operational date ' || v_operational_date::text || '; pilot batch ' || v_batch_id::text || '.',
            now()
        ) RETURNING id INTO v_lead_id;

        INSERT INTO public.email_sequence_enrollments (
            lead_id,sequence_id,status,current_step,next_send_at,started_at,updated_at
        ) VALUES (
            v_lead_id,v_sequence_id,'active',1,v_send_at,now(),now()
        ) RETURNING id INTO v_enrollment_id;

        INSERT INTO public.email_pilot_members (
            batch_id,carrier_id,lead_id,enrollment_id,dot_number,email
        )
        SELECT
            v_batch_id,c.id,v_lead_id,v_enrollment_id,c.dot_number,lower(btrim(c.email))
        FROM public.carriers c
        WHERE c.dot_number = r.dot_number
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION '027G safety failure: carrier row missing for DOT %', r.dot_number;
        END IF;

        UPDATE public.carriers
        SET contacted = true,
            updated_at = now()
        WHERE dot_number = r.dot_number;

        v_created := v_created + 1;
        v_created_members := v_created_members + 1;

        IF v_first_send IS NULL OR v_send_at < v_first_send THEN
            v_first_send := v_send_at;
        END IF;

        IF v_last_send IS NULL OR v_send_at > v_last_send THEN
            v_last_send := v_send_at;
        END IF;
    END LOOP;

    IF v_created <> v_new_slots OR v_created_members <> v_new_slots THEN
        RAISE EXCEPTION '027G failed: expected % daily enrollments but created leads=% members=%',
            v_new_slots, v_created, v_created_members;
    END IF;

    INSERT INTO public.email_daily_outreach_runs (
        operational_date,status,daily_send_cap,sends_already_today,
        existing_reserved_today,new_slots_available,candidates_available,
        created_leads,created_enrollments,created_pilot_members,pilot_batch_id,
        first_send_at,last_send_at,note,metadata
    ) VALUES (
        v_operational_date,'launched',COALESCE(v_launch.daily_send_cap,0),v_sent_today,
        v_reserved_today,v_new_slots,v_candidate_count,
        v_created,v_created,v_created_members,v_batch_id,
        v_first_send,v_last_send,
        'Fresh verified carriers filled only the unused daily capacity after follow-up reservations.',
        jsonb_build_object(
            'phase','027G',
            'followups_first',v_cfg.followups_first,
            'target_new_carriers_per_day',v_cfg.target_new_carriers_per_day,
            'active_enrollments_before',v_active_total,
            'max_concurrent_enrollments',v_cfg.max_concurrent_enrollments,
            'verification_refill_result',v_verify_result,
            'timezone',v_timezone,
            'local_base_send_time',v_base_local,
            'emails_sent_by_this_function',false,
            'processor_responsible_for_send',true
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'phase', '027G-daily-outreach-capacity-manager',
        'launched', true,
        'operational_date', v_operational_date,
        'pilot_batch_id', v_batch_id,
        'daily_send_cap', v_launch.daily_send_cap,
        'sent_today_before_run', v_sent_today,
        'existing_followups_reserved', v_reserved_today,
        'new_carriers_added', v_created,
        'first_send_at', v_first_send,
        'last_send_at', v_last_send,
        'emails_sent_by_this_function', false,
        'message', 'Fresh verified carriers were safely enrolled to fill the remaining daily send capacity.'
    );

EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO public.email_daily_outreach_runs (
            operational_date,status,daily_send_cap,note,metadata
        ) VALUES (
            COALESCE(v_operational_date, (now() AT TIME ZONE COALESCE(v_timezone,'America/Chicago'))::date),
            'error',COALESCE(v_launch.daily_send_cap,0),
            'Phase 027G daily manager rolled back after an unexpected error.',
            jsonb_build_object('error',SQLERRM,'sqlstate',SQLSTATE)
        )
        ON CONFLICT (operational_date)
        DO UPDATE SET
            status='error',
            note=EXCLUDED.note,
            metadata=EXCLUDED.metadata,
            completed_at=now();

        RETURN jsonb_build_object(
            'success', false,
            'launched', false,
            'reason', 'unexpected_error',
            'error', SQLERRM,
            'sqlstate', SQLSTATE
        );
END;
$function$


DO $postflight$
DECLARE
  v_source text;
  v_old_predicate text := $old$WHERE lower(btrim(l.name)) = lower(btrim(COALESCE(p.legal_name, 'Carrier ' || p.dot_number::text)))$old$;
  v_new_predicate text := $new$WHERE l.carrier_dot_number = p.dot_number$new$;
  v_old_matches integer;
  v_new_matches integer;
BEGIN
  SELECT p.prosrc
    INTO v_source
  FROM pg_proc p
  WHERE p.oid = 'public.run_daily_outreach_capacity_manager(boolean)'::regprocedure;

  v_old_matches := (length(v_source) - length(replace(v_source, v_old_predicate, '')))
                   / length(v_old_predicate);
  v_new_matches := (length(v_source) - length(replace(v_source, v_new_predicate, '')))
                   / length(v_new_predicate);

  IF v_old_matches <> 0 OR v_new_matches <> 3 THEN
    RAISE EXCEPTION 'Carrier identity postflight failed: old checks %, DOT checks %.', v_old_matches, v_new_matches;
  END IF;
END
$postflight$;

COMMIT;
