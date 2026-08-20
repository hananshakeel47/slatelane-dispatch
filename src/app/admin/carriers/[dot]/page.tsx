import Link from "next/link";

import {
  notFound,
  redirect,
} from "next/navigation";

import {
  revalidatePath,
} from "next/cache";

import {
  createServerSupabase,
} from "@/lib/supabase/server";

import {
  enrichCarrierAuthority,
} from "@/lib/fmcsa/motus";


type Props = {
  params: Promise<{
    dot: string;
  }>;
};


function show(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return String(value);
}


function scoreClasses(score: number) {
  if (score >= 80) {
    return "border-emerald-700 bg-emerald-950 text-emerald-300";
  }

  if (score >= 60) {
    return "border-amber-700 bg-amber-950 text-amber-300";
  }

  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}


function formatPhone(
  phone: string | null
) {
  if (!phone) {
    return "—";
  }

  const digits =
    phone.replace(/\D/g, "");

  if (digits.length === 10) {
    return `(${digits.slice(
      0,
      3
    )}) ${digits.slice(
      3,
      6
    )}-${digits.slice(6)}`;
  }

  return phone;
}


export default async function CarrierDetailPage({
  params,
}: Props) {
  const { dot } =
    await params;

  const dotNumber =
    Number(dot);

  if (
    !Number.isFinite(dotNumber) ||
    dotNumber <= 0
  ) {
    notFound();
  }


  const supabase =
    createServerSupabase();


  // ==========================================================
  // LOAD CARRIER
  // ==========================================================

  const {
    data: carrier,
    error,
  } = await supabase
    .from("carriers")
    .select(`
      id,
      dot_number,

      mc_number,
      mx_number,
      ff_number,

      legal_name,
      dba_name,
      owner_name,

      phone,
      cell_phone,
      email,
      website,

      street,
      city,
      state,
      zip,
      county,

      status_code,
      entity_type,
      classification,
      carrier_operation,
      business_type,

      power_units,
      truck_units,
      bus_units,
      drivers,
      total_cdl,

      safety_rating,
      safety_rating_date,
      review_date,

      hazmat,
      cargo,

      add_date,
      mcs150_date,

      authority_date,
      authority_age,
      authority_age_days,
      authority_docket,
      authority_type,
      authority_status,
      authority_reason,
      authority_enriched_at,

      lead_score,
      dispatcher_probability,

      contacted,
      meeting_booked,
      client,
      notes,

      last_fmcsa_sync,
      created_at,
      updated_at
    `)
    .eq(
      "dot_number",
      dotNumber
    )
    .maybeSingle();


  if (error) {
    return (
      <div className="space-y-6">

        <Link
          href="/admin/carriers"
          className="text-zinc-400 hover:text-white"
        >
          ← Back to carriers
        </Link>

        <div className="rounded-xl border border-red-800 bg-red-950/40 p-6">

          <h1 className="text-xl font-bold text-red-300">
            Carrier database error
          </h1>

          <p className="mt-3 font-mono text-sm text-red-200">
            {error.message}
          </p>

        </div>

      </div>
    );
  }


  if (!carrier) {
    notFound();
  }

  /*
   * Snapshot the non-null carrier fields used by the Server Action.
   * TypeScript does not preserve the `carrier` null-narrowing inside
   * a nested async Server Action closure.
   */
  const carrierForLead = {
    owner_name: carrier.owner_name,
    legal_name: carrier.legal_name,
    email: carrier.email,
    phone: carrier.phone,
    dot_number: carrier.dot_number,
    mc_number: carrier.mc_number,
  };


  // ==========================================================
  // CHECK EXISTING LEAD
  // ==========================================================

  const {
    data: existingLead,
    error: leadCheckError,
  } = await supabase
    .from("leads")
    .select(
      "id, status"
    )
    .eq(
      "carrier_dot_number",
      dotNumber
    )
    .maybeSingle();


  if (leadCheckError) {
    console.error(
      "Lead check failed:",
      leadCheckError.message
    );
  }


  // ==========================================================
  // SERVER ACTION
  // ADD CARRIER → LEADS → AUTOMATIC MOTUS
  // ==========================================================

  async function addToLeads() {
    "use server";

    const db =
      createServerSupabase();


    // --------------------------------------------------------
    // DUPLICATE CHECK
    // --------------------------------------------------------

    const {
      data: existing,
      error: existingError,
    } = await db
      .from("leads")
      .select("id")
      .eq(
        "carrier_dot_number",
        dotNumber
      )
      .maybeSingle();


    if (existingError) {
      throw new Error(
        `Could not check lead: ${existingError.message}`
      );
    }


    // --------------------------------------------------------
    // CREATE LEAD ONLY IF IT DOES NOT EXIST
    // --------------------------------------------------------

    if (!existing) {

      const {
        error: insertError,
      } = await db
        .from("leads")
        .insert({

          name:
            carrierForLead.owner_name ||
            carrierForLead.legal_name,

          company_name:
            carrierForLead.legal_name,

          email:
            carrierForLead.email,

          phone:
            carrierForLead.phone,

          message:
            "FMCSA carrier prospect added from SlateLane CRM.",

          carrier_dot_number:
            carrierForLead.dot_number,

          mc_number:
            carrierForLead.mc_number,

          source:
            "fmcsa",

          status:
            "new",

          notes:
            null,

          updated_at:
            new Date()
              .toISOString(),
        });


      if (
        insertError &&
        insertError.code !==
          "23505"
      ) {
        throw new Error(
          `Could not add carrier to leads: ${insertError.message}`
        );
      }
    }


    // --------------------------------------------------------
    // AUTOMATIC MOTUS ENRICHMENT
    //
    // MOTUS failure must NOT prevent
    // the carrier from becoming a lead.
    // --------------------------------------------------------

    try {

      console.log(
        `Starting automatic MOTUS enrichment for USDOT ${dotNumber}`
      );

      const authority =
        await enrichCarrierAuthority(
          dotNumber
        );

      console.log(
        `MOTUS enrichment successful for USDOT ${dotNumber}`,
        authority
      );

    } catch (
      motusError
    ) {

      console.error(
        `MOTUS enrichment failed for USDOT ${dotNumber}:`,
        motusError
      );

      /*
       * Intentionally continue.
       *
       * Carrier remains a valid lead.
       * Authority can be retried later.
       */
    }


    revalidatePath(
      "/admin/leads"
    );

    revalidatePath(
      "/admin/carriers"
    );

    revalidatePath(
      `/admin/carriers/${dotNumber}`
    );


    redirect(
      `/admin/leads?carrier=${dotNumber}`
    );
  }


  // ==========================================================
  // DISPLAY VALUES
  // ==========================================================

  const score =
    carrier.lead_score ??
    0;


  const cargo: string[] =
    Array.isArray(
      carrier.cargo
    )
      ? carrier.cargo
      : [];


  return (
    <div className="space-y-8">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div>

        <Link
          href="/admin/carriers"
          className="text-sm text-zinc-400 transition hover:text-white"
        >
          ← Back to carriers
        </Link>


        <div className="mt-5 flex flex-wrap items-start justify-between gap-6">

          <div>

            <div className="flex flex-wrap items-center gap-3">

              <h1 className="text-4xl font-bold">
                {carrier.legal_name}
              </h1>


              <span
                className={`rounded-lg border px-3 py-1.5 text-lg font-bold ${scoreClasses(
                  score
                )}`}
              >
                {score}
              </span>

            </div>


            {carrier.dba_name && (

              <p className="mt-2 text-lg text-zinc-400">
                DBA:{" "}
                {carrier.dba_name}
              </p>

            )}


            <div className="mt-4 flex flex-wrap gap-2">

              {carrier.status_code ===
              "A" ? (

                <span className="rounded-full border border-emerald-800 bg-emerald-950 px-3 py-1 text-sm text-emerald-300">
                  Active
                </span>

              ) : (

                <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm">
                  Status:{" "}
                  {show(
                    carrier.status_code
                  )}
                </span>

              )}


              <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm">
                USDOT{" "}
                {carrier.dot_number}
              </span>


              {carrier.mc_number && (

                <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm">
                  {carrier.mc_number}
                </span>

              )}

            </div>

          </div>


          {/* ADD TO LEADS */}

          <div>

            {existingLead ? (

              <div className="space-y-2 text-right">

                <Link
                  href={`/admin/leads?carrier=${dotNumber}`}
                  className="inline-flex rounded-xl border border-emerald-700 bg-emerald-950 px-6 py-3 font-semibold text-emerald-300 transition hover:bg-emerald-900"
                >
                  ✓ Already in Leads
                </Link>

                <div className="text-xs text-zinc-500">
                  Status:{" "}
                  {existingLead.status ??
                    "new"}
                </div>

              </div>

            ) : (

              <form
                action={
                  addToLeads
                }
              >

                <button
                  type="submit"
                  className="rounded-xl bg-white px-7 py-3 font-semibold text-black transition hover:bg-zinc-200"
                >
                  + Add to Leads
                </button>

              </form>

            )}

          </div>

        </div>

      </div>


      {/* =====================================================
          QUICK STATS
      ====================================================== */}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        <StatCard
          label="Power Units"
          value={
            carrier.power_units ??
            0
          }
        />

        <StatCard
          label="Drivers"
          value={
            carrier.drivers ??
            0
          }
        />

        <StatCard
          label="Lead Score"
          value={
            `${score}/100`
          }
        />

        <StatCard
          label="Safety Rating"
          value={
            carrier.safety_rating ??
            "Not Rated"
          }
        />

      </div>


      {/* =====================================================
          CONTACT
      ====================================================== */}

      <Section title="Contact Information">

        <InfoGrid>

          <Info
            label="Phone"
            value={
              carrier.phone ? (

                <a
                  href={`tel:${carrier.phone}`}
                  className="text-blue-400 hover:underline"
                >
                  {formatPhone(
                    carrier.phone
                  )}
                </a>

              ) : (
                "—"
              )
            }
          />


          <Info
            label="Cell Phone"
            value={
              carrier.cell_phone ? (

                <a
                  href={`tel:${carrier.cell_phone}`}
                  className="text-blue-400 hover:underline"
                >
                  {formatPhone(
                    carrier.cell_phone
                  )}
                </a>

              ) : (
                "—"
              )
            }
          />


          <Info
            label="Email"
            value={
              carrier.email ? (

                <a
                  href={`mailto:${carrier.email}`}
                  className="break-all text-blue-400 hover:underline"
                >
                  {carrier.email}
                </a>

              ) : (
                "—"
              )
            }
          />


          <Info
            label="Website"
            value={
              show(
                carrier.website
              )
            }
          />


          <Info
            label="Owner / Contact"
            value={
              show(
                carrier.owner_name
              )
            }
          />

        </InfoGrid>

      </Section>


      {/* =====================================================
          FMCSA IDENTIFICATION
      ====================================================== */}

      <Section title="FMCSA Identification">

        <InfoGrid>

          <Info
            label="USDOT"
            value={
              carrier.dot_number
            }
          />

          <Info
            label="MC"
            value={
              show(
                carrier.mc_number
              )
            }
          />

          <Info
            label="MX"
            value={
              show(
                carrier.mx_number
              )
            }
          />

          <Info
            label="FF"
            value={
              show(
                carrier.ff_number
              )
            }
          />

          <Info
            label="Entity Type"
            value={
              show(
                carrier.entity_type
              )
            }
          />

          <Info
            label="Classification"
            value={
              show(
                carrier.classification
              )
            }
          />

          <Info
            label="Carrier Operation"
            value={
              show(
                carrier.carrier_operation
              )
            }
          />

          <Info
            label="Business Type"
            value={
              show(
                carrier.business_type
              )
            }
          />

        </InfoGrid>

      </Section>


      {/* =====================================================
          ADDRESS
      ====================================================== */}

      <Section title="Physical Address">

        <InfoGrid>

          <Info
            label="Street"
            value={
              show(
                carrier.street
              )
            }
          />

          <Info
            label="City"
            value={
              show(
                carrier.city
              )
            }
          />

          <Info
            label="State"
            value={
              show(
                carrier.state
              )
            }
          />

          <Info
            label="ZIP"
            value={
              show(
                carrier.zip
              )
            }
          />

          <Info
            label="County"
            value={
              show(
                carrier.county
              )
            }
          />

        </InfoGrid>

      </Section>


      {/* =====================================================
          FLEET
      ====================================================== */}

      <Section title="Fleet & Drivers">

        <InfoGrid>

          <Info
            label="Power Units"
            value={
              carrier.power_units ??
              0
            }
          />

          <Info
            label="Truck Units"
            value={
              carrier.truck_units ??
              0
            }
          />

          <Info
            label="Bus Units"
            value={
              carrier.bus_units ??
              0
            }
          />

          <Info
            label="Drivers"
            value={
              carrier.drivers ??
              0
            }
          />

          <Info
            label="CDL Drivers"
            value={
              carrier.total_cdl ??
              0
            }
          />

          <Info
            label="Hazmat"
            value={
              carrier.hazmat
                ? "Yes"
                : "No"
            }
          />

        </InfoGrid>

      </Section>


      {/* =====================================================
          CARGO
      ====================================================== */}

      <Section title="Cargo">

        {cargo.length > 0 ? (

          <div className="flex flex-wrap gap-2">

            {cargo.map(
              (
                item,
                index
              ) => (

                <span
                  key={`${item}-${index}`}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm capitalize"
                >
                  {String(item)
                    .replace(
                      /^other:/,
                      "Other: "
                    )
                    .replace(
                      /_/g,
                      " "
                    )}
                </span>

              )
            )}

          </div>

        ) : (

          <p className="text-zinc-500">
            No cargo information available.
          </p>

        )}

      </Section>


      {/* =====================================================
          SAFETY
      ====================================================== */}

      <Section title="Safety & FMCSA Activity">

        <InfoGrid>

          <Info
            label="Safety Rating"
            value={
              show(
                carrier.safety_rating
              )
            }
          />

          <Info
            label="Safety Rating Date"
            value={
              show(
                carrier.safety_rating_date
              )
            }
          />

          <Info
            label="Review Date"
            value={
              show(
                carrier.review_date
              )
            }
          />

          <Info
            label="MCS-150 Date"
            value={
              show(
                carrier.mcs150_date
              )
            }
          />

          <Info
            label="FMCSA Add Date"
            value={
              show(
                carrier.add_date
              )
            }
          />

          <Info
            label="Last FMCSA Sync"
            value={
              carrier.last_fmcsa_sync
                ? new Date(
                    carrier.last_fmcsa_sync
                  ).toLocaleString()
                : "—"
            }
          />

        </InfoGrid>

      </Section>


      {/* =====================================================
          MOTUS AUTHORITY
      ====================================================== */}

      <Section title="Operating Authority">

        <InfoGrid>

          <Info
            label="Authority Docket"
            value={
              show(
                carrier.authority_docket
              )
            }
          />


          <Info
            label="Authority Type"
            value={
              show(
                carrier.authority_type
              )
            }
          />


          <Info
            label="Authority Status"
            value={
              show(
                carrier.authority_status
              )
            }
          />


          <Info
            label="Authority Date"
            value={
              show(
                carrier.authority_date
              )
            }
          />


          <Info
            label="Authority Age"
            value={
              carrier.authority_age !==
                null &&
              carrier.authority_age !==
                undefined
                ? `${carrier.authority_age} years`
                : "—"
            }
          />


          <Info
            label="Authority Age Days"
            value={
              carrier.authority_age_days !==
                null &&
              carrier.authority_age_days !==
                undefined
                ? `${carrier.authority_age_days.toLocaleString()} days`
                : "—"
            }
          />


          <Info
            label="Authority Reason"
            value={
              show(
                carrier.authority_reason
              )
            }
          />


          <Info
            label="MOTUS Enriched"
            value={
              carrier.authority_enriched_at
                ? new Date(
                    carrier.authority_enriched_at
                  ).toLocaleString()
                : "Not yet"
            }
          />

        </InfoGrid>

      </Section>


      {/* =====================================================
          CRM
      ====================================================== */}

      <Section title="CRM Status">

        <InfoGrid>

          <Info
            label="Lead"
            value={
              existingLead
                ? "Yes"
                : "No"
            }
          />

          <Info
            label="Lead Status"
            value={
              existingLead
                ?.status ??
              "—"
            }
          />

          <Info
            label="Contacted"
            value={
              carrier.contacted
                ? "Yes"
                : "No"
            }
          />

          <Info
            label="Meeting Booked"
            value={
              carrier.meeting_booked
                ? "Yes"
                : "No"
            }
          />

          <Info
            label="Client"
            value={
              carrier.client
                ? "Yes"
                : "No"
            }
          />

        </InfoGrid>

      </Section>

    </div>
  );
}


// ============================================================
// UI COMPONENTS
// ============================================================

function Section({
  title,
  children,
}: {
  title: string;
  children:
    React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">

      <h2 className="mb-6 text-xl font-semibold">
        {title}
      </h2>

      {children}

    </section>
  );
}


function InfoGrid({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
      {children}
    </div>
  );
}


function Info({
  label,
  value,
}: {
  label: string;
  value:
    React.ReactNode;
}) {
  return (
    <div>

      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>

      <div className="mt-1.5 text-sm font-medium text-zinc-200">
        {value}
      </div>

    </div>
  );
}


function StatCard({
  label,
  value,
}: {
  label: string;
  value:
    React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-bold">
        {value}
      </div>

    </div>
  );
}