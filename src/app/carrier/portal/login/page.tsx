import type { Metadata } from "next";

import CarrierPortalLoginForm from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Carrier Portal Sign In",
  robots: { index: false, follow: false },
};

export default function CarrierPortalLoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100 sm:py-20">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">
            SlateLane Dispatch
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Carrier Client Portal
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Securely upload your onboarding documents and check their review status.
          </p>
        </div>
        <CarrierPortalLoginForm />
        <p className="mt-6 text-center text-xs leading-5 text-slate-500">
          Access is available only to carrier contacts enabled by SlateLane Dispatch.
          Your documents are stored privately and are not publicly accessible.
        </p>
      </div>
    </main>
  );
}
