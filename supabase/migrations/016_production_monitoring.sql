BEGIN;

-- ============================================================
-- SlateLane Dispatch CRM
-- Migration 016
-- Production Monitoring + Pilot Analytics
-- ============================================================


-- ============================================================
-- 1. PILOT CAMPAIGN METRICS
-- ============================================================

CREATE OR REPLACE VIEW public.pilot_campaign_metrics AS

WITH member_metrics AS (

    SELECT
        batch_id,
        COUNT(*)::bigint AS member_count
    FROM public.email_pilot_members
    GROUP BY batch_id

),

send_metrics AS (

    SELECT
        pm.batch_id,

        COUNT(es.id)::bigint AS sent_count,

        COUNT(es.id)
            FILTER (
                WHERE LOWER(COALESCE(es.status, '')) = 'delivered'
            )::bigint
            AS delivered_count,

        COUNT(es.id)
            FILTER (
                WHERE LOWER(COALESCE(es.status, '')) = 'bounced'
            )::bigint
            AS bounced_count,

        COUNT(es.id)
            FILTER (
                WHERE LOWER(COALESCE(es.status, '')) = 'failed'
            )::bigint
            AS failed_count,

        MAX(es.created_at)
            AS last_send_at

    FROM public.email_pilot_members pm

    LEFT JOIN public.email_sends es
        ON es.lead_id = pm.lead_id

    GROUP BY pm.batch_id

),

reply_metrics AS (

    SELECT
        pm.batch_id,

        COUNT(er.id)::bigint
            AS total_replies,

        COUNT(DISTINCT er.lead_id)::bigint
            AS replied_leads,

        COUNT(DISTINCT er.lead_id)
            FILTER (
                WHERE LOWER(COALESCE(er.classification, '')) = 'interested'
            )::bigint
            AS interested_leads,

        COUNT(er.id)
            FILTER (
                WHERE er.requires_attention IS TRUE
            )::bigint
            AS attention_replies,

        COUNT(er.id)
            FILTER (
                WHERE er.handled IS TRUE
            )::bigint
            AS handled_replies,

        MAX(er.received_at)
            AS last_reply_at

    FROM public.email_pilot_members pm

    LEFT JOIN public.email_replies er
        ON er.lead_id = pm.lead_id

    GROUP BY pm.batch_id

)

SELECT

    b.id AS batch_id,

    b.sequence_id,

    b.status,

    b.requested_count,

    b.prepared_count,

    b.minimum_score,

    b.created_at,

    b.prepared_at,

    b.armed_at,

    b.cancelled_at,

    COALESCE(mm.member_count, 0)
        AS member_count,

    COALESCE(sm.sent_count, 0)
        AS sent_count,

    COALESCE(sm.delivered_count, 0)
        AS delivered_count,

    COALESCE(sm.bounced_count, 0)
        AS bounced_count,

    COALESCE(sm.failed_count, 0)
        AS failed_count,

    COALESCE(rm.total_replies, 0)
        AS total_replies,

    COALESCE(rm.replied_leads, 0)
        AS replied_leads,

    COALESCE(rm.interested_leads, 0)
        AS interested_leads,

    COALESCE(rm.attention_replies, 0)
        AS attention_replies,

    COALESCE(rm.handled_replies, 0)
        AS handled_replies,

    sm.last_send_at,

    rm.last_reply_at,


    ROUND(
        CASE
            WHEN COALESCE(sm.sent_count, 0) = 0
                THEN 0
            ELSE
                (
                    COALESCE(sm.delivered_count, 0)::numeric
                    /
                    sm.sent_count::numeric
                ) * 100
        END,
        2
    ) AS delivery_rate,


    ROUND(
        CASE
            WHEN COALESCE(sm.sent_count, 0) = 0
                THEN 0
            ELSE
                (
                    COALESCE(sm.bounced_count, 0)::numeric
                    /
                    sm.sent_count::numeric
                ) * 100
        END,
        2
    ) AS bounce_rate,


    ROUND(
        CASE
            WHEN COALESCE(sm.sent_count, 0) = 0
                THEN 0
            ELSE
                (
                    COALESCE(rm.replied_leads, 0)::numeric
                    /
                    sm.sent_count::numeric
                ) * 100
        END,
        2
    ) AS reply_rate,


    ROUND(
        CASE
            WHEN COALESCE(sm.sent_count, 0) = 0
                THEN 0
            ELSE
                (
                    COALESCE(rm.interested_leads, 0)::numeric
                    /
                    sm.sent_count::numeric
                ) * 100
        END,
        2
    ) AS interested_rate

FROM public.email_pilot_batches b

LEFT JOIN member_metrics mm
    ON mm.batch_id = b.id

LEFT JOIN send_metrics sm
    ON sm.batch_id = b.id

LEFT JOIN reply_metrics rm
    ON rm.batch_id = b.id;
    

-- ============================================================
-- 2. PRODUCTION HEALTH SNAPSHOT
-- ============================================================

CREATE OR REPLACE VIEW public.production_health_snapshot AS

SELECT

    NOW() AS observed_at,


    (
        SELECT MAX(created_at)
        FROM public.email_sends
    ) AS last_send_at,


    (
        SELECT MAX(received_at)
        FROM public.email_webhook_events
    ) AS last_webhook_at,


    (
        SELECT MAX(received_at)
        FROM public.email_replies
    ) AS last_reply_at,


    (
        SELECT COUNT(*)
        FROM public.email_sequence_enrollments
        WHERE status = 'active'
    )::bigint AS active_enrollments,


    (
        SELECT COUNT(*)
        FROM public.email_sequence_enrollments
        WHERE status = 'paused'
    )::bigint AS paused_enrollments,


    (
        SELECT COUNT(*)
        FROM public.email_sequence_enrollments
        WHERE status = 'stopped'
    )::bigint AS stopped_enrollments,


    (
        SELECT COUNT(*)
        FROM public.email_replies
        WHERE handled IS FALSE
    )::bigint AS unhandled_replies,


    (
        SELECT COUNT(*)
        FROM public.email_replies
        WHERE requires_attention IS TRUE
        AND handled IS FALSE
    )::bigint AS attention_required,


    (
        SELECT COUNT(*)
        FROM public.email_sends
        WHERE created_at >= NOW() - INTERVAL '24 hours'
    )::bigint AS sends_last_24h,


    (
        SELECT COUNT(*)
        FROM public.email_sends
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND LOWER(COALESCE(status, '')) = 'delivered'
    )::bigint AS delivered_last_24h,


    (
        SELECT COUNT(*)
        FROM public.email_sends
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND LOWER(COALESCE(status, '')) = 'bounced'
    )::bigint AS bounced_last_24h,


    (
        SELECT COUNT(*)
        FROM public.email_sends
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND LOWER(COALESCE(status, '')) = 'failed'
    )::bigint AS failed_last_24h,


    (
        SELECT COUNT(*)
        FROM public.email_replies
        WHERE received_at >= NOW() - INTERVAL '24 hours'
    )::bigint AS replies_last_24h,


    (
        SELECT COUNT(*)
        FROM public.email_webhook_events
        WHERE received_at >= NOW() - INTERVAL '24 hours'
    )::bigint AS webhook_events_last_24h,


    (
        SELECT COUNT(*)
        FROM public.lead_tasks
        WHERE due_at < NOW()
        AND status NOT IN (
            'completed',
            'cancelled'
        )
    )::bigint AS overdue_tasks;


COMMENT ON VIEW public.pilot_campaign_metrics IS
    'Performance analytics for SlateLane controlled real-carrier pilot batches.';


COMMENT ON VIEW public.production_health_snapshot IS
    'Live operational health snapshot for SlateLane email automation.';


COMMIT;