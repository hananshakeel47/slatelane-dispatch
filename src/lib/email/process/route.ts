import {
  NextResponse,
} from "next/server";

import {
  processDueEmailEnrollments,
} from "@/lib/email/sequences";


export const runtime =
  "nodejs";


export async function POST(
  request: Request
) {
  try {
    const secret =
      process.env
        .EMAIL_PROCESS_SECRET;


    if (!secret) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "EMAIL_PROCESS_SECRET is not configured.",
        },

        {
          status: 500,
        }
      );
    }


    const authorization =
      request.headers.get(
        "authorization"
      );


    if (
      authorization !==
      `Bearer ${secret}`
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Unauthorized.",
        },

        {
          status: 401,
        }
      );
    }


    let limit =
      10;


    try {
      const body =
        await request.json();

      if (
        Number.isFinite(
          Number(
            body?.limit
          )
        )
      ) {
        limit =
          Number(
            body.limit
          );
      }
    } catch {
      // Body is optional.
    }


    const result =
      await processDueEmailEnrollments(
        limit
      );


    return NextResponse.json({
      success:
        true,

      ...result,
    });

  } catch (
    error
  ) {
    console.error(
      "EMAIL PROCESS ERROR:",
      error
    );


    return NextResponse.json(
      {
        success:
          false,

        message:
          error instanceof Error
            ? error.message
            : "Unknown email processing error.",
      },

      {
        status: 500,
      }
    );
  }
}