import {
  createAdminSupabase,
} from "@/lib/supabase/admin";


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
      success:
        false,

      status:
        400,

      message:
        "Missing unsubscribe token.",
    };
  }


  const supabase =
    createAdminSupabase();


  const {
    data: lead,
    error,
  } = await supabase
    .from("leads")
    .select(`
      id,
      email
    `)
    .eq(
      "unsubscribe_token",
      token
    )
    .maybeSingle();


  if (
    error ||
    !lead
  ) {
    return {
      success:
        false,

      status:
        404,

      message:
        "Unsubscribe link is invalid.",
    };
  }


  const now =
    new Date()
      .toISOString();


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
      updateError.message
    );
  }


  if (lead.email) {
    await supabase
      .from(
        "email_suppressions"
      )
      .upsert(
        {
          email:
            lead.email
              .trim()
              .toLowerCase(),

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
  }


  /*
   * Immediately stop all active
   * sequences for this lead.
   */

  await supabase
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
    .eq(
      "status",
      "active"
    );


  return {
    success:
      true,

    status:
      200,

    message:
      "You have been unsubscribed.",
  };
}


export async function GET(
  request: Request
) {
  try {
    const result =
      await unsubscribe(
        request
      );


    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>SlateLane Email Preferences</title>
</head>

<body
  style="
    font-family:Arial,sans-serif;
    max-width:600px;
    margin:60px auto;
    padding:20px;
    line-height:1.6;
  "
>

  <h1>
    ${
      result.success
        ? "Unsubscribed"
        : "Unable to unsubscribe"
    }
  </h1>

  <p>
    ${result.message}
  </p>

  ${
    result.success
      ? `
        <p>
          You will not receive further
          SlateLane outreach emails.
        </p>
      `
      : ""
  }

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
    return new Response(
      "Unable to process unsubscribe request.",
      {
        status: 500,
      }
    );
  }
}


/*
 * Supports RFC-style one-click
 * unsubscribe requests from mailbox
 * providers.
 */

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

  } catch {
    return Response.json(
      {
        success:
          false,
      },

      {
        status: 500,
      }
    );
  }
}