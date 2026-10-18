import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const VERIFALIA_BASE = "https://api.verifalia.com/v2.7";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function localParts(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    date: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function providerAuth(username: string, password: string) {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const username = Deno.env.get("VERIFALIA_USERNAME");
  const password = Deno.env.get("VERIFALIA_PASSWORD");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, reason: "supabase_runtime_missing" }, 500);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const candidateKey = req.headers.get("x-slatelane-verifier-key");
  if (!candidateKey) {
    return json({ success: false, reason: "unauthorized" }, 401);
  }

  const { data: invocationAuthorized, error: invocationAuthError } = await db.rpc(
    "verify_slatelane_verifier_invocation_key",
    { p_candidate_key: candidateKey },
  );

  if (invocationAuthError || invocationAuthorized !== true) {
    return json({ success: false, reason: "unauthorized" }, 401);
  }

  const { data: cfg, error: cfgError } = await db
    .from("email_verification_provider_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (cfgError || !cfg) {
    return json({ success: false, reason: "provider_settings_missing" }, 500);
  }

  if (!cfg.enabled) {
    return json({ success: true, configured: false, reason: "provider_disabled" });
  }

  if (!username || !password) {
    await db
      .from("email_verification_provider_settings")
      .update({
        last_error: "Verifalia credentials are not configured in Edge Function secrets.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    return json({
      success: true,
      configured: false,
      reason: "verifalia_credentials_missing",
    });
  }

  const { data: launch } = await db
    .from("email_launch_settings")
    .select("sending_timezone")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  const timeZone = launch?.sending_timezone || "America/Chicago";
  const local = localParts(timeZone);
  const auth = providerAuth(username, password);

  const processSnapshot = async (job: any, snapshot: any) => {
    const overviewStatus = String(snapshot?.overview?.status ?? "").toLowerCase();
    const entries = Array.isArray(snapshot?.entries?.data) ? snapshot.entries.data : [];

    if (overviewStatus !== "completed") {
      await db
        .from("email_verification_jobs")
        .update({
          status: "processing",
          last_polled_at: new Date().toISOString(),
          raw_response: snapshot ?? {},
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return { completed: false, jobId: job.provider_job_id };
    }

    const { data: queued } = await db
      .from("email_verification_queue")
      .select("*")
      .eq("job_id", job.id);

    const byEmail = new Map(
      (queued ?? []).map((q: any) => [normalizeEmail(q.email), q]),
    );

    let deliverable = 0;
    let risky = 0;
    let undeliverable = 0;
    let unknown = 0;
    let errors = 0;

    for (const entry of entries) {
      const input = normalizeEmail(entry?.inputData ?? entry?.emailAddress);
      const q: any = byEmail.get(input);

      if (!q) {
        errors += 1;
        continue;
      }

      const classification = String(entry?.classification ?? "Unknown");
      const providerStatus = String(entry?.status ?? "Unknown");
      const normalizedClass = classification.toLowerCase();

      let localStatus = "unknown";
      if (normalizedClass === "deliverable") {
        localStatus = "deliverable";
        deliverable += 1;
      } else if (normalizedClass === "risky") {
        localStatus = "risky";
        risky += 1;
      } else if (normalizedClass === "undeliverable") {
        localStatus = "undeliverable";
        undeliverable += 1;
      } else {
        unknown += 1;
      }

      const checkedAt = new Date();
      const expiresAt =
        localStatus === "deliverable"
          ? new Date(
              checkedAt.getTime() +
                Number(cfg.verification_ttl_days || 14) * 86400000,
            ).toISOString()
          : null;

      const { error: extError } = await db
        .from("email_external_verifications")
        .insert({
          carrier_id: q.carrier_id,
          provider: "verifalia",
          status: localStatus,
          email_normalized: input,
          classification,
          provider_status: providerStatus,
          provider_job_id: job.provider_job_id,
          checked_at: checkedAt.toISOString(),
          expires_at: expiresAt,
          note: `Verifalia ${classification}: ${providerStatus}`,
          raw_result: entry,
        });

      if (extError) errors += 1;

      await db
        .from("email_verification_queue")
        .update({
          status: localStatus,
          provider_classification: classification,
          provider_status: providerStatus,
          checked_at: checkedAt.toISOString(),
          raw_result: entry,
          attempts: Number(q.attempts || 0) + 1,
          updated_at: checkedAt.toISOString(),
        })
        .eq("id", q.id);

      if (localStatus === "undeliverable") {
        await db
          .from("email_suppressions")
          .upsert(
            {
              email: input,
              reason: `verifalia:${providerStatus}`,
              source: "verifalia",
            },
            { onConflict: "email" },
          );
      }
    }

    const finishedAt = new Date().toISOString();

    await db
      .from("email_verification_jobs")
      .update({
        status: "completed",
        deliverable_count: deliverable,
        risky_count: risky,
        undeliverable_count: undeliverable,
        unknown_count: unknown,
        error_count: errors,
        completed_at: finishedAt,
        last_polled_at: finishedAt,
        raw_response: snapshot ?? {},
        last_error:
          errors > 0
            ? `${errors} result rows could not be matched or persisted.`
            : null,
        updated_at: finishedAt,
      })
      .eq("id", job.id);

    await db
      .from("email_verification_provider_settings")
      .update({
        last_success_at: finishedAt,
        last_error:
          errors > 0
            ? `${errors} result rows had persistence/matching errors.`
            : null,
        updated_at: finishedAt,
      })
      .eq("id", 1);

    return {
      completed: true,
      deliverable,
      risky,
      undeliverable,
      unknown,
      errors,
    };
  };

  const { data: pendingJobs } = await db
    .from("email_verification_jobs")
    .select("*")
    .eq("provider", "verifalia")
    .in("status", ["submitted", "processing"])
    .order("created_at", { ascending: true });

  const pollResults: unknown[] = [];

  for (const job of pendingJobs ?? []) {
    if (!job.provider_job_id) continue;

    try {
      const res = await fetch(
        `${VERIFALIA_BASE}/email-validations/${job.provider_job_id}?waitTime=30000`,
        {
          headers: { authorization: auth, accept: "application/json" },
        },
      );

      const body = await res.json().catch(() => ({}));

      if (res.ok || res.status === 202) {
        pollResults.push(await processSnapshot(job, body));
      } else {
        await db
          .from("email_verification_jobs")
          .update({
            last_polled_at: new Date().toISOString(),
            last_error: `Verifalia poll HTTP ${res.status}`,
            raw_response: body,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      }
    } catch (error) {
      await db
        .from("email_verification_jobs")
        .update({
          last_polled_at: new Date().toISOString(),
          last_error: error instanceof Error ? error.message : String(error),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
  }

  if (
    local.hour !== Number(cfg.preparation_local_hour || 8) ||
    local.minute < Number(cfg.preparation_local_minute || 5)
  ) {
    return json({
      success: true,
      configured: true,
      reason: "outside_preparation_window",
      operationalDate: local.date,
      localHour: local.hour,
      localMinute: local.minute,
      pollResults,
    });
  }

  const { data: existingJob } = await db
    .from("email_verification_jobs")
    .select("id,status,provider_job_id")
    .eq("provider", "verifalia")
    .eq("operational_date", local.date)
    .neq("status", "failed")
    .limit(1)
    .maybeSingle();

  if (existingJob) {
    return json({
      success: true,
      configured: true,
      reason: "daily_verification_job_already_exists",
      operationalDate: local.date,
      job: existingJob,
      pollResults,
    });
  }

  let balance: any;

  try {
    const balanceResponse = await fetch(`${VERIFALIA_BASE}/credits/balance`, {
      headers: { authorization: auth, accept: "application/json" },
    });

    balance = await balanceResponse.json().catch(() => ({}));

    if (!balanceResponse.ok) {
      await db
        .from("email_verification_provider_settings")
        .update({
          last_error: `Could not read Verifalia free-credit balance (HTTP ${balanceResponse.status}).`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      return json({
        success: true,
        configured: true,
        reason: "credit_balance_unavailable",
        httpStatus: balanceResponse.status,
      });
    }
  } catch (error) {
    return json({
      success: true,
      configured: true,
      reason: "credit_balance_request_failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const freeCredits = Math.max(0, Math.floor(Number(balance?.freeCredits ?? 0)));
  const limit = Math.min(Number(cfg.daily_verification_limit || 25), freeCredits);

  if (limit <= 0) {
    return json({
      success: true,
      configured: true,
      reason: "no_free_verification_credits",
      freeCredits,
      creditPacksIgnored: true,
      pollResults,
    });
  }

  const { data: candidates, error: candidateError } = await db
    .from("email_verification_candidate_pool")
    .select(
      "carrier_id,dot_number,legal_name,email,email_free_provider,lead_score,acquisition_source,motus_authority_event_date,power_units,verification_priority_tier,verification_priority_score",
    )
    .order("verification_priority_score", { ascending: false })
    .order("motus_authority_event_date", { ascending: false, nullsFirst: false })
    .order("lead_score", { ascending: false, nullsFirst: false })
    .order("dot_number", { ascending: false })
    .limit(limit);

  if (candidateError) {
    return json(
      {
        success: false,
        reason: "candidate_query_failed",
        error: candidateError.message,
      },
      500,
    );
  }

  if (!candidates?.length) {
    return json({
      success: true,
      configured: true,
      reason: "no_candidates_need_external_verification",
      pollResults,
    });
  }

  const requestBody = {
    entries: candidates.map((c: any) => ({
      inputData: normalizeEmail(c.email),
      custom: String(c.carrier_id),
    })),
    quality: cfg.quality || "Standard",
    deduplication: "Relaxed",
  };

  let response: Response;
  let snapshot: any;

  try {
    response = await fetch(`${VERIFALIA_BASE}/email-validations?waitTime=30000`, {
      method: "POST",
      headers: {
        authorization: auth,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    snapshot = await response.json().catch(() => ({}));
  } catch (error) {
    await db
      .from("email_verification_provider_settings")
      .update({
        last_error: error instanceof Error ? error.message : String(error),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    return json({
      success: true,
      configured: true,
      reason: "verification_submit_failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (!(response.ok || response.status === 202)) {
    await db
      .from("email_verification_provider_settings")
      .update({
        last_error: `Verifalia submit HTTP ${response.status}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    return json({
      success: true,
      configured: true,
      reason: "verification_submit_rejected",
      httpStatus: response.status,
    });
  }

  const providerJobId = String(snapshot?.overview?.id ?? "");

  if (!providerJobId) {
    return json({ success: false, reason: "provider_job_id_missing" }, 502);
  }

  const initialStatus =
    String(snapshot?.overview?.status ?? "").toLowerCase() === "completed"
      ? "processing"
      : "submitted";

  const { data: localJob, error: jobInsertError } = await db
    .from("email_verification_jobs")
    .insert({
      provider: "verifalia",
      provider_job_id: providerJobId,
      operational_date: local.date,
      status: initialStatus,
      requested_count: candidates.length,
      free_credits_before: Number(balance?.freeCredits ?? 0),
      free_credits_reset_in: balance?.freeCreditsResetIn ?? null,
      raw_response: snapshot ?? {},
    })
    .select("*")
    .single();

  if (jobInsertError || !localJob) {
    return json(
      {
        success: false,
        reason: "verification_job_persist_failed",
        error: jobInsertError?.message,
      },
      500,
    );
  }

  const queueRows = candidates.map((c: any) => ({
    job_id: localJob.id,
    provider: "verifalia",
    operational_date: local.date,
    carrier_id: c.carrier_id,
    email: normalizeEmail(c.email),
    status: "submitted",
    selection_priority_score: c.verification_priority_score ?? null,
    selection_priority_tier: c.verification_priority_tier ?? null,
    selection_source: c.acquisition_source ?? null,
    selection_motus_authority_event_date: c.motus_authority_event_date ?? null,
  }));

  const { error: queueError } = await db
    .from("email_verification_queue")
    .insert(queueRows);

  if (queueError) {
    await db
      .from("email_verification_jobs")
      .update({
        status: "failed",
        last_error: queueError.message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", localJob.id);

    return json(
      {
        success: false,
        reason: "verification_queue_persist_failed",
        error: queueError.message,
      },
      500,
    );
  }

  const immediate = await processSnapshot(localJob, snapshot);

  return json({
    success: true,
    configured: true,
    operationalDate: local.date,
    submitted: candidates.length,
    freeCreditsBefore: Number(balance?.freeCredits ?? 0),
    creditPacksIgnored: true,
    providerJobId,
    priorityMode: "phase_029c_b_fresh_authority_first",
    selectedPriorityRange: {
      highest: candidates[0]?.verification_priority_score ?? null,
      lowest: candidates[candidates.length - 1]?.verification_priority_score ?? null,
      topTier: candidates[0]?.verification_priority_tier ?? null,
      freshMotusSelected: candidates.filter(
        (c: any) => c.acquisition_source === "motus_new_registration",
      ).length,
    },
    immediate,
    pollResults,
  });
});
