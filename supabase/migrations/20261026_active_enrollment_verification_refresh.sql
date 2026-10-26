-- Allow the Verifalia worker to refresh active sequence recipients when their
-- deliverability result is missing or expired. Without this, the stricter send-time
-- gate would safely hold follow-ups forever because the new-prospect pool excludes leads.
-- This uses the existing daily verification limit and does not send outreach.

CREATE OR REPLACE VIEW public.email_new_prospect_verification_pool AS
SELECT
    b.carrier_id,
    b.dot_number,
    b.legal_name,
    b.email,
    b.phone,
    b.mc_number,
    b.lead_score,
    b.status_code,
    b.email_domain,
    b.email_free_provider,
    b.email_role_based,
    b.email_risk_score,
    c.acquisition_source,
    c.source_first_seen_at,
    c.motus_authority_event_date,
    c.power_units,
    c.authority_date,
    c.authority_age_days,
    CASE
        WHEN c.acquisition_source = 'motus_new_registration'
         AND c.motus_authority_event_date >= (CURRENT_DATE - 7)
         AND COALESCE(c.lead_score, 0) >= 90
         AND COALESCE(c.power_units, 99) BETWEEN 1 AND 3
            THEN 'hot_new_authority'
        WHEN c.acquisition_source = 'motus_new_registration'
         AND c.motus_authority_event_date >= (CURRENT_DATE - 14)
            THEN 'fresh_new_authority'
        WHEN c.acquisition_source = 'motus_new_registration'
            THEN 'recent_new_authority'
        ELSE 'legacy'
    END AS verification_priority_tier,
    CASE
        WHEN c.acquisition_source = 'motus_new_registration' THEN 1000
        ELSE 0
    END
    + CASE
        WHEN c.acquisition_source = 'motus_new_registration'
         AND c.motus_authority_event_date >= (CURRENT_DATE - 2) THEN 400
        WHEN c.acquisition_source = 'motus_new_registration'
         AND c.motus_authority_event_date >= (CURRENT_DATE - 7) THEN 320
        WHEN c.acquisition_source = 'motus_new_registration'
         AND c.motus_authority_event_date >= (CURRENT_DATE - 14) THEN 240
        WHEN c.acquisition_source = 'motus_new_registration'
         AND c.motus_authority_event_date >= (CURRENT_DATE - 30) THEN 160
        WHEN c.acquisition_source = 'motus_new_registration' THEN 80
        ELSE 0
    END
    + CASE
        WHEN lower(COALESCE(c.motus_authority_reason, '')) = 'granted' THEN 80
        ELSE 0
    END
    + LEAST(100, GREATEST(0, COALESCE(c.lead_score, 0)))
    + CASE COALESCE(c.power_units, 0)
        WHEN 1 THEN 50
        WHEN 2 THEN 45
        WHEN 3 THEN 35
        WHEN 4 THEN 20
        WHEN 5 THEN 10
        ELSE 0
      END
    + CASE WHEN COALESCE(c.email_free_provider, false) = false THEN 20 ELSE 0 END
    + CASE
        WHEN COALESCE(c.email_risk_score, 100) <= 10 THEN 20
        WHEN COALESCE(c.email_risk_score, 100) <= 30 THEN 10
        ELSE 0
      END
    + GREATEST(
        -120,
        LEAST(
            120,
            COALESCE(ws.conversion_boost, 0)
            + COALESCE(wf.conversion_boost, 0)
            + COALESCE(we.conversion_boost, 0)
            + COALESCE(wa.conversion_boost, 0)
            + COALESCE(wsrc.conversion_boost, 0)
        )
      ) AS verification_priority_score,
    GREATEST(
        -120,
        LEAST(
            120,
            COALESCE(ws.conversion_boost, 0)
            + COALESCE(wf.conversion_boost, 0)
            + COALESCE(we.conversion_boost, 0)
            + COALESCE(wa.conversion_boost, 0)
            + COALESCE(wsrc.conversion_boost, 0)
        )
    ) AS conversion_learning_boost
FROM public.email_outreach_base_candidates b
JOIN public.carriers c
  ON c.id = b.carrier_id
CROSS JOIN public.email_verification_provider_settings cfg
LEFT JOIN public.email_acquisition_segment_weights ws
  ON ws.dimension = 'state'
 AND ws.segment_value = COALESCE(NULLIF(c.state, ''), 'UNKNOWN')
LEFT JOIN public.email_acquisition_segment_weights wf
  ON wf.dimension = 'fleet'
 AND wf.segment_value = CASE
    WHEN COALESCE(c.power_units, 0) = 1 THEN '1_truck'
    WHEN COALESCE(c.power_units, 0) BETWEEN 2 AND 3 THEN '2_3_trucks'
    WHEN COALESCE(c.power_units, 0) BETWEEN 4 AND 5 THEN '4_5_trucks'
    ELSE 'other_unknown'
 END
LEFT JOIN public.email_acquisition_segment_weights we
  ON we.dimension = 'email_type'
 AND we.segment_value = CASE
    WHEN COALESCE(c.email_free_provider, false) THEN 'free_provider'
    ELSE 'business_domain'
 END
LEFT JOIN public.email_acquisition_segment_weights wa
  ON wa.dimension = 'authority_age'
 AND wa.segment_value = CASE
    WHEN c.motus_authority_event_date IS NULL THEN 'unknown'
    WHEN (CURRENT_DATE - c.motus_authority_event_date) <= 14 THEN '0_14_days'
    WHEN (CURRENT_DATE - c.motus_authority_event_date) <= 30 THEN '15_30_days'
    WHEN (CURRENT_DATE - c.motus_authority_event_date) <= 60 THEN '31_60_days'
    ELSE '61_plus_days'
 END
LEFT JOIN public.email_acquisition_segment_weights wsrc
  ON wsrc.dimension = 'source'
 AND wsrc.segment_value = COALESCE(c.acquisition_source, 'legacy')
WHERE cfg.id = 1
  AND cfg.enabled = true
  AND NOT EXISTS (
      SELECT 1
      FROM public.email_external_verifications ev
      WHERE ev.provider = 'verifalia'
        AND ev.carrier_id = b.carrier_id
        AND lower(COALESCE(ev.email_normalized, '')) = lower(BTRIM(b.email))
        AND ev.checked_at >= (now() - make_interval(days => cfg.retry_after_days))
  );

CREATE OR REPLACE VIEW public.email_verification_candidate_pool AS
WITH cfg AS (
    SELECT *
    FROM public.email_verification_provider_settings
    WHERE id = 1
      AND enabled = true
),
active_enrolled_leads AS (
    SELECT DISTINCT lead_id
    FROM public.email_sequence_enrollments
    WHERE status = 'active'
      AND next_send_at IS NOT NULL
),
active_enrollment_refresh AS (
    SELECT
        c.id AS carrier_id,
        c.dot_number,
        c.legal_name,
        c.email,
        c.phone,
        c.mc_number,
        c.lead_score,
        c.status_code,
        c.email_domain,
        c.email_free_provider,
        c.email_role_based,
        c.email_risk_score,
        c.acquisition_source,
        c.source_first_seen_at,
        c.motus_authority_event_date,
        c.power_units,
        c.authority_date,
        c.authority_age_days,
        'active_enrollment_refresh'::text AS verification_priority_tier,
        (
            10000
            + COALESCE(c.lead_score, 0) * 3
            + GREATEST(0, 70 - COALESCE(c.email_risk_score, 70))
        )::integer AS verification_priority_score,
        0::integer AS conversion_learning_boost
    FROM public.carriers c
    JOIN public.leads l
      ON l.carrier_dot_number = c.dot_number
     AND lower(BTRIM(COALESCE(l.email, ''))) = lower(BTRIM(COALESCE(c.email, '')))
    JOIN active_enrolled_leads ae
      ON ae.lead_id = l.id
    CROSS JOIN cfg
    WHERE c.email IS NOT NULL
      AND BTRIM(c.email) <> ''
      AND COALESCE(l.has_replied, false) = false
      AND COALESCE(l.reply_count, 0) = 0
      AND COALESCE(l.email_opt_out, false) = false
      AND COALESCE(l.email_bounced, false) = false
      AND COALESCE(l.email_complained, false) = false
      AND l.unsubscribed_at IS NULL
      AND COALESCE(c.status_code, '') = 'A'
      AND COALESCE(c.carrier_operation, '') = 'A'
      AND COALESCE(c.authority_status, '') = 'Active'
      AND COALESCE(NULLIF(BTRIM(c.authority_type), ''), '') ILIKE '%property%'
      AND COALESCE(
            CURRENT_DATE - COALESCE(c.motus_authority_event_date, c.authority_date),
            c.authority_age_days,
            0
          ) >= 14
      AND COALESCE(c.power_units, 0) BETWEEN 1 AND 5
      AND COALESCE(c.drivers, 0) >= 1
      AND COALESCE(c.email_verification_status, '') = 'verified_format'
      AND COALESCE(c.email_risk_score, 100) < 70
      AND NOT COALESCE(c.email_disposable, false)
      AND length(split_part(lower(BTRIM(c.email)), '@', 1)) >= 2
      AND COALESCE(c.email_health_status, 'unknown') NOT IN (
          'bounced', 'complained', 'opted_out', 'suppressed'
      )
      AND COALESCE(c.client, false) = false
      AND NOT EXISTS (
          SELECT 1
          FROM public.email_suppressions s
          WHERE lower(BTRIM(s.email)) = lower(BTRIM(c.email))
      )
      AND NOT EXISTS (
          SELECT 1
          FROM public.email_verifalia_latest v
          WHERE v.carrier_id = c.id
            AND lower(BTRIM(COALESCE(v.email_normalized, ''))) = lower(BTRIM(c.email))
            AND v.status = 'deliverable'
            AND v.classification = 'Deliverable'
            AND v.expires_at > now()
      )
      AND NOT EXISTS (
          SELECT 1
          FROM public.email_external_verifications ev
          WHERE ev.provider = 'verifalia'
            AND ev.carrier_id = c.id
            AND lower(BTRIM(COALESCE(ev.email_normalized, ''))) = lower(BTRIM(c.email))
            AND ev.checked_at >= (now() - make_interval(days => cfg.retry_after_days))
      )
)
SELECT * FROM public.email_new_prospect_verification_pool
UNION ALL
SELECT * FROM active_enrollment_refresh;
