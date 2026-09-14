import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type OnboardingRow = {
  onboarding_id: string;
  carrier_id: number | null;
  company_name: string | null;
  dot_number: number | null;
  mc_number: string | null;

  agreement_status: string | null;

  dispatch_agreement_status:
    | string
    | null;

  carrier_packet_status:
    | string
    | null;

  agreement_ready: boolean | null;
  carrier_packet_ready: boolean | null;

  tax_form_ready: boolean | null;
  insurance_ready: boolean | null;
  authority_ready: boolean | null;
  factoring_ready: boolean | null;

  broker_packet_ready: boolean | null;

  missing_documents:
    | string[]
    | null;
};

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "Missing Supabase URL.",
    );
  }

  if (!key) {
    throw new Error(
      "Missing Supabase server key.",
    );
  }

  return createClient(
    url,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function prettyStatus(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return "Not Started";
  }

  return value
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (c) =>
        c.toUpperCase(),
    );
}

function StatusBadge({
  ready,
  status,
}: {
  ready?: boolean | null;
  status?: string | null;
}) {
  if (ready) {
    return (
      <span className="inline-flex rounded-full border border-emerald-800 bg-emerald-950 px-2.5 py-1 text-xs font-semibold text-emerald-300">
        Ready
      </span>
    );
  }

  if (
    status === "sent" ||
    status === "requested"
  ) {
    return (
      <span className="inline-flex rounded-full border border-blue-800 bg-blue-950 px-2.5 py-1 text-xs font-semibold text-blue-300">
        {prettyStatus(status)}
      </span>
    );
  }

  if (
    status === "received"
  ) {
    return (
      <span className="inline-flex rounded-full border border-cyan-800 bg-cyan-950 px-2.5 py-1 text-xs font-semibold text-cyan-300">
        Received
      </span>
    );
  }

  if (
    status === "signed"
  ) {
    return (
      <span className="inline-flex rounded-full border border-emerald-800 bg-emerald-950 px-2.5 py-1 text-xs font-semibold text-emerald-300">
        Signed
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-zinc-400">
      Not Started
    </span>
  );
}

function CoreStatusBadge({
  agreementReady,
  packetReady,
}: {
  agreementReady: boolean;
  packetReady: boolean;
}) {
  if (
    agreementReady &&
    packetReady
  ) {
    return (
      <span className="inline-flex rounded-full border border-emerald-800 bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-300">
        Core Ready
      </span>
    );
  }

  if (
    agreementReady ||
    packetReady
  ) {
    return (
      <span className="inline-flex rounded-full border border-amber-800 bg-amber-950 px-3 py-1 text-xs font-bold text-amber-300">
        In Progress
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-400">
      New
    </span>
  );
}

export default async function OnboardingPage() {
  const supabase =
    getSupabaseAdmin();

  const {
    data,
    error,
  } = await supabase
    .from(
      "carrier_document_vault_status",
    )
    .select("*")
    .order(
      "company_name",
      {
        ascending: true,
      },
    );

  if (error) {
    console.error(
      "ONBOARDING HUB ERROR:",
      error,
    );
  }

  const rows =
    (data ??
      []) as OnboardingRow[];

  const total =
    rows.length;

  const coreReady =
    rows.filter(
      (row) =>
        Boolean(
          row.agreement_ready,
        ) &&
        Boolean(
          row.carrier_packet_ready,
        ),
    ).length;

  const inProgress =
    rows.filter(
      (row) => {
        const agreement =
          Boolean(
            row.agreement_ready,
          );

        const packet =
          Boolean(
            row.carrier_packet_ready,
          );

        return (
          (agreement ||
            packet) &&
          !(
            agreement &&
            packet
          )
        );
      },
    ).length;

  const brokerReady =
    rows.filter(
      (row) =>
        Boolean(
          row.broker_packet_ready,
        ),
    ).length;

  return (
    <div className="min-h-screen">
      <div className="mb-8 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-400">
            SlateLane Operations
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Carrier Onboarding
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Manage agreements,
            credential packets and
            supporting carrier documents
            from one place.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/onboarding/new"
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-500"
          >
            + Start New Onboarding
          </Link>

          <Link
            href="/admin/leads"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            View Leads
          </Link>

          <Link
            href="/admin/carriers"
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-zinc-200"
          >
            View Carriers
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-[#111317] p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Total Onboardings
          </div>

          <div className="mt-3 text-3xl font-bold text-white">
            {total}
          </div>

          <div className="mt-2 text-xs text-zinc-500">
            Carrier onboarding records
          </div>
        </div>

        <div className="rounded-2xl border border-amber-900/60 bg-amber-950/10 p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-400">
            In Progress
          </div>

          <div className="mt-3 text-3xl font-bold text-amber-300">
            {inProgress}
          </div>

          <div className="mt-2 text-xs text-zinc-500">
            Core onboarding incomplete
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-900/60 bg-emerald-950/10 p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
            Core Ready
          </div>

          <div className="mt-3 text-3xl font-bold text-emerald-300">
            {coreReady}
          </div>

          <div className="mt-2 text-xs text-zinc-500">
            Agreement + packet complete
          </div>
        </div>

        <div className="rounded-2xl border border-blue-900/60 bg-blue-950/10 p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-400">
            Broker Ready
          </div>

          <div className="mt-3 text-3xl font-bold text-blue-300">
            {brokerReady}
          </div>

          <div className="mt-2 text-xs text-zinc-500">
            All supporting docs complete
          </div>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-800 bg-[#111317]">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-white">
              Onboarding Pipeline
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Every current carrier
              onboarding record.
            </p>
          </div>
        </div>

        {error ? (
          <div className="p-8">
            <div className="rounded-xl border border-red-900 bg-red-950/20 p-5 text-sm text-red-300">
              Unable to load onboarding
              records. Please refresh and
              try again.
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-lg font-bold text-white">
              No carrier onboardings yet
            </div>

            <p className="mt-2 text-sm text-zinc-500">
              Your first real client will
              appear here when onboarding
              is started.
            </p>

            <Link
              href="/admin/onboarding/new"
              className="mt-6 inline-flex rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-500"
            >
              + Start New Onboarding
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/40 text-left">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Carrier
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Agreement
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Carrier Packet
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Core Status
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Supporting Docs
                  </th>

                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map(
                  (row) => {
                    const agreementReady =
                      Boolean(
                        row.agreement_ready,
                      );

                    const packetReady =
                      Boolean(
                        row.carrier_packet_ready,
                      );

                    const supportReady =
                      [
                        row.tax_form_ready,
                        row.insurance_ready,
                        row.authority_ready,
                        row.factoring_ready,
                      ].filter(Boolean)
                        .length;

                    return (
                      <tr
                        key={
                          row.onboarding_id
                        }
                        className="border-b border-zinc-800/80 transition last:border-b-0 hover:bg-zinc-900/40"
                      >
                        <td className="px-6 py-5">
                          <div className="font-semibold text-white">
                            {row.company_name ||
                              "Unnamed Carrier"}
                          </div>

                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                            {row.dot_number ? (
                              <span>
                                DOT{" "}
                                {
                                  row.dot_number
                                }
                              </span>
                            ) : null}

                            {row.mc_number ? (
                              <span>
                                MC{" "}
                                {
                                  row.mc_number
                                }
                              </span>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <StatusBadge
                            ready={
                              agreementReady
                            }
                            status={
                              row.dispatch_agreement_status ||
                              row.agreement_status
                            }
                          />
                        </td>

                        <td className="px-6 py-5">
                          <StatusBadge
                            ready={
                              packetReady
                            }
                            status={
                              row.carrier_packet_status
                            }
                          />
                        </td>

                        <td className="px-6 py-5">
                          <CoreStatusBadge
                            agreementReady={
                              agreementReady
                            }
                            packetReady={
                              packetReady
                            }
                          />
                        </td>

                        <td className="px-6 py-5">
                          <div className="text-sm font-semibold text-zinc-200">
                            {
                              supportReady
                            }{" "}
                            / 4
                          </div>

                          <div className="mt-1 text-xs text-zinc-500">
                            Tax · COI ·
                            Authority · NOA
                          </div>
                        </td>

                        <td className="px-6 py-5 text-right">
                          <Link
                            href={`/admin/onboarding/${row.onboarding_id}/documents`}
                            className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-zinc-200"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}