import {
  NextResponse,
} from "next/server";

import {
  Resend,
} from "resend";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";

import {
  recordReliabilityEvent,
} from "@/lib/reliability/events";


export const runtime =
  "nodejs";


const resend =
  new Resend(
    process.env
      .RESEND_API_KEY,
  );


function clean(
  value:
    unknown,
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}


function escapeHtml(
  value:
    string,
) {
  return value
    .replace(
      /&/g,
      "&amp;",
    )
    .replace(
      /</g,
      "&lt;",
    )
    .replace(
      />/g,
      "&gt;",
    )
    .replace(
      /"/g,
      "&quot;",
    )
    .replace(
      /'/g,
      "&#039;",
    );
}


export async function POST(
  request:
    Request,
) {
  try {
    const body =
      await request.json();


    const name =
      clean(
        body?.name,
      );


    const email =
      clean(
        body?.email,
      )
        .toLowerCase();


    const phone =
      clean(
        body?.phone,
      );


    const message =
      clean(
        body?.message,
      );


    if (
      !name ||
      !email ||
      !message
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Please fill all required fields.",
        },
        {
          status:
            400,
        },
      );
    }


    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email,
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Please enter a valid email address.",
        },
        {
          status:
            400,
        },
      );
    }


    if (
      name.length >
        150 ||
      email.length >
        320 ||
      phone.length >
        80 ||
      message.length >
        5000
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Submission is too large.",
        },
        {
          status:
            400,
        },
      );
    }


    const supabase =
      createAdminSupabase();


    const {
      data:
        lead,

      error:
        databaseError,
    } =
      await supabase
        .from(
          "leads",
        )
        .insert({
          name,
          email,

          phone:
            phone ||
            null,

          message,

          source:
            "website",
        })
        .select(
          "id",
        )
        .single();


    if (
      databaseError ||
      !lead
    ) {
      console.error(
        "CONTACT LEAD DATABASE ERROR:",
        databaseError?.message,
      );


      await recordReliabilityEvent({
        source:
          "contact",

        eventType:
          "lead_insert_failed",

        severity:
          "error",

        message:
          "Website contact submission could not be stored.",

        metadata: {
          email,
          database_error:
            databaseError?.message ??
            "Unknown database error",
        },
      });


      return NextResponse.json(
        {
          success:
            false,

          error:
            "Unable to save your request.",
        },
        {
          status:
            500,
        },
      );
    }


    const safeName =
      escapeHtml(
        name,
      );


    const safeEmail =
      escapeHtml(
        email,
      );


    const safePhone =
      escapeHtml(
        phone ||
        "-",
      );


    const safeMessage =
      escapeHtml(
        message,
      )
        .replace(
          /\n/g,
          "<br />",
        );


    const internalResult =
      await resend
        .emails
        .send({
          from:
            "SlateLane Dispatch <contact@slatelanedispatch.com>",

          to: [
            "contact@slatelanedispatch.com",
          ],

          replyTo:
            email,

          subject:
            `New Dispatch Lead - ${name}`,

          html: `
            <div
              style="
                font-family:Arial,sans-serif;
                padding:30px;
                background:#0f172a;
                color:white;
              "
            >
              <h1 style="color:#38bdf8">
                New Website Lead
              </h1>

              <hr />

              <p>
                <strong>Name</strong><br />
                ${safeName}
              </p>

              <p>
                <strong>Email</strong><br />
                ${safeEmail}
              </p>

              <p>
                <strong>Phone</strong><br />
                ${safePhone}
              </p>

              <p>
                <strong>Message</strong>
              </p>

              <div
                style="
                  padding:15px;
                  background:#1e293b;
                  border-radius:8px;
                "
              >
                ${safeMessage}
              </div>
            </div>
          `,
        });


    if (
      internalResult.error
    ) {
      console.error(
        "CONTACT NOTIFICATION EMAIL ERROR:",
        internalResult.error,
      );


      await recordReliabilityEvent({
        source:
          "contact",

        eventType:
          "internal_notification_failed",

        severity:
          "warning",

        message:
          "Website lead was saved but internal notification email failed.",

        entityType:
          "lead",

        entityId:
          lead.id,

        metadata: {
          email,
          resend_error:
            internalResult.error,
        },
      });
    }


    const confirmationResult =
      await resend
        .emails
        .send({
          from:
            "SlateLane Dispatch <contact@slatelanedispatch.com>",

          to: [
            email,
          ],

          subject:
            "We received your request | SlateLane Dispatch",

          html: `
            <div
              style="
                font-family:Arial,sans-serif;
                padding:30px;
              "
            >
              <h2>
                Hi ${safeName},
              </h2>

              <p>
                Thank you for contacting
                <strong>SlateLane Dispatch</strong>.
                We received your request successfully.
                One of our dispatch specialists will
                contact you shortly.
              </p>

              <br />

              <strong>
                SlateLane Dispatch
              </strong>

              <br />

              contact@slatelanedispatch.com
            </div>
          `,
        });


    if (
      confirmationResult.error
    ) {
      console.error(
        "CONTACT CONFIRMATION EMAIL ERROR:",
        confirmationResult.error,
      );


      await recordReliabilityEvent({
        source:
          "contact",

        eventType:
          "customer_confirmation_failed",

        severity:
          "warning",

        message:
          "Website lead was saved but customer confirmation email failed.",

        entityType:
          "lead",

        entityId:
          lead.id,

        metadata: {
          email,
          resend_error:
            confirmationResult.error,
        },
      });
    }


    return NextResponse.json({
      success:
        true,
    });
  } catch (
    error
  ) {
    console.error(
      "CONTACT FORM ERROR:",
      error,
    );


    await recordReliabilityEvent({
      source:
        "contact",

      eventType:
        "contact_route_exception",

      severity:
        "error",

      message:
        "Unhandled website contact route exception.",

      metadata: {
        error:
          error instanceof
          Error
            ? error.message
            : String(
                error,
              ),
      },
    });


    return NextResponse.json(
      {
        success:
          false,

        error:
          "Unable to process your request.",
      },
      {
        status:
          500,
      },
    );
  }
}