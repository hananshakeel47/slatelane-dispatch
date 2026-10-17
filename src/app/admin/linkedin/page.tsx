"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Prospect = {
  id: string;
  linkedin_url: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  job_title: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  carrier_dot_number: number | null;
  status: string;
  source: string;
  lead_id: string | null;
  connection_requested_at: string | null;
  connected_at: string | null;
  first_message_at: string | null;
  last_message_at: string | null;
  next_followup_at: string | null;
  replied_at: string | null;
  reply_text: string | null;
  notes: string | null;
  last_step_sent: number;
  qualified_at: string | null;
  created_at: string;
  updated_at: string;
};

type MessageTemplate = {
  id: number;
  step_number: number;
  template_name: string;
  message_body: string;
  active: boolean;
};

type Settings = {
  enabled: boolean;
  daily_connection_target: number;
  daily_followup_target: number;
  max_open_prospects: number;
  followup_1_delay_days: number;
  followup_2_delay_days: number;
  followup_3_delay_days: number;
};

type ProspectDraft = {
  linkedin_url: string;
  first_name: string;
  last_name: string;
  company_name: string;
  job_title: string;
  location: string;
  email: string;
  phone: string;
  carrier_dot_number: string;
  notes: string;
};

const EMPTY_DRAFT: ProspectDraft = {
  linkedin_url: "",
  first_name: "",
  last_name: "",
  company_name: "",
  job_title: "",
  location: "",
  email: "",
  phone: "",
  carrier_dot_number: "",
  notes: "",
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/10";
const primaryButton =
  "inline-flex items-center justify-center rounded-xl bg-sky-400 px-3.5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton =
  "inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40";
const dangerButton =
  "inline-flex items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-400/[0.12] disabled:cursor-not-allowed disabled:opacity-40";

function prettyStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: string) {
  switch (status) {
    case "qualified":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "replied":
    case "connected":
      return "border-sky-400/20 bg-sky-400/10 text-sky-300";
    case "connection_pending":
    case "messaged":
      return "border-amber-400/20 bg-amber-400/10 text-amber-200";
    case "not_interested":
      return "border-rose-400/20 bg-rose-400/10 text-rose-300";
    default:
      return "border-white/10 bg-white/[0.04] text-zinc-300";
  }
}

function fullName(prospect: Prospect) {
  const name = [prospect.first_name, prospect.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || prospect.company_name || "Unnamed prospect";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isDue(prospect: Prospect) {
  if (!prospect.next_followup_at) return true;
  return new Date(prospect.next_followup_at).getTime() <= Date.now();
}

function templateText(template: MessageTemplate, prospect?: Prospect) {
  let message = template.message_body || "";
  const firstName = prospect?.first_name?.trim() || "there";
  const lastName = prospect?.last_name?.trim() || "";
  const company = prospect?.company_name?.trim() || "your company";
  const title = prospect?.job_title?.trim() || "your role";
  const location = prospect?.location?.trim() || "your area";

  const replacements: Record<string, string> = {
    first_name: firstName,
    last_name: lastName,
    company_name: company,
    company,
    job_title: title,
    location,
  };

  Object.entries(replacements).forEach(([key, value]) => {
    message = message.replace(
      new RegExp("\\{\\{\\s*" + key + "\\s*\\}\\}", "gi"),
      value
    );
  });

  return message;
}

function draftFromProspect(prospect: Prospect): ProspectDraft {
  return {
    linkedin_url: prospect.linkedin_url || "",
    first_name: prospect.first_name || "",
    last_name: prospect.last_name || "",
    company_name: prospect.company_name || "",
    job_title: prospect.job_title || "",
    location: prospect.location || "",
    email: prospect.email || "",
    phone: prospect.phone || "",
    carrier_dot_number:
      prospect.carrier_dot_number === null ||
      prospect.carrier_dot_number === undefined
        ? ""
        : String(prospect.carrier_dot_number),
    notes: prospect.notes || "",
  };
}

export default function AdminLinkedInPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<ProspectDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ProspectDraft>(EMPTY_DRAFT);
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/admin/linkedin", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Could not load LinkedIn outreach.");
      }
      setProspects(Array.isArray(payload.prospects) ? payload.prospects : []);
      setTemplates(Array.isArray(payload.templates) ? payload.templates : []);
      setSettings(payload.settings || null);
      setPageError("");
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Could not load LinkedIn outreach. Please refresh and try again."
      );
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendRequest(
    body: Record<string, unknown>,
    key: string,
    endpoint = "/api/admin/linkedin"
  ) {
    setBusyId(key);
    setNotice("");
    setPageError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "The request could not be completed.");
      }

      setNotice(payload.message || "Saved successfully.");
      if (body.mode === "create") {
        setDraft(EMPTY_DRAFT);
        setShowAdd(false);
      }
      if (body.mode === "update") {
        setEditingId(null);
      }
      if (body.mode === "action" && body.action === "reply_received") {
        setReplyOpenId(null);
        setReplyDrafts((current) => ({
          ...current,
          [String(body.prospect_id)]: "",
        }));
      }
      await load(true);
      return true;
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "The request could not be completed."
      );
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = draft.linkedin_url.trim();
    if (!url) {
      setPageError("Add the LinkedIn profile URL before saving.");
      return;
    }
    const success = await sendRequest(
      {
        mode: "create",
        ...draft,
        linkedin_url: url,
        carrier_dot_number: draft.carrier_dot_number || null,
      },
      "create"
    );
    if (success) setNotice("Prospect added to your LinkedIn pipeline.");
  }

  function beginEdit(prospect: Prospect) {
    setEditingId(prospect.id);
    setEditDraft(draftFromProspect(prospect));
    setPageError("");
    setNotice("");
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>, prospect: Prospect) {
    event.preventDefault();
    const success = await sendRequest(
      {
        mode: "update",
        prospect_id: prospect.id,
        ...editDraft,
        carrier_dot_number: editDraft.carrier_dot_number || null,
      },
      prospect.id,
      "/api/admin/linkedin/prospect"
    );
    if (success) setNotice("Prospect details updated.");
  }

  async function action(
    prospect: Prospect,
    actionName: string,
    extra: Record<string, unknown> = {}
  ) {
    await sendRequest(
      {
        mode: "action",
        prospect_id: prospect.id,
        action: actionName,
        ...extra,
      },
      prospect.id
    );
  }

  async function copyMessage(step: number, prospect?: Prospect) {
    const template = templates.find((item) => item.step_number === step);
    if (!template) {
      setPageError("No active template is configured for this step.");
      return;
    }
    try {
      await navigator.clipboard.writeText(templateText(template, prospect));
      setNotice(
        prospect
          ? "Personalized message copied. Open LinkedIn, paste it, and send it manually."
          : "Template copied. Replace any placeholders before sending."
      );
      setPageError("");
    } catch {
      setPageError("Clipboard access was blocked. Select and copy the message text manually.");
    }
  }

  const filteredProspects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return prospects.filter((prospect) => {
      const matchesStatus =
        statusFilter === "all" || prospect.status === statusFilter;
      const searchable = [
        prospect.first_name,
        prospect.last_name,
        prospect.company_name,
        prospect.job_title,
        prospect.location,
        prospect.email,
        prospect.linkedin_url,
        prospect.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [prospects, search, statusFilter]);

  const counts = useMemo(() => {
    const due = prospects.filter(
      (prospect) =>
        (prospect.status === "connected" || prospect.status === "messaged") &&
        isDue(prospect)
    ).length;
    return {
      total: prospects.length,
      fresh: prospects.filter((item) => item.status === "new").length,
      pending: prospects.filter((item) => item.status === "connection_pending").length,
      due,
      replied: prospects.filter((item) => item.status === "replied").length,
      qualified: prospects.filter((item) => item.status === "qualified").length,
    };
  }, [prospects]);

  const statusOptions = [
    ["all", "All statuses"],
    ["new", "New"],
    ["connection_pending", "Connection pending"],
    ["connected", "Connected"],
    ["messaged", "In sequence"],
    ["replied", "Replied"],
    ["qualified", "Qualified"],
    ["not_interested", "Not interested"],
  ];

  function nextStep(prospect: Prospect) {
    if (prospect.status === "connected") return 1;
    if (prospect.status === "messaged") return Number(prospect.last_step_sent || 0) + 1;
    return 0;
  }

  return (
    <main className="min-h-screen bg-[#080a0f] px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">
              <span className="h-2 w-2 rounded-full bg-sky-300" />
              SlateLane Dispatch · Prospecting
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              LinkedIn outreach
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Research prospects, prepare personalized messages, and keep every connection and follow-up recorded in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || busyId !== null}
              className={secondaryButton}
            >
              ↻ Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowAdd((value) => !value)}
              className={primaryButton}
            >
              + Add prospect
            </button>
          </div>
        </header>

        <section className="flex flex-col gap-3 rounded-2xl border border-sky-400/15 bg-sky-400/[0.045] p-4 sm:flex-row sm:items-start">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-300/15 bg-sky-300/10 text-lg text-sky-200">
            i
          </div>
          <div>
            <h2 className="text-sm font-semibold text-sky-100">Manual workflow — no LinkedIn automation</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              Open a profile, review the prospect, copy a message, and send it yourself on LinkedIn. Only use the buttons below to record activity after it has actually happened. Replies stop the follow-up sequence.
            </p>
          </div>
        </section>

        {pageError ? (
          <div role="alert" className="flex flex-col gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200 sm:flex-row sm:items-center sm:justify-between">
            <span>{pageError}</span>
            <button type="button" onClick={() => void load()} className="text-xs font-bold underline">
              Retry
            </button>
          </div>
        ) : null}

        {notice ? (
          <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")} aria-label="Dismiss notice" className="text-emerald-200/70 hover:text-emerald-100">
              ×
            </button>
          </div>
        ) : null}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {[
            { label: "Total prospects", value: counts.total, detail: "In this workspace" },
            { label: "New", value: counts.fresh, detail: "Ready to research" },
            { label: "Pending", value: counts.pending, detail: "Awaiting acceptance" },
            { label: "Follow-ups due", value: counts.due, detail: "Ready for manual action" },
            { label: "Replies", value: counts.replied, detail: "Conversation started" },
            { label: "Qualified", value: counts.qualified, detail: "Sales-ready prospects" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-zinc-500">{item.label}</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-white">{loading ? "—" : item.value}</div>
              <div className="mt-1 text-[10px] text-zinc-600">{item.detail}</div>
            </div>
          ))}
        </section>

        {settings ? (
          <section className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs text-zinc-400">
            <span>Daily connection target: <strong className="text-zinc-200">{settings.daily_connection_target}</strong></span>
            <span>Daily follow-up target: <strong className="text-zinc-200">{settings.daily_followup_target}</strong></span>
            <span>Open-prospect capacity: <strong className="text-zinc-200">{settings.max_open_prospects}</strong></span>
            <span className="ml-auto inline-flex items-center gap-2 text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Activity is recorded manually
            </span>
          </section>
        ) : null}

        {showAdd ? (
          <section className="rounded-2xl border border-sky-400/20 bg-white/[0.025] p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Add a prospect</h2>
                <p className="mt-1 text-xs text-zinc-500">Start with a public LinkedIn profile URL. Other details can be added now or later.</p>
              </div>
              <button type="button" onClick={() => setShowAdd(false)} className={secondaryButton}>Close</button>
            </div>
            <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <label className="sm:col-span-2 xl:col-span-3">
                <span className="mb-1.5 block text-xs font-medium text-zinc-300">LinkedIn profile URL *</span>
                <input required type="url" value={draft.linkedin_url} onChange={(event) => setDraft({ ...draft, linkedin_url: event.target.value })} placeholder="https://www.linkedin.com/in/..." className={inputClass} />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-zinc-300">First name</span>
                <input value={draft.first_name} onChange={(event) => setDraft({ ...draft, first_name: event.target.value })} className={inputClass} placeholder="First name" />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-zinc-300">Last name</span>
                <input value={draft.last_name} onChange={(event) => setDraft({ ...draft, last_name: event.target.value })} className={inputClass} placeholder="Last name" />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-zinc-300">Company</span>
                <input value={draft.company_name} onChange={(event) => setDraft({ ...draft, company_name: event.target.value })} className={inputClass} placeholder="Carrier / company" />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-zinc-300">Job title</span>
                <input value={draft.job_title} onChange={(event) => setDraft({ ...draft, job_title: event.target.value })} className={inputClass} placeholder="Owner, fleet manager..." />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-zinc-300">Location</span>
                <input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} className={inputClass} placeholder="City, state" />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-zinc-300">Email</span>
                <input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} className={inputClass} placeholder="name@company.com" />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-zinc-300">Phone</span>
                <input type="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} className={inputClass} placeholder="Optional" />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-zinc-300">Carrier DOT number</span>
                <input inputMode="numeric" value={draft.carrier_dot_number} onChange={(event) => setDraft({ ...draft, carrier_dot_number: event.target.value })} className={inputClass} placeholder="Optional" />
              </label>
              <label className="sm:col-span-2 xl:col-span-3">
                <span className="mb-1.5 block text-xs font-medium text-zinc-300">Research notes</span>
                <textarea rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className={inputClass} placeholder="Equipment, fleet size, lanes, personalization ideas..." />
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-3">
                <button type="submit" disabled={busyId !== null} className={primaryButton}>{busyId === "create" ? "Saving..." : "Save prospect"}</button>
                <button type="button" onClick={() => setDraft(EMPTY_DRAFT)} className={secondaryButton}>Clear form</button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
          <div className="flex flex-col gap-3 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-lg font-semibold">Prospect pipeline</h2>
              <p className="mt-1 text-xs text-zinc-500">Search, update contact details, and record the next manual action.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input aria-label="Search prospects" value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass + " sm:w-64"} placeholder="Search name, company, email..." />
              <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass + " sm:w-48"}>
                {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-zinc-500">Loading LinkedIn prospects…</div>
          ) : filteredProspects.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-sm font-semibold text-zinc-300">{prospects.length === 0 ? "Your LinkedIn pipeline is ready" : "No matching prospects"}</div>
              <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-zinc-500">
                {prospects.length === 0 ? "Add a prospect to begin. Your saved prospects will appear here with their outreach status and next action." : "Try a different search term or choose All statuses."}
              </p>
              {prospects.length === 0 ? <button type="button" onClick={() => setShowAdd(true)} className={primaryButton + " mt-4"}>+ Add your first prospect</button> : null}
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {filteredProspects.map((prospect) => {
                const step = nextStep(prospect);
                const nextTemplate = templates.find((item) => item.step_number === step);
                const isTerminal = prospect.status === "qualified" || prospect.status === "not_interested";
                const waiting = step > 1 && prospect.next_followup_at && !isDue(prospect);
                const isBusy = busyId !== null;
                return (
                  <article key={prospect.id} className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-base font-semibold text-white">{fullName(prospect)}</h3>
                          <span className={"inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold " + statusClass(prospect.status)}>{prettyStatus(prospect.status)}</span>
                          {prospect.lead_id ? <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2 py-1 text-[10px] text-emerald-300">CRM lead linked</span> : null}
                        </div>
                        <div className="mt-1 text-xs text-zinc-400">
                          {[prospect.job_title, prospect.company_name, prospect.location].filter(Boolean).join(" · ") || "Add role, company, and location details"}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-500">
                          {prospect.email ? <a className="hover:text-sky-300" href={"mailto:" + prospect.email}>{prospect.email}</a> : <span>No email added</span>}
                          {prospect.phone ? <a className="hover:text-sky-300" href={"tel:" + prospect.phone}>{prospect.phone}</a> : null}
                          {prospect.carrier_dot_number ? <span>DOT {prospect.carrier_dot_number}</span> : null}
                          <span>Added {formatDate(prospect.created_at)}</span>
                        </div>
                        <div className="mt-4 grid gap-2 rounded-xl border border-white/[0.06] bg-black/20 p-3 sm:grid-cols-3">
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">Last activity</div>
                            <div className="mt-1 text-xs text-zinc-300">{formatDate(prospect.last_message_at || prospect.connected_at || prospect.connection_requested_at)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">Next follow-up</div>
                            <div className={"mt-1 text-xs " + (waiting ? "text-amber-200" : "text-zinc-300")}>{prospect.next_followup_at ? formatDate(prospect.next_followup_at) : "No follow-up scheduled"}</div>
                          </div>
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">Sequence progress</div>
                            <div className="mt-1 text-xs text-zinc-300">{Math.min(Number(prospect.last_step_sent || 0), 4)} of 4 message steps recorded</div>
                          </div>
                        </div>
                        {prospect.reply_text ? (
                          <div className="mt-3 rounded-xl border border-sky-400/15 bg-sky-400/[0.045] p-3">
                            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-sky-300">Latest reply</div>
                            <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-zinc-300">{prospect.reply_text}</p>
                          </div>
                        ) : null}
                        {prospect.notes ? <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-zinc-500">{prospect.notes}</p> : null}
                      </div>

                      <div className="flex w-full flex-col gap-2 xl:w-64 xl:shrink-0">
                        <a href={prospect.linkedin_url} target="_blank" rel="noreferrer" className={secondaryButton}>Open LinkedIn profile ↗</a>
                        <button type="button" onClick={() => beginEdit(prospect)} disabled={isBusy} className={secondaryButton}>Edit prospect details</button>

                        {prospect.status === "new" ? (
                          <>
                            <button type="button" onClick={() => void copyMessage(0, prospect)} disabled={isBusy} className={secondaryButton}>Copy connection note</button>
                            <button type="button" onClick={() => void action(prospect, "connection_requested")} disabled={isBusy} className={primaryButton}>Mark request sent</button>
                          </>
                        ) : null}

                        {prospect.status === "connection_pending" ? (
                          <button type="button" onClick={() => void action(prospect, "connection_accepted")} disabled={isBusy} className={primaryButton}>Mark connection accepted</button>
                        ) : null}

                        {(prospect.status === "connected" || prospect.status === "messaged") && step >= 1 && step <= 4 ? (
                          <>
                            {nextTemplate ? <button type="button" onClick={() => void copyMessage(step, prospect)} disabled={isBusy} className={secondaryButton}>Copy step {step} message</button> : <p className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3 text-xs text-amber-200">No active template for step {step}. Check the message library.</p>}
                            <button
                              type="button"
                              onClick={() => void action(prospect, "message_sent", { step_number: step, message_body: nextTemplate ? templateText(nextTemplate, prospect) : null })}
                              disabled={isBusy || Boolean(waiting) || !nextTemplate}
                              className={primaryButton}
                            >
                              {waiting ? "Follow-up not due yet" : "Mark step " + step + " sent"}
                            </button>
                            {waiting ? <p className="text-[10px] leading-4 text-amber-200/80">Due {formatDate(prospect.next_followup_at)}. You can prepare the message now, but record it only after it is sent.</p> : null}
                          </>
                        ) : null}

                        {prospect.status === "messaged" && step > 4 ? (
                          <p className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-xs text-zinc-400">Sequence complete. Review the conversation or mark the prospect qualified.</p>
                        ) : null}

                        {!isTerminal && prospect.status !== "replied" ? (
                          <button type="button" onClick={() => setReplyOpenId((current) => current === prospect.id ? null : prospect.id)} disabled={isBusy} className={secondaryButton}>Record a reply</button>
                        ) : null}

                        {!isTerminal ? (
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => void action(prospect, "qualified")} disabled={isBusy} className={secondaryButton}>Mark qualified</button>
                            <button type="button" onClick={() => void action(prospect, "not_interested")} disabled={isBusy} className={dangerButton}>Not interested</button>
                          </div>
                        ) : null}

                        {prospect.status === "qualified" && prospect.email && !prospect.lead_id ? (
                          <button type="button" onClick={() => void sendRequest({ mode: "sync", prospect_id: prospect.id, email: prospect.email, phone: prospect.phone }, prospect.id)} disabled={isBusy} className={primaryButton}>Sync to CRM Leads</button>
                        ) : null}
                        {prospect.lead_id ? <a href="/admin/leads" className="text-center text-[11px] font-semibold text-emerald-300 hover:text-emerald-200">View CRM leads →</a> : null}
                      </div>
                    </div>

                    {editingId === prospect.id ? (
                      <form onSubmit={(event) => void handleEdit(event, prospect)} className="mt-5 rounded-2xl border border-sky-400/15 bg-sky-400/[0.035] p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <h4 className="text-sm font-semibold">Edit prospect details</h4>
                          <button type="button" onClick={() => setEditingId(null)} className="text-xs text-zinc-500 hover:text-white">Cancel</button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <label className="sm:col-span-2 xl:col-span-3">
                            <span className="mb-1.5 block text-xs text-zinc-400">LinkedIn URL</span>
                            <input required type="url" value={editDraft.linkedin_url} onChange={(event) => setEditDraft({ ...editDraft, linkedin_url: event.target.value })} className={inputClass} />
                          </label>
                          <label><span className="mb-1.5 block text-xs text-zinc-400">First name</span><input value={editDraft.first_name} onChange={(event) => setEditDraft({ ...editDraft, first_name: event.target.value })} className={inputClass} /></label>
                          <label><span className="mb-1.5 block text-xs text-zinc-400">Last name</span><input value={editDraft.last_name} onChange={(event) => setEditDraft({ ...editDraft, last_name: event.target.value })} className={inputClass} /></label>
                          <label><span className="mb-1.5 block text-xs text-zinc-400">Company</span><input value={editDraft.company_name} onChange={(event) => setEditDraft({ ...editDraft, company_name: event.target.value })} className={inputClass} /></label>
                          <label><span className="mb-1.5 block text-xs text-zinc-400">Job title</span><input value={editDraft.job_title} onChange={(event) => setEditDraft({ ...editDraft, job_title: event.target.value })} className={inputClass} /></label>
                          <label><span className="mb-1.5 block text-xs text-zinc-400">Location</span><input value={editDraft.location} onChange={(event) => setEditDraft({ ...editDraft, location: event.target.value })} className={inputClass} /></label>
                          <label><span className="mb-1.5 block text-xs text-zinc-400">Email</span><input type="email" value={editDraft.email} onChange={(event) => setEditDraft({ ...editDraft, email: event.target.value })} className={inputClass} /></label>
                          <label><span className="mb-1.5 block text-xs text-zinc-400">Phone</span><input type="tel" value={editDraft.phone} onChange={(event) => setEditDraft({ ...editDraft, phone: event.target.value })} className={inputClass} /></label>
                          <label><span className="mb-1.5 block text-xs text-zinc-400">Carrier DOT number</span><input inputMode="numeric" value={editDraft.carrier_dot_number} onChange={(event) => setEditDraft({ ...editDraft, carrier_dot_number: event.target.value })} className={inputClass} /></label>
                          <label className="sm:col-span-2 xl:col-span-3"><span className="mb-1.5 block text-xs text-zinc-400">Research notes</span><textarea rows={2} value={editDraft.notes} onChange={(event) => setEditDraft({ ...editDraft, notes: event.target.value })} className={inputClass} /></label>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="submit" disabled={isBusy} className={primaryButton}>{busyId === prospect.id ? "Saving..." : "Save changes"}</button>
                          <button type="button" onClick={() => setEditDraft(draftFromProspect(prospect))} className={secondaryButton}>Reset changes</button>
                        </div>
                      </form>
                    ) : null}

                    {replyOpenId === prospect.id ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const reply = (replyDrafts[prospect.id] || "").trim();
                          if (!reply) {
                            setPageError("Enter the reply text before saving it.");
                            return;
                          }
                          void action(prospect, "reply_received", { reply_text: reply });
                        }}
                        className="mt-4 rounded-2xl border border-sky-400/15 bg-sky-400/[0.035] p-4"
                      >
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-medium text-zinc-300">Paste the reply you received</span>
                          <textarea required rows={3} value={replyDrafts[prospect.id] || ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [prospect.id]: event.target.value }))} className={inputClass} placeholder="Record the prospect's reply here..." />
                        </label>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="submit" disabled={isBusy} className={primaryButton}>Save reply and stop follow-ups</button>
                          <button type="button" onClick={() => setReplyOpenId(null)} className={secondaryButton}>Cancel</button>
                        </div>
                      </form>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Message library</h2>
              <p className="mt-1 text-xs text-zinc-500">Templates are copied to your clipboard only. Review and send them manually on LinkedIn.</p>
            </div>
            <span className="text-[10px] uppercase tracking-[0.13em] text-zinc-600">{templates.length} active templates</span>
          </div>
          {templates.length === 0 ? (
            <p className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-4 text-xs text-amber-200">No active LinkedIn templates were returned by the API.</p>
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {templates.map((template) => (
                <article key={template.id} className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-zinc-200">{template.template_name}</div>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] text-zinc-500">{template.step_number === 0 ? "Connection note" : "Step " + template.step_number}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-zinc-400">{template.message_body}</p>
                  <button type="button" onClick={() => void copyMessage(template.step_number)} disabled={busyId !== null} className={secondaryButton + " mt-3"}>Copy template</button>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/[0.06] pt-4 text-[10px] text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <span>SlateLane Dispatch · LinkedIn prospect workspace</span>
          <span>Data refreshes from the CRM API · No automated LinkedIn activity</span>
        </footer>
      </div>
    </main>
  );
}
