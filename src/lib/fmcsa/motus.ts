import {
  createServerSupabase,
} from "./supabase/server";


const DATA_BASE =
  "https://data.transportation.gov/resource";

/*
 * Current operating-authority summary.
 */
const MOTUS_CARRIER_DATASET =
  "inys-ebih";

/*
 * Operating-authority status history.
 */
const MOTUS_AUTH_HISTORY_DATASET =
  "yu5v-wbh6";


type MotusCarrierRow = {
  docket_number?: string;
  usdot_number?: string;

  op_auth_type?: string;
  op_auth_status?: string;

  legal_name?: string;
  dba_name?: string;
};


type MotusHistoryRow = {
  docket_number?: string;
  usdot_number?: string;

  op_auth_type?: string;
  op_auth_status?: string;

  reason?: string;

  status_change_date?: string;
};


export interface AuthoritySummary {
  dotNumber: number;

  docketNumber: string | null;

  authorityType: string | null;

  authorityStatus: string | null;

  authorityReason: string | null;

  authorityDate: string | null;

  authorityAgeDays: number | null;

  authorityAgeYears: number | null;

  currentRecordsFound: number;

  historyRecordsFound: number;
}


function clean(
  value: unknown
): string | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const result =
    String(value).trim();

  return result
    ? result
    : null;
}


function normalize(
  value: unknown
): string {
  return (
    clean(value)
      ?.toUpperCase() ??
    ""
  );
}


function normalizeDocket(
  value: unknown
): string {
  const raw =
    normalize(value)
      .replace(/[^A-Z0-9]/g, "");

  const match =
    raw.match(
      /^(MC|MX|FF)0*(\d+)$/
    );

  if (!match) {
    return raw;
  }

  return `${match[1]}${match[2]}`;
}


function isActive(
  value: unknown
): boolean {
  return (
    normalize(value) ===
    "ACTIVE"
  );
}


function parseFMCSADate(
  value: unknown
): string | null {
  const raw =
    clean(value);

  if (!raw) {
    return null;
  }

  /*
   * MOTUS AuthHist uses YYYYMMDD.
   */
  if (
    /^\d{8}$/.test(raw)
  ) {
    const year =
      raw.slice(0, 4);

    const month =
      raw.slice(4, 6);

    const day =
      raw.slice(6, 8);

    const result =
      `${year}-${month}-${day}`;

    const date =
      new Date(
        `${result}T00:00:00Z`
      );

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return result;
    }
  }

  return null;
}


function dateTime(
  value: unknown
): number {
  const date =
    parseFMCSADate(
      value
    );

  if (!date) {
    return 0;
  }

  return new Date(
    `${date}T00:00:00Z`
  ).getTime();
}


function calculateAgeDays(
  date: string | null
): number | null {
  if (!date) {
    return null;
  }

  const start =
    new Date(
      `${date}T00:00:00Z`
    );

  if (
    Number.isNaN(
      start.getTime()
    )
  ) {
    return null;
  }

  const now =
    new Date();

  const difference =
    now.getTime() -
    start.getTime();

  if (
    difference < 0
  ) {
    return 0;
  }

  return Math.floor(
    difference /
      (
        1000 *
        60 *
        60 *
        24
      )
  );
}


/*
 * Dispatch-specific priority.
 *
 * Property-carrier authority is more
 * useful to SlateLane than broker or
 * passenger authority.
 */
function authorityPriority(
  authorityType: unknown
): number {
  const type =
    normalize(
      authorityType
    );

  if (
    type.includes(
      "MOTOR CARRIER"
    ) &&
    type.includes(
      "PROPERTY"
    ) &&
    !type.includes(
      "HOUSEHOLD"
    )
  ) {
    return 100;
  }

  if (
    type.includes(
      "MOTOR CARRIER"
    ) &&
    type.includes(
      "PROPERTY"
    )
  ) {
    return 90;
  }

  if (
    type.includes(
      "MOTOR CARRIER"
    )
  ) {
    return 80;
  }

  if (
    type.includes(
      "FREIGHT FORWARD"
    )
  ) {
    return 40;
  }

  if (
    type.includes(
      "BROKER"
    )
  ) {
    return 20;
  }

  return 10;
}


async function fetchSocrata<
  T
>(
  datasetId: string,
  dotNumber: number,
  limit = 1000
): Promise<T[]> {
  const url =
    new URL(
      `${DATA_BASE}/${datasetId}.json`
    );

  /*
   * Official API field name.
   */
  url.searchParams.set(
    "usdot_number",
    String(dotNumber)
  );

  url.searchParams.set(
    "$limit",
    String(limit)
  );


  const headers:
    Record<string, string> =
    {
      Accept:
        "application/json",
    };


  /*
   * Optional.
   *
   * The public dataset works without
   * a token, but if we later create a
   * Socrata app token it can be added
   * to .env.local:
   *
   * SOCRATA_APP_TOKEN=...
   */
  const appToken =
    process.env
      .SOCRATA_APP_TOKEN;

  if (appToken) {
    headers[
      "X-App-Token"
    ] = appToken;
  }


  const response =
    await fetch(
      url,
      {
        headers,

        cache:
          "no-store",
      }
    );


  if (!response.ok) {
    const body =
      await response.text();

    throw new Error(
      [
        `MOTUS request failed`,
        `${response.status}`,
        response.statusText,
        body.slice(
          0,
          300
        ),
      ].join(
        ": "
      )
    );
  }


  const data =
    await response.json();

  if (
    !Array.isArray(
      data
    )
  ) {
    throw new Error(
      "Unexpected MOTUS response."
    );
  }


  return data as T[];
}


export async function getCarrierAuthority(
  dotNumber: number
): Promise<AuthoritySummary> {
  if (
    !Number.isFinite(
      dotNumber
    ) ||
    dotNumber <= 0
  ) {
    throw new Error(
      "Invalid USDOT number."
    );
  }


  /*
   * Get current authority records and
   * history simultaneously.
   */
  const [
    currentRecords,
    historyRecords,
  ] =
    await Promise.all([
      fetchSocrata<
        MotusCarrierRow
      >(
        MOTUS_CARRIER_DATASET,
        dotNumber,
        100
      ),

      fetchSocrata<
        MotusHistoryRow
      >(
        MOTUS_AUTH_HISTORY_DATASET,
        dotNumber,
        1000
      ),
    ]);


  /*
   * ==========================================================
   * SELECT BEST CURRENT AUTHORITY
   * ==========================================================
   */

  const activeRecords =
    currentRecords.filter(
      (record) =>
        isActive(
          record.op_auth_status
        )
    );


  const candidates =
    activeRecords.length > 0
      ? activeRecords
      : currentRecords;


  candidates.sort(
    (a, b) => {
      const statusDifference =
        Number(
          isActive(
            b.op_auth_status
          )
        ) -
        Number(
          isActive(
            a.op_auth_status
          )
        );

      if (
        statusDifference !== 0
      ) {
        return statusDifference;
      }

      return (
        authorityPriority(
          b.op_auth_type
        ) -
        authorityPriority(
          a.op_auth_type
        )
      );
    }
  );


  const selectedCurrent =
    candidates[0] ??
    null;


  /*
   * ==========================================================
   * SELECT HISTORY FOR CURRENT AUTHORITY
   * ==========================================================
   */

  let relevantHistory =
    historyRecords;


  if (
    selectedCurrent
      ?.docket_number
  ) {
    const targetDocket =
      normalizeDocket(
        selectedCurrent
          .docket_number
      );

    const sameDocket =
      historyRecords.filter(
        (record) =>
          normalizeDocket(
            record.docket_number
          ) ===
          targetDocket
      );

    if (
      sameDocket.length >
      0
    ) {
      relevantHistory =
        sameDocket;
    }
  }


  if (
    selectedCurrent
      ?.op_auth_type
  ) {
    const targetType =
      normalize(
        selectedCurrent
          .op_auth_type
      );

    const sameType =
      relevantHistory.filter(
        (record) =>
          normalize(
            record.op_auth_type
          ) ===
          targetType
      );

    if (
      sameType.length >
      0
    ) {
      relevantHistory =
        sameType;
    }
  }


  relevantHistory.sort(
    (a, b) =>
      dateTime(
        b.status_change_date
      ) -
      dateTime(
        a.status_change_date
      )
  );


  const latestHistory =
    relevantHistory[0] ??
    null;


  /*
   * If current status is active,
   * find the most recent transition
   * into ACTIVE status.
   *
   * This gives us "current authority
   * active since", which is more useful
   * for dispatch prospecting than the
   * Company Census ADD_DATE.
   */
  let authorityDate:
    string | null =
    null;


  const status =
    clean(
      selectedCurrent
        ?.op_auth_status
    ) ??
    clean(
      latestHistory
        ?.op_auth_status
    );


  if (
    isActive(status)
  ) {
    const activeEvents =
      relevantHistory
        .filter(
          (record) =>
            isActive(
              record
                .op_auth_status
            )
        )
        .sort(
          (a, b) =>
            dateTime(
              b
                .status_change_date
            ) -
            dateTime(
              a
                .status_change_date
            )
        );

    authorityDate =
      parseFMCSADate(
        activeEvents[0]
          ?.status_change_date
      );
  }


  const ageDays =
    calculateAgeDays(
      authorityDate
    );


  return {
    dotNumber,

    docketNumber:
      clean(
        selectedCurrent
          ?.docket_number
      ) ??
      clean(
        latestHistory
          ?.docket_number
      ),

    authorityType:
      clean(
        selectedCurrent
          ?.op_auth_type
      ) ??
      clean(
        latestHistory
          ?.op_auth_type
      ),

    authorityStatus:
      status,

    authorityReason:
      clean(
        latestHistory
          ?.reason
      ),

    authorityDate,

    authorityAgeDays:
      ageDays,

    authorityAgeYears:
      ageDays === null
        ? null
        : Math.floor(
            ageDays /
              365.25
          ),

    currentRecordsFound:
      currentRecords.length,

    historyRecordsFound:
      historyRecords.length,
  };
}


export async function enrichCarrierAuthority(
  dotNumber: number
): Promise<AuthoritySummary> {
  const authority =
    await getCarrierAuthority(
      dotNumber
    );


  const supabase =
    createServerSupabase();


  const {
    error,
  } =
    await supabase
      .from("carriers")
      .update({
        authority_docket:
          authority
            .docketNumber,

        authority_type:
          authority
            .authorityType,

        authority_status:
          authority
            .authorityStatus,

        authority_reason:
          authority
            .authorityReason,

        authority_date:
          authority
            .authorityDate,

        authority_age:
          authority
            .authorityAgeYears,

        authority_age_days:
          authority
            .authorityAgeDays,

        authority_enriched_at:
          new Date()
            .toISOString(),

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "dot_number",
        dotNumber
      );


  if (error) {
    throw new Error(
      `Could not save MOTUS authority data: ${error.message}`
    );
  }


  return authority;
}