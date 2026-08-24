BEGIN;

-- ============================================================
-- SlateLane Dispatch CRM
-- Migration 013
-- Follow-up Tasks / Sales Scheduling
-- ============================================================


-- ============================================================
-- 1. TASK TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lead_tasks (

    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    lead_id uuid NOT NULL
        REFERENCES public.leads(id)
        ON DELETE CASCADE,

    source_reply_id uuid
        REFERENCES public.email_replies(id)
        ON DELETE SET NULL,

    task_type text NOT NULL DEFAULT 'follow_up',

    title text NOT NULL,

    note text,

    status text NOT NULL DEFAULT 'open',

    priority text NOT NULL DEFAULT 'normal',

    due_at timestamptz NOT NULL,

    completed_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),

    updated_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 2. VALID TASK TYPES
-- ============================================================

ALTER TABLE public.lead_tasks
DROP CONSTRAINT IF EXISTS lead_tasks_task_type_check;

ALTER TABLE public.lead_tasks
ADD CONSTRAINT lead_tasks_task_type_check
CHECK (
    task_type IN (
        'call',
        'send_rates',
        'follow_up',
        'email',
        'meeting',
        'custom'
    )
);


-- ============================================================
-- 3. VALID STATUS
-- ============================================================

ALTER TABLE public.lead_tasks
DROP CONSTRAINT IF EXISTS lead_tasks_status_check;

ALTER TABLE public.lead_tasks
ADD CONSTRAINT lead_tasks_status_check
CHECK (
    status IN (
        'open',
        'completed',
        'cancelled'
    )
);


-- ============================================================
-- 4. PRIORITY
-- ============================================================

ALTER TABLE public.lead_tasks
DROP CONSTRAINT IF EXISTS lead_tasks_priority_check;

ALTER TABLE public.lead_tasks
ADD CONSTRAINT lead_tasks_priority_check
CHECK (
    priority IN (
        'low',
        'normal',
        'high',
        'urgent'
    )
);


-- ============================================================
-- 5. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
    lead_tasks_due_status_idx
ON public.lead_tasks (
    status,
    due_at
);


CREATE INDEX IF NOT EXISTS
    lead_tasks_lead_idx
ON public.lead_tasks (
    lead_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    lead_tasks_priority_idx
ON public.lead_tasks (
    priority,
    due_at
)
WHERE status = 'open';


CREATE INDEX IF NOT EXISTS
    lead_tasks_source_reply_idx
ON public.lead_tasks (
    source_reply_id
)
WHERE source_reply_id IS NOT NULL;


-- ============================================================
-- 6. DOCUMENTATION
-- ============================================================

COMMENT ON TABLE public.lead_tasks IS
    'Manual and automated sales follow-up tasks for SlateLane leads.';

COMMENT ON COLUMN public.lead_tasks.source_reply_id IS
    'Reply that caused or relates to this follow-up task.';

COMMENT ON COLUMN public.lead_tasks.task_type IS
    'Type of follow-up: call, send_rates, follow_up, email, meeting, or custom.';

COMMENT ON COLUMN public.lead_tasks.due_at IS
    'When this task should be completed.';

COMMENT ON COLUMN public.lead_tasks.priority IS
    'Task priority: low, normal, high, or urgent.';


COMMIT;