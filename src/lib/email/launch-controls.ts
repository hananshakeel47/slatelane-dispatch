import {
  createAdminSupabase,
} from "@/lib/supabase/admin";


export type EmailLaunchSettings = {
  id: number;
  sending_enabled: boolean;
  daily_send_cap: number;
  max_batch_size: number;
  sending_hour_start: number;
  sending_hour_end: number;
  sending_timezone: string;
  minimum_carrier_score: number;
  require_active_authority: boolean;
  require_email: boolean;
  skip_replied: boolean;
  skip_bounced: boolean;
  skip_complained: boolean;
  skip_opted_out: boolean;
  pilot_mode: boolean;
  pilot_limit: number;
  notes: string | null;
  updated_at: string;
};


function getZonedParts(
  date: Date,
  timeZone: string
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }
    );


  const parts =
    formatter.formatToParts(
      date
    );


  const map =
    Object.fromEntries(
      parts.map(
        (
          part
        ) => [
          part.type,
          part.value,
        ]
      )
    );


  return {
    year:
      Number(
        map.year
      ),

    month:
      Number(
        map.month
      ),

    day:
      Number(
        map.day
      ),

    hour:
      Number(
        map.hour
      ),

    minute:
      Number(
        map.minute
      ),

    second:
      Number(
        map.second
      ),
  };
}


function timeZoneOffsetMs(
  date: Date,
  timeZone: string
) {
  const parts =
    getZonedParts(
      date,
      timeZone
    );


  const asUtc =
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );


  return (
    asUtc -
    date.getTime()
  );
}


function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
) {
  const guess =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        hour,
        minute,
        second
      )
    );


  const firstOffset =
    timeZoneOffsetMs(
      guess,
      timeZone
    );


  let result =
    new Date(
      guess.getTime() -
      firstOffset
    );


  const secondOffset =
    timeZoneOffsetMs(
      result,
      timeZone
    );


  if (
    secondOffset !==
    firstOffset
  ) {
    result =
      new Date(
        guess.getTime() -
        secondOffset
      );
  }


  return result;
}


function nextCalendarDay(
  year: number,
  month: number,
  day: number
) {
  const next =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + 1
      )
    );


  return {
    year:
      next.getUTCFullYear(),

    month:
      next.getUTCMonth() + 1,

    day:
      next.getUTCDate(),
  };
}


export function getOperationalDayBounds(
  timeZone: string,
  now = new Date()
) {
  const local =
    getZonedParts(
      now,
      timeZone
    );


  const next =
    nextCalendarDay(
      local.year,
      local.month,
      local.day
    );


  const start =
    zonedDateTimeToUtc(
      local.year,
      local.month,
      local.day,
      0,
      0,
      0,
      timeZone
    );


  const end =
    zonedDateTimeToUtc(
      next.year,
      next.month,
      next.day,
      0,
      0,
      0,
      timeZone
    );


  return {
    start,
    end,
  };
}


export function getCurrentLocalHour(
  timeZone: string,
  now = new Date()
) {
  return getZonedParts(
    now,
    timeZone
  ).hour;
}


export function isWithinSendingWindow(
  settings:
    EmailLaunchSettings,
  now = new Date()
) {
  const hour =
    getCurrentLocalHour(
      settings.sending_timezone,
      now
    );


  return (
    hour >=
      settings.sending_hour_start &&
    hour <
      settings.sending_hour_end
  );
}


export function effectiveDailyCap(
  settings:
    EmailLaunchSettings
) {
  if (
    settings.pilot_mode
  ) {
    return Math.min(
      settings.daily_send_cap,
      settings.pilot_limit
    );
  }


  return settings.daily_send_cap;
}


export async function getLaunchSettings() {
  const supabase =
    createAdminSupabase();


  const {
    data,
    error,
  } = await supabase
    .from(
      "email_launch_settings"
    )
    .select("*")
    .eq(
      "id",
      1
    )
    .single();


  if (
    error ||
    !data
  ) {
    throw new Error(
      `Could not load email launch settings: ${
        error?.message ||
        "Settings missing."
      }`
    );
  }


  return data as
    EmailLaunchSettings;
}


export async function countEmailsSentToday(
  settings:
    EmailLaunchSettings
) {
  const supabase =
    createAdminSupabase();


  const {
    start,
    end,
  } =
    getOperationalDayBounds(
      settings.sending_timezone
    );


  /*
   * Count all created send records.
   * This intentionally counts attempts as well as
   * successful deliveries so failures cannot bypass
   * the safety cap.
   */
  const {
    count,
    error,
  } = await supabase
    .from(
      "email_sends"
    )
    .select(
      "id",
      {
        count:
          "exact",

        head:
          true,
      }
    )
    .gte(
      "created_at",
      start.toISOString()
    )
    .lt(
      "created_at",
      end.toISOString()
    );


  if (error) {
    throw new Error(
      `Could not count today's email sends: ${error.message}`
    );
  }


  return count ?? 0;
}


export async function getLaunchSnapshot() {
  const settings =
    await getLaunchSettings();


  const sentToday =
    await countEmailsSentToday(
      settings
    );


  const cap =
    effectiveDailyCap(
      settings
    );


  const remainingToday =
    Math.max(
      0,
      cap -
      sentToday
    );


  return {
    settings,
    sentToday,
    effectiveCap:
      cap,
    remainingToday,

    withinSendingWindow:
      isWithinSendingWindow(
        settings
      ),

    localHour:
      getCurrentLocalHour(
        settings.sending_timezone
      ),
  };
}