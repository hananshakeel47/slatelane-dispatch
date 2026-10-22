"use client";

import { useCallback, useEffect, useState } from "react";

type PortalAccess = {
  id: string;
  email: string;
  status: "active" | "revoked";
  created_at: string;
  last_login_at: string | null;
  revoked_at: string | null;
};

type OnboardingRow = {
  id: string;
  company_name: string;
  dot_number: number | null;
  mc_number: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  portal_access: PortalAccess[];
};

type ListResponse = {
  ok: boolean;
  onboardings?: OnboardingRow[];
  message?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function ClientPortalManager() {
  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/client-portal", {
        cache: "no-store",
      });
      const result = (await response.json()) as ListResponse;

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Could not load portal access.");
      }

      setRows(result.onboardings || []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load portal access."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeAccess(row: OnboardingRow) {
    const email = row.primary_contact_email?.trim().toLowerCase();

    if (!email) {
      setError("Add a primary contact email to this onboarding before enabling portal access.");
      return;
    }

    const activeForCurrentEmail = row.portal_access.some(
      (access) => access.status === "active" && access.email === email
    );

    setBusyId(row.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/client-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboarding_id: row.id,
          action: activeForCurrentEmail ? "revoke" : "enable",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Could not update portal access.");
      }

      setNotice(
        activeForCurrentEmail
          ? "Portal access was revoked."
          : "Portal access is enabled for " + email + ". Share the portal login link with the carrier."
      );

      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update portal access."
      );
    } finally {
      setBusyId("");
    }
  }

  async function copyPortalLink() {
    const url = window.location.origin + "/carrier/portal/login";

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy the link. Copy it manually: " + url);
    }
  }

  return (
    <main className="sl-page">
      <div className="sl-page-header">
        <div>
          <p className="sl-eyebrow">Carrier Operations</p>
          <h1 className="sl-page-title">Client Portal Access</h1>
          <p className="sl-page-description">
            Enable private document uploads and ongoing onboarding-status access for a carrier's verified business email.
          </p>
        </div>
        <button
          type="button"
          onClick={copyPortalLink}
          className="sl-button sl-button-secondary"
        >
          {copied ? "Link copied" : "Copy client login link"}
        </button>
      </div>

      <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
        Enabling access does not send an email automatically. Share the login link with the carrier after enabling access. They will receive a one-time code at the authorized email address when they sign in.
      </div>

      {error ? (
        <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      <section className="sl-card">
        <div className="sl-card-header">
          <div>
            <h2 className="sl-card-title">Carrier onboarding records</h2>
            <p className="sl-card-description">
              Access is limited to the onboarding record and contact email shown below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="sl-button sl-button-secondary"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-slate-500">Loading onboarding records…</div>
        ) : rows.length === 0 ? (
          <div className="p-8">
            <h3 className="font-semibold text-slate-900">No onboarding records yet</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Create a carrier onboarding record first. Once it exists, you can enable portal access here without sending documents through an external file-sharing website.
            </p>
            <a
              href="/admin/onboarding/new"
              className="mt-4 inline-flex text-sm font-semibold text-sky-700 underline underline-offset-4"
            >
              Create onboarding record
            </a>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {rows.map((row) => {
              const currentEmail = row.primary_contact_email?.trim().toLowerCase() || "";
              const activeForCurrentEmail = row.portal_access.some(
                (access) => access.status === "active" && access.email === currentEmail
              );
              const activeAccess = row.portal_access.filter(
                (access) => access.status === "active"
              );

              return (
                <article key={row.id} className="p-5 sm:p-6">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-900">
                        {row.company_name || "Unnamed carrier"}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {row.primary_contact_name || "No contact name"}
                        {currentEmail ? " · " + currentEmail : " · No contact email"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.dot_number ? "DOT " + row.dot_number : "DOT not set"}
                        {" · "}
                        {row.mc_number ? "MC " + row.mc_number : "MC not set"}
                        {" · Onboarding: "}
                        {row.status}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void changeAccess(row)}
                        disabled={busyId === row.id || !currentEmail}
                        className={
                          activeForCurrentEmail
                            ? "sl-button sl-button-secondary"
                            : "sl-button sl-button-primary"
                        }
                      >
                        {busyId === row.id
                          ? "Saving…"
                          : activeForCurrentEmail
                            ? "Revoke portal access"
                            : "Enable portal access"}
                      </button>
                      <a
                        href={"/admin/onboarding/" + row.id + "/documents"}
                        className="sl-button sl-button-secondary"
                      >
                        Open document vault
                      </a>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Portal access
                    </p>
                    {row.portal_access.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-600">Not enabled</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {row.portal_access.map((access) => (
                          <div
                            key={access.id}
                            className="flex flex-col justify-between gap-1 text-sm sm:flex-row sm:items-center"
                          >
                            <span className="break-all text-slate-800">{access.email}</span>
                            <span className="text-xs text-slate-500">
                              {access.status === "active" ? "Active" : "Revoked"}
                              {" · Last sign-in: "}
                              {formatDate(access.last_login_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
