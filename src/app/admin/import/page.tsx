import Link from "next/link";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = Record<string, string | string[] | undefined>;

type Run = {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  source_mode: string | null;
  authority_events_scanned: number | null;
  eligible_rows: number | null;
  inserted_rows: number | null;
  updated_rows: number | null;
  skipped_no_email: number | null;
  skipped_old_registration: number | null;
  skipped_fleet_size: number | null;
  skipped_registration_status: number | null;
  skipped_operation: number | null;
  skipped_non_carrier: number | null;
  error_message: string | null;
};

type Carrier = {
  id: number;
  dot_number: number | null;
  mc_number: string | null;
  legal_name: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  power_units: number | null;
  lead_score: number | null;
  email_verification_status: string | null;
  source_first_seen_at: string | null;
};

type Settings = {
  enabled: boolean;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
};

type Checkpoint = {
  last_checked_at: string | null;
  last_processed_at: string | null;
  last_check_result: string | null;
  daily_difference_updated_at: number | null;
  census_updated_at: number | null;
};

type Freshness = {
  failures_last_seven_days: number | null;
};

const PAGE_SIZE = 25;

function number(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("en-US");
}

function time(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date) + " PKT";
}

function sourceTime(value: number | null | undefined) {
  return value ? time(new Date(value * 1000).toISOString()) : "Unavailable";
}

function valueOf(input: string | string[] | undefined) {
  return Array.isArray(input) ? (input[0] ?? "") : (input ?? "");
}

function human(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function Metric({
  label, value, hint, accent = "text-white",
}: {
  label: string;
  value: string;
  hint: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111821] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className={`mt-3 text-3xl font-bold tracking-tight ${accent}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-200">{number(value)}</p>
    </div>
  );
}

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const requestedRun = valueOf(params.run);
  const search = valueOf(params.q)
    .trim()
    .replace(/[^a-zA-Z0-9 \-]/g, "")
    .slice(0, 80);
  const state = valueOf(params.state)
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);

  const rawPage = Number(valueOf(params.page) || "1");
  const page = Number.isSafeInteger(rawPage)
    ? Math.max(1, Math.min(100, rawPage))
    : 1;

  const db = createAdminSupabase();

  const [runsResult, settingsResult, checkpointResult, countResult, freshnessResult] =
    await Promise.all([
      db.from("motus_new_carrier_sync_runs")
        .select("id,started_at,completed_at,status,source_mode,authority_events_scanned,eligible_rows,inserted_rows,updated_rows,skipped_no_email,skipped_old_registration,skipped_fleet_size,skipped_registration_status,skipped_operation,skipped_non_carrier,error_message")
        .order("started_at", { ascending: false }).limit(15),
      db.from("motus_new_carrier_sync_settings")
        .select("enabled,last_attempt_at,last_success_at,last_error")
        .eq("id", 1).maybeSingle(),
      db.from("motus_source_publication_checkpoint")
        .select("last_checked_at,last_processed_at,last_check_result,daily_difference_updated_at,census_updated_at")
        .eq("id", 1).maybeSingle(),
      db.from("carriers")
        .select("id", { count: "exact", head: true })
        .eq("acquisition_source", "motus_new_registration"),
      db.from("motus_import_freshness_status")
        .select("failures_last_seven_days").maybeSingle(),
    ]);

  const loadErrors = [
    runsResult.error,
    settingsResult.error,
    checkpointResult.error,
    countResult.error,
    freshnessResult.error,
  ].filter(Boolean);

  if (loadErrors.length > 0) {
    return (
      <section className="rounded-2xl border border-red-900 bg-red-950/20 p-8">
        <h1 className="text-2xl font-bold">Motus Import Center</h1>
        <p className="mt-3 text-sm text-red-300">
          Could not load live import records. No automation settings were changed.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          {loadErrors.map(e => e?.message).join(" | ")}
        </p>
      </section>
    );
  }

  const runs = (runsResult.data ?? []) as Run[];
  const settings = settingsResult.data as Settings | null;
  const checkpoint = checkpointResult.data as Checkpoint | null;
  const freshness = freshnessResult.data as Freshness | null;

  const latestComplete = runs.find(r => r.status === "completed") ?? null;
  const selected = runs.find(r => r.id === requestedRun) ?? latestComplete;
  const latest = runs[0] ?? null;

  const lastSuccessAge = settings?.last_success_at
    ? Date.now() - new Date(settings.last_success_at).getTime()
    : Infinity;

  const healthy = Boolean(
    settings?.enabled &&
    !settings.last_error &&
    lastSuccessAge < 36 * 60 * 60 * 1000
  );

  let carriers: Carrier[] = [];
  let filteredCount = 0;
  let carrierError: string | null = null;

  if (selected?.started_at) {
    // Motus writes source_first_seen_at just before the audit run opens.
    // Include a small margin to correctly correlate first-time inserts.
    const start = new Date(
      new Date(selected.started_at).getTime() - 120000
    ).toISOString();

    const end = new Date(
      new Date(selected.completed_at ?? selected.started_at).getTime() + 120000
    ).toISOString();

    let query = db.from("carriers")
      .select("id,dot_number,mc_number,legal_name,email,city,state,power_units,lead_score,email_verification_status,source_first_seen_at", {
        count: "exact",
      })
      .eq("acquisition_source", "motus_new_registration")
      .gte("source_first_seen_at", start)
      .lte("source_first_seen_at", end);

    if (state) query = query.eq("state", state);

    if (search) {
      if (/^\d+$/.test(search)) {
        query = query.eq("dot_number", Number(search));
      } else {
        query = query.ilike("legal_name", `%${search}%`);
      }
    }

    const result = await query
      .order("source_first_seen_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (result.error) {
      carrierError = result.error.message;
    } else {
      carriers = (result.data ?? []) as Carrier[];
      filteredCount = result.count ?? 0;
    }
  }

  function urlFor(nextPage: number, runId = selected?.id ?? "") {
    const query = new URLSearchParams();
    if (runId) query.set("run", runId);
    if (search) query.set("q", search);
    if (state) query.set("state", state);
    if (nextPage > 1) query.set("page", String(nextPage));
    return "/admin/import?" + query.toString();
  }

  const pages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const unchanged = checkpoint?.last_check_result === "no_new_publication";

  return (
    <main className="space-y-8 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-400">
            Carrier Intelligence / Automated Acquisition
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Motus Import Center
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Live source monitoring, permanent import history and
            new-carrier records directly from your SlateLane database.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={urlFor(page)}
            className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-800"
          >
            ↻ Refresh
          </a>
          <Link
            href="/admin/carriers?source=motus_new_registration&sort=recent"
            className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-600"
          >
            All Motus Carriers →
          </Link>
        </div>
      </header>

      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${
        healthy
          ? "border-emerald-500/20 bg-emerald-500/[0.06]"
          : "border-amber-500/20 bg-amber-500/[0.06]"
      }`}>
        <div>
          <p className={`text-sm font-bold ${healthy ? "text-emerald-300" : "text-amber-300"}`}>
            ● {healthy ? "Automatic Motus Sync Healthy" : "Motus Sync Needs Review"}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Last successful import: {time(settings?.last_success_at)}
          </p>
        </div>
        <span className="text-xs text-zinc-400">
          {settings?.enabled ? "Automatic scheduling enabled" : "Automatic scheduling disabled"}
        </span>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Latest Import / New"
          value={number(latestComplete?.inserted_rows)}
          hint={latestComplete ? time(latestComplete.completed_at) : "No completed import"}
          accent="text-emerald-300"
        />
        <Metric
          label="All Motus Carriers"
          value={number(countResult.count)}
          hint="Stored in the carrier database"
          accent="text-sky-300"
        />
        <Metric
          label="Latest Events Scanned"
          value={number(latestComplete?.authority_events_scanned)}
          hint={`${number(latestComplete?.eligible_rows)} eligible records`}
        />
        <Metric
          label="Failures / 7 Days"
          value={number(freshness?.failures_last_seven_days)}
          hint="Historical sync attempts requiring review"
          accent={Number(freshness?.failures_last_seven_days ?? 0) > 0
            ? "text-amber-300" : "text-emerald-300"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#111821] p-6">
          <h2 className="text-lg font-bold">Publication Watch</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Source checks only reprocess records when the official data changes.
          </p>
          <dl className="mt-5 space-y-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-zinc-500">Last source check</dt>
              <dd className="font-medium">{time(checkpoint?.last_checked_at)}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-zinc-500">Last changed-data processing</dt>
              <dd className="font-medium">{time(checkpoint?.last_processed_at)}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-zinc-500">Current checkpoint</dt>
              <dd className={unchanged ? "text-sky-300" : "text-emerald-300"}>
                {unchanged ? "Unchanged — safely skipped" : human(checkpoint?.last_check_result)}
              </dd>
            </div>
            <div className="border-t border-white/[0.07] pt-4 text-xs text-zinc-500">
              <p>Authority data published: {sourceTime(checkpoint?.daily_difference_updated_at)}</p>
              <p className="mt-2">Company Census published: {sourceTime(checkpoint?.census_updated_at)}</p>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111821] p-6">
          <h2 className="text-lg font-bold">Latest Import Breakdown</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Actual counts from the most recent completed import run.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SmallMetric label="New Carriers" value={latestComplete?.inserted_rows ?? 0} />
            <SmallMetric label="Updated" value={latestComplete?.updated_rows ?? 0} />
            <SmallMetric label="Eligible" value={latestComplete?.eligible_rows ?? 0} />
            <SmallMetric label="Old Registration" value={latestComplete?.skipped_old_registration ?? 0} />
            <SmallMetric label="No Email" value={latestComplete?.skipped_no_email ?? 0} />
            <SmallMetric label="Fleet Mismatch" value={latestComplete?.skipped_fleet_size ?? 0} />
            <SmallMetric label="Registration Filter" value={latestComplete?.skipped_registration_status ?? 0} />
            <SmallMetric label="Operation Filter" value={latestComplete?.skipped_operation ?? 0} />
            <SmallMetric label="Non-carrier" value={latestComplete?.skipped_non_carrier ?? 0} />
          </div>
          {settings?.last_error ? (
            <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-300">
              Latest error: {settings.last_error}
            </p>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#111821]">
        <div className="border-b border-white/10 px-6 py-5">
          <h2 className="text-xl font-bold">Import Run History</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Select any run to inspect the carriers first imported during that run.
          </p>
        </div>
        <div className="max-h-[340px] overflow-y-auto p-3">
          {runs.length ? runs.map(run => (
            <Link
              key={run.id}
              href={`/admin/import?run=${encodeURIComponent(run.id)}`}
              className={`mb-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 transition ${
                selected?.id === run.id
                  ? "border-sky-500/40 bg-sky-500/[0.09]"
                  : "border-white/[0.06] hover:bg-white/[0.04]"
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-zinc-200">
                  {time(run.started_at)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {number(run.authority_events_scanned)} scanned · {human(run.source_mode)}
                </p>
                {run.error_message ? (
                  <p className="mt-1 max-w-lg text-xs text-red-300">{run.error_message}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-4 text-right text-xs">
                <span className="text-emerald-300">+{number(run.inserted_rows)} new</span>
                <span className="text-zinc-400">{number(run.updated_rows)} updated</span>
                <span className={run.status === "completed" ? "text-emerald-300" : "text-red-300"}>
                  {human(run.status)}
                </span>
                <span className="text-sky-400">→</span>
              </div>
            </Link>
          )) : (
            <p className="p-5 text-sm text-zinc-500">No sync runs have been recorded yet.</p>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#111821]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold">Newly Imported Carriers</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {selected ? `Selected run: ${time(selected.started_at)}` : "No run selected"}
              {" · "}{number(filteredCount)} matching records
            </p>
          </div>
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1.5 text-xs font-semibold text-emerald-300">
            Read-only audit
          </span>
        </div>

        <form method="GET" action="/admin/import" className="flex flex-wrap items-end gap-3 px-5 py-4">
          <input type="hidden" name="run" value={selected?.id ?? ""} />
          <label className="flex min-w-[200px] flex-1 flex-col gap-1.5 text-xs text-zinc-500">
            Company name or DOT number
            <input
              name="q"
              defaultValue={search}
              placeholder="Search imported carriers..."
              className="w-full rounded-xl border border-white/10 bg-[#0b1119] px-4 py-3 text-sm text-white outline-none focus:border-sky-500/50"
            />
          </label>
          <label className="flex w-32 flex-col gap-1.5 text-xs text-zinc-500">
            State
            <input
              name="state"
              defaultValue={state}
              maxLength={2}
              placeholder="e.g. TX"
              className="w-full rounded-xl border border-white/10 bg-[#0b1119] px-4 py-3 text-sm text-white outline-none focus:border-sky-500/50"
            />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-600"
          >
            Search
          </button>
          <Link
            href={selected ? `/admin/import?run=${selected.id}` : "/admin/import"}
            className="rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-400 hover:text-white"
          >
            Clear
          </Link>
        </form>

        {carrierError ? (
          <p className="px-6 py-4 text-sm text-red-300">Carrier lookup failed: {carrierError}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-white/[0.025] text-[11px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-5 py-3">Carrier</th>
                    <th className="px-4 py-3">DOT / MC</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Power Units</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Email Status</th>
                    <th className="px-4 py-3">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {carriers.map(carrier => (
                    <tr key={carrier.id} className="hover:bg-white/[0.025]">
                      <td className="px-5 py-4">
                        <p className="max-w-[220px] truncate font-semibold text-zinc-200">
                          {carrier.legal_name || "Unnamed carrier"}
                        </p>
                        <p className="mt-1 max-w-[220px] truncate text-xs text-zinc-500">
                          {carrier.email || "No email"}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-xs text-zinc-400">
                        <p>{carrier.dot_number ?? "—"}</p>
                        <p className="mt-1">{carrier.mc_number || "—"}</p>
                      </td>
                      <td className="px-4 py-4 text-xs text-zinc-400">
                        {[carrier.city, carrier.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-4">{carrier.power_units ?? "—"}</td>
                      <td className="px-4 py-4 font-semibold text-sky-300">
                        {carrier.lead_score ?? "—"}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2 py-1 text-xs ${
                          carrier.email_verification_status === "verified_format"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-amber-500/10 text-amber-300"
                        }`}>
                          {human(carrier.email_verification_status)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {carrier.dot_number ? (
                          <Link
                            href={`/admin/carriers/${carrier.dot_number}`}
                            className="font-semibold text-sky-400 hover:text-sky-300"
                          >
                            Open →
                          </Link>
                        ) : <span className="text-zinc-600">—</span>}
                      </td>
                    </tr>
                  ))}
                  {!carriers.length ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-zinc-500">
                        No new carriers match this import run and the selected filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-5">
              <p className="text-xs text-zinc-500">
                Page {page} of {pages} · {number(filteredCount)} matching records
              </p>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link href={urlFor(page - 1)} className="rounded-lg border border-white/10 px-4 py-2 text-xs hover:bg-white/[0.06]">
                    ← Previous
                  </Link>
                ) : null}
                {page < pages ? (
                  <Link href={urlFor(page + 1)} className="rounded-lg border border-white/10 px-4 py-2 text-xs hover:bg-white/[0.06]">
                    Next →
                  </Link>
                ) : null}
              </div>
            </div>
          </>
        )}
      </section>

      <p className="text-xs leading-relaxed text-zinc-500">
        Motus imports store eligible carrier records only. This dashboard reads the
        existing sync audit and carrier database; it never triggers an email send,
        sequence enrollment or new import. The legacy FMCSA ZIP API is preserved
        separately for maintenance and recovery.
      </p>
    </main>
  );
}