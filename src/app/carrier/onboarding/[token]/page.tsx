"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useParams } from "next/navigation";

import {
  DISPATCH_AGREEMENT_SECTIONS,
  DISPATCH_AGREEMENT_VERSION,
  DispatchAgreementFormData,
  DispatchFeeType,
  formatDispatchFee,
} from "@/lib/onboarding/dispatch-agreement";

type LoadResponse = {
  ok: boolean;
  completed?: boolean;
  error?: string;

  company_name?: string;
  completed_at?: string;

  expires_at?: string;
  recipient_email?: string;
  agreement_version?: string;

  fee_locked?: boolean;

  prefill?: Partial<DispatchAgreementFormData>;
};

const EMPTY_FORM: DispatchAgreementFormData = {
  company_name: "",
  dot_number: "",
  mc_number: "",

  signer_name: "",
  signer_title: "",
  signer_email: "",
  electronic_signature: "",

  dispatch_fee_type:
    "percentage",

  dispatch_fee_value:
    "",

  minimum_rate_per_mile:
    "",

  factoring_company:
    "",

  insurance_company:
    "",

  insurance_expiration:
    "",

  preferred_lanes:
    "",

  preferred_states:
    "",

  regions_to_avoid:
    "",

  home_time_notes:
    "",

  operating_notes:
    "",

  consent: false,
};

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600";

const labelClass =
  "block text-sm font-semibold text-slate-800";

const cardClass =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7";

export default function CarrierOnboardingPage() {
  const params = useParams<{
    token: string;
  }>();

  const token =
    typeof params?.token === "string"
      ? params.token
      : "";

  const [form, setForm] =
    useState<DispatchAgreementFormData>(
      EMPTY_FORM,
    );

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState(false);

  const [alreadyCompleted, setAlreadyCompleted] =
    useState(false);

  const [completedAt, setCompletedAt] =
    useState<string | null>(null);

  const [expiresAt, setExpiresAt] =
    useState<string | null>(null);

  const [feeLocked, setFeeLocked] =
    useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(
          `/api/carrier/onboarding/${encodeURIComponent(
            token,
          )}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data =
          (await res.json()) as LoadResponse;

        if (cancelled) return;

        if (!res.ok || !data.ok) {
          setError(
            data.error ||
              "Unable to load this agreement.",
          );
          return;
        }

        if (data.completed) {
          setAlreadyCompleted(true);
          setCompletedAt(
            data.completed_at || null,
          );
          return;
        }

        setExpiresAt(
          data.expires_at || null,
        );

        setFeeLocked(
          Boolean(data.fee_locked),
        );

        const prefill =
          data.prefill || {};

        setForm((current) => ({
          ...current,
          ...prefill,

          dispatch_fee_type:
            (prefill.dispatch_fee_type ||
              "percentage") as DispatchFeeType,

          signer_email:
            data.recipient_email ||
            prefill.signer_email ||
            "",

          consent: false,

          electronic_signature:
            "",
        }));
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            "Unable to load this secure agreement.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  function updateField<
    K extends keyof DispatchAgreementFormData,
  >(
    key: K,
    value: DispatchAgreementFormData[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  const feePreview = useMemo(() => {
    const value =
      Number(form.dispatch_fee_value);

    if (
      !form.dispatch_fee_value ||
      !Number.isFinite(value)
    ) {
      return "Not yet entered";
    }

    return formatDispatchFee(
      form.dispatch_fee_type,
      form.dispatch_fee_value,
    );
  }, [
    form.dispatch_fee_type,
    form.dispatch_fee_value,
  ]);

  async function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();

    setError("");

    if (!form.consent) {
      setError(
        "Please accept the agreement before signing.",
      );
      return;
    }

    if (
      form.signer_name
        .trim()
        .toLowerCase() !==
      form.electronic_signature
        .trim()
        .toLowerCase()
    ) {
      setError(
        "Your electronic signature must match the authorized signer name.",
      );
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(
        `/api/carrier/onboarding/${encodeURIComponent(
          token,
        )}`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(form),
        },
      );

      const data =
        await res.json();

      if (!res.ok || !data.ok) {
        setError(
          data.error ||
            "Unable to submit the agreement.",
        );
        return;
      }

      setSuccess(true);

      setCompletedAt(
        data.signed_at || null,
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (err) {
      console.error(err);

      setError(
        "Unable to submit the agreement. Please check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <div className={cardClass}>
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-64 rounded bg-slate-200" />
              <div className="h-4 w-full rounded bg-slate-200" />
              <div className="h-4 w-5/6 rounded bg-slate-200" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (
    success ||
    alreadyCompleted
  ) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
              ✓
            </div>

            <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Agreement Completed
            </h1>

            <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-slate-600 sm:text-base">
              Your Carrier-Dispatcher
              Agreement has been securely
              completed and recorded by Slate
              Lane Dispatch.
            </p>

            {completedAt && (
              <p className="mt-4 text-sm text-slate-500">
                Completed:{" "}
                {new Date(
                  completedAt,
                ).toLocaleString()}
              </p>
            )}

            <div className="mt-8 rounded-2xl bg-slate-50 p-5 text-left text-sm leading-6 text-slate-600">
              The signed PDF has been stored
              securely in the Slate Lane
              carrier document vault. No
              additional PDF editor or
              software is required.
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error && !form.company_name) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-slate-950">
              Secure Agreement Unavailable
            </h1>

            <p className="mt-4 text-sm leading-6 text-red-700">
              {error}
            </p>

            <p className="mt-6 text-sm text-slate-500">
              Please contact Slate Lane
              Dispatch for a new secure
              onboarding link.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            Slate Lane Dispatch
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Carrier-Dispatcher Agreement
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Complete and electronically sign
            your carrier agreement directly
            in your browser. No PDF editor is
            required.
          </p>

          <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-400">
            <span>
              Agreement version:{" "}
              {DISPATCH_AGREEMENT_VERSION}
            </span>

            {expiresAt && (
              <span>
                Secure link expires:{" "}
                {new Date(
                  expiresAt,
                ).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6"
      >
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
            {error}
          </div>
        )}

        <section className={cardClass}>
          <h2 className="text-lg font-bold text-slate-950">
            Carrier Information
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Review the motor carrier
            information below before signing.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className={`${labelClass} sm:col-span-2`}>
              Legal / Company Name
              <input
                required
                className={inputClass}
                value={form.company_name}
                onChange={(e) =>
                  updateField(
                    "company_name",
                    e.target.value,
                  )
                }
              />
            </label>

            <label className={labelClass}>
              USDOT Number
              <input
                className={inputClass}
                inputMode="numeric"
                value={form.dot_number}
                onChange={(e) =>
                  updateField(
                    "dot_number",
                    e.target.value,
                  )
                }
              />
            </label>

            <label className={labelClass}>
              MC Number
              <input
                className={inputClass}
                value={form.mc_number}
                onChange={(e) =>
                  updateField(
                    "mc_number",
                    e.target.value,
                  )
                }
              />
            </label>
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="text-lg font-bold text-slate-950">
            Commercial Terms
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            These terms will appear on the
            final signed PDF.
          </p>

          {feeLocked && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Slate Lane has already set the
              agreed dispatch fee. These fee
              fields are locked for this
              agreement.
            </div>
          )}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>
              Dispatch Fee Type
              <select
                required
                disabled={feeLocked}
                className={inputClass}
                value={form.dispatch_fee_type}
                onChange={(e) =>
                  updateField(
                    "dispatch_fee_type",
                    e.target
                      .value as DispatchFeeType,
                  )
                }
              >
                <option value="percentage">
                  Percentage
                </option>

                <option value="flat_per_load">
                  Flat Fee Per Load
                </option>

                <option value="weekly_flat">
                  Weekly Flat Fee
                </option>
              </select>
            </label>

            <label className={labelClass}>
              {form.dispatch_fee_type ===
              "percentage"
                ? "Dispatch Percentage"
                : "Dispatch Fee ($)"}

              <input
                required
                disabled={feeLocked}
                className={inputClass}
                type="number"
                min="0.01"
                step="0.01"
                value={
                  form.dispatch_fee_value
                }
                onChange={(e) =>
                  updateField(
                    "dispatch_fee_value",
                    e.target.value,
                  )
                }
              />
            </label>

            <div className="sm:col-span-2 rounded-xl bg-slate-50 p-4 text-sm">
              <span className="font-semibold text-slate-700">
                Agreement fee:
              </span>{" "}
              <span className="text-slate-600">
                {feePreview}
              </span>
            </div>

            <label className={labelClass}>
              Minimum Rate Per Mile
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 2.50"
                value={
                  form.minimum_rate_per_mile
                }
                onChange={(e) =>
                  updateField(
                    "minimum_rate_per_mile",
                    e.target.value,
                  )
                }
              />
            </label>

            <label className={labelClass}>
              Preferred States
              <input
                className={inputClass}
                placeholder="TX, OK, AR, TN"
                value={form.preferred_states}
                onChange={(e) =>
                  updateField(
                    "preferred_states",
                    e.target.value,
                  )
                }
              />
            </label>

            <label className={`${labelClass} sm:col-span-2`}>
              Preferred Lanes
              <textarea
                className={`${inputClass} min-h-24`}
                placeholder="Example: Dallas, TX to Atlanta, GA"
                value={form.preferred_lanes}
                onChange={(e) =>
                  updateField(
                    "preferred_lanes",
                    e.target.value,
                  )
                }
              />
            </label>

            <label className={`${labelClass} sm:col-span-2`}>
              Regions / States to Avoid
              <textarea
                className={`${inputClass} min-h-20`}
                placeholder="Optional"
                value={form.regions_to_avoid}
                onChange={(e) =>
                  updateField(
                    "regions_to_avoid",
                    e.target.value,
                  )
                }
              />
            </label>
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="text-lg font-bold text-slate-950">
            Carrier Operations
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>
              Factoring Company
              <input
                className={inputClass}
                placeholder="Optional"
                value={
                  form.factoring_company
                }
                onChange={(e) =>
                  updateField(
                    "factoring_company",
                    e.target.value,
                  )
                }
              />
            </label>

            <label className={labelClass}>
              Insurance Company
              <input
                className={inputClass}
                placeholder="Optional"
                value={
                  form.insurance_company
                }
                onChange={(e) =>
                  updateField(
                    "insurance_company",
                    e.target.value,
                  )
                }
              />
            </label>

            <label className={labelClass}>
              Insurance Expiration
              <input
                className={inputClass}
                type="date"
                value={
                  form.insurance_expiration
                }
                onChange={(e) =>
                  updateField(
                    "insurance_expiration",
                    e.target.value,
                  )
                }
              />
            </label>

            <label className={`${labelClass} sm:col-span-2`}>
              Home Time Requirements
              <textarea
                className={`${inputClass} min-h-20`}
                placeholder="Example: Home every second weekend"
                value={
                  form.home_time_notes
                }
                onChange={(e) =>
                  updateField(
                    "home_time_notes",
                    e.target.value,
                  )
                }
              />
            </label>

            <label className={`${labelClass} sm:col-span-2`}>
              Additional Operating Notes
              <textarea
                className={`${inputClass} min-h-24`}
                placeholder="Equipment limitations, driver preferences, appointment restrictions, etc."
                value={
                  form.operating_notes
                }
                onChange={(e) =>
                  updateField(
                    "operating_notes",
                    e.target.value,
                  )
                }
              />
            </label>
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Agreement Terms
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Please review these terms
                before signing.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {DISPATCH_AGREEMENT_VERSION}
            </span>
          </div>

          <div className="mt-6 max-h-[560px] space-y-6 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
            {DISPATCH_AGREEMENT_SECTIONS.map(
              (section) => (
                <div key={section.title}>
                  <h3 className="text-sm font-bold text-slate-950">
                    {section.title}
                  </h3>

                  <div className="mt-2 space-y-2">
                    {section.paragraphs.map(
                      (paragraph) => (
                        <p
                          key={paragraph}
                          className="text-sm leading-6 text-slate-600"
                        >
                          {paragraph}
                        </p>
                      ),
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="text-lg font-bold text-slate-950">
            Authorized Signature
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            The person signing must be
            authorized to enter into this
            agreement on behalf of the
            carrier.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>
              Authorized Signer Name
              <input
                required
                className={inputClass}
                value={form.signer_name}
                onChange={(e) =>
                  updateField(
                    "signer_name",
                    e.target.value,
                  )
                }
              />
            </label>

            <label className={labelClass}>
              Signer Title
              <input
                required
                className={inputClass}
                placeholder="Owner, President, Manager..."
                value={form.signer_title}
                onChange={(e) =>
                  updateField(
                    "signer_title",
                    e.target.value,
                  )
                }
              />
            </label>

            <label className={`${labelClass} sm:col-span-2`}>
              Signer Email
              <input
                required
                readOnly
                type="email"
                className={inputClass}
                value={form.signer_email}
              />

              <span className="mt-2 block text-xs font-normal text-slate-500">
                For security, this must match
                the email address that
                received the onboarding link.
              </span>
            </label>

            <label className={`${labelClass} sm:col-span-2`}>
              Electronic Signature
              <input
                required
                className={`${inputClass} text-lg italic`}
                placeholder="Type your full legal name"
                value={
                  form.electronic_signature
                }
                onChange={(e) =>
                  updateField(
                    "electronic_signature",
                    e.target.value,
                  )
                }
              />

              <span className="mt-2 block text-xs font-normal text-slate-500">
                Type the same full name shown
                in Authorized Signer Name.
              </span>
            </label>
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <input
              required
              type="checkbox"
              className="mt-1 h-4 w-4 accent-slate-950"
              checked={form.consent}
              onChange={(e) =>
                updateField(
                  "consent",
                  e.target.checked,
                )
              }
            />

            <span className="text-sm leading-6 text-slate-700">
              I certify that I am authorized
              to sign for the Carrier. I have
              reviewed and agree to the Slate
              Lane Carrier-Dispatcher
              Agreement. I intend my typed
              name and submission of this form
              to constitute my electronic
              signature.
            </span>
          </label>
        </section>

        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold">
                Ready to complete onboarding?
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Your completed agreement will
                automatically be converted
                into a PDF and stored securely
                in Slate Lane's Document
                Vault.
              </p>
            </div>

            <button
              type="submit"
              disabled={
                submitting || !form.consent
              }
              className="shrink-0 rounded-xl bg-white px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Signing Agreement..."
                : "Agree & Sign Agreement"}
            </button>
          </div>
        </div>

        <p className="pb-6 text-center text-xs leading-5 text-slate-400">
          Secure carrier onboarding provided
          by Slate Lane Dispatch. Do not
          forward your private onboarding
          link.
        </p>
      </form>
    </main>
  );
}