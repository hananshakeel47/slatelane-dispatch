import Link from "next/link";

import {
  createServerSupabase,
} from "@/lib/supabase/server";

export const dynamic =
  "force-dynamic";

const PAGE_SIZE = 50;

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

type SearchParams = Record<
  string,
  string | string[] | undefined
>;

type Props = {
  searchParams:
    Promise<SearchParams>;
};

type CarrierRow = {
  id: number;
  dot_number:
    number | null;
  mc_number:
    string | null;
  legal_name:
    string | null;
  dba_name:
    string | null;
  owner_name:
    string | null;
  phone:
    string | null;
  email:
    string | null;
  city:
    string | null;
  state:
    string | null;
  power_units:
    number | null;
  drivers:
    number | null;
  status_code:
    string | null;
  lead_score:
    number | null;
  dispatcher_probability:
    number | null;
  authority_date:
    string | null;
  authority_age_days:
    number | null;
  authority_status:
    string | null;
  email_verification_status:
    string | null;
  email_health_status:
    string | null;
  acquisition_source:
    string | null;
  source_first_seen_at:
    string | null;
  last_fmcsa_sync:
    string | null;
};

function param(
  params: SearchParams,
  key: string,
) {
  const value =
    params[key];

  if (
    Array.isArray(value)
  ) {
    return (
      value[0] ?? ""
    );
  }

  return value ?? "";
}

function cleanSearch(
  value: string,
) {
  return value
    .trim()
    .replace(
      /[(),"]/g,
      " ",
    )
    .slice(
      0,
      120,
    );
}

function buildUrl(
  current:
    URLSearchParams,

  changes:
    Record<
      string,
      | string
      | number
      | null
      | undefined
    >,
) {
  const next =
    new URLSearchParams(
      current,
    );

  for (
    const [
      key,
      value,
    ] of Object.entries(
      changes,
    )
  ) {
    if (
      value ===
        null ||
      value ===
        undefined ||
      value === ""
    ) {
      next.delete(
        key,
      );
    } else {
      next.set(
        key,
        String(value),
      );
    }
  }

  const query =
    next.toString();

  return query
    ? `/admin/carriers?${query}`
    : "/admin/carriers";
}

function scoreClass(
  score:
    number | null,
) {
  const value =
    score ?? 0;

  if (value >= 80) {
    return "border-emerald-500/15 bg-emerald-500/[0.08] text-emerald-300";
  }

  if (value >= 60) {
    return "border-amber-500/15 bg-amber-500/[0.08] text-amber-300";
  }

  return "border-white/[0.08] bg-white/[0.035] text-zinc-400";
}

function verificationClass(
  status:
    string | null,
) {
  switch (status) {
    case "verified_format":
      return "border-emerald-500/15 bg-emerald-500/[0.075] text-emerald-300";

    case "caution":
      return "border-amber-500/15 bg-amber-500/[0.075] text-amber-300";

    case "risky":
      return "border-orange-500/15 bg-orange-500/[0.075] text-orange-300";

    case "blocked":
      return "border-red-500/15 bg-red-500/[0.075] text-red-300";

    default:
      return "border-white/[0.07] bg-white/[0.025] text-zinc-500";
  }
}

function verificationLabel(
  status:
    string | null,
) {
  switch (status) {
    case "verified_format":
      return "Verified";

    case "caution":
      return "Caution";

    case "risky":
      return "Risky";

    case "blocked":
      return "Blocked";

    default:
      return "Unchecked";
  }
}

function sourceLabel(
  source:
    string | null,
) {
  if (
    source ===
    "motus_new_registration"
  ) {
    return "MOTUS";
  }

  if (!source) {
    return "Legacy";
  }

  return source
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

function formatDate(
  value:
    string | null,
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(date);
}

function initials(
  name:
    string | null,
) {
  if (!name) {
    return "CA";
  }

  const pieces =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

  return (
    pieces
      .map(
        (item) =>
          item[0],
      )
      .join("")
      .toUpperCase() ||
    "CA"
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="11"
        cy="11"
        r="6"
      />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </svg>
  );
}

export default async function CarriersPage({
  searchParams,
}: Props) {
  const params =
    await searchParams;

  const search =
    cleanSearch(
      param(
        params,
        "q",
      ),
    );

  const state =
    param(
      params,
      "state",
    ).toUpperCase();

  const fleet =
    param(
      params,
      "fleet",
    );

  const sort =
    param(
      params,
      "sort",
    ) || "score";

  const verification =
    param(
      params,
      "verification",
    );

  const source =
    param(
      params,
      "source",
    );

  const activeOnly =
    param(
      params,
      "active",
    ) === "1";

  const hasEmail =
    param(
      params,
      "email",
    ) === "1";

  const hasPhone =
    param(
      params,
      "phone",
    ) === "1";

  const hasMC =
    param(
      params,
      "mc",
    ) === "1";

  const rawMinScore =
    Number(
      param(
        params,
        "score",
      ),
    );

  const minScore =
    Number.isFinite(
      rawMinScore,
    )
      ? Math.max(
          0,
          Math.min(
            100,
            rawMinScore,
          ),
        )
      : 0;

  const rawPage =
    Number(
      param(
        params,
        "page",
      ),
    );

  const page =
    Number.isFinite(
      rawPage,
    ) &&
    rawPage > 0
      ? Math.floor(
          rawPage,
        )
      : 1;

  const from =
    (page - 1) *
    PAGE_SIZE;

  const to =
    from +
    PAGE_SIZE -
    1;

  const supabase =
    createServerSupabase();

  let query =
    supabase
      .from("carriers")
      .select(
        `
          id,
          dot_number,
          mc_number,
          legal_name,
          dba_name,
          owner_name,
          phone,
          email,
          city,
          state,
          power_units,
          drivers,
          status_code,
          lead_score,
          dispatcher_probability,
          authority_date,
          authority_age_days,
          authority_status,
          email_verification_status,
          email_health_status,
          acquisition_source,
          source_first_seen_at,
          last_fmcsa_sync
        `,
        {
          count: "exact",
        },
      );

  /* ==========================================================
     SEARCH
  ========================================================== */

  if (search) {
    if (
      /^\d+$/.test(
        search,
      )
    ) {
      query =
        query.or(
          [
            `dot_number.eq.${Number(
              search,
            )}`,
            `mc_number.ilike.%${search}%`,
            `phone.ilike.%${search}%`,
          ].join(","),
        );
    } else {
      query =
        query.or(
          [
            `legal_name.ilike.%${search}%`,
            `dba_name.ilike.%${search}%`,
            `owner_name.ilike.%${search}%`,
            `mc_number.ilike.%${search}%`,
            `email.ilike.%${search}%`,
            `phone.ilike.%${search}%`,
          ].join(","),
        );
    }
  }

  /* ==========================================================
     FILTERS
  ========================================================== */

  if (
    state &&
    US_STATES.includes(
      state,
    )
  ) {
    query =
      query.eq(
        "state",
        state,
      );
  }

  if (activeOnly) {
    query =
      query.eq(
        "status_code",
        "A",
      );
  }

  if (hasEmail) {
    query =
      query
        .not(
          "email",
          "is",
          null,
        )
        .neq(
          "email",
          "",
        );
  }

  if (hasPhone) {
    query =
      query
        .not(
          "phone",
          "is",
          null,
        )
        .neq(
          "phone",
          "",
        );
  }

  if (hasMC) {
    query =
      query
        .not(
          "mc_number",
          "is",
          null,
        )
        .neq(
          "mc_number",
          "",
        );
  }

  if (minScore > 0) {
    query =
      query.gte(
        "lead_score",
        minScore,
      );
  }

  if (
    verification ===
      "verified_format" ||
    verification ===
      "caution" ||
    verification ===
      "risky" ||
    verification ===
      "blocked"
  ) {
    query =
      query.eq(
        "email_verification_status",
        verification,
      );
  }

  if (
    source ===
    "motus_new_registration"
  ) {
    query =
      query.eq(
        "acquisition_source",
        source,
      );
  }

  switch (fleet) {
    case "1-5":
      query =
        query
          .gte(
            "power_units",
            1,
          )
          .lte(
            "power_units",
            5,
          );
      break;

    case "6-10":
      query =
        query
          .gte(
            "power_units",
            6,
          )
          .lte(
            "power_units",
            10,
          );
      break;

    case "1-10":
      query =
        query
          .gte(
            "power_units",
            1,
          )
          .lte(
            "power_units",
            10,
          );
      break;

    case "11-25":
      query =
        query
          .gte(
            "power_units",
            11,
          )
          .lte(
            "power_units",
            25,
          );
      break;

    case "26-50":
      query =
        query
          .gte(
            "power_units",
            26,
          )
          .lte(
            "power_units",
            50,
          );
      break;
  }

  /* ==========================================================
     SORT
  ========================================================== */

  switch (sort) {
    case "name":
      query =
        query.order(
          "legal_name",
          {
            ascending:
              true,
          },
        );
      break;

    case "fleet-small":
      query =
        query
          .order(
            "power_units",
            {
              ascending:
                true,
              nullsFirst:
                false,
            },
          )
          .order(
            "lead_score",
            {
              ascending:
                false,
            },
          );
      break;

    case "fleet-large":
      query =
        query.order(
          "power_units",
          {
            ascending:
              false,
            nullsFirst:
              false,
          },
        );
      break;

    case "authority-new":
      query =
        query.order(
          "authority_date",
          {
            ascending:
              false,
            nullsFirst:
              false,
          },
        );
      break;

    case "recent":
      query =
        query.order(
          "source_first_seen_at",
          {
            ascending:
              false,
            nullsFirst:
              false,
          },
        );
      break;

    case "score":
    default:
      query =
        query
          .order(
            "lead_score",
            {
              ascending:
                false,
              nullsFirst:
                false,
            },
          )
          .order(
            "legal_name",
            {
              ascending:
                true,
            },
          );
      break;
  }

  query =
    query.range(
      from,
      to,
    );

  const {
    data,
    error,
    count,
  } = await query;

  const carriers =
    (data ??
      []) as CarrierRow[];

  const total =
    count ?? 0;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total /
          PAGE_SIZE,
      ),
    );

  const firstResult =
    total === 0
      ? 0
      : from + 1;

  const lastResult =
    Math.min(
      from +
        PAGE_SIZE,
      total,
    );

  const currentParams =
    new URLSearchParams();

  for (
    const [
      key,
      value,
    ] of Object.entries(
      params,
    )
  ) {
    if (
      typeof value ===
      "string"
    ) {
      currentParams.set(
        key,
        value,
      );
    }
  }

  const activeFilterCount =
    [
      search,
      state,
      fleet,
      verification,
      source,
      activeOnly
        ? "1"
        : "",
      hasEmail
        ? "1"
        : "",
      hasPhone
        ? "1"
        : "",
      hasMC
        ? "1"
        : "",
      minScore > 0
        ? String(
            minScore,
          )
        : "",
    ].filter(Boolean)
      .length;

  return (
    <div className="space-y-6">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <section className="relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-[linear-gradient(135deg,rgba(18,23,31,.94),rgba(9,13,18,.95))] px-6 py-6 shadow-[0_18px_60px_rgba(0,0,0,.16)]">

        <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-blue-500/[0.055] blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-400">
              Carrier Intelligence
            </div>

            <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.045em] text-white md:text-[38px]">
              Carrier workspace
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Search FMCSA carriers,
              evaluate quality and move
              the strongest prospects
              into your sales pipeline.
            </p>

          </div>

          <div className="flex flex-wrap items-center gap-2">

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">

              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                Results
              </div>

              <div className="mt-1 text-xl font-semibold tracking-[-0.03em] text-zinc-100">
                {total.toLocaleString()}
              </div>

            </div>

            <Link
              href="/admin/carriers?active=1&email=1&mc=1&fleet=1-10&score=80&verification=verified_format&sort=score"
              className="inline-flex h-[54px] items-center rounded-xl bg-white px-5 text-[11px] font-semibold text-black hover:bg-zinc-200"
            >
              Best prospects
              <span className="ml-2">
                →
              </span>
            </Link>

          </div>

        </div>

      </section>

      {/* =====================================================
          PRESETS
      ===================================================== */}

      <section className="flex flex-wrap items-center gap-2">

        <span className="mr-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-zinc-600">
          Views
        </span>

        <Link
          href="/admin/carriers?active=1&email=1&mc=1&fleet=1-10&score=80&verification=verified_format&sort=score"
          className="rounded-full border border-emerald-500/15 bg-emerald-500/[0.065] px-3 py-1.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/[0.1]"
        >
          Best prospects
        </Link>

        <Link
          href="/admin/carriers?active=1&email=1&verification=verified_format&sort=score"
          className="rounded-full border border-white/[0.075] bg-white/[0.025] px-3 py-1.5 text-[10px] font-medium text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
        >
          Verified email
        </Link>

        <Link
          href="/admin/carriers?active=1&phone=1&sort=score"
          className="rounded-full border border-white/[0.075] bg-white/[0.025] px-3 py-1.5 text-[10px] font-medium text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
        >
          Phone ready
        </Link>

        <Link
          href="/admin/carriers?active=1&fleet=1-5&sort=score"
          className="rounded-full border border-white/[0.075] bg-white/[0.025] px-3 py-1.5 text-[10px] font-medium text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
        >
          1–5 trucks
        </Link>

        <Link
          href="/admin/carriers?active=1&fleet=6-10&sort=score"
          className="rounded-full border border-white/[0.075] bg-white/[0.025] px-3 py-1.5 text-[10px] font-medium text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
        >
          6–10 trucks
        </Link>

        <Link
          href="/admin/carriers?source=motus_new_registration&sort=recent"
          className="rounded-full border border-blue-500/15 bg-blue-500/[0.055] px-3 py-1.5 text-[10px] font-medium text-blue-300 hover:bg-blue-500/[0.09]"
        >
          New MOTUS
        </Link>

        {activeFilterCount >
        0 ? (
          <Link
            href="/admin/carriers"
            className="rounded-full border border-white/[0.075] px-3 py-1.5 text-[10px] font-medium text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-300"
          >
            Clear filters
          </Link>
        ) : null}

      </section>

      {/* =====================================================
          FILTER BAR
      ===================================================== */}

      <form
        method="GET"
        className="rounded-[18px] border border-white/[0.07] bg-white/[0.022] p-4"
      >

        <div className="mb-4 flex items-center justify-between gap-3">

          <div className="flex items-center gap-2">

            <span className="text-zinc-500">
              <FilterIcon />
            </span>

            <div>
              <div className="text-[11px] font-semibold text-zinc-300">
                Filters
              </div>

              <div className="mt-0.5 text-[9px] text-zinc-600">
                Narrow the FMCSA
                carrier universe.
              </div>
            </div>

          </div>

          {activeFilterCount >
          0 ? (
            <span className="rounded-full border border-blue-500/15 bg-blue-500/[0.06] px-2.5 py-1 text-[9px] font-semibold text-blue-300">
              {activeFilterCount} active
            </span>
          ) : null}

        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">

          <div className="relative md:col-span-2 xl:col-span-2">

            <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.11em] text-zinc-600">
              Search
            </label>

            <span className="pointer-events-none absolute bottom-[12px] left-3 text-zinc-600">
              <SearchIcon />
            </span>

            <input
              type="text"
              name="q"
              defaultValue={
                search
              }
              placeholder="Company, DOT, MC, owner, email, phone..."
              className="w-full rounded-xl border border-white/[0.08] bg-black/25 py-2.5 pl-10 pr-3 text-[11px] text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
            />

          </div>

          <div>

            <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.11em] text-zinc-600">
              State
            </label>

            <select
              name="state"
              defaultValue={
                state
              }
              className="w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-[11px] text-zinc-300 outline-none"
            >
              <option value="">
                All states
              </option>

              {US_STATES.map(
                (item) => (
                  <option
                    key={
                      item
                    }
                    value={
                      item
                    }
                  >
                    {item}
                  </option>
                ),
              )}

            </select>

          </div>

          <div>

            <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.11em] text-zinc-600">
              Fleet
            </label>

            <select
              name="fleet"
              defaultValue={
                fleet
              }
              className="w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-[11px] text-zinc-300 outline-none"
            >
              <option value="">
                Any fleet
              </option>
              <option value="1-5">
                1–5 trucks
              </option>
              <option value="6-10">
                6–10 trucks
              </option>
              <option value="1-10">
                1–10 trucks
              </option>
              <option value="11-25">
                11–25 trucks
              </option>
              <option value="26-50">
                26–50 trucks
              </option>
            </select>

          </div>

          <div>

            <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.11em] text-zinc-600">
              Verification
            </label>

            <select
              name="verification"
              defaultValue={
                verification
              }
              className="w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-[11px] text-zinc-300 outline-none"
            >
              <option value="">
                Any status
              </option>
              <option value="verified_format">
                Verified
              </option>
              <option value="caution">
                Caution
              </option>
              <option value="risky">
                Risky
              </option>
              <option value="blocked">
                Blocked
              </option>
            </select>

          </div>

          <div>

            <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.11em] text-zinc-600">
              Sort
            </label>

            <select
              name="sort"
              defaultValue={
                sort
              }
              className="w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-[11px] text-zinc-300 outline-none"
            >
              <option value="score">
                Highest score
              </option>
              <option value="recent">
                Newly acquired
              </option>
              <option value="authority-new">
                Newest authority
              </option>
              <option value="fleet-small">
                Smallest fleet
              </option>
              <option value="fleet-large">
                Largest fleet
              </option>
              <option value="name">
                Company name
              </option>
            </select>

          </div>

        </div>

        <div className="mt-4 flex flex-col gap-4 border-t border-white/[0.055] pt-4 lg:flex-row lg:items-end lg:justify-between">

          <div className="flex flex-wrap gap-x-5 gap-y-3">

            <label className="flex cursor-pointer items-center gap-2 text-[10px] text-zinc-500">
              <input
                type="checkbox"
                name="active"
                value="1"
                defaultChecked={
                  activeOnly
                }
                className="h-3.5 w-3.5 rounded border-white/10 bg-black/40 accent-blue-500"
              />
              Active authority
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-[10px] text-zinc-500">
              <input
                type="checkbox"
                name="email"
                value="1"
                defaultChecked={
                  hasEmail
                }
                className="h-3.5 w-3.5 rounded border-white/10 bg-black/40 accent-blue-500"
              />
              Has email
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-[10px] text-zinc-500">
              <input
                type="checkbox"
                name="phone"
                value="1"
                defaultChecked={
                  hasPhone
                }
                className="h-3.5 w-3.5 rounded border-white/10 bg-black/40 accent-blue-500"
              />
              Has phone
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-[10px] text-zinc-500">
              <input
                type="checkbox"
                name="mc"
                value="1"
                defaultChecked={
                  hasMC
                }
                className="h-3.5 w-3.5 rounded border-white/10 bg-black/40 accent-blue-500"
              />
              Has MC
            </label>

            <label className="flex items-center gap-2 text-[10px] text-zinc-500">

              Score

              <input
                type="number"
                name="score"
                min="0"
                max="100"
                step="5"
                defaultValue={
                  minScore ||
                  ""
                }
                placeholder="Min"
                className="h-8 w-16 rounded-lg border border-white/[0.08] bg-black/25 px-2 text-[10px] text-zinc-300 outline-none"
              />

            </label>

            <label className="flex items-center gap-2 text-[10px] text-zinc-500">

              Source

              <select
                name="source"
                defaultValue={
                  source
                }
                className="h-8 rounded-lg border border-white/[0.08] bg-black/25 px-2 text-[10px] text-zinc-300 outline-none"
              >
                <option value="">
                  All
                </option>
                <option value="motus_new_registration">
                  MOTUS
                </option>
              </select>

            </label>

          </div>

          <div className="flex gap-2">

            <Link
              href="/admin/carriers"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-white/[0.075] px-3 text-[10px] font-medium text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-300"
            >
              Reset
            </Link>

            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-[10px] font-semibold text-black hover:bg-zinc-200"
            >
              Apply filters
            </button>

          </div>

        </div>

      </form>

      {/* =====================================================
          RESULTS
      ===================================================== */}

      <section className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.018]">

        <div className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <h2 className="text-[13px] font-semibold text-zinc-200">
              Carrier results
            </h2>

            <p className="mt-1 text-[10px] text-zinc-600">
              Showing{" "}
              <span className="text-zinc-400">
                {firstResult.toLocaleString()}
                –
                {lastResult.toLocaleString()}
              </span>{" "}
              of{" "}
              <span className="text-zinc-400">
                {total.toLocaleString()}
              </span>
            </p>

          </div>

          <div className="text-[9px] text-zinc-700">
            Page {page} of{" "}
            {totalPages}
          </div>

        </div>

        {error ? (
          <div className="border-b border-red-500/10 bg-red-500/[0.04] px-5 py-4 text-[11px] text-red-300">
            Could not load carriers:
            {" "}
            {error.message}
          </div>
        ) : null}

        {/* DESKTOP */}

        <div className="hidden overflow-x-auto lg:block">

          <table className="min-w-full">

            <thead>

              <tr className="border-b border-white/[0.055]">

                <th className="px-5 py-3 text-left">
                  Carrier
                </th>

                <th className="px-4 py-3 text-left">
                  Authority
                </th>

                <th className="px-4 py-3 text-left">
                  Location
                </th>

                <th className="px-4 py-3 text-left">
                  Fleet
                </th>

                <th className="px-4 py-3 text-left">
                  Contact
                </th>

                <th className="px-4 py-3 text-left">
                  Quality
                </th>

                <th className="px-4 py-3 text-left">
                  Source
                </th>

                <th className="px-5 py-3 text-right">
                  Open
                </th>

              </tr>

            </thead>

            <tbody>

              {carriers.map(
                (carrier) => {
                  const name =
                    carrier.legal_name ||
                    carrier.dba_name ||
                    `DOT ${carrier.dot_number ?? "—"}`;

                  const active =
                    carrier.status_code ===
                    "A";

                  return (
                    <tr
                      key={
                        carrier.id
                      }
                      className="group border-b border-white/[0.045] transition hover:bg-white/[0.018]"
                    >

                      <td className="px-5 py-4">

                        <div className="flex min-w-[220px] items-center gap-3">

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.075] bg-white/[0.03] text-[9px] font-bold tracking-wide text-zinc-400">
                            {initials(
                              name,
                            )}
                          </div>

                          <div className="min-w-0">

                            <Link
                              href={`/admin/carriers/${carrier.dot_number}`}
                              className="block max-w-[230px] truncate text-[11px] font-semibold text-zinc-200 hover:text-white"
                            >
                              {name}
                            </Link>

                            <div className="mt-1 flex items-center gap-2 text-[9px] text-zinc-600">

                              <span>
                                DOT{" "}
                                {carrier.dot_number ??
                                  "—"}
                              </span>

                              <span className="text-zinc-800">
                                •
                              </span>

                              <span>
                                {carrier.mc_number ||
                                  "No MC"}
                              </span>

                            </div>

                          </div>

                        </div>

                      </td>

                      <td className="px-4 py-4">

                        <div className="min-w-[110px]">

                          <div className="flex items-center gap-2">

                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                active
                                  ? "bg-emerald-400"
                                  : "bg-zinc-700"
                              }`}
                            />

                            <span
                              className={`text-[10px] font-semibold ${
                                active
                                  ? "text-emerald-300"
                                  : "text-zinc-500"
                              }`}
                            >
                              {active
                                ? "Active"
                                : carrier.authority_status ||
                                  "Unknown"}
                            </span>

                          </div>

                          <div className="mt-1.5 text-[9px] text-zinc-700">
                            {formatDate(
                              carrier.authority_date,
                            )}
                          </div>

                        </div>

                      </td>

                      <td className="px-4 py-4">

                        <div className="min-w-[100px] text-[10px] text-zinc-400">
                          {carrier.city ||
                            "—"}
                          {carrier.state
                            ? `, ${carrier.state}`
                            : ""}
                        </div>

                      </td>

                      <td className="px-4 py-4">

                        <div className="min-w-[80px]">

                          <div className="text-[11px] font-semibold text-zinc-300">
                            {carrier.power_units ??
                              0}
                            <span className="ml-1 font-normal text-zinc-700">
                              trucks
                            </span>
                          </div>

                          <div className="mt-1 text-[9px] text-zinc-700">
                            {carrier.drivers ??
                              0}
                            {" "}
                            drivers
                          </div>

                        </div>

                      </td>

                      <td className="px-4 py-4">

                        <div className="min-w-[180px]">

                          {carrier.email ? (
                            <div className="max-w-[210px] truncate text-[10px] text-zinc-400">
                              {carrier.email}
                            </div>
                          ) : (
                            <div className="text-[10px] text-zinc-700">
                              No email
                            </div>
                          )}

                          <div className="mt-1 text-[9px] text-zinc-700">
                            {carrier.phone ||
                              "No phone"}
                          </div>

                        </div>

                      </td>

                      <td className="px-4 py-4">

                        <div className="flex min-w-[130px] flex-col items-start gap-1.5">

                          <span
                            className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold ${scoreClass(
                              carrier.lead_score,
                            )}`}
                          >
                            Score{" "}
                            {carrier.lead_score ??
                              0}
                          </span>

                          <span
                            className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold ${verificationClass(
                              carrier.email_verification_status,
                            )}`}
                          >
                            {verificationLabel(
                              carrier.email_verification_status,
                            )}
                          </span>

                        </div>

                      </td>

                      <td className="px-4 py-4">

                        <div className="min-w-[90px]">

                          <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[8px] font-semibold text-zinc-500">
                            {sourceLabel(
                              carrier.acquisition_source,
                            )}
                          </span>

                          <div className="mt-2 text-[8px] text-zinc-700">
                            {formatDate(
                              carrier.source_first_seen_at,
                            )}
                          </div>

                        </div>

                      </td>

                      <td className="px-5 py-4 text-right">

                        <Link
                          href={`/admin/carriers/${carrier.dot_number}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-zinc-600 transition hover:border-white/[0.13] hover:bg-white/[0.05] hover:text-zinc-200"
                          aria-label={`Open ${name}`}
                        >
                          <ArrowIcon />
                        </Link>

                      </td>

                    </tr>
                  );
                },
              )}

            </tbody>

          </table>

        </div>

        {/* MOBILE */}

        <div className="divide-y divide-white/[0.05] lg:hidden">

          {carriers.map(
            (carrier) => {
              const name =
                carrier.legal_name ||
                carrier.dba_name ||
                `DOT ${carrier.dot_number ?? "—"}`;

              return (
                <Link
                  key={
                    carrier.id
                  }
                  href={`/admin/carriers/${carrier.dot_number}`}
                  className="block px-4 py-4 transition hover:bg-white/[0.02]"
                >

                  <div className="flex items-start gap-3">

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.075] bg-white/[0.03] text-[9px] font-bold text-zinc-400">
                      {initials(
                        name,
                      )}
                    </div>

                    <div className="min-w-0 flex-1">

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <div className="truncate text-[12px] font-semibold text-zinc-200">
                            {name}
                          </div>

                          <div className="mt-1 text-[9px] text-zinc-600">
                            DOT{" "}
                            {carrier.dot_number ??
                              "—"}
                            {" "}
                            •{" "}
                            {carrier.mc_number ||
                              "No MC"}
                          </div>

                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-semibold ${scoreClass(
                            carrier.lead_score,
                          )}`}
                        >
                          {carrier.lead_score ??
                            0}
                        </span>

                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3">

                        <div>
                          <div className="text-[8px] uppercase tracking-wide text-zinc-700">
                            Location
                          </div>

                          <div className="mt-1 text-[10px] text-zinc-400">
                            {carrier.city ||
                              "—"}
                            {carrier.state
                              ? `, ${carrier.state}`
                              : ""}
                          </div>
                        </div>

                        <div>
                          <div className="text-[8px] uppercase tracking-wide text-zinc-700">
                            Fleet
                          </div>

                          <div className="mt-1 text-[10px] text-zinc-400">
                            {carrier.power_units ??
                              0}
                            {" "}
                            trucks
                          </div>
                        </div>

                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">

                        <span
                          className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold ${verificationClass(
                            carrier.email_verification_status,
                          )}`}
                        >
                          {verificationLabel(
                            carrier.email_verification_status,
                          )}
                        </span>

                        <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-0.5 text-[8px] text-zinc-500">
                          {sourceLabel(
                            carrier.acquisition_source,
                          )}
                        </span>

                      </div>

                    </div>

                  </div>

                </Link>
              );
            },
          )}

        </div>

        {carriers.length ===
        0 ? (
          <div className="px-5 py-16 text-center">

            <div className="text-sm font-semibold text-zinc-300">
              No carriers found
            </div>

            <div className="mt-2 text-[11px] text-zinc-600">
              Try widening your filters
              or clearing the search.
            </div>

            <Link
              href="/admin/carriers"
              className="mt-4 inline-flex rounded-lg border border-white/[0.08] px-3 py-2 text-[10px] font-semibold text-zinc-400 hover:bg-white/[0.035]"
            >
              Clear all filters
            </Link>

          </div>
        ) : null}

      </section>

      {/* =====================================================
          PAGINATION
      ===================================================== */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div className="text-[10px] text-zinc-700">
          Page{" "}
          <span className="text-zinc-500">
            {page}
          </span>{" "}
          of{" "}
          <span className="text-zinc-500">
            {totalPages}
          </span>
        </div>

        <div className="flex items-center gap-2">

          {page > 1 ? (
            <Link
              href={buildUrl(
                currentParams,
                {
                  page:
                    page -
                    1,
                },
              )}
              className="inline-flex h-9 items-center rounded-lg border border-white/[0.075] bg-white/[0.02] px-3 text-[10px] font-semibold text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
            >
              ← Previous
            </Link>
          ) : (
            <span className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-white/[0.045] px-3 text-[10px] text-zinc-800">
              ← Previous
            </span>
          )}

          <span className="inline-flex h-9 min-w-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-[10px] font-semibold text-zinc-500">
            {page}
          </span>

          {page <
          totalPages ? (
            <Link
              href={buildUrl(
                currentParams,
                {
                  page:
                    page +
                    1,
                },
              )}
              className="inline-flex h-9 items-center rounded-lg border border-white/[0.075] bg-white/[0.02] px-3 text-[10px] font-semibold text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
            >
              Next →
            </Link>
          ) : (
            <span className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-white/[0.045] px-3 text-[10px] text-zinc-800">
              Next →
            </span>
          )}

        </div>

      </div>

    </div>
  );
}