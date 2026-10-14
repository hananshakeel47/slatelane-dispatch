import Link from "next/link";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  saveProspectTruckAction,
  saveObservedLoadAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EQUIPMENT: Array<[string, string]> = [
  ["sprinter", "Sprinter / Cargo Van"],
  ["box_truck", "Box Truck (16–26 ft)"],
  ["dry_van", "Dry Van"],
  ["reefer", "Reefer"],
  ["flatbed", "Flatbed"],
  ["step_deck", "Step Deck"],
  ["hotshot", "Hotshot"],
  ["power_only", "Power Only"],
  ["specialized", "Specialized"],
  ["other", "Other"],
];

type Lead = {
  id: string;
  company_name: string | null;
  email: string;
  status: string | null;
  carrier_dot_number: number | null;
  last_reply_at: string | null;
  email_opt_out: boolean | null;
};

type Profile = {
  equipment_type: string;
  equipment_details: string | null;
  trailer_length_ft: number | null;
  max_payload_lbs: number | null;
  liftgate_required: boolean;
  origin_city: string | null;
  origin_state: string | null;
  available_date: string | null;
  preferred_destinations: string | null;
  max_deadhead_miles: number | null;
  notes: string | null;
};

type Posting = {
  id: string;
  source_name: string;
  source_url: string;
  origin_city: string | null;
  origin_state: string | null;
  destination_city: string | null;
  destination_state: string | null;
  equipment_type: string | null;
  pickup_date: string | null;
  posted_rate_usd: number | null;
  status: string;
  observed_at: string;
  expires_at: string;
  notes: string | null;
};

type Params = Record<string, string | string[] | undefined>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const input =
  "w-full rounded-xl border border-white/10 bg-[#0a1018] px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-500/50";
const label = "block space-y-1.5 text-xs font-semibold text-zinc-300";
const panel = "rounded-2xl border border-white/10 bg-[#111821] p-5 sm:p-6";

function val(p: Params, key: string) {
  const value = p[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function niceDate(value: string | null | undefined) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "America/Chicago",
  }).format(dt) + " CT";
}

function Field({
  title, name, current, placeholder, kind = "text", required = false,
}: {
  title: string;
  name: string;
  current?: string | number | null;
  placeholder?: string;
  kind?: string;
  required?: boolean;
}) {
  return (
    <label className={label}>
      <span>{title}</span>
      <input
        className={input}
        name={name}
        type={kind}
        required={required}
        placeholder={placeholder}
        defaultValue={current ?? ""}
        min={kind === "number" ? 0 : undefined}
        step={kind === "number" ? "any" : undefined}
      />
    </label>
  );
}

function statusLabel(post: Posting) {
  if (post.status === "expired" || new Date(post.expires_at).getTime() <= Date.now()) {
    return "Expired — don't present as current";
  }
  if (post.status === "details_incomplete") return "Details incomplete";
  return "Observed — unconfirmed";
}

export default async function ProspectResearchPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const db = createAdminSupabase();

  const hotResult = await db
    .from("leads")
    .select("id,company_name,email,status,carrier_dot_number,last_reply_at,email_opt_out")
    .in("status", ["interested", "follow_up", "meeting"])
    .order("last_reply_at", { ascending: false, nullsFirst: false })
    .limit(150);

  if (hotResult.error) throw new Error(hotResult.error.message);
  const candidates = (hotResult.data ?? []) as Lead[];

  const requestedId = val(params, "lead");
  let selected: Lead | undefined =
    uuid.test(requestedId)
      ? candidates.find(x => x.id === requestedId)
      : undefined;

  if (!selected && uuid.test(requestedId)) {
    const detail = await db
      .from("leads")
      .select("id,company_name,email,status,carrier_dot_number,last_reply_at,email_opt_out")
      .eq("id", requestedId)
      .maybeSingle();
    if (detail.error) throw new Error(detail.error.message);
    selected = (detail.data ?? undefined) as Lead | undefined;
    if (selected && !candidates.some(x => x.id === selected?.id)) {
      candidates.unshift(selected);
    }
  }

  selected ??= candidates[0];

  let profile: Profile | null = null;
  let postings: Posting[] = [];

  if (selected) {
    const [p, l] = await Promise.all([
      db.from("prospect_truck_profiles").select("*")
        .eq("lead_id", selected.id).maybeSingle(),
      db.from("prospect_load_research")
        .select("id,source_name,source_url,origin_city,origin_state,destination_city,destination_state,equipment_type,pickup_date,posted_rate_usd,status,observed_at,expires_at,notes")
        .eq("lead_id", selected.id)
        .order("observed_at", { ascending: false })
        .limit(100),
    ]);
    if (p.error || l.error) {
      throw new Error(p.error?.message || l.error?.message || "Research data unavailable.");
    }
    profile = (p.data ?? null) as Profile | null;
    postings = (l.data ?? []) as Posting[];
  }

  return (
    <div className="space-y-7 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sky-400">
            Load Board / Pre-client acquisition
          </p>
          <h1 className="mt-2 text-3xl font-bold">Prospect Research Workspace</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Collect truck requirements and record source-linked public freight
            postings for prospects before carrier authorization.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/loadboard"
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5">
            ← Operational Load Board
          </Link>
          <Link href="/admin/replies"
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5">
            Carrier Replies
          </Link>
        </div>
      </header>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-200">
        <strong>Research only:</strong> Listings are not guaranteed, reserved, booked,
        or broker-confirmed. Never negotiate or arrange a shipment here. Source
        permissions and carrier authorization must be respected.
      </div>

      {val(params, "saved") === "profile" || val(params, "saved") === "load" ? (
        <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-sm text-emerald-300">
          {val(params, "saved") === "profile" ? "Truck requirements saved." : "Research posting saved."}
        </p>
      ) : null}

      <section className={panel}>
        <h2 className="text-lg font-semibold">1. Select an interested prospect</h2>
        <p className="mt-1 text-sm text-zinc-400">
          This list prioritizes interested and follow-up leads. Any Lead 360 page
          can also open its own research workspace directly.
        </p>
        {candidates.length ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <form className="flex min-w-0 flex-1 flex-wrap items-end gap-3" method="GET">
              <label className={`${label} min-w-[220px] flex-1`}>
                <span>Carrier</span>
                <select className={input} name="lead" defaultValue={selected?.id}>
                  {candidates.map(c => (
                    <option key={c.id} value={c.id}>
                      {(c.company_name || c.email)} — {c.status}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-600">
                Open
              </button>
            </form>
            {selected ? (
              <Link href={`/admin/leads/${selected.id}`}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5">
                Lead 360 →
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-400">
            No interested or follow-up leads yet. Start from Leads when a prospect replies.
          </p>
        )}
        {selected ? (
          <p className="mt-4 text-xs text-zinc-500">
            DOT: {selected.carrier_dot_number ?? "Unknown"} · Status: {selected.status ?? "Unknown"}
            {selected.email_opt_out ? " · Opted out — never email automatically" : ""}
          </p>
        ) : null}
      </section>

      {selected ? (
        <>
          <section className={panel}>
            <h2 className="text-lg font-semibold">2. Prospect equipment and availability</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Record requirements confirmed by the carrier. Don't assume that FMCSA
              fleet information describes the actual available truck.
            </p>
            <form action={saveProspectTruckAction} className="mt-5 space-y-4">
              <input type="hidden" name="lead_id" value={selected.id}/>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className={label}>
                  <span>Equipment type *</span>
                  <select className={input} name="equipment_type"
                    defaultValue={profile?.equipment_type ?? "dry_van"} required>
                    {EQUIPMENT.map(([code, name]) =>
                      <option key={code} value={code}>{name}</option>
                    )}
                  </select>
                </label>
                <Field title="Equipment details" name="equipment_details"
                  current={profile?.equipment_details} placeholder="53 ft, temp-controlled, pallet capacity..."/>
                <Field title="Trailer / box length (ft)" name="trailer_length_ft"
                  current={profile?.trailer_length_ft} kind="number"/>
                <Field title="Max payload (lbs)" name="max_payload_lbs"
                  current={profile?.max_payload_lbs} kind="number"/>
                <Field title="Available city" name="origin_city"
                  current={profile?.origin_city} placeholder="Dallas"/>
                <Field title="Available state (2 letters)" name="origin_state"
                  current={profile?.origin_state} placeholder="TX"/>
                <Field title="Available date" name="available_date"
                  current={profile?.available_date} kind="date"/>
                <Field title="Max deadhead (miles)" name="max_deadhead_miles"
                  current={profile?.max_deadhead_miles} kind="number"/>
                <Field title="Preferred destinations / regions" name="preferred_destinations"
                  current={profile?.preferred_destinations} placeholder="Texas, Southeast, no NYC..."/>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" name="liftgate_required"
                  defaultChecked={profile?.liftgate_required ?? false}
                  className="h-4 w-4 accent-sky-500"/>
                Liftgate required
              </label>
              <label className={label}>
                <span>Operator notes</span>
                <textarea className={input} rows={3} name="notes"
                  defaultValue={profile?.notes ?? ""}
                  placeholder="Carrier-confirmed details, availability caveats..."/>
              </label>
              <button className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-600">
                Save truck profile
              </button>
            </form>
          </section>

          <section className={panel}>
            <h2 className="text-lg font-semibold">3. Research legitimate public listings</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Open public sources yourself, inspect a matching advertisement, and
              record only information you're allowed to use. No automated scraping.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a className="rounded-lg border border-white/10 px-3 py-2 text-sm text-sky-300 hover:bg-white/5"
                href="https://www.trulos.com/load-board/" target="_blank" rel="noopener noreferrer">
                Trulos public listings ↗
              </a>
              <a className="rounded-lg border border-white/10 px-3 py-2 text-sm text-sky-300 hover:bg-white/5"
                href="https://www.chrobinson.com/en-us/carriers/loadboard/" target="_blank" rel="noopener noreferrer">
                C.H. Robinson public search ↗
              </a>
            </div>

            <form action={saveObservedLoadAction} className="mt-5 space-y-4">
              <input type="hidden" name="lead_id" value={selected.id}/>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field title="Source name *" name="source_name" placeholder="Trulos" required/>
                <div className="lg:col-span-2">
                  <Field title="Direct posting URL (HTTPS) *"
                    name="source_url" kind="url"
                    placeholder="https://..." required/>
                </div>
                <Field title="Pickup city" name="origin_city" placeholder="Dallas"/>
                <Field title="Pickup state" name="origin_state" placeholder="TX"/>
                <Field title="Destination city" name="destination_city" placeholder="Atlanta"/>
                <Field title="Destination state" name="destination_state" placeholder="GA"/>
                <Field title="Advertised equipment" name="equipment_type" placeholder="53 ft Dry Van"/>
                <Field title="Pickup date" name="pickup_date" kind="date"/>
                <Field title="Posted rate (USD, if shown)" name="posted_rate_usd" kind="number"/>
                <label className={label}>
                  <span>Observation status</span>
                  <select name="status" className={input} defaultValue="observed_unconfirmed">
                    <option value="observed_unconfirmed">Observed — unconfirmed</option>
                    <option value="details_incomplete">Details incomplete</option>
                    <option value="expired">Expired</option>
                  </select>
                </label>
              </div>
              <label className={label}>
                <span>Notes / caveats</span>
                <textarea className={input} rows={3} name="notes"
                  placeholder="Posted requirements, restrictions, equipment uncertainty..."/>
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <button className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-600">
                  Save research posting
                </button>
                <p className="text-xs text-zinc-500">
                  Every saved posting automatically expires from the current shortlist after 24 hours.
                </p>
              </div>
            </form>
          </section>

          <section className={panel}>
            <h2 className="text-lg font-semibold">4. Prospect research history</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Stored for internal review. No emails, offers, negotiations or bookings are created.
            </p>
            {postings.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[790px] text-left text-sm">
                  <thead className="border-b border-white/10 text-xs text-zinc-400">
                    <tr>
                      <th className="py-3 pr-3">Source</th>
                      <th className="py-3 pr-3">Lane</th>
                      <th className="py-3 pr-3">Equipment / Rate</th>
                      <th className="py-3 pr-3">Observed</th>
                      <th className="py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.07]">
                    {postings.map(p => (
                      <tr key={p.id} className="align-top">
                        <td className="py-4 pr-3">
                          <a className="font-semibold text-sky-300 hover:underline"
                            href={p.source_url} target="_blank" rel="noopener noreferrer">
                            {p.source_name} ↗
                          </a>
                        </td>
                        <td className="py-4 pr-3">
                          {[p.origin_city,p.origin_state].filter(Boolean).join(", ") || "?"}
                          {" → "}
                          {[p.destination_city,p.destination_state].filter(Boolean).join(", ") || "?"}
                          <p className="mt-1 text-xs text-zinc-400">Pickup: {p.pickup_date || "Unknown"}</p>
                        </td>
                        <td className="py-4 pr-3">
                          {p.equipment_type || "Unknown"}
                          <p className="mt-1 text-xs text-zinc-400">
                            {p.posted_rate_usd === null ? "Rate not shown" : `$${Number(p.posted_rate_usd).toLocaleString("en-US")} posted`}
                          </p>
                        </td>
                        <td className="py-4 pr-3 text-xs text-zinc-400">
                          {niceDate(p.observed_at)}
                        </td>
                        <td className="py-4 text-xs text-amber-300">
                          {statusLabel(p)}
                          {p.notes ? <p className="mt-2 max-w-[240px] text-zinc-400">{p.notes}</p> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-5 rounded-lg border border-dashed border-white/10 p-6 text-sm text-zinc-400">
                No research recorded for this prospect yet. Start with the public sources above.
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
