"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  CARRIER_PACKET_VERSION,
  CarrierPacketFormData,
} from "@/lib/onboarding/carrier-packet";

type LoadResponse = {
  ok: boolean;

  completed?: boolean;

  error?: string;

  company_name?: string;

  completed_at?: string;

  expires_at?: string;

  recipient_email?: string;

  packet_version?: string;

  prefill?: Partial<CarrierPacketFormData>;
};

const EMPTY_FORM: CarrierPacketFormData =
  {
    company_name:
      "",

    dot_number:
      "",

    mc_number:
      "",

    primary_contact_name:
      "",

    primary_contact_email:
      "",

    primary_contact_phone:
      "",

    business_address:
      "",

    city:
      "",

    state:
      "",

    zip_code:
      "",

    home_terminal:
      "",

    operation_type:
      "OTR",

    equipment_type:
      "",

    trailer_type:
      "",

    truck_count:
      "",

    driver_count:
      "",

    minimum_rate_per_mile:
      "",

    weekly_revenue_target:
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

    factoring_company:
      "",

    factoring_contact_email:
      "",

    insurance_company:
      "",

    insurance_policy_number:
      "",

    insurance_expiration:
      "",

    auto_liability_limit:
      "",

    cargo_limit:
      "",

    load_board_provider:
      "",

    emergency_contact_name:
      "",

    emergency_contact_phone:
      "",

    certification_name:
      "",

    certification_title:
      "",

    certification_email:
      "",

    electronic_signature:
      "",

    consent:
      false,
  };

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600";

const labelClass =
  "block text-sm font-semibold text-slate-800";

const cardClass =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7";

export default function CarrierPacketPage() {
  const params =
    useParams<{
      token: string;
    }>();

  const token =
    typeof params?.token ===
    "string"
      ? params.token
      : "";

  const [
    form,
    setForm,
  ] =
    useState<CarrierPacketFormData>(
      EMPTY_FORM,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState(false);

  const [
    alreadyCompleted,
    setAlreadyCompleted,
  ] =
    useState(false);

  const [
    completedAt,
    setCompletedAt,
  ] =
    useState<
      string | null
    >(null);

  const [
    expiresAt,
    setExpiresAt,
  ] =
    useState<
      string | null
    >(null);

  useEffect(
    () => {
      if (!token) {
        return;
      }

      let cancelled =
        false;

      async function load() {
        try {
          setLoading(
            true,
          );

          setError("");

          const res =
            await fetch(
              `/api/carrier/onboarding/packet/${encodeURIComponent(
                token,
              )}`,
              {
                method:
                  "GET",

                cache:
                  "no-store",
              },
            );

          const data =
            (await res.json()) as LoadResponse;

          if (
            cancelled
          ) {
            return;
          }

          if (
            !res.ok ||
            !data.ok
          ) {
            setError(
              data.error ||
                "Unable to load this Carrier Packet.",
            );

            return;
          }

          if (
            data.completed
          ) {
            setAlreadyCompleted(
              true,
            );

            setCompletedAt(
              data.completed_at ||
                null,
            );

            return;
          }

          setExpiresAt(
            data.expires_at ||
              null,
          );

          const prefill =
            data.prefill ||
            {};

          setForm(
            (
              current,
            ) => ({
              ...current,
              ...prefill,

              operation_type:
                prefill.operation_type ||
                "OTR",

              primary_contact_email:
                data.recipient_email ||
                prefill.primary_contact_email ||
                "",

              certification_email:
                data.recipient_email ||
                prefill.certification_email ||
                "",

              electronic_signature:
                "",

              consent:
                false,
            }),
          );
        } catch (
          caught
        ) {
          console.error(
            caught,
          );

          if (
            !cancelled
          ) {
            setError(
              "Unable to load this secure Carrier Packet.",
            );
          }
        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false,
            );
          }
        }
      }

      load();

      return () => {
        cancelled =
          true;
      };
    },
    [token],
  );

  function updateField<
    K extends keyof CarrierPacketFormData,
  >(
    key: K,
    value: CarrierPacketFormData[K],
  ) {
    setForm(
      (
        current,
      ) => ({
        ...current,
        [key]:
          value,
      }),
    );
  }

  async function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();

    setError("");

    if (
      !form.consent
    ) {
      setError(
        "Please certify the Carrier Packet before submitting.",
      );

      return;
    }

    const signer =
      form.certification_name
        .trim()
        .replace(
          /\s+/g,
          " ",
        )
        .toLowerCase();

    const signature =
      form.electronic_signature
        .trim()
        .replace(
          /\s+/g,
          " ",
        )
        .toLowerCase();

    if (
      signer !==
      signature
    ) {
      setError(
        "Your electronic signature must match the Authorized Representative Name.",
      );

      return;
    }

    try {
      setSubmitting(
        true,
      );

      const res =
        await fetch(
          `/api/carrier/onboarding/packet/${encodeURIComponent(
            token,
          )}`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                form,
              ),
          },
        );

      const data =
        await res.json();

      if (
        !res.ok ||
        !data.ok
      ) {
        setError(
          data.error ||
            "Unable to submit the Carrier Packet.",
        );

        return;
      }

      setSuccess(
        true,
      );

      setCompletedAt(
        data.received_at ||
          null,
      );

      window.scrollTo({
        top: 0,

        behavior:
          "smooth",
      });
    } catch (
      caught
    ) {
      console.error(
        caught,
      );

      setError(
        "Unable to submit the Carrier Packet. Please check your connection and try again.",
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <div
            className={
              cardClass
            }
          >
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-72 rounded bg-slate-200" />

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
              Carrier Packet Completed
            </h1>

            <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-slate-600 sm:text-base">
              Your Carrier Credential Packet
              has been securely received by
              Slate Lane Dispatch.
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
              Your completed Carrier Packet
              PDF has been automatically
              generated and stored securely
              in the Slate Lane Document
              Vault.
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (
    error &&
    !form.company_name
  ) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-slate-950">
              Carrier Packet Unavailable
            </h1>

            <p className="mt-4 text-sm leading-6 text-red-700">
              {error}
            </p>

            <p className="mt-6 text-sm text-slate-500">
              Please contact Slate Lane
              Dispatch for a new secure
              Carrier Packet link.
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
            Carrier Credential Packet
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Complete your carrier information
            directly in your browser. When
            submitted, Slate Lane will
            automatically create and securely
            store your completed Carrier
            Packet PDF.
          </p>

          <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-400">
            <span>
              Packet version:{" "}
              {CARRIER_PACKET_VERSION}
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
        onSubmit={
          handleSubmit
        }
        className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6"
      >
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
            {error}
          </div>
        )}

        <section
          className={
            cardClass
          }
        >
          <h2 className="text-lg font-bold text-slate-950">
            Carrier & Authority Information
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label
              className={`${labelClass} sm:col-span-2`}
            >
              Legal / Company Name
              <input
                required
                className={
                  inputClass
                }
                value={
                  form.company_name
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "company_name",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              USDOT Number
              <input
                required
                inputMode="numeric"
                className={
                  inputClass
                }
                value={
                  form.dot_number
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "dot_number",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              MC Number
              <input
                className={
                  inputClass
                }
                value={
                  form.mc_number
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "mc_number",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={`${labelClass} sm:col-span-2`}
            >
              Business Address
              <input
                required
                className={
                  inputClass
                }
                value={
                  form.business_address
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "business_address",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              City
              <input
                required
                className={
                  inputClass
                }
                value={
                  form.city
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "city",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              State
              <input
                required
                className={
                  inputClass
                }
                value={
                  form.state
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "state",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              ZIP Code
              <input
                required
                className={
                  inputClass
                }
                value={
                  form.zip_code
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "zip_code",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              Home Terminal
              <input
                className={
                  inputClass
                }
                placeholder="City, State"
                value={
                  form.home_terminal
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "home_terminal",
                    e.target
                      .value,
                  )
                }
              />
            </label>
          </div>
        </section>

        <section
          className={
            cardClass
          }
        >
          <h2 className="text-lg font-bold text-slate-950">
            Primary Contact
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label
              className={
                labelClass
              }
            >
              Contact Name
              <input
                required
                className={
                  inputClass
                }
                value={
                  form.primary_contact_name
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "primary_contact_name",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              Phone
              <input
                required
                type="tel"
                className={
                  inputClass
                }
                value={
                  form.primary_contact_phone
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "primary_contact_phone",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={`${labelClass} sm:col-span-2`}
            >
              Email
              <input
                required
                readOnly
                type="email"
                className={
                  inputClass
                }
                value={
                  form.primary_contact_email
                }
              />

              <span className="mt-2 block text-xs font-normal text-slate-500">
                For security, this email must
                match the address that received
                this secure packet.
              </span>
            </label>
          </div>
        </section>

        <section
          className={
            cardClass
          }
        >
          <h2 className="text-lg font-bold text-slate-950">
            Fleet & Equipment
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label
              className={
                labelClass
              }
            >
              Operation Type
              <select
                required
                className={
                  inputClass
                }
                value={
                  form.operation_type
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "operation_type",
                    e.target
                      .value,
                  )
                }
              >
                <option value="OTR">
                  OTR
                </option>

                <option value="Regional">
                  Regional
                </option>

                <option value="Local">
                  Local
                </option>

                <option value="Mixed">
                  Mixed
                </option>
              </select>
            </label>

            <label
              className={
                labelClass
              }
            >
              Equipment Type
              <input
                required
                className={
                  inputClass
                }
                placeholder="Dry Van, Reefer, Flatbed..."
                value={
                  form.equipment_type
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "equipment_type",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              Trailer Type / Size
              <input
                className={
                  inputClass
                }
                placeholder="53 ft Dry Van"
                value={
                  form.trailer_type
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "trailer_type",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              Number of Trucks
              <input
                required
                min="1"
                type="number"
                className={
                  inputClass
                }
                value={
                  form.truck_count
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "truck_count",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              Number of Drivers
              <input
                min="1"
                type="number"
                className={
                  inputClass
                }
                value={
                  form.driver_count
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "driver_count",
                    e.target
                      .value,
                  )
                }
              />
            </label>
          </div>
        </section>

        <section
          className={
            cardClass
          }
        >
          <h2 className="text-lg font-bold text-slate-950">
            Dispatch Preferences
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label
              className={
                labelClass
              }
            >
              Minimum Rate Per Mile
              <input
                min="0"
                step="0.01"
                type="number"
                className={
                  inputClass
                }
                placeholder="2.50"
                value={
                  form.minimum_rate_per_mile
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "minimum_rate_per_mile",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              Weekly Revenue Target
              <input
                min="0"
                step="0.01"
                type="number"
                className={
                  inputClass
                }
                placeholder="7000"
                value={
                  form.weekly_revenue_target
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "weekly_revenue_target",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={`${labelClass} sm:col-span-2`}
            >
              Preferred States
              <input
                className={
                  inputClass
                }
                placeholder="TX, OK, AR, TN..."
                value={
                  form.preferred_states
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "preferred_states",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={`${labelClass} sm:col-span-2`}
            >
              Preferred Lanes
              <textarea
                className={`${inputClass} min-h-24`}
                placeholder="Dallas, TX to Atlanta, GA"
                value={
                  form.preferred_lanes
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "preferred_lanes",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={`${labelClass} sm:col-span-2`}
            >
              Regions / States to Avoid
              <textarea
                className={`${inputClass} min-h-20`}
                value={
                  form.regions_to_avoid
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "regions_to_avoid",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={`${labelClass} sm:col-span-2`}
            >
              Home Time Requirements
              <textarea
                className={`${inputClass} min-h-20`}
                value={
                  form.home_time_notes
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "home_time_notes",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={`${labelClass} sm:col-span-2`}
            >
              Additional Operating Notes
              <textarea
                className={`${inputClass} min-h-24`}
                value={
                  form.operating_notes
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "operating_notes",
                    e.target
                      .value,
                  )
                }
              />
            </label>
          </div>
        </section>

        <section
          className={
            cardClass
          }
        >
          <h2 className="text-lg font-bold text-slate-950">
            Factoring & Insurance
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            You will still upload the official
            COI and Factoring NOA separately
            in the onboarding process.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label
              className={
                labelClass
              }
            >
              Factoring Company
              <input
                className={
                  inputClass
                }
                value={
                  form.factoring_company
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "factoring_company",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              Factoring Contact Email
              <input
                type="email"
                className={
                  inputClass
                }
                value={
                  form.factoring_contact_email
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "factoring_contact_email",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              Insurance Company
              <input
                className={
                  inputClass
                }
                value={
                  form.insurance_company
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "insurance_company",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              Policy Number
              <input
                className={
                  inputClass
                }
                value={
                  form.insurance_policy_number
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "insurance_policy_number",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              Insurance Expiration
              <input
                type="date"
                className={
                  inputClass
                }
                value={
                  form.insurance_expiration
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "insurance_expiration",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              Auto Liability Limit
              <input
                className={
                  inputClass
                }
                placeholder="$1,000,000"
                value={
                  form.auto_liability_limit
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "auto_liability_limit",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              Cargo Coverage Limit
              <input
                className={
                  inputClass
                }
                placeholder="$100,000"
                value={
                  form.cargo_limit
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "cargo_limit",
                    e.target
                      .value,
                  )
                }
              />
            </label>
          </div>
        </section>

        <section
          className={
            cardClass
          }
        >
          <h2 className="text-lg font-bold text-slate-950">
            Load Board & Emergency Contact
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label
              className={
                labelClass
              }
            >
              Primary Load Board
              <input
                className={
                  inputClass
                }
                placeholder="DAT, Truckstop..."
                value={
                  form.load_board_provider
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "load_board_provider",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              Emergency Contact Name
              <input
                className={
                  inputClass
                }
                value={
                  form.emergency_contact_name
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "emergency_contact_name",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              Emergency Contact Phone
              <input
                type="tel"
                className={
                  inputClass
                }
                value={
                  form.emergency_contact_phone
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "emergency_contact_phone",
                    e.target
                      .value,
                  )
                }
              />
            </label>
          </div>
        </section>

        <section
          className={
            cardClass
          }
        >
          <h2 className="text-lg font-bold text-slate-950">
            Carrier Certification
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            An authorized carrier
            representative must certify that
            the information supplied in this
            packet is accurate.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label
              className={
                labelClass
              }
            >
              Authorized Representative Name
              <input
                required
                className={
                  inputClass
                }
                value={
                  form.certification_name
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "certification_name",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={
                labelClass
              }
            >
              Title
              <input
                required
                className={
                  inputClass
                }
                placeholder="Owner, President, Manager..."
                value={
                  form.certification_title
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "certification_title",
                    e.target
                      .value,
                  )
                }
              />
            </label>

            <label
              className={`${labelClass} sm:col-span-2`}
            >
              Certification Email
              <input
                required
                readOnly
                type="email"
                className={
                  inputClass
                }
                value={
                  form.certification_email
                }
              />
            </label>

            <label
              className={`${labelClass} sm:col-span-2`}
            >
              Electronic Signature
              <input
                required
                className={`${inputClass} text-lg italic`}
                placeholder="Type your full name"
                value={
                  form.electronic_signature
                }
                onChange={(
                  e,
                ) =>
                  updateField(
                    "electronic_signature",
                    e.target
                      .value,
                  )
                }
              />

              <span className="mt-2 block text-xs font-normal text-slate-500">
                Type the same full name shown
                in Authorized Representative
                Name.
              </span>
            </label>
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <input
              required
              type="checkbox"
              className="mt-1 h-4 w-4 accent-slate-950"
              checked={
                form.consent
              }
              onChange={(
                e,
              ) =>
                updateField(
                  "consent",
                  e.target
                    .checked,
                )
              }
            />

            <span className="text-sm leading-6 text-slate-700">
              I certify that I am authorized
              to provide this information on
              behalf of the Carrier and that
              the information in this Carrier
              Credential Packet is accurate to
              the best of my knowledge. I
              intend my typed name and
              submission to serve as my
              electronic certification.
            </span>
          </label>
        </section>

        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold">
                Ready to submit your Carrier Packet?
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Slate Lane will automatically
                generate the PDF and save it
                securely to your Document
                Vault.
              </p>
            </div>

            <button
              type="submit"
              disabled={
                submitting ||
                !form.consent
              }
              className="shrink-0 rounded-xl bg-white px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Submitting Packet..."
                : "Certify & Submit Packet"}
            </button>
          </div>
        </div>

        <p className="pb-6 text-center text-xs leading-5 text-slate-400">
          Secure carrier onboarding provided
          by Slate Lane Dispatch. Do not
          forward your private Carrier Packet
          link.
        </p>
      </form>
    </main>
  );
}