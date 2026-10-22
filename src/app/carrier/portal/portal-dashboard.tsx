"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase/client";

type PortalDocument = {
  type: string;
  label: string;
  description: string;
  required: boolean;
  uploadable: boolean;
  status: string;
  status_label: string;
  satisfied: boolean;
  document_id: string | null;
  file_name: string | null;
  has_file: boolean;
  received_at: string | null;
  signed_at: string | null;
  approved_at: string | null;
  expires_at: string | null;
  rejection_reason: string | null;
};

type PortalOnboarding = {
  id: string;
  company_name: string;
  dot_number: number | null;
  mc_number: string | null;
  onboarding_status: string;
  agreement_status: string;
  created_at: string;
  updated_at: string;
  portal_status: "documents_needed" | "under_review" | "complete";
  progress: { submitted: number; required: number; percent: number };
  documents: PortalDocument[];
};

type PortalResponse = {
  ok: boolean;
  email?: string;
  onboardings?: PortalOnboarding[];
  message?: string;
};

function statusTone(status: string) {
  if (status === "approved" || status === "signed" || status === "complete") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "received" || status === "under_review") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }

  if (status === "rejected" || status === "expired") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

function overallStatusLabel(status: PortalOnboarding["portal_status"]) {
  if (status === "complete") return "Documents approved";
  if (status === "under_review") return "Under review";
  return "Documents needed";
}

export default function CarrierPortalDashboard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [onboardings, setOnboardings] = useState<PortalOnboarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploadingKey, setUploadingKey] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/carrier/portal/me", {
        cache: "no-store",
      });

      const result = (await response.json()) as PortalResponse;

      if (response.status === 401) {
        router.replace("/carrier/portal/login");
        return;
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Could not load your onboarding.");
      }

      setEmail(result.email || "");
      setOnboardings(result.onboardings || []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load your onboarding."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function signOut() {
    await fetch("/api/carrier/portal/logout", { method: "POST" });
    router.replace("/carrier/portal/login");
    router.refresh();
  }

  async function uploadDocument(
    onboardingId: string,
    document: PortalDocument
  ) {
    const key = onboardingId + ":" + document.type;
    const file = selectedFiles[key];

    if (!file) {
      setError("Choose a PDF file before uploading.");
      return;
    }

    if (
      !file.name.toLowerCase().endsWith(".pdf") ||
      file.size <= 0 ||
      file.size > 15 * 1024 * 1024
    ) {
      setError("Choose a valid PDF up to 15 MB.");
      return;
    }

    setUploadingKey(key);
    setError("");
    setSuccess("");

    try {
      const prepareResponse = await fetch("/api/carrier/portal/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboarding_id: onboardingId,
          document_type: document.type,
          file_name: file.name,
          file_size_bytes: file.size,
        }),
      });

      const prepared = await prepareResponse.json();

      if (!prepareResponse.ok || !prepared.ok) {
        throw new Error(prepared.message || "Could not prepare a secure upload.");
      }

      const { error: storageError } = await supabase.storage
        .from("carrier-document-vault")
        .uploadToSignedUrl(prepared.path, prepared.token, file, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (storageError) {
        throw new Error("The PDF could not be uploaded. Please try again.");
      }

      const finalizeResponse = await fetch(
        "/api/carrier/portal/documents/finalize",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent_id: prepared.intent_id }),
        }
      );

      const finalized = await finalizeResponse.json();

      if (!finalizeResponse.ok || !finalized.ok) {
        throw new Error(finalized.message || "Could not finish the upload.");
      }

      setSelectedFiles((current) => ({ ...current, [key]: null }));
      setSuccess(document.label + " uploaded successfully. It is now awaiting review.");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not upload this document."
      );
    } finally {
      setUploadingKey("");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-5xl animate-pulse rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading your secure onboarding portal…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col justify-between gap-4 rounded-3xl bg-slate-950 p-6 text-white sm:flex-row sm:items-center sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">
              SlateLane Dispatch
            </p>
            <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
              Your carrier onboarding
            </h1>
            <p className="mt-2 break-all text-sm text-slate-400">{email}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            Sign out
          </button>
        </header>

        {error ? (
          <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {success ? (
          <div role="status" className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {success}
          </div>
        ) : null}

        {onboardings.length === 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold">No onboarding records found</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
              This email does not currently have an active onboarding record. Please contact your SlateLane Dispatch representative.
            </p>
          </section>
        ) : (
          <div className="space-y-8">
            {onboardings.map((onboarding) => (
              <section
                key={onboarding.id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-200 p-6 sm:p-8">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                        Carrier profile
                      </p>
                      <h2 className="mt-2 text-xl font-semibold">
                        {onboarding.company_name || "Your company"}
                      </h2>
                      <p className="mt-2 text-sm text-slate-600">
                        {onboarding.dot_number ? "DOT " + onboarding.dot_number : "DOT not provided"}
                        {" · "}
                        {onboarding.mc_number ? "MC " + onboarding.mc_number : "MC not provided"}
                      </p>
                    </div>
                    <span className={"inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-semibold " + statusTone(onboarding.portal_status)}>
                      {overallStatusLabel(onboarding.portal_status)}
                    </span>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-700">Required items submitted</span>
                      <span className="font-semibold tabular-nums">
                        {onboarding.progress.submitted} of {onboarding.progress.required}
                      </span>
                    </div>
                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                      aria-valuenow={onboarding.progress.percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Required onboarding items submitted"
                    >
                      <div
                        className="h-full rounded-full bg-sky-500 transition-all"
                        style={{ width: onboarding.progress.percent + "%" }}
                      />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Uploaded files are marked as received while SlateLane reviews them. Approval is shown separately for each document.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
                  {onboarding.documents.map((document) => {
                    const key = onboarding.id + ":" + document.type;
                    const file = selectedFiles[key];

                    return (
                      <article
                        key={document.type}
                        className="flex min-w-0 flex-col rounded-2xl border border-slate-200 p-4 sm:p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-slate-900">{document.label}</h3>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {document.description}
                            </p>
                          </div>
                          <span className={"shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold " + statusTone(document.status)}>
                            {document.status_label}
                          </span>
                        </div>

                        <div className="mt-4 flex-1">
                          {document.required ? (
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Required
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              If applicable
                            </span>
                          )}

                          {document.file_name ? (
                            <p className="mt-2 break-all text-xs text-slate-600">
                              Latest file: {document.file_name}
                            </p>
                          ) : null}

                          {document.rejection_reason ? (
                            <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-800">
                              Please update this document: {document.rejection_reason}
                            </p>
                          ) : null}

                          {document.has_file && document.document_id ? (
                            <a
                              href={"/api/carrier/portal/documents/" + document.document_id}
                              className="mt-3 inline-flex text-sm font-medium text-sky-700 underline underline-offset-4 hover:text-sky-900"
                            >
                              Download submitted PDF
                            </a>
                          ) : null}
                        </div>

                        {document.uploadable ? (
                          <div className="mt-5 border-t border-slate-100 pt-4">
                            <label className="block text-xs font-semibold text-slate-700">
                              PDF file (maximum 15 MB)
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                onChange={(event) =>
                                  setSelectedFiles((current) => ({
                                    ...current,
                                    [key]: event.target.files?.[0] ?? null,
                                  }))
                                }
                                className="mt-2 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                              />
                            </label>
                            <button
                              type="button"
                              disabled={!file || uploadingKey === key}
                              onClick={() => void uploadDocument(onboarding.id, document)}
                              className="mt-3 w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {uploadingKey === key
                                ? "Uploading securely…"
                                : document.has_file
                                  ? "Upload replacement PDF"
                                  : "Upload PDF"}
                            </button>
                          </div>
                        ) : (
                          <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
                            This item is completed through a separate secure SlateLane link. Contact your representative if you need a fresh link.
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-8 text-center text-xs leading-5 text-slate-500">
          This portal only shows onboarding records assigned to your email. Files are private and download links expire automatically.
        </footer>
      </div>
    </main>
  );
}
