import {
  NextResponse,
} from "next/server";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


function clean(
  value: unknown,
) {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const result =
    value.trim();

  return result || null;
}


function numberOrNull(
  value: unknown,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(
    number,
  )
    ? number
    : null;
}


function addDays(
  iso: string,
  days: number,
) {
  const date =
    new Date(iso);

  date.setUTCDate(
    date.getUTCDate() +
      days,
  );

  return date.toISOString();
}


async function getProspect(
  id: string,
) {
  const supabase =
    createAdminSupabase();

  const {
    data,
    error,
  } = await supabase
    .from(
      "linkedin_prospects",
    )
    .select("*")
    .eq(
      "id",
      id,
    )
    .maybeSingle();

  if (
    error ||
    !data
  ) {
    throw new Error(
      error?.message ||
        "LinkedIn prospect not found.",
    );
  }

  return data;
}


async function syncToLead(
  prospect: any,
) {
  const supabase =
    createAdminSupabase();

  if (
    prospect.lead_id
  ) {
    return prospect.lead_id;
  }


  const email =
    clean(
      prospect.email,
    )?.toLowerCase();


  if (
    !email ||
    !email.includes("@")
  ) {
    return null;
  }


  const {
    data:
      existingLead,

    error:
      existingError,
  } = await supabase
    .from(
      "leads",
    )
    .select(
      "id",
    )
    .ilike(
      "email",
      email,
    )
    .limit(1)
    .maybeSingle();


  if (
    existingError
  ) {
    throw new Error(
      existingError.message,
    );
  }


  let leadId:
    string;


  if (
    existingLead?.id
  ) {

    leadId =
      String(
        existingLead.id,
      );

  } else {

    const fullName =
      [
        prospect.first_name,
        prospect.last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();


    const baseName =
      fullName ||
      prospect.company_name ||
      "LinkedIn Prospect";


    /*
     * leads.name is currently unique/PK.
     * LinkedIn ID suffix avoids duplicate
     * name conflicts.
     */
    const uniqueName =
      `${baseName} [LI-${String(
        prospect.id,
      ).slice(
        0,
        8,
      )}]`;


    const notes =
      [
        "Qualified from SlateLane LinkedIn outreach.",

        `LinkedIn: ${prospect.linkedin_url}`,

        prospect.job_title
          ? `Title: ${prospect.job_title}`
          : null,

        prospect.location
          ? `Location: ${prospect.location}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");


    const {
      data:
        created,

      error:
        createError,
    } = await supabase
      .from(
        "leads",
      )
      .insert({
        name:
          uniqueName,

        email,

        phone:
          clean(
            prospect.phone,
          ),

        company_name:
          clean(
            prospect.company_name,
          ),

        carrier_dot_number:
          prospect.carrier_dot_number,

        source:
          "linkedin",

        status:
          "interested",

        message:
          clean(
            prospect.reply_text,
          ),

        notes,

        updated_at:
          new Date()
            .toISOString(),
      })
      .select(
        "id",
      )
      .single();


    if (
      createError ||
      !created
    ) {
      throw new Error(
        createError?.message ||
          "Could not create CRM lead.",
      );
    }


    leadId =
      String(
        created.id,
      );
  }


  const {
    error:
      linkError,
  } = await supabase
    .from(
      "linkedin_prospects",
    )
    .update({
      lead_id:
        leadId,

      updated_at:
        new Date()
          .toISOString(),
    })
    .eq(
      "id",
      prospect.id,
    );


  if (
    linkError
  ) {
    throw new Error(
      linkError.message,
    );
  }


  return leadId;
}


export async function GET() {

  try {

    const supabase =
      createAdminSupabase();


    const [
      settingsResult,
      statusResult,
      templatesResult,
      prospectsResult,
    ] =
      await Promise.all([

        supabase
          .from(
            "linkedin_outreach_settings",
          )
          .select("*")
          .eq(
            "id",
            1,
          )
          .maybeSingle(),


        supabase
          .from(
            "linkedin_outreach_status",
          )
          .select("*")
          .maybeSingle(),


        supabase
          .from(
            "linkedin_message_templates",
          )
          .select("*")
          .eq(
            "active",
            true,
          )
          .order(
            "step_number",
            {
              ascending:
                true,
            },
          ),


        supabase
          .from(
            "linkedin_prospects",
          )
          .select("*")
          .order(
            "updated_at",
            {
              ascending:
                false,
            },
          )
          .limit(300),

      ]);


    const error =
      settingsResult.error ||
      statusResult.error ||
      templatesResult.error ||
      prospectsResult.error;


    if (
      error
    ) {
      throw new Error(
        error.message,
      );
    }


    return NextResponse.json(
      {
        success:
          true,

        settings:
          settingsResult.data,

        status:
          statusResult.data,

        templates:
          templatesResult.data ??
          [],

        prospects:
          prospectsResult.data ??
          [],
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );

  } catch (
    error
  ) {

    console.error(
      "LINKEDIN GET ERROR:",
      error,
    );


    return NextResponse.json(
      {
        success:
          false,

        message:
          error instanceof
          Error
            ? error.message
            : "Could not load LinkedIn outreach.",
      },
      {
        status:
          500,
      },
    );
  }
}


export async function POST(
  request: Request,
) {

  try {

    const supabase =
      createAdminSupabase();


    const body =
      await request.json();


    const mode =
      clean(
        body.mode,
      );


    /*
     * ======================================
     * CREATE PROSPECT
     * ======================================
     */

    if (
      mode ===
      "create"
    ) {

      const linkedinUrl =
        clean(
          body.linkedin_url,
        );


      if (
        !linkedinUrl ||
        !linkedinUrl
          .toLowerCase()
          .includes(
            "linkedin.com/",
          )
      ) {

        return NextResponse.json(
          {
            success:
              false,

            message:
              "Valid LinkedIn profile URL required.",
          },
          {
            status:
              400,
          },
        );
      }


      const {
        error,
      } = await supabase
        .from(
          "linkedin_prospects",
        )
        .insert({
          linkedin_url:
            linkedinUrl,

          first_name:
            clean(
              body.first_name,
            ),

          last_name:
            clean(
              body.last_name,
            ),

          company_name:
            clean(
              body.company_name,
            ),

          job_title:
            clean(
              body.job_title,
            ),

          location:
            clean(
              body.location,
            ),

          email:
            clean(
              body.email,
            )?.toLowerCase() ??
            null,

          phone:
            clean(
              body.phone,
            ),

          carrier_dot_number:
            numberOrNull(
              body.carrier_dot_number,
            ),

          source:
            "linkedin_manual",

          status:
            "new",

          updated_at:
            new Date()
              .toISOString(),
        });


      if (
        error
      ) {

        if (
          error.code ===
          "23505"
        ) {

          return NextResponse.json(
            {
              success:
                false,

              message:
                "This LinkedIn profile is already in your outreach pipeline.",
            },
            {
              status:
                409,
            },
          );
        }


        throw new Error(
          error.message,
        );
      }


      return NextResponse.json({
        success:
          true,

        message:
          "LinkedIn prospect added.",
      });
    }


    const prospectId =
      clean(
        body.prospect_id,
      );


    if (
      !prospectId
    ) {

      return NextResponse.json(
        {
          success:
            false,

          message:
            "Prospect ID required.",
        },
        {
          status:
            400,
        },
      );
    }


    /*
     * ======================================
     * MANUAL CRM LEAD SYNC
     * ======================================
     */

    if (
      mode ===
      "sync"
    ) {

      const email =
        clean(
          body.email,
        )?.toLowerCase();


      if (
        !email ||
        !email.includes("@")
      ) {

        return NextResponse.json(
          {
            success:
              false,

            message:
              "A valid email is required to sync this prospect to CRM Leads.",
          },
          {
            status:
              400,
          },
        );
      }


      const {
        error:
          updateError,
      } = await supabase
        .from(
          "linkedin_prospects",
        )
        .update({
          email,

          phone:
            clean(
              body.phone,
            ),

          status:
            "qualified",

          qualified_at:
            new Date()
              .toISOString(),

          next_followup_at:
            null,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          prospectId,
        );


      if (
        updateError
      ) {
        throw new Error(
          updateError.message,
        );
      }


      const prospect =
        await getProspect(
          prospectId,
        );


      const leadId =
        await syncToLead(
          prospect,
        );


      return NextResponse.json({
        success:
          true,

        lead_id:
          leadId,

        message:
          "LinkedIn prospect synced to CRM Leads.",
      });
    }


    /*
     * ======================================
     * OUTREACH ACTIONS
     * ======================================
     */

    if (
      mode !==
      "action"
    ) {

      return NextResponse.json(
        {
          success:
            false,

          message:
            "Unsupported LinkedIn request.",
        },
        {
          status:
            400,
        },
      );
    }


    const action =
      clean(
        body.action,
      );


    const prospect =
      await getProspect(
        prospectId,
      );


    const {
      data:
        settings,

      error:
        settingsError,
    } = await supabase
      .from(
        "linkedin_outreach_settings",
      )
      .select("*")
      .eq(
        "id",
        1,
      )
      .maybeSingle();


    if (
      settingsError ||
      !settings
    ) {
      throw new Error(
        settingsError?.message ||
          "LinkedIn outreach settings are missing.",
      );
    }


    const now =
      new Date()
        .toISOString();


    const update:
      Record<
        string,
        unknown
      > = {
        updated_at:
          now,
      };


    let eventType:
      string | null =
      null;


    let stepNumber:
      number | null =
      null;


    let eventMessage:
      string | null =
      null;


    let responseMessage =
      "Prospect updated.";


    /*
     * CONNECTION REQUEST
     */

    if (
      action ===
      "connection_requested"
    ) {

      update.status =
        "connection_pending";

      update.connection_requested_at =
        now;

      update.next_followup_at =
        null;


      eventType =
        "connection_requested";


      responseMessage =
        "Connection request recorded.";
    }


    /*
     * CONNECTION ACCEPTED
     */

    else if (
      action ===
      "connection_accepted"
    ) {

      update.status =
        "connected";

      update.connected_at =
        now;

      /*
       * First LinkedIn message becomes
       * immediately due.
       */
      update.next_followup_at =
        now;


      eventType =
        "connection_accepted";


      responseMessage =
        "Connection accepted. First message is now ready.";
    }


    /*
     * MESSAGE / FOLLOW-UP SENT
     */

    else if (
      action ===
      "message_sent"
    ) {

      const step =
        Number(
          body.step_number,
        );


      if (
        !Number.isInteger(
          step,
        ) ||
        step < 1 ||
        step > 4
      ) {

        return NextResponse.json(
          {
            success:
              false,

            message:
              "Invalid LinkedIn message step.",
          },
          {
            status:
              400,
          },
        );
      }


      const d1 =
        Number(
          settings.followup_1_delay_days ??
            2,
        );


      const d2 =
        Number(
          settings.followup_2_delay_days ??
            4,
        );


      const d3 =
        Number(
          settings.followup_3_delay_days ??
            7,
        );


      let delay:
        number | null =
        null;


      /*
       * Sequence:
       *
       * Step 1 = acceptance message
       * Step 2 = day 2
       * Step 3 = day 4
       * Step 4 = day 7 final follow-up
       */

      if (
        step === 1
      ) {

        delay =
          Math.max(
            1,
            d1,
          );
      }


      else if (
        step === 2
      ) {

        delay =
          Math.max(
            1,
            d2 - d1,
          );
      }


      else if (
        step === 3
      ) {

        delay =
          Math.max(
            1,
            d3 - d2,
          );
      }


      update.status =
        "messaged";


      update.first_message_at =
        prospect.first_message_at ??
        now;


      update.last_message_at =
        now;


      update.last_step_sent =
        step;


      /*
       * Step 4 is final, therefore
       * no further follow-up date.
       */
      update.next_followup_at =
        delay === null
          ? null
          : addDays(
              now,
              delay,
            );


      eventType =
        "message_sent";


      stepNumber =
        step;


      eventMessage =
        clean(
          body.message_body,
        );


      responseMessage =
        step === 4
          ? "Final LinkedIn follow-up recorded."
          : `LinkedIn message step ${step} recorded.`;
    }


    /*
     * REPLY RECEIVED
     */

    else if (
      action ===
      "reply_received"
    ) {

      const replyText =
        clean(
          body.reply_text,
        );


      if (
        !replyText
      ) {

        return NextResponse.json(
          {
            success:
              false,

            message:
              "Reply text is required.",
          },
          {
            status:
              400,
          },
        );
      }


      update.status =
        "replied";


      update.replied_at =
        now;


      update.reply_text =
        replyText;


      /*
       * A reply permanently stops
       * the automated follow-up queue.
       */
      update.next_followup_at =
        null;


      eventType =
        "reply_received";


      eventMessage =
        replyText;


      responseMessage =
        "LinkedIn reply recorded. Follow-ups stopped.";
    }


    /*
     * QUALIFIED
     */

    else if (
      action ===
      "qualified"
    ) {

      update.status =
        "qualified";


      update.qualified_at =
        now;


      update.next_followup_at =
        null;


      eventType =
        "qualified";


      responseMessage =
        "Prospect marked qualified.";
    }


    /*
     * NOT INTERESTED
     */

    else if (
      action ===
      "not_interested"
    ) {

      update.status =
        "not_interested";


      update.next_followup_at =
        null;


      eventType =
        "not_interested";


      responseMessage =
        "Prospect marked not interested.";
    }


    else {

      return NextResponse.json(
        {
          success:
            false,

          message:
            "Unsupported LinkedIn action.",
        },
        {
          status:
            400,
        },
      );
    }


    const {
      error:
        updateError,
    } = await supabase
      .from(
        "linkedin_prospects",
      )
      .update(
        update,
      )
      .eq(
        "id",
        prospectId,
      );


    if (
      updateError
    ) {
      throw new Error(
        updateError.message,
      );
    }


    /*
     * Store permanent event history.
     */

    if (
      eventType
    ) {

      const {
        error:
          eventError,
      } = await supabase
        .from(
          "linkedin_outreach_events",
        )
        .insert({
          prospect_id:
            prospectId,

          event_type:
            eventType,

          step_number:
            stepNumber,

          message_body:
            eventMessage,

          occurred_at:
            now,
        });


      if (
        eventError
      ) {
        throw new Error(
          eventError.message,
        );
      }
    }


    /*
     * Automatically sync qualified
     * prospects when an email already
     * exists.
     */

    if (
      action ===
        "qualified"
    ) {

      const updatedProspect =
        await getProspect(
          prospectId,
        );


      if (
        updatedProspect.email
      ) {

        const leadId =
          await syncToLead(
            updatedProspect,
          );


        if (
          leadId
        ) {
          responseMessage =
            "Qualified and synced to CRM Leads.";
        }
      } else {

        responseMessage =
          "Prospect qualified. Add their email to sync into CRM Leads.";
      }
    }


    return NextResponse.json({
      success:
        true,

      message:
        responseMessage,
    });

  } catch (
    error
  ) {

    console.error(
      "LINKEDIN POST ERROR:",
      error,
    );


    return NextResponse.json(
      {
        success:
          false,

        message:
          error instanceof
          Error
            ? error.message
            : "LinkedIn action failed.",
      },
      {
        status:
          500,
      },
    );
  }
}