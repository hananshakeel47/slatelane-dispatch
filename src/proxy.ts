import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

import {
  Buffer,
} from "node:buffer";

import {
  NextResponse,
  type NextRequest,
} from "next/server";


/*
 * ============================================================
 * PHASE 3F — ADMIN ACCESS GATE
 * ============================================================
 *
 * Protects internal SlateLane CRM surfaces.
 *
 * Intentionally NOT protected here:
 *
 * /api/email/process
 *   Protected by EMAIL_PROCESS_SECRET.
 *
 * /api/email/webhook
 *   Protected by Resend/Svix signature verification.
 *
 * /api/email/unsubscribe
 *   Public token-based unsubscribe endpoint.
 *
 * /api/carrier/*
 *   Secure token-based carrier onboarding flow.
 *
 * /api/contact
 *   Public website contact form.
 *
 * ============================================================
 */


function digest(
  value:
    string,
) {
  return createHash(
    "sha256",
  )
    .update(
      value,
      "utf8",
    )
    .digest();
}


function secureEqual(
  left:
    string,

  right:
    string,
) {
  return timingSafeEqual(
    digest(
      left,
    ),

    digest(
      right,
    ),
  );
}


function parseBasicAuth(
  authorization:
    string |
    null,
) {
  if (
    !authorization ||
    !authorization.startsWith(
      "Basic ",
    )
  ) {
    return null;
  }


  const encoded =
    authorization
      .slice(
        6,
      )
      .trim();


  if (
    !encoded
  ) {
    return null;
  }


  try {
    const decoded =
      Buffer
        .from(
          encoded,
          "base64",
        )
        .toString(
          "utf8",
        );


    const separator =
      decoded.indexOf(
        ":",
      );


    if (
      separator <=
      0
    ) {
      return null;
    }


    return {
      username:
        decoded.slice(
          0,
          separator,
        ),

      password:
        decoded.slice(
          separator +
            1,
        ),
    };
  } catch {
    return null;
  }
}


function addSecurityHeaders(
  response:
    NextResponse,
) {
  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );

  response.headers.set(
    "Pragma",
    "no-cache",
  );

  response.headers.set(
    "X-Robots-Tag",
    "noindex, nofollow, noarchive, nosnippet",
  );

  response.headers.set(
    "X-Content-Type-Options",
    "nosniff",
  );

  response.headers.set(
    "X-Frame-Options",
    "DENY",
  );

  response.headers.set(
    "Referrer-Policy",
    "no-referrer",
  );


  return response;
}


function unauthorized() {
  const response =
    new NextResponse(
      "Authentication required.",
      {
        status:
          401,

        headers: {
          "WWW-Authenticate":
            'Basic realm="SlateLane Admin", charset="UTF-8"',
        },
      },
    );


  return addSecurityHeaders(
    response,
  );
}


function configurationError() {
  const response =
    new NextResponse(
      "SlateLane admin authentication is not configured.",
      {
        status:
          503,
      },
    );


  return addSecurityHeaders(
    response,
  );
}


export function proxy(
  request:
    NextRequest,
) {
  const expectedUsername =
    process.env
      .SLATELANE_ADMIN_USER
      ?.trim();


  const expectedPassword =
    process.env
      .SLATELANE_ADMIN_PASSWORD;


  /*
   * Fail CLOSED.
   *
   * If production credentials are missing,
   * the admin CRM becomes unavailable rather
   * than accidentally public.
   */

  if (
    !expectedUsername ||
    !expectedPassword
  ) {
    return configurationError();
  }


  const credentials =
    parseBasicAuth(
      request.headers.get(
        "authorization",
      ),
    );


  if (
    !credentials
  ) {
    return unauthorized();
  }


  const usernameValid =
    secureEqual(
      credentials.username,
      expectedUsername,
    );


  const passwordValid =
    secureEqual(
      credentials.password,
      expectedPassword,
    );


  if (
    !usernameValid ||
    !passwordValid
  ) {
    return unauthorized();
  }


  return addSecurityHeaders(
    NextResponse.next(),
  );
}


export const config = {
  matcher: [
    "/admin/:path*",

    "/api/admin/:path*",

    "/api/fmcsa/:path*",

    /*
     * Legacy CRM surfaces are also protected
     * until their redirect executes.
     */
    "/dashboard/:path*",

    "/carriers/:path*",
  ],
};