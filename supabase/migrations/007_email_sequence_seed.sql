BEGIN;

-- ============================================================
-- Prevent duplicate sequence-step sends.
-- One enrollment may receive each step only once.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
email_sends_enrollment_step_unique_idx
ON public.email_sends (
    enrollment_id,
    sequence_step_id
)
WHERE
    enrollment_id IS NOT NULL
    AND sequence_step_id IS NOT NULL;


-- ============================================================
-- EMAIL TEMPLATE 1
-- ============================================================

INSERT INTO public.email_templates (
    name,
    description,
    subject,
    html_body,
    text_body,
    active
)
SELECT
    'SlateLane Introduction',
    'Initial dispatch service outreach',
    'Dispatch support for {{company_name}}',

    $html$
<p>Hello,</p>

<p>
I’m reaching out from <strong>SlateLane Dispatch</strong>.
We help small motor carriers with load sourcing,
rate negotiation, paperwork, and day-to-day dispatch support.
</p>

<p>
I found {{company_name}} through public FMCSA carrier records.
If dispatch support is relevant for your operation,
I can send you a short overview of how we work.
</p>

<p>
Best,<br>
SlateLane Dispatch
</p>
$html$,

    $text$
Hello,

I'm reaching out from SlateLane Dispatch.

We help small motor carriers with load sourcing, rate negotiation,
paperwork, and day-to-day dispatch support.

I found {{company_name}} through public FMCSA carrier records.

If dispatch support is relevant for your operation,
I can send you a short overview of how we work.

Best,
SlateLane Dispatch
$text$,

    true

WHERE NOT EXISTS (
    SELECT 1
    FROM public.email_templates
    WHERE name = 'SlateLane Introduction'
);


-- ============================================================
-- EMAIL TEMPLATE 2
-- ============================================================

INSERT INTO public.email_templates (
    name,
    description,
    subject,
    html_body,
    text_body,
    active
)
SELECT
    'SlateLane Follow Up',
    'First follow-up',
    'Following up — {{company_name}}',

    $html$
<p>Hello,</p>

<p>
Just following up on my previous message regarding
dispatch support for {{company_name}}.
</p>

<p>
SlateLane can assist with finding loads,
negotiating rates, broker communication,
and daily dispatch coordination.
</p>

<p>
If you'd like, I can send a quick breakdown of
our service and how we work with small fleets.
</p>

<p>
Best,<br>
SlateLane Dispatch
</p>
$html$,

    $text$
Hello,

Just following up on my previous message regarding
dispatch support for {{company_name}}.

SlateLane can assist with finding loads, negotiating rates,
broker communication, and daily dispatch coordination.

If you'd like, I can send a quick breakdown of our service.

Best,
SlateLane Dispatch
$text$,

    true

WHERE NOT EXISTS (
    SELECT 1
    FROM public.email_templates
    WHERE name = 'SlateLane Follow Up'
);


-- ============================================================
-- EMAIL TEMPLATE 3
-- ============================================================

INSERT INTO public.email_templates (
    name,
    description,
    subject,
    html_body,
    text_body,
    active
)
SELECT
    'SlateLane Final Follow Up',
    'Final sequence follow-up',
    'Last follow-up — {{company_name}}',

    $html$
<p>Hello,</p>

<p>
This will be my last follow-up regarding dispatch
support for {{company_name}}.
</p>

<p>
If you ever need help sourcing loads,
negotiating rates, or managing daily dispatch,
feel free to reach out.
</p>

<p>
Thanks for your time.
</p>

<p>
Best,<br>
SlateLane Dispatch
</p>
$html$,

    $text$
Hello,

This will be my last follow-up regarding dispatch
support for {{company_name}}.

If you ever need help sourcing loads, negotiating rates,
or managing daily dispatch, feel free to reach out.

Thanks for your time.

Best,
SlateLane Dispatch
$text$,

    true

WHERE NOT EXISTS (
    SELECT 1
    FROM public.email_templates
    WHERE name = 'SlateLane Final Follow Up'
);


-- ============================================================
-- SEQUENCE
-- ============================================================

INSERT INTO public.email_sequences (
    name,
    description,
    active
)
SELECT
    'SlateLane Dispatch Outreach',
    'Three-step dispatch outreach sequence',
    true

WHERE NOT EXISTS (
    SELECT 1
    FROM public.email_sequences
    WHERE name = 'SlateLane Dispatch Outreach'
);


-- ============================================================
-- STEP 1 — IMMEDIATE
-- ============================================================

INSERT INTO public.email_sequence_steps (
    sequence_id,
    template_id,
    step_order,
    delay_hours,
    active
)
SELECT
    s.id,
    t.id,
    1,
    0,
    true

FROM public.email_sequences s
JOIN public.email_templates t
    ON t.name = 'SlateLane Introduction'

WHERE s.name = 'SlateLane Dispatch Outreach'

AND NOT EXISTS (
    SELECT 1
    FROM public.email_sequence_steps x
    WHERE x.sequence_id = s.id
      AND x.step_order = 1
);


-- ============================================================
-- STEP 2 — 48 HOURS AFTER STEP 1
-- ============================================================

INSERT INTO public.email_sequence_steps (
    sequence_id,
    template_id,
    step_order,
    delay_hours,
    active
)
SELECT
    s.id,
    t.id,
    2,
    48,
    true

FROM public.email_sequences s
JOIN public.email_templates t
    ON t.name = 'SlateLane Follow Up'

WHERE s.name = 'SlateLane Dispatch Outreach'

AND NOT EXISTS (
    SELECT 1
    FROM public.email_sequence_steps x
    WHERE x.sequence_id = s.id
      AND x.step_order = 2
);


-- ============================================================
-- STEP 3 — 72 HOURS AFTER STEP 2
-- ============================================================

INSERT INTO public.email_sequence_steps (
    sequence_id,
    template_id,
    step_order,
    delay_hours,
    active
)
SELECT
    s.id,
    t.id,
    3,
    72,
    true

FROM public.email_sequences s
JOIN public.email_templates t
    ON t.name = 'SlateLane Final Follow Up'

WHERE s.name = 'SlateLane Dispatch Outreach'

AND NOT EXISTS (
    SELECT 1
    FROM public.email_sequence_steps x
    WHERE x.sequence_id = s.id
      AND x.step_order = 3
);

COMMIT;