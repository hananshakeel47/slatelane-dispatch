import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  createServerSupabase,
} from "@/lib/supabase/server";

export const dynamic =
  "force-dynamic";

type SearchParams = {
  lead?: string;
};

type Props = {
  searchParams:
    Promise<SearchParams>;
};

type LeadRow = {
  id: string;

  name:
    | string
    | null;

  company_name:
    | string
    | null;

  email:
    | string
    | null;

  phone:
    | string
    | null;

  carrier_dot_number:
    | number
    | null;

  mc_number:
    | string
    | null;

  status: string;

  source:
    | string
    | null;

  created_at:
    | string
    | null;
};

type ExistingOnboardingRow = {
  id: string;

  lead_id:
    | string
    | null;
};

const ELIGIBLE_STATUSES: string[] = [
  "interested",
  "follow_up",
  "meeting",
  "client",
];

function prettyStatus(
  value:
    string |
    null,
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
      (char) =>
        char.toUpperCase(),
    );
}

function statusClasses(
  status:
    string |
    null,
) {
  switch (status) {
    case "client":
      return "border-emerald-800 bg-emerald-950 text-emerald-300";

    case "interested":
    case "meeting":
      return "border-blue-800 bg-blue-950 text-blue-300";

    case "follow_up":
      return "border-amber-800 bg-amber-950 text-amber-300";

    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
  }
}

function clean(
  value:
    FormDataEntryValue |
    null,

  max = 500,
) {
  return String(
    value ?? "",
  )
    .trim()
    .slice(
      0,
      max,
    );
}

function validEmail(
  value: string,
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

export default async function NewOnboardingPage({
  searchParams,
}: Props) {
  const params =
    await searchParams;

  const selectedLeadId =
    params.lead ??
    "";

  const supabase =
    createServerSupabase();

  /*
  |--------------------------------------------------------------------------
  | LOAD QUALIFIED LEADS
  |--------------------------------------------------------------------------
  */

  const {
    data:
      eligibleLeadsData,

    error:
      leadsError,
  } = await supabase
    .from(
      "leads",
    )
    .select(`
      id,
      name,
      company_name,
      email,
      phone,
      carrier_dot_number,
      mc_number,
      status,
      source,
      created_at
    `)
    .in(
      "status",
      ELIGIBLE_STATUSES,
    )
    .order(
      "created_at",
      {
        ascending:
          false,
      },
    )
    .limit(
      200,
    );

  if (
    leadsError
  ) {
    console.error(
      "START ONBOARDING LEADS ERROR:",
      leadsError,
    );
  }

  const eligibleLeads =
    (
      eligibleLeadsData ??
      []
    ) as LeadRow[];

  /*
  |--------------------------------------------------------------------------
  | EXISTING ONBOARDINGS
  |--------------------------------------------------------------------------
  */

  const {
    data:
      existingOnboardingsData,

    error:
      existingOnboardingsError,
  } = await supabase
    .from(
      "carrier_onboardings",
    )
    .select(`
      id,
      lead_id
    `)
    .not(
      "lead_id",
      "is",
      null,
    );

  if (
    existingOnboardingsError
  ) {
    console.error(
      "EXISTING ONBOARDINGS ERROR:",
      existingOnboardingsError,
    );
  }

  const existingOnboardings =
    (
      existingOnboardingsData ??
      []
    ) as ExistingOnboardingRow[];

  const onboardedLeadIds =
    new Set<string>(
      existingOnboardings
        .map(
          (
            item,
          ) =>
            item.lead_id,
        )
        .filter(
          (
            value,
          ): value is string =>
            Boolean(
              value,
            ),
        ),
    );

  const availableLeads =
    eligibleLeads.filter(
      (
        lead,
      ) =>
        !onboardedLeadIds.has(
          lead.id,
        ),
    );

  /*
  |--------------------------------------------------------------------------
  | LOAD SELECTED LEAD
  |--------------------------------------------------------------------------
  */

  let selectedLead:
    LeadRow |
    null =
      null;

  if (
    selectedLeadId
  ) {
    const {
      data,
      error,
    } = await supabase
      .from(
        "leads",
      )
      .select(`
        id,
        name,
        company_name,
        email,
        phone,
        carrier_dot_number,
        mc_number,
        status,
        source,
        created_at
      `)
      .eq(
        "id",
        selectedLeadId,
      )
      .maybeSingle();

    if (
      error
    ) {
      console.error(
        "SELECTED LEAD ERROR:",
        error,
      );
    }

    selectedLead =
      data
        ? (
            data as LeadRow
          )
        : null;
  }

  /*
  |--------------------------------------------------------------------------
  | START ONBOARDING
  |--------------------------------------------------------------------------
  */

  async function startOnboarding(
    formData:
      FormData,
  ) {
    "use server";

    const db =
      createServerSupabase();

    const leadId =
      clean(
        formData.get(
          "lead_id",
        ),
        100,
      );

    if (
      !leadId
    ) {
      throw new Error(
        "Lead ID is required.",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | RELOAD LEAD SERVER-SIDE
    |--------------------------------------------------------------------------
    */

    const {
      data:
        leadData,

      error:
        leadError,
    } = await db
      .from(
        "leads",
      )
      .select(`
        id,
        name,
        company_name,
        email,
        phone,
        carrier_dot_number,
        mc_number,
        status,
        source,
        created_at
      `)
      .eq(
        "id",
        leadId,
      )
      .maybeSingle();

    if (
      leadError ||
      !leadData
    ) {
      throw new Error(
        leadError?.message ||
          "Lead was not found.",
      );
    }

    const lead =
      leadData as LeadRow;

    /*
    |--------------------------------------------------------------------------
    | CHECK EXISTING ONBOARDING BY LEAD
    |--------------------------------------------------------------------------
    */

    const {
      data:
        existingOnboarding,

      error:
        existingError,
    } = await db
      .from(
        "carrier_onboardings",
      )
      .select(
        "id",
      )
      .eq(
        "lead_id",
        lead.id,
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        },
      )
      .limit(
        1,
      )
      .maybeSingle();

    if (
      existingError
    ) {
      throw new Error(
        existingError.message,
      );
    }

    if (
      existingOnboarding
    ) {
      redirect(
        `/admin/onboarding/${existingOnboarding.id}/documents`,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | READ REVIEW FORM
    |--------------------------------------------------------------------------
    */

    const companyName =
      clean(
        formData.get(
          "company_name",
        ),
        300,
      );

    const contactName =
      clean(
        formData.get(
          "contact_name",
        ),
        200,
      );

    const contactEmail =
      clean(
        formData.get(
          "contact_email",
        ),
        320,
      ).toLowerCase();

    const contactPhone =
      clean(
        formData.get(
          "contact_phone",
        ),
        100,
      );

    const dotRaw =
      clean(
        formData.get(
          "dot_number",
        ),
        30,
      );

    const mcNumber =
      clean(
        formData.get(
          "mc_number",
        ),
        50,
      );

    const dispatchFeeType =
      clean(
        formData.get(
          "dispatch_fee_type",
        ),
        30,
      );

    const dispatchFeeRaw =
      clean(
        formData.get(
          "dispatch_fee_value",
        ),
        30,
      );

    const minimumRateRaw =
      clean(
        formData.get(
          "minimum_rate_per_mile",
        ),
        30,
      );

    /*
    |--------------------------------------------------------------------------
    | VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
      !companyName
    ) {
      throw new Error(
        "Company name is required.",
      );
    }

    if (
      !contactName
    ) {
      throw new Error(
        "Primary contact name is required.",
      );
    }

    if (
      !contactEmail ||
      !validEmail(
        contactEmail,
      )
    ) {
      throw new Error(
        "A valid carrier email is required.",
      );
    }

    const dotDigits =
      dotRaw.replace(
        /\D/g,
        "",
      );

    const dotNumber =
      dotDigits
        ? Number(
            dotDigits,
          )
        : null;

    if (
      !dotNumber ||
      !Number.isSafeInteger(
        dotNumber,
      ) ||
      dotNumber <= 0
    ) {
      throw new Error(
        "A valid USDOT number is required.",
      );
    }

    const allowedFeeTypes =
      [
        "percentage",
        "flat_per_load",
        "weekly_flat",
      ];

    if (
      !allowedFeeTypes.includes(
        dispatchFeeType,
      )
    ) {
      throw new Error(
        "Select a valid dispatch fee type.",
      );
    }

    const dispatchFeeValue =
      Number(
        dispatchFeeRaw,
      );

    if (
      !Number.isFinite(
        dispatchFeeValue,
      ) ||
      dispatchFeeValue <= 0
    ) {
      throw new Error(
        "Dispatch fee must be greater than zero.",
      );
    }

    if (
      dispatchFeeType ===
        "percentage" &&
      dispatchFeeValue > 100
    ) {
      throw new Error(
        "Percentage dispatch fee cannot exceed 100%.",
      );
    }

    let minimumRate:
      number |
      null =
        null;

    if (
      minimumRateRaw
    ) {
      const parsedRate =
        Number(
          minimumRateRaw,
        );

      if (
        !Number.isFinite(
          parsedRate,
        ) ||
        parsedRate < 0
      ) {
        throw new Error(
          "Minimum rate per mile is invalid.",
        );
      }

      minimumRate =
        parsedRate;
    }

    /*
    |--------------------------------------------------------------------------
    | FIND MATCHING FMCSA CARRIER
    |--------------------------------------------------------------------------
    */

    const {
      data:
        carrier,

      error:
        carrierError,
    } = await db
      .from(
        "carriers",
      )
      .select(`
        id,
        dot_number,
        legal_name,
        mc_number
      `)
      .eq(
        "dot_number",
        dotNumber,
      )
      .maybeSingle();

    if (
      carrierError
    ) {
      console.error(
        "ONBOARDING CARRIER LOOKUP ERROR:",
        carrierError,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | CHECK EXISTING ONBOARDING BY CARRIER
    |--------------------------------------------------------------------------
    */

    if (
      carrier?.id
    ) {
      const {
        data:
          carrierOnboarding,

        error:
          carrierOnboardingError,
      } = await db
        .from(
          "carrier_onboardings",
        )
        .select(
          "id",
        )
        .eq(
          "carrier_id",
          carrier.id,
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          },
        )
        .limit(
          1,
        )
        .maybeSingle();

      if (
        carrierOnboardingError
      ) {
        throw new Error(
          carrierOnboardingError.message,
        );
      }

      if (
        carrierOnboarding
      ) {
        const now =
          new Date()
            .toISOString();

        /*
         * Reuse existing onboarding for the same physical carrier.
         */

        const {
          error:
            attachError,
        } = await db
          .from(
            "carrier_onboardings",
          )
          .update({
            lead_id:
              lead.id,

            primary_contact_name:
              contactName,

            primary_contact_email:
              contactEmail,

            primary_contact_phone:
              contactPhone ||
              null,

            dispatch_fee_type:
              dispatchFeeType,

            dispatch_fee_value:
              dispatchFeeValue,

            minimum_rate_per_mile:
              minimumRate,

            updated_at:
              now,
          })
          .eq(
            "id",
            carrierOnboarding.id,
          );

        if (
          attachError
        ) {
          throw new Error(
            attachError.message,
          );
        }

        /*
         * Lead becomes client.
         */

        const {
          error:
            leadClientError,
        } = await db
          .from(
            "leads",
          )
          .update({
            status:
              "client",

            updated_at:
              now,
          })
          .eq(
            "id",
            lead.id,
          );

        if (
          leadClientError
        ) {
          console.error(
            "LEAD CLIENT UPDATE ERROR:",
            leadClientError,
          );
        }

        /*
         * Stop active sales automation.
         */

        const {
          error:
            stopSequenceError,
        } = await db
          .from(
            "email_sequence_enrollments",
          )
          .update({
            status:
              "stopped",

            stopped_at:
              now,

            next_send_at:
              null,

            updated_at:
              now,
          })
          .eq(
            "lead_id",
            lead.id,
          )
          .eq(
            "status",
            "active",
          );

        if (
          stopSequenceError
        ) {
          console.error(
            "SEQUENCE STOP ERROR:",
            stopSequenceError,
          );
        }

        /*
         * Mark carrier as client.
         */

        const {
          error:
            carrierClientError,
        } = await db
          .from(
            "carriers",
          )
          .update({
            client:
              true,

            updated_at:
              now,
          })
          .eq(
            "id",
            carrier.id,
          );

        if (
          carrierClientError
        ) {
          console.error(
            "CARRIER CLIENT UPDATE ERROR:",
            carrierClientError,
          );
        }

        redirect(
          `/admin/onboarding/${carrierOnboarding.id}/documents`,
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | CREATE NEW ONBOARDING
    |--------------------------------------------------------------------------
    */

    const now =
      new Date()
        .toISOString();

    const {
      data:
        onboarding,

      error:
        onboardingError,
    } = await db
      .from(
        "carrier_onboardings",
      )
      .insert({
        lead_id:
          lead.id,

        carrier_id:
          carrier?.id ??
          null,

        company_name:
          companyName,

        dot_number:
          dotNumber,

        mc_number:
          mcNumber ||
          carrier?.mc_number ||
          null,

        primary_contact_name:
          contactName,

        primary_contact_email:
          contactEmail,

        primary_contact_phone:
          contactPhone ||
          null,

        status:
          "draft",

        agreement_status:
          "not_sent",

        dispatch_fee_type:
          dispatchFeeType,

        dispatch_fee_value:
          dispatchFeeValue,

        minimum_rate_per_mile:
          minimumRate,

        updated_at:
          now,
      })
      .select(
        "id",
      )
      .single();

    if (
      onboardingError ||
      !onboarding
    ) {
      throw new Error(
        onboardingError?.message ||
          "Unable to create carrier onboarding.",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | CONVERT LEAD TO CLIENT
    |--------------------------------------------------------------------------
    */

    const {
      error:
        leadUpdateError,
    } = await db
      .from(
        "leads",
      )
      .update({
        status:
          "client",

        updated_at:
          now,
      })
      .eq(
        "id",
        lead.id,
      );

    if (
      leadUpdateError
    ) {
      console.error(
        "CLIENT STATUS UPDATE ERROR:",
        leadUpdateError,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | STOP ACTIVE SALES FOLLOW-UPS
    |--------------------------------------------------------------------------
    */

    const {
      error:
        stopError,
    } = await db
      .from(
        "email_sequence_enrollments",
      )
      .update({
        status:
          "stopped",

        stopped_at:
          now,

        next_send_at:
          null,

        updated_at:
          now,
      })
      .eq(
        "lead_id",
        lead.id,
      )
      .eq(
        "status",
        "active",
      );

    if (
      stopError
    ) {
      console.error(
        "CLIENT SEQUENCE STOP ERROR:",
        stopError,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | MARK CARRIER AS CLIENT
    |--------------------------------------------------------------------------
    */

    if (
      carrier?.id
    ) {
      const {
        error:
          carrierClientError,
      } = await db
        .from(
          "carriers",
        )
        .update({
          client:
            true,

          updated_at:
            now,
        })
        .eq(
          "id",
          carrier.id,
        );

      if (
        carrierClientError
      ) {
        console.error(
          "CARRIER CLIENT UPDATE ERROR:",
          carrierClientError,
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | OPEN DOCUMENT VAULT
    |--------------------------------------------------------------------------
    */

    redirect(
      `/admin/onboarding/${onboarding.id}/documents`,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | SELECTED LEAD REVIEW SCREEN
  |--------------------------------------------------------------------------
  */

  if (
    selectedLeadId
  ) {
    if (
      !selectedLead
    ) {
      return (
        <div className="space-y-6">
          <Link
            href="/admin/onboarding/new"
            className="text-sm text-zinc-400 hover:text-white"
          >
            ← Back
          </Link>

          <div className="rounded-2xl border border-red-900 bg-red-950/20 p-6 text-red-300">
            Lead not found.
          </div>
        </div>
      );
    }

    const existingForLead =
      existingOnboardings.find(
        (
          item,
        ) =>
          item.lead_id ===
          selectedLead.id,
      );

    if (
      existingForLead
    ) {
      return (
        <div className="space-y-6">
          <Link
            href="/admin/onboarding"
            className="text-sm text-zinc-400 hover:text-white"
          >
            ← Back to Onboarding
          </Link>

          <div className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-7">
            <h1 className="text-2xl font-bold text-white">
              Onboarding Already Exists
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              This lead already has an
              onboarding record.
            </p>

            <Link
              href={`/admin/onboarding/${existingForLead.id}/documents`}
              className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-zinc-200"
            >
              Open Document Vault →
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <Link
            href="/admin/onboarding/new"
            className="text-sm text-zinc-500 transition hover:text-white"
          >
            ← Choose another lead
          </Link>

          <div className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-violet-400">
            Production Onboarding
          </div>

          <h1 className="mt-2 text-3xl font-bold text-white">
            Review & Start Onboarding
          </h1>

          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Verify the carrier details and
            lock the commercial terms before
            sending any onboarding document.
          </p>
        </div>

        <form
          action={
            startOnboarding
          }
          className="space-y-6"
        >
          <input
            type="hidden"
            name="lead_id"
            value={
              selectedLead.id
            }
          />

          <section className="rounded-2xl border border-zinc-800 bg-[#111317] p-6">
            <h2 className="text-lg font-bold text-white">
              Carrier Information
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Information is prefilled from
              the SlateLane lead record.
            </p>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="text-sm font-semibold text-zinc-300">
                  Company Name
                </span>

                <input
                  required
                  name="company_name"
                  defaultValue={
                    selectedLead.company_name ??
                    ""
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-500"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-zinc-300">
                  USDOT Number
                </span>

                <input
                  required
                  name="dot_number"
                  inputMode="numeric"
                  defaultValue={
                    selectedLead.carrier_dot_number ??
                    ""
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-500"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-zinc-300">
                  MC Number
                </span>

                <input
                  name="mc_number"
                  defaultValue={
                    selectedLead.mc_number ??
                    ""
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-500"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-[#111317] p-6">
            <h2 className="text-lg font-bold text-white">
              Primary Contact
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-zinc-300">
                  Contact Name
                </span>

                <input
                  required
                  name="contact_name"
                  defaultValue={
                    selectedLead.name ??
                    selectedLead.company_name ??
                    ""
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-500"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-zinc-300">
                  Phone
                </span>

                <input
                  name="contact_phone"
                  defaultValue={
                    selectedLead.phone ??
                    ""
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-500"
                />
              </label>

              <label className="md:col-span-2">
                <span className="text-sm font-semibold text-zinc-300">
                  Email
                </span>

                <input
                  required
                  type="email"
                  name="contact_email"
                  defaultValue={
                    selectedLead.email ??
                    ""
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-500"
                />

                <span className="mt-2 block text-xs text-zinc-500">
                  Secure Agreement and
                  Carrier Packet links will
                  be sent to this address.
                </span>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-violet-900/70 bg-violet-950/10 p-6">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-violet-400">
              Commercial Terms
            </div>

            <h2 className="mt-2 text-lg font-bold text-white">
              Dispatch Fee
            </h2>

            <p className="mt-1 text-sm leading-6 text-zinc-400">
              Set these terms before the
              agreement is sent. The carrier
              will not be able to change
              locked fee terms in the
              Agreement.
            </p>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-zinc-300">
                  Fee Type
                </span>

                <select
                  required
                  name="dispatch_fee_type"
                  defaultValue="percentage"
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-violet-600"
                >
                  <option value="percentage">
                    Percentage of Gross
                  </option>

                  <option value="flat_per_load">
                    Flat Fee Per Load
                  </option>

                  <option value="weekly_flat">
                    Weekly Flat Fee
                  </option>
                </select>
              </label>

              <label>
                <span className="text-sm font-semibold text-zinc-300">
                  Fee Value
                </span>

                <input
                  required
                  name="dispatch_fee_value"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Example: 8"
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-violet-600"
                />

                <span className="mt-2 block text-xs text-zinc-500">
                  Example: enter 8 for an
                  8% dispatch fee.
                </span>
              </label>

              <label className="md:col-span-2">
                <span className="text-sm font-semibold text-zinc-300">
                  Minimum Rate Per Mile

                  <span className="ml-2 font-normal text-zinc-600">
                    Optional
                  </span>
                </span>

                <input
                  name="minimum_rate_per_mile"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Example: 2.50"
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-violet-600"
                />
              </label>
            </div>
          </section>

          <div className="rounded-2xl border border-amber-900/60 bg-amber-950/10 p-5">
            <div className="font-semibold text-amber-300">
              What happens when you continue?
            </div>

            <div className="mt-2 text-sm leading-6 text-zinc-400">
              SlateLane will create or reuse
              the carrier onboarding record,
              mark the lead as a client,
              immediately stop active sales
              follow-ups, save your commercial
              terms, and open the carrier's
              Document Vault.
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Link
              href="/admin/onboarding"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Cancel
            </Link>

            <button
              type="submit"
              className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-zinc-200"
            >
              Start Onboarding →
            </button>
          </div>
        </form>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | LEAD SELECTION
  |--------------------------------------------------------------------------
  */

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/onboarding"
          className="text-sm text-zinc-500 transition hover:text-white"
        >
          ← Back to Onboarding
        </Link>

        <div className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-violet-400">
          Production Onboarding
        </div>

        <h1 className="mt-2 text-3xl font-bold text-white">
          Start New Onboarding
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Select a qualified prospect.
          SlateLane will then let you review
          the carrier information and set
          commercial terms before the carrier
          becomes an onboarding client.
        </p>
      </div>

      {leadsError ? (
        <div className="rounded-2xl border border-red-900 bg-red-950/20 p-6 text-sm text-red-300">
          Unable to load eligible leads.
          Please refresh and try again.
        </div>
      ) : availableLeads.length ===
        0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-[#111317] p-10 text-center">
          <h2 className="text-xl font-bold text-white">
            No qualified leads waiting
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">
            A prospect must have the status
            Interested, Follow Up, Meeting or
            Client before starting
            onboarding.
          </p>

          <Link
            href="/admin/leads"
            className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-zinc-200"
          >
            Open Leads
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#111317]">
          <div className="border-b border-zinc-800 px-6 py-5">
            <h2 className="text-lg font-bold text-white">
              Qualified Leads
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              {
                availableLeads.length
              }{" "}
              lead
              {availableLeads.length ===
              1
                ? ""
                : "s"}{" "}
              ready for onboarding review.
            </p>
          </div>

          <div className="divide-y divide-zinc-800">
            {availableLeads.map(
              (
                lead,
              ) => (
                <div
                  key={
                    lead.id
                  }
                  className="flex flex-col gap-5 px-6 py-5 transition hover:bg-zinc-900/40 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="font-semibold text-white">
                        {lead.company_name ??
                          lead.name ??
                          lead.email ??
                          "Unnamed Lead"}
                      </div>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                          lead.status,
                        )}`}
                      >
                        {prettyStatus(
                          lead.status,
                        )}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                      {lead.email ? (
                        <span>
                          {
                            lead.email
                          }
                        </span>
                      ) : null}

                      {lead.carrier_dot_number ? (
                        <span>
                          DOT{" "}
                          {
                            lead.carrier_dot_number
                          }
                        </span>
                      ) : null}

                      {lead.mc_number ? (
                        <span>
                          MC{" "}
                          {
                            lead.mc_number
                          }
                        </span>
                      ) : null}

                      {lead.phone ? (
                        <span>
                          {
                            lead.phone
                          }
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <Link
                    href={`/admin/onboarding/new?lead=${encodeURIComponent(
                      lead.id,
                    )}`}
                    className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:bg-zinc-200"
                  >
                    Review & Start
                  </Link>
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}