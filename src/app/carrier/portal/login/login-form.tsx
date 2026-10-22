"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CarrierPortalLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      try {
        const response = await fetch("/api/carrier/portal/me", {
          cache: "no-store",
        });

        if (response.ok && !cancelled) {
          router.replace("/carrier/portal");
        }
      } catch {
        // The sign-in form remains available if the status check fails.
      }
    }

    void checkExistingSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/carrier/portal/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message || "Could not request a sign-in code."
        );
      }

      setChallengeId(String(result.challenge_id || ""));
      setStep("code");
      setNotice(
        "If this email has active portal access, a one-time code has been sent. Check your inbox and spam folder."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not request a sign-in code."
      );
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/carrier/portal/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          challenge_id: challengeId,
          code,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message || "That code is invalid or expired."
        );
      }

      router.replace("/carrier/portal");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not complete sign-in."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/20 sm:p-8">
      {step === "email" ? (
        <form onSubmit={requestCode} className="space-y-5">
          <div>
            <label htmlFor="portal-email" className="block text-sm font-medium text-slate-200">
              Business email address
            </label>
            <input
              id="portal-email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@yourcarrier.com"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <p className="text-sm leading-6 text-slate-400">
            We will email you a one-time code. No password is needed.
          </p>
          {error ? (
            <p role="alert" className="rounded-xl border border-red-900 bg-red-950/60 p-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending code…" : "Email me a sign-in code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-5">
          <div>
            <p className="text-sm text-slate-400">Code sent to</p>
            <p className="mt-1 break-all text-sm font-semibold text-white">{email}</p>
          </div>
          <div>
            <label htmlFor="portal-code" className="block text-sm font-medium text-slate-200">
              Six-digit sign-in code
            </label>
            <input
              id="portal-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center text-2xl font-semibold tracking-[0.4em] text-white outline-none transition placeholder:text-slate-700 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
            />
            <p className="mt-2 text-xs text-slate-500">The code expires after 10 minutes and can be used only once.</p>
          </div>
          {notice ? (
            <p className="rounded-xl border border-sky-900 bg-sky-950/50 p-3 text-sm text-sky-100">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-xl border border-red-900 bg-red-950/60 p-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading || code.length !== 6 || !challengeId}
            className="w-full rounded-xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Verifying…" : "Sign in securely"}
          </button>
          <div className="flex items-center justify-between gap-3 text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setChallengeId("");
                setNotice("");
                setError("");
              }}
              className="text-slate-400 underline underline-offset-4 hover:text-white"
            >
              Change email
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setStep("email");
                setCode("");
                setChallengeId("");
                setNotice("");
                setError("");
              }}
              className="text-sky-300 underline underline-offset-4 hover:text-sky-200 disabled:opacity-50"
            >
              Request a new code
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
