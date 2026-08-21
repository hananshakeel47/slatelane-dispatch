import {
  createAdminSupabase,
} from "@/lib/supabase/admin";


export const runtime =
  "nodejs";


async function unsubscribe(
  request: Request
) {
  const url =
    new URL(
      request.url
    );


  const token =
    url.searchParams.get(
      "token"
    );


  if (!token) {
    return {
      success: false,
      status: 400,
      message:
        "Missing unsubscribe token.",
    };
  }


  const supabase =
    createAdminSupabase();


  // ==========================================================
  // FIND LEAD
  // ==========================================================

  const {
    data: lead,
    error:
      leadError,
  } = await supabase
    .from("leads")
    .select(`
      id,
      email,
      email_opt_out
    `)
    .eq(
      "unsubscribe_token",
      token
    )
    .maybeSingle();


  if (
    leadError ||
    !lead
  ) {
    return {
      success: false,
      status: 404,
      message:
        "This unsubscribe link is invalid or expired.",
    };
  }


  // Already unsubscribed.
  // Still return success so the link remains idempotent.
  if (
    lead.email_opt_out
  ) {
    return {
      success: true,
      status: 200,
      message:
        "You are already unsubscribed from SlateLane outreach emails.",
    };
  }


  const now =
    new Date()
      .toISOString();


  // ==========================================================
  // MARK LEAD AS UNSUBSCRIBED
  // ==========================================================

  const {
    error:
      updateError,
  } = await supabase
    .from("leads")
    .update({
      email_opt_out:
        true,

      unsubscribed_at:
        now,

      updated_at:
        now,
    })
    .eq(
      "id",
      lead.id
    );


  if (updateError) {
    throw new Error(
      `Could not unsubscribe lead: ${updateError.message}`
    );
  }


  // ==========================================================
  // ADD LOCAL SUPPRESSION
  // ==========================================================

  if (lead.email) {
    const normalizedEmail =
      lead.email
        .trim()
        .toLowerCase();


    const {
      error:
        suppressionError,
    } = await supabase
      .from(
        "email_suppressions"
      )
      .upsert(
        {
          email:
            normalizedEmail,

          reason:
            "unsubscribe",

          source:
            "slatelane",
        },
        {
          onConflict:
            "email",
        }
      );


    if (
      suppressionError
    ) {
      console.error(
        "Could not create unsubscribe suppression:",
        suppressionError.message
      );
    }
  }


  // ==========================================================
  // STOP ALL AUTOMATION FOR THIS LEAD
  // ==========================================================

  const {
    error:
      enrollmentError,
  } = await supabase
    .from(
      "email_sequence_enrollments"
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
      lead.id
    )
    .in(
      "status",
      [
        "active",
        "paused",
      ]
    );


  if (
    enrollmentError
  ) {
    console.error(
      "Could not stop email sequences:",
      enrollmentError.message
    );
  }


  return {
    success: true,
    status: 200,
    message:
      "You have been unsubscribed from SlateLane outreach emails.",
  };
}


// ============================================================
// GET
//
// Used when recipient clicks the unsubscribe link manually.
// ============================================================

export async function GET(
  request: Request
) {
  try {
    const result =
      await unsubscribe(
        request
      );


    const title =
      result.success
        ? "Unsubscribed"
        : "Unable to unsubscribe";


    const html = `
<!doctype html>

<html lang="en">

<head>

  <meta charset="utf-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />

  <title>
    SlateLane Email Preferences
  </title>

</head>


<body
  style="
    margin:0;
    background:#09090b;
    color:#ffffff;
    font-family:Arial,Helvetica,sans-serif;
  "
>

  <main
    style="
      max-width:620px;
      margin:80px auto;
      padding:24px;
    "
  >

    <div
      style="
        border:1px solid #27272a;
        border-radius:16px;
        background:#18181b;
        padding:32px;
      "
    >

      <div
        style="
          color:#a1a1aa;
          font-size:13px;
          margin-bottom:12px;
        "
      >
        SlateLane Dispatch
      </div>


      <h1
        style="
          margin:0 0 18px;
          font-size:30px;
        "
      >
        ${title}
      </h1>


      <p
        style="
          margin:0;
          color:#d4d4d8;
          line-height:1.6;
        "
      >
        ${result.message}
      </p>


      ${
        result.success
          ? `
            <p
              style="
                margin-top:22px;
                color:#a1a1aa;
                line-height:1.6;
              "
            >
              You will not receive further automated
              SlateLane outreach emails.
            </p>
          `
          : ""
      }

    </div>

  </main>

</body>

</html>
`;


    return new Response(
      html,
      {
        status:
          result.status,

        headers: {
          "Content-Type":
            "text/html; charset=utf-8",
        },
      }
    );

  } catch (
    error
  ) {
    console.error(
      "UNSUBSCRIBE ERROR:",
      error
    );


    return new Response(
      "Unable to process unsubscribe request.",
      {
        status: 500,
      }
    );
  }
}


// ============================================================
// POST
//
// Used for one-click List-Unsubscribe requests.
// ============================================================

export async function POST(
  request: Request
) {
  try {
    const result =
      await unsubscribe(
        request
      );


    return Response.json(
      {
        success:
          result.success,

        message:
          result.message,
      },
      {
        status:
          result.status,
      }
    );

  } catch (
    error
  ) {
    console.error(
      "ONE-CLICK UNSUBSCRIBE ERROR:",
      error
    );


    return Response.json(
      {
        success: false,
        message:
          "Unable to process unsubscribe request.",
      },
      {
        status: 500,
      }
    );
  }
}