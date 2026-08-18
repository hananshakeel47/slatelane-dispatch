import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

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
  searchParams: Promise<SearchParams>;
};

function param(
  params: SearchParams,
  key: string
): string {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function cleanSearch(value: string) {
  return value
    .trim()
    .replace(/[(),]/g, " ")
    .slice(0, 120);
}

function buildUrl(
  current: URLSearchParams,
  changes: Record<
    string,
    string | number | null | undefined
  >
) {
  const next = new URLSearchParams(current);

  for (const [key, value] of Object.entries(changes)) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  }

  const query = next.toString();

  return query
    ? `/admin/carriers?${query}`
    : "/admin/carriers";
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

export default async function CarriersPage({
  searchParams,
}: Props) {
  const params = await searchParams;

  const search = cleanSearch(
    param(params, "q")
  );

  const state = param(
    params,
    "state"
  ).toUpperCase();

  const fleet = param(
    params,
    "fleet"
  );

  const sort =
    param(params, "sort") || "score";

  const activeOnly =
    param(params, "active") === "1";

  const hasEmail =
    param(params, "email") === "1";

  const hasPhone =
    param(params, "phone") === "1";

  const hasMC =
    param(params, "mc") === "1";

  const rawMinScore = Number(
    param(params, "score")
  );

  const minScore = Number.isFinite(
    rawMinScore
  )
    ? Math.max(
        0,
        Math.min(100, rawMinScore)
      )
    : 0;

  const rawPage = Number(
    param(params, "page")
  );

  const page =
    Number.isFinite(rawPage) &&
    rawPage > 0
      ? Math.floor(rawPage)
      : 1;

  const from =
    (page - 1) * PAGE_SIZE;

  const to =
    from + PAGE_SIZE - 1;

  const supabase =
    createServerSupabase();

  let query = supabase
    .from("carriers")
    .select(
      `
        id,
        dot_number,
        mc_number,
        legal_name,
        dba_name,
        phone,
        email,
        city,
        state,
        power_units,
        drivers,
        status_code,
        lead_score,
        last_fmcsa_sync
      `,
      {
        count: "exact",
      }
    );

  // ==========================================================
  // SEARCH
  // ==========================================================

  if (search) {
    if (/^\d+$/.test(search)) {
      const dotNumber = Number(search);

      query = query.or(
        [
          `dot_number.eq.${dotNumber}`,
          `mc_number.ilike.%${search}%`,
          `phone.ilike.%${search}%`,
        ].join(",")
      );
    } else {
      query = query.or(
        [
          `legal_name.ilike.%${search}%`,
          `dba_name.ilike.%${search}%`,
          `mc_number.ilike.%${search}%`,
          `email.ilike.%${search}%`,
          `phone.ilike.%${search}%`,
        ].join(",")
      );
    }
  }

  // ==========================================================
  // FILTERS
  // ==========================================================

  if (
    state &&
    US_STATES.includes(state)
  ) {
    query = query.eq(
      "state",
      state
    );
  }

  if (activeOnly) {
    query = query.eq(
      "status_code",
      "A"
    );
  }

  if (hasEmail) {
    query = query
      .not(
        "email",
        "is",
        null
      )
      .neq(
        "email",
        ""
      );
  }

  if (hasPhone) {
    query = query
      .not(
        "phone",
        "is",
        null
      )
      .neq(
        "phone",
        ""
      );
  }

  if (hasMC) {
    query = query
      .not(
        "mc_number",
        "is",
        null
      )
      .neq(
        "mc_number",
        ""
      );
  }

  if (minScore > 0) {
    query = query.gte(
      "lead_score",
      minScore
    );
  }

  switch (fleet) {
    case "1-5":
      query = query
        .gte(
          "power_units",
          1
        )
        .lte(
          "power_units",
          5
        );
      break;

    case "6-10":
      query = query
        .gte(
          "power_units",
          6
        )
        .lte(
          "power_units",
          10
        );
      break;

    case "1-10":
      query = query
        .gte(
          "power_units",
          1
        )
        .lte(
          "power_units",
          10
        );
      break;

    case "11-25":
      query = query
        .gte(
          "power_units",
          11
        )
        .lte(
          "power_units",
          25
        );
      break;

    case "26-50":
      query = query
        .gte(
          "power_units",
          26
        )
        .lte(
          "power_units",
          50
        );
      break;
  }

  // ==========================================================
  // SORT
  // ==========================================================

  switch (sort) {
    case "name":
      query = query.order(
        "legal_name",
        {
          ascending: true,
        }
      );
      break;

    case "fleet-small":
      query = query
        .order(
          "power_units",
          {
            ascending: true,
          }
        )
        .order(
          "lead_score",
          {
            ascending: false,
          }
        );
      break;

    case "fleet-large":
      query = query.order(
        "power_units",
        {
          ascending: false,
        }
      );
      break;

    case "recent":
      query = query.order(
        "last_fmcsa_sync",
        {
          ascending: false,
          nullsFirst: false,
        }
      );
      break;

    case "score":
    default:
      query = query
        .order(
          "lead_score",
          {
            ascending: false,
          }
        )
        .order(
          "legal_name",
          {
            ascending: true,
          }
        );
      break;
  }

  query = query.range(
    from,
    to
  );

  const {
    data: carriers,
    error,
    count,
  } = await query;

  const total =
    count ?? 0;

  const totalPages = Math.max(
    1,
    Math.ceil(
      total / PAGE_SIZE
    )
  );

  const currentParams =
    new URLSearchParams();

  for (
    const [key, value] of Object.entries(
      params
    )
  ) {
    if (
      typeof value === "string"
    ) {
      currentParams.set(
        key,
        value
      );
    }
  }

  const firstResult =
    total === 0
      ? 0
      : from + 1;

  const lastResult = Math.min(
    from + PAGE_SIZE,
    total
  );

  return (
    <div className="space-y-8">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-wrap items-end justify-between gap-4">

        <div>
          <h1 className="text-4xl font-bold">
            Carriers
          </h1>

          <p className="mt-2 text-zinc-400">
            Search and filter your FMCSA prospect database.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3">

          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Matching carriers
          </div>

          <div className="mt-1 text-2xl font-bold">
            {total.toLocaleString()}
          </div>

        </div>

      </div>

      {/* =====================================================
          PRESETS
      ====================================================== */}

      <div className="flex flex-wrap gap-2">

        <Link
          href="/admin/carriers?active=1&email=1&mc=1&fleet=1-10&score=80&sort=score"
          className="rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-900"
        >
          🔥 Best Prospects
        </Link>

        <Link
          href="/admin/carriers?active=1&email=1&sort=score"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm hover:bg-zinc-800"
        >
          📧 Email Ready
        </Link>

        <Link
          href="/admin/carriers?active=1&phone=1&sort=score"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm hover:bg-zinc-800"
        >
          📞 Phone Ready
        </Link>

        <Link
          href="/admin/carriers?active=1&fleet=1-5&sort=score"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm hover:bg-zinc-800"
        >
          🚛 1–5 Trucks
        </Link>

        <Link
          href="/admin/carriers?active=1&fleet=6-10&sort=score"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm hover:bg-zinc-800"
        >
          🚚 6–10 Trucks
        </Link>

        <Link
          href="/admin/carriers?active=1&mc=1&sort=score"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm hover:bg-zinc-800"
        >
          🟢 Active + MC
        </Link>

        <Link
          href="/admin/carriers"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-900"
        >
          Clear
        </Link>

      </div>

      {/* =====================================================
          FILTER PANEL
      ====================================================== */}

      <form
        method="GET"
        className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
      >

        <div className="grid gap-4 xl:grid-cols-6 lg:grid-cols-3 md:grid-cols-2">

          {/* Search */}

          <div className="xl:col-span-2">

            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Search
            </label>

            <input
              type="text"
              name="q"
              defaultValue={search}
              placeholder="Company, DOT, MC, email, phone..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 outline-none placeholder:text-zinc-600 focus:border-zinc-500"
            />

          </div>

          {/* State */}

          <div>

            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              State
            </label>

            <select
              name="state"
              defaultValue={state}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 outline-none"
            >

              <option value="">
                All states
              </option>

              {US_STATES.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}

            </select>

          </div>

          {/* Fleet */}

          <div>

            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Fleet
            </label>

            <select
              name="fleet"
              defaultValue={fleet}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 outline-none"
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

          {/* Score */}

          <div>

            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Minimum score
            </label>

            <select
              name="score"
              defaultValue={
                minScore > 0
                  ? String(
                      minScore
                    )
                  : ""
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 outline-none"
            >

              <option value="">
                Any score
              </option>

              <option value="50">
                50+
              </option>

              <option value="60">
                60+
              </option>

              <option value="70">
                70+
              </option>

              <option value="80">
                80+
              </option>

              <option value="90">
                90+
              </option>

            </select>

          </div>

          {/* Sort */}

          <div>

            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Sort
            </label>

            <select
              name="sort"
              defaultValue={sort}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 outline-none"
            >

              <option value="score">
                Highest score
              </option>

              <option value="name">
                Company A–Z
              </option>

              <option value="fleet-small">
                Smallest fleet
              </option>

              <option value="fleet-large">
                Largest fleet
              </option>

              <option value="recent">
                Recently synced
              </option>

            </select>

          </div>

        </div>

        {/* Boolean filters */}

        <div className="mt-5 flex flex-wrap items-center gap-5">

          <label className="flex cursor-pointer items-center gap-2 text-sm">

            <input
              type="checkbox"
              name="active"
              value="1"
              defaultChecked={
                activeOnly
              }
              className="h-4 w-4"
            />

            Active only

          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm">

            <input
              type="checkbox"
              name="email"
              value="1"
              defaultChecked={
                hasEmail
              }
              className="h-4 w-4"
            />

            Has email

          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm">

            <input
              type="checkbox"
              name="phone"
              value="1"
              defaultChecked={
                hasPhone
              }
              className="h-4 w-4"
            />

            Has phone

          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm">

            <input
              type="checkbox"
              name="mc"
              value="1"
              defaultChecked={
                hasMC
              }
              className="h-4 w-4"
            />

            Has MC

          </label>

          <button
            type="submit"
            className="ml-auto rounded-lg bg-white px-6 py-2.5 font-semibold text-black hover:bg-zinc-200"
          >
            Apply Filters
          </button>

        </div>

      </form>

      {/* =====================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 p-5 text-red-300">

          <strong>
            Database error:
          </strong>{" "}

          {error.message}

        </div>
      )}

      {/* =====================================================
          RESULT SUMMARY
      ====================================================== */}

      {!error && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">

          <div>
            Showing{" "}

            <span className="font-medium text-white">
              {firstResult.toLocaleString()}
            </span>

            {" – "}

            <span className="font-medium text-white">
              {lastResult.toLocaleString()}
            </span>

            {" of "}

            <span className="font-medium text-white">
              {total.toLocaleString()}
            </span>

          </div>

          <div>

            Page{" "}

            <span className="text-white">
              {page.toLocaleString()}
            </span>

            {" of "}

            <span className="text-white">
              {totalPages.toLocaleString()}
            </span>

          </div>

        </div>
      )}

      {/* =====================================================
          TABLE
      ====================================================== */}

      <div className="overflow-hidden rounded-2xl border border-zinc-800">

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1250px] text-left text-sm">

            <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">

              <tr>

                <th className="px-4 py-4">
                  Score
                </th>

                <th className="px-4 py-4">
                  Company
                </th>

                <th className="px-4 py-4">
                  USDOT
                </th>

                <th className="px-4 py-4">
                  MC
                </th>

                <th className="px-4 py-4">
                  Location
                </th>

                <th className="px-4 py-4 text-center">
                  Trucks
                </th>

                <th className="px-4 py-4 text-center">
                  Drivers
                </th>

                <th className="px-4 py-4">
                  Email
                </th>

                <th className="px-4 py-4">
                  Phone
                </th>

                <th className="px-4 py-4">
                  Status
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-zinc-800">

              {carriers?.map(
                (carrier) => {
                  const score =
                    carrier.lead_score ??
                    0;

                  return (
                    <tr
                      key={carrier.id}
                      className="bg-zinc-950 transition hover:bg-zinc-900/80"
                    >

                      {/* Score */}

                      <td className="px-4 py-4">

                        <span
                          className={`inline-flex min-w-12 justify-center rounded-lg border px-2.5 py-1 font-bold ${scoreClasses(
                            score
                          )}`}
                        >
                          {score}
                        </span>

                      </td>

                      {/* Company */}

                      <td className="max-w-[280px] px-4 py-4">

                        <Link
                          href={`/admin/carriers/${carrier.dot_number}`}
                          className="font-semibold text-white transition hover:text-blue-400 hover:underline"
                        >
                          {carrier.legal_name}
                        </Link>

                        {carrier.dba_name &&
                          carrier.dba_name !==
                            carrier.legal_name && (
                            <div className="mt-1 truncate text-xs text-zinc-500">
                              DBA:{" "}
                              {carrier.dba_name}
                            </div>
                          )}

                      </td>

                      {/* DOT */}

                      <td className="px-4 py-4">

                        <Link
                          href={`/admin/carriers/${carrier.dot_number}`}
                          className="font-mono text-zinc-300 transition hover:text-blue-400 hover:underline"
                        >
                          {carrier.dot_number}
                        </Link>

                      </td>

                      {/* MC */}

                      <td className="px-4 py-4 font-mono text-zinc-300">
                        {carrier.mc_number ??
                          "—"}
                      </td>

                      {/* Location */}

                      <td className="px-4 py-4">

                        <div>
                          {carrier.city ??
                            "—"}
                        </div>

                        <div className="text-xs text-zinc-500">
                          {carrier.state ??
                            "—"}
                        </div>

                      </td>

                      {/* Trucks */}

                      <td className="px-4 py-4 text-center font-semibold">
                        {carrier.power_units ??
                          0}
                      </td>

                      {/* Drivers */}

                      <td className="px-4 py-4 text-center">
                        {carrier.drivers ??
                          0}
                      </td>

                      {/* Email */}

                      <td className="max-w-[240px] px-4 py-4">

                        {carrier.email ? (
                          <a
                            href={`mailto:${carrier.email}`}
                            className="block truncate text-blue-400 hover:underline"
                            title={
                              carrier.email
                            }
                          >
                            {carrier.email}
                          </a>
                        ) : (
                          <span className="text-zinc-600">
                            —
                          </span>
                        )}

                      </td>

                      {/* Phone */}

                      <td className="px-4 py-4">

                        {carrier.phone ? (
                          <a
                            href={`tel:${carrier.phone}`}
                            className="text-zinc-300 hover:text-white"
                          >
                            {carrier.phone}
                          </a>
                        ) : (
                          <span className="text-zinc-600">
                            —
                          </span>
                        )}

                      </td>

                      {/* Status */}

                      <td className="px-4 py-4">

                        {carrier.status_code ===
                        "A" ? (
                          <span className="rounded-full border border-emerald-800 bg-emerald-950 px-2.5 py-1 text-xs font-medium text-emerald-300">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400">
                            {carrier.status_code ??
                              "Unknown"}
                          </span>
                        )}

                      </td>

                    </tr>
                  );
                }
              )}

              {carriers?.length ===
                0 && (
                <tr>

                  <td
                    colSpan={10}
                    className="px-6 py-16 text-center"
                  >

                    <div className="text-lg font-semibold text-zinc-300">
                      No carriers found
                    </div>

                    <div className="mt-2 text-zinc-500">
                      Try changing your search or filters.
                    </div>

                  </td>

                </tr>
              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* =====================================================
          PAGINATION
      ====================================================== */}

      {total > 0 && (
        <div className="flex items-center justify-between">

          {page > 1 ? (
            <Link
              href={buildUrl(
                currentParams,
                {
                  page:
                    page - 1,
                }
              )}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-2.5 hover:bg-zinc-800"
            >
              ← Previous
            </Link>
          ) : (
            <div />
          )}

          <div className="text-sm text-zinc-500">
            {PAGE_SIZE} carriers per page
          </div>

          {page < totalPages ? (
            <Link
              href={buildUrl(
                currentParams,
                {
                  page:
                    page + 1,
                }
              )}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-2.5 hover:bg-zinc-800"
            >
              Next →
            </Link>
          ) : (
            <div />
          )}

        </div>
      )}

    </div>
  );
}