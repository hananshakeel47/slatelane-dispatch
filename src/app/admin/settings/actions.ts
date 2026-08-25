"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";


function integerValue(
  formData: FormData,
  name: string,
  fallback: number
) {
  const value =
    Number(
      formData.get(
        name
      )
    );


  if (
    !Number.isFinite(
      value
    )
  ) {
    return fallback;
  }


  return Math.floor(
    value
  );
}


function booleanValue(
  formData: FormData,
  name: string
) {
  return (
    String(
      formData.get(
        name
      ) ?? "false"
    ) === "true"
  );
}


function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}


export async function updateLaunchSettingsAction(
  formData: FormData
) {
  const supabase =
    createAdminSupabase();


  const sendingHourStart =
    clamp(
      integerValue(
        formData,
        "sending_hour_start",
        9
      ),
      0,
      23
    );


  let sendingHourEnd =
    clamp(
      integerValue(
        formData,
        "sending_hour_end",
        17
      ),
      1,
      24
    );


  if (
    sendingHourEnd <=
    sendingHourStart
  ) {
    sendingHourEnd =
      Math.min(
        24,
        sendingHourStart + 1
      );
  }


  const timeZone =
    String(
      formData.get(
        "sending_timezone"
      ) ??
      "America/Chicago"
    )
      .trim()
      .slice(
        0,
        100
      );


  /*
   * Validate timezone before writing it.
   */
  try {
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
      }
    ).format(
      new Date()
    );
  } catch {
    throw new Error(
      "Invalid sending timezone."
    );
  }


  const notes =
    String(
      formData.get(
        "notes"
      ) ?? ""
    )
      .trim()
      .slice(
        0,
        2000
      );


  const now =
    new Date().toISOString();


  const {
    error,
  } = await supabase
    .from(
      "email_launch_settings"
    )
    .update({
      sending_enabled:
        booleanValue(
          formData,
          "sending_enabled"
        ),

      daily_send_cap:
        clamp(
          integerValue(
            formData,
            "daily_send_cap",
            25
          ),
          0,
          10000
        ),

      max_batch_size:
        clamp(
          integerValue(
            formData,
            "max_batch_size",
            10
          ),
          1,
          100
        ),

      sending_hour_start:
        sendingHourStart,

      sending_hour_end:
        sendingHourEnd,

      sending_timezone:
        timeZone,

      minimum_carrier_score:
        clamp(
          integerValue(
            formData,
            "minimum_carrier_score",
            80
          ),
          0,
          100
        ),

      require_active_authority:
        booleanValue(
          formData,
          "require_active_authority"
        ),

      require_email:
        booleanValue(
          formData,
          "require_email"
        ),

      skip_replied:
        booleanValue(
          formData,
          "skip_replied"
        ),

      skip_bounced:
        booleanValue(
          formData,
          "skip_bounced"
        ),

      skip_complained:
        booleanValue(
          formData,
          "skip_complained"
        ),

      skip_opted_out:
        booleanValue(
          formData,
          "skip_opted_out"
        ),

      pilot_mode:
        booleanValue(
          formData,
          "pilot_mode"
        ),

      pilot_limit:
        clamp(
          integerValue(
            formData,
            "pilot_limit",
            25
          ),
          1,
          1000
        ),

      notes:
        notes ||
        null,

      updated_at:
        now,
    })
    .eq(
      "id",
      1
    );


  if (error) {
    throw new Error(
      `Could not update launch controls: ${error.message}`
    );
  }


  revalidatePath(
    "/admin/settings"
  );

  revalidatePath(
    "/admin/dashboard"
  );
}