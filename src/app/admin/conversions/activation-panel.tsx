import Link from "next/link";

import {
  createServerSupabase,
} from "@/lib/supabase/server";

import {
  activateCarrierAction,
} from "./actions";


type OnboardingRow = {
  id:
    string;

  lead_id:
    string |
    null;

  carrier_id:
    number |
    null;

  company_name:
    string;

  dot_number:
    number |
    null;

  mc_number:
    string |
    null;

  status:
    string;

  agreement_status:
    string;

  activated_at:
    string |
    null;

  created_at:
    string;
};


type VaultRow = {
  onboarding_id:
    string;

  document_count:
    number |
    null;

  agreement_ready:
    boolean |
    null;

  carrier_packet_ready:
    boolean |
    null;

  tax_form_ready:
    boolean |
    null;

  insurance_ready:
    boolean |
    null;

  authority_ready:
    boolean |
    null;

  factoring_ready:
    boolean |
    null;

  missing_documents:
    string[] |
    null;

  broker_packet_ready:
    boolean |
    null;
};


function prettyStatus(
  value:
    string |
    null |
    undefined,
) {
  if (!value) {
    return "Unknown";
  }


  return value
    .replace(
      /_/g,
      " ",
    )
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character.toUpperCase(),
    );
}


export default async function ActivationPanel() {
  const supabase =
    createServerSupabase();


  const {
    data:
      onboardingData,

    error:
      onboardingError,
  } =
    await supabase
      .from(
        "carrier_onboardings",
      )
      .select(`
        id,
        lead_id,
        carrier_id,
        company_name,
        dot_number,
        mc_number,
        status,
        agreement_status,
        activated_at,
        created_at
      `)
      .in(
        "status",
        [
          "draft",
          "paperwork_pending",
          "load_board_pending",
          "ready",
          "active",
        ],
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        },
      )
      .limit(
        50,
      );


  if (
    onboardingError
  ) {
    console.error(
      "ACTIVATION PANEL ONBOARDING ERROR:",
      onboardingError.message,
    );
  }


  const onboardings =
    (
      onboardingData ??
      []
    ) as OnboardingRow[];


  const onboardingIds =
    onboardings.map(
      (
        onboarding,
      ) =>
        onboarding.id,
    );


  const vaultMap =
    new Map<
      string,
      VaultRow
    >();


  if (
    onboardingIds.length >
    0
  ) {
    const {
      data:
        vaultData,

      error:
        vaultError,
    } =
      await supabase
        .from(
          "carrier_document_vault_status",
        )
        .select(`
          onboarding_id,
          document_count,
          agreement_ready,
          carrier_packet_ready,
          tax_form_ready,
          insurance_ready,
          authority_ready,
          factoring_ready,
          missing_documents,
          broker_packet_ready
        `)
        .in(
          "onboarding_id",
          onboardingIds,
        );


    if (
      vaultError
    ) {
      console.error(
        "ACTIVATION PANEL VAULT ERROR:",
        vaultError.message,
      );
    }


    for (
      const row
      of (
        vaultData ??
        []
      ) as VaultRow[]
    ) {
      vaultMap.set(
        row.onboarding_id,
        row,
      );
    }
  }


  const readyToActivate =
    onboardings.filter(
      (
        onboarding,
      ) => {
        const vault =
          vaultMap.get(
            onboarding.id,
          );


        return (
          onboarding.status !==
            "active" &&
          onboarding.agreement_status ===
            "signed" &&
          vault?.broker_packet_ready ===
            true
        );
      },
    );


  const activeCarriers =
    onboardings.filter(
      (
        onboarding,
      ) =>
        onboarding.status ===
        "active",
    );


  const incomplete =
    onboardings.filter(
      (
        onboarding,
      ) => {
        const vault =
          vaultMap.get(
            onboarding.id,
          );


        return (
          onboarding.status !==
            "active" &&
          !(
            onboarding.agreement_status ===
              "signed" &&
            vault?.broker_packet_ready ===
              true
          )
        );
      },
    );


  return (
    <section className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-[linear-gradient(135deg,rgba(15,22,25,.96),rgba(8,12,17,.97))]">

      {/* HEADER */}

      <div className="flex flex-col gap-4 border-b border-white/[0.055] px-5 py-5 lg:flex-row lg:items-center lg:justify-between">

        <div>

          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
            Phase 3D-C · Client Activation
          </div>

          <h2 className="mt-2 text-[17px] font-semibold text-white">
            Client → Active Carrier Handoff
          </h2>

          <p className="mt-1 max-w-2xl text-[9px] leading-4 text-zinc-600">
            Final production gate between sales/onboarding
            and active dispatch operations.
          </p>

        </div>


        <div className="flex flex-wrap gap-2">

          <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.045] px-4 py-2">

            <div className="text-[7px] uppercase tracking-[0.1em] text-emerald-500">
              Ready
            </div>

            <div className="mt-1 text-[17px] font-semibold text-white">
              {readyToActivate.length}
            </div>

          </div>


          <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.045] px-4 py-2">

            <div className="text-[7px] uppercase tracking-[0.1em] text-violet-500">
              Active
            </div>

            <div className="mt-1 text-[17px] font-semibold text-white">
              {activeCarriers.length}
            </div>

          </div>


          <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.035] px-4 py-2">

            <div className="text-[7px] uppercase tracking-[0.1em] text-amber-500">
              Incomplete
            </div>

            <div className="mt-1 text-[17px] font-semibold text-white">
              {incomplete.length}
            </div>

          </div>

        </div>

      </div>


      {/* READY */}

      <div className="p-5">

        <div className="mb-3 flex items-center justify-between gap-3">

          <div>

            <div className="text-[9px] font-semibold text-zinc-300">
              Ready to Activate
            </div>

            <div className="mt-1 text-[8px] text-zinc-700">
              Signed agreement + Broker Packet Ready are required.
            </div>

          </div>

        </div>


        {readyToActivate.length >
        0 ? (
          <div className="grid gap-3 lg:grid-cols-2">

            {readyToActivate.map(
              (
                onboarding,
              ) => {
                const vault =
                  vaultMap.get(
                    onboarding.id,
                  );


                return (
                  <div
                    key={
                      onboarding.id
                    }
                    className="rounded-[16px] border border-emerald-500/15 bg-emerald-500/[0.025] p-4"
                  >

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-2">

                          <div className="truncate text-[11px] font-semibold text-zinc-200">
                            {onboarding.company_name}
                          </div>

                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2 py-0.5 text-[7px] font-semibold text-emerald-300">
                            Broker Packet Ready
                          </span>

                        </div>


                        <div className="mt-2 text-[8px] text-zinc-600">
                          {onboarding.dot_number
                            ? `USDOT ${onboarding.dot_number}`
                            : "No USDOT"}

                          {onboarding.mc_number
                            ? ` • MC ${onboarding.mc_number}`
                            : ""}
                        </div>


                        <div className="mt-3 flex flex-wrap gap-2">

                          <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[7px] text-zinc-500">
                            Agreement Signed
                          </span>

                          <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[7px] text-zinc-500">
                            {vault?.document_count ??
                              0} documents
                          </span>

                        </div>

                      </div>


                      <div className="flex shrink-0 flex-wrap gap-2">

                        <Link
                          href={`/admin/onboarding/${onboarding.id}/documents`}
                          className="inline-flex h-8 items-center rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 text-[8px] font-semibold text-zinc-400 hover:bg-white/[0.05]"
                        >
                          Review Vault
                        </Link>


                        <form
                          action={
                            activateCarrierAction
                          }
                        >

                          <input
                            type="hidden"
                            name="onboardingId"
                            value={
                              onboarding.id
                            }
                          />


                          <button
                            type="submit"
                            className="inline-flex h-8 items-center rounded-lg bg-emerald-400 px-3 text-[8px] font-bold text-black hover:bg-emerald-300"
                          >
                            Activate Carrier →
                          </button>

                        </form>

                      </div>

                    </div>

                  </div>
                );
              },
            )}

          </div>
        ) : (
          <div className="rounded-[15px] border border-white/[0.055] bg-black/15 p-5">

            <div className="text-[10px] font-semibold text-zinc-400">
              No carrier is ready for activation yet.
            </div>

            <div className="mt-1 text-[8px] leading-4 text-zinc-700">
              A carrier will appear here automatically after
              the agreement is signed and its Broker Packet
              becomes ready.
            </div>

          </div>
        )}

      </div>


      {/* ACTIVE CLIENTS */}

      {activeCarriers.length >
      0 ? (
        <div className="border-t border-white/[0.05] px-5 py-5">

          <div className="mb-3 text-[9px] font-semibold text-zinc-300">
            Active Carriers
          </div>


          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">

            {activeCarriers.map(
              (
                onboarding,
              ) => (
                <div
                  key={
                    onboarding.id
                  }
                  className="rounded-xl border border-violet-500/12 bg-violet-500/[0.025] p-4"
                >

                  <div className="flex items-start justify-between gap-3">

                    <div className="min-w-0">

                      <div className="truncate text-[10px] font-semibold text-zinc-300">
                        {onboarding.company_name}
                      </div>

                      <div className="mt-1 text-[8px] text-zinc-700">
                        {onboarding.dot_number
                          ? `USDOT ${onboarding.dot_number}`
                          : "No USDOT"}
                      </div>

                    </div>


                    <span className="rounded-full border border-violet-500/20 bg-violet-500/[0.07] px-2 py-0.5 text-[7px] font-semibold text-violet-300">
                      ACTIVE
                    </span>

                  </div>


                  <div className="mt-3 flex flex-wrap gap-2">

                    {onboarding.lead_id ? (
                      <Link
                        href={`/admin/leads/${onboarding.lead_id}`}
                        className="text-[8px] font-medium text-blue-400 hover:text-blue-300"
                      >
                        Lead 360 →
                      </Link>
                    ) : null}


                    {onboarding.dot_number ? (
                      <Link
                        href={`/admin/carriers/${onboarding.dot_number}`}
                        className="text-[8px] font-medium text-emerald-400 hover:text-emerald-300"
                      >
                        Carrier 360 →
                      </Link>
                    ) : null}


                    <Link
                      href={`/admin/onboarding/${onboarding.id}/documents`}
                      className="text-[8px] font-medium text-violet-400 hover:text-violet-300"
                    >
                      Vault →
                    </Link>

                  </div>

                </div>
              ),
            )}

          </div>

        </div>
      ) : null}


      {/* INCOMPLETE */}

      {incomplete.length >
      0 ? (
        <div className="border-t border-white/[0.05] px-5 py-5">

          <div className="mb-3">

            <div className="text-[9px] font-semibold text-zinc-400">
              Activation Blocked
            </div>

            <div className="mt-1 text-[8px] text-zinc-700">
              These clients still have onboarding requirements to complete.
            </div>

          </div>


          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">

            {incomplete.map(
              (
                onboarding,
              ) => {
                const vault =
                  vaultMap.get(
                    onboarding.id,
                  );


                const missing =
                  Array.isArray(
                    vault?.missing_documents,
                  )
                    ? vault?.missing_documents
                    : [];


                return (
                  <Link
                    href={`/admin/onboarding/${onboarding.id}/documents`}
                    key={
                      onboarding.id
                    }
                    className="rounded-xl border border-white/[0.055] bg-black/15 p-4 transition hover:border-amber-500/15 hover:bg-amber-500/[0.025]"
                  >

                    <div className="flex items-start justify-between gap-3">

                      <div className="min-w-0">

                        <div className="truncate text-[10px] font-semibold text-zinc-300">
                          {onboarding.company_name}
                        </div>

                        <div className="mt-1 text-[8px] text-zinc-700">
                          {prettyStatus(
                            onboarding.status,
                          )}
                        </div>

                      </div>


                      <span className="rounded-full border border-amber-500/15 bg-amber-500/[0.05] px-2 py-0.5 text-[7px] font-semibold text-amber-300">
                        Incomplete
                      </span>

                    </div>


                    <div className="mt-3 text-[8px] leading-4 text-zinc-600">

                      {onboarding.agreement_status !==
                      "signed"
                        ? "Dispatch agreement still requires signature."
                        : missing.length >
                            0
                          ? `${missing.length} Document Vault requirement${
                              missing.length ===
                              1
                                ? ""
                                : "s"
                            } remaining.`
                          : "Broker Packet is not ready yet."}

                    </div>


                    <div className="mt-3 text-[8px] font-medium text-amber-400">
                      Complete onboarding →
                    </div>

                  </Link>
                );
              },
            )}

          </div>

        </div>
      ) : null}

    </section>
  );
}