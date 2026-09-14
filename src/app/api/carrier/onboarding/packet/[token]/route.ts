import {
  createHash,
} from "crypto";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  NextResponse,
} from "next/server";

import {
  CARRIER_PACKET_VERSION,
  CarrierPacketFormData,
} from "@/lib/onboarding/carrier-packet";

import {
  generateCarrierPacketPdf,
} from "@/lib/onboarding/generate-carrier-packet-pdf";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

function getAdminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "Missing Supabase URL.",
    );
  }

  if (!key) {
    throw new Error(
      "Missing Supabase server key.",
    );
  }

  return createClient(
    url,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function response(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",

        Pragma:
          "no-cache",

        Expires:
          "0",
      },
    },
  );
}

function hashToken(
  token: string,
) {
  return createHash(
    "sha256",
  )
    .update(token)
    .digest("hex");
}

function hashBytes(
  bytes: Uint8Array,
) {
  return createHash(
    "sha256",
  )
    .update(
      Buffer.from(
        bytes,
      ),
    )
    .digest("hex");
}

function clean(
  value: unknown,
  max = 5000,
) {
  return String(
    value ?? "",
  )
    .trim()
    .slice(0, max);
}

function normalizeEmail(
  value: string,
) {
  return value
    .trim()
    .toLowerCase();
}

function normalizeName(
  value: string,
) {
  return value
    .trim()
    .replace(
      /\s+/g,
      " ",
    )
    .toLowerCase();
}

function validEmail(
  value: string,
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function parseDotNumber(
  value: string,
) {
  const digits =
    value.replace(
      /\D/g,
      "",
    );

  if (!digits) {
    return null;
  }

  const parsed =
    Number(digits);

  if (
    !Number.isSafeInteger(
      parsed,
    ) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function nullableNumber(
  value: string,
) {
  if (
    !value.trim()
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed,
    ) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

function positiveInteger(
  value: string,
) {
  const parsed =
    Number.parseInt(
      value,
      10,
    );

  if (
    !Number.isSafeInteger(
      parsed,
    ) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function toArray(
  value: string,
) {
  return value
    .split(
      /[\n,;]/g,
    )
    .map(
      (item) =>
        item.trim(),
    )
    .filter(Boolean)
    .slice(0, 100);
}

async function resolveLink(
  token: string,
) {
  const supabase =
    getAdminSupabase();

  const tokenHash =
    hashToken(token);

  const {
    data: link,
    error: linkError,
  } = await supabase
    .from(
      "carrier_onboarding_links",
    )
    .select("*")
    .eq(
      "token_hash",
      tokenHash,
    )
    .eq(
      "document_type",
      "carrier_packet",
    )
    .maybeSingle();

  if (linkError) {
    throw new Error(
      linkError.message,
    );
  }

  if (!link) {
    return {
      supabase,

      error:
        "invalid" as const,
    };
  }

  const {
    data: onboarding,
    error:
      onboardingError,
  } = await supabase
    .from(
      "carrier_onboardings",
    )
    .select("*")
    .eq(
      "id",
      link.onboarding_id,
    )
    .maybeSingle();

  if (
    onboardingError
  ) {
    throw new Error(
      onboardingError.message,
    );
  }

  if (!onboarding) {
    return {
      supabase,

      error:
        "invalid" as const,
    };
  }

  return {
    supabase,
    link,
    onboarding,

    error:
      null,
  };
}

/*
|--------------------------------------------------------------------------
| GET PACKET
|--------------------------------------------------------------------------
*/

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const {
      token,
    } =
      await context.params;

    if (
      !token ||
      token.length < 20
    ) {
      return response(
        {
          ok: false,

          error:
            "Invalid Carrier Packet link.",
        },
        404,
      );
    }

    const resolved =
      await resolveLink(
        token,
      );

    if (
      resolved.error
    ) {
      return response(
        {
          ok: false,

          error:
            "This Carrier Packet link is invalid.",
        },
        404,
      );
    }

    const {
      supabase,
      link,
      onboarding,
    } = resolved;

    if (
      link.status ===
      "completed"
    ) {
      return response({
        ok: true,

        completed:
          true,

        company_name:
          onboarding.company_name,

        completed_at:
          link.completed_at,
      });
    }

    if (
      link.status ===
        "revoked" ||
      link.status ===
        "expired"
    ) {
      return response(
        {
          ok: false,

          error:
            "This secure Carrier Packet link is no longer active.",
        },
        410,
      );
    }

    const expiresAt =
      new Date(
        link.expires_at,
      );

    if (
      Number.isNaN(
        expiresAt.getTime(),
      ) ||
      expiresAt.getTime() <=
        Date.now()
    ) {
      await supabase
        .from(
          "carrier_onboarding_links",
        )
        .update({
          status:
            "expired",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          link.id,
        )
        .eq(
          "status",
          "active",
        );

      return response(
        {
          ok: false,

          error:
            "This Carrier Packet link has expired. Please request a new packet from Slate Lane Dispatch.",
        },
        410,
      );
    }

    await supabase
      .from(
        "carrier_onboarding_links",
      )
      .update({
        last_opened_at:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        link.id,
      );

    return response({
      ok: true,

      completed:
        false,

      expires_at:
        link.expires_at,

      recipient_email:
        link.recipient_email,

      packet_version:
        CARRIER_PACKET_VERSION,

      prefill: {
        company_name:
          onboarding.company_name ||
          "",

        dot_number:
          onboarding.dot_number
            ?.toString() ||
          "",

        mc_number:
          onboarding.mc_number ||
          "",

        primary_contact_name:
          onboarding.primary_contact_name ||
          "",

        primary_contact_email:
          link.recipient_email ||
          onboarding.primary_contact_email ||
          "",

        primary_contact_phone:
          onboarding.primary_contact_phone ||
          "",

        business_address:
          "",

        city:
          "",

        state:
          "",

        zip_code:
          "",

        home_terminal:
          "",

        operation_type:
          "OTR",

        equipment_type:
          "",

        trailer_type:
          "",

        truck_count:
          "",

        driver_count:
          "",

        minimum_rate_per_mile:
          onboarding.minimum_rate_per_mile
            ?.toString() ||
          "",

        weekly_revenue_target:
          onboarding.weekly_revenue_target
            ?.toString() ||
          "",

        preferred_lanes:
          Array.isArray(
            onboarding.preferred_lanes,
          )
            ? onboarding.preferred_lanes.join(
                ", ",
              )
            : "",

        preferred_states:
          Array.isArray(
            onboarding.preferred_states,
          )
            ? onboarding.preferred_states.join(
                ", ",
              )
            : "",

        regions_to_avoid:
          Array.isArray(
            onboarding.regions_to_avoid,
          )
            ? onboarding.regions_to_avoid.join(
                ", ",
              )
            : "",

        home_time_notes:
          onboarding.home_time_notes ||
          "",

        operating_notes:
          onboarding.operating_notes ||
          "",

        factoring_company:
          onboarding.factoring_company ||
          "",

        factoring_contact_email:
          "",

        insurance_company:
          onboarding.insurance_company ||
          "",

        insurance_policy_number:
          "",

        insurance_expiration:
          onboarding.insurance_expiration ||
          "",

        auto_liability_limit:
          "",

        cargo_limit:
          "",

        load_board_provider:
          onboarding.load_board_provider ||
          "",

        emergency_contact_name:
          "",

        emergency_contact_phone:
          "",

        certification_name:
          onboarding.primary_contact_name ||
          "",

        certification_title:
          "",

        certification_email:
          link.recipient_email ||
          onboarding.primary_contact_email ||
          "",

        electronic_signature:
          "",

        consent:
          false,
      },
    });
  } catch (error) {
    console.error(
      "Carrier Packet GET error:",
      error,
    );

    return response(
      {
        ok: false,

        error:
          "Unable to load this Carrier Packet right now.",
      },
      500,
    );
  }
}

/*
|--------------------------------------------------------------------------
| SUBMIT PACKET
|--------------------------------------------------------------------------
*/

export async function POST(
  request: Request,
  context: RouteContext,
) {
  let uploadedBucket:
    | string
    | null = null;

  let uploadedPath:
    | string
    | null = null;

  try {
    const {
      token,
    } =
      await context.params;

    if (
      !token ||
      token.length < 20
    ) {
      return response(
        {
          ok: false,

          error:
            "Invalid Carrier Packet link.",
        },
        404,
      );
    }

    const resolved =
      await resolveLink(
        token,
      );

    if (
      resolved.error
    ) {
      return response(
        {
          ok: false,

          error:
            "This Carrier Packet link is invalid.",
        },
        404,
      );
    }

    const {
      supabase,
      link,
      onboarding,
    } = resolved;

    if (
      link.status ===
      "completed"
    ) {
      return response(
        {
          ok: false,

          error:
            "This Carrier Packet has already been completed.",
        },
        409,
      );
    }

    if (
      link.status !==
      "active"
    ) {
      return response(
        {
          ok: false,

          error:
            "This Carrier Packet link is no longer active.",
        },
        410,
      );
    }

    if (
      new Date(
        link.expires_at,
      ).getTime() <=
      Date.now()
    ) {
      await supabase
        .from(
          "carrier_onboarding_links",
        )
        .update({
          status:
            "expired",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          link.id,
        );

      return response(
        {
          ok: false,

          error:
            "This Carrier Packet link has expired.",
        },
        410,
      );
    }

    const raw =
      await request.json();

    const form: CarrierPacketFormData =
      {
        company_name:
          clean(
            raw.company_name,
            300,
          ),

        dot_number:
          clean(
            raw.dot_number,
            30,
          ),

        mc_number:
          clean(
            raw.mc_number,
            50,
          ),

        primary_contact_name:
          clean(
            raw.primary_contact_name,
            200,
          ),

        primary_contact_email:
          clean(
            raw.primary_contact_email,
            320,
          ),

        primary_contact_phone:
          clean(
            raw.primary_contact_phone,
            100,
          ),

        business_address:
          clean(
            raw.business_address,
            500,
          ),

        city:
          clean(
            raw.city,
            200,
          ),

        state:
          clean(
            raw.state,
            100,
          ),

        zip_code:
          clean(
            raw.zip_code,
            30,
          ),

        home_terminal:
          clean(
            raw.home_terminal,
            300,
          ),

        operation_type:
          clean(
            raw.operation_type,
            100,
          ),

        equipment_type:
          clean(
            raw.equipment_type,
            300,
          ),

        trailer_type:
          clean(
            raw.trailer_type,
            300,
          ),

        truck_count:
          clean(
            raw.truck_count,
            20,
          ),

        driver_count:
          clean(
            raw.driver_count,
            20,
          ),

        minimum_rate_per_mile:
          clean(
            raw.minimum_rate_per_mile,
            30,
          ),

        weekly_revenue_target:
          clean(
            raw.weekly_revenue_target,
            30,
          ),

        preferred_lanes:
          clean(
            raw.preferred_lanes,
            3000,
          ),

        preferred_states:
          clean(
            raw.preferred_states,
            2000,
          ),

        regions_to_avoid:
          clean(
            raw.regions_to_avoid,
            2000,
          ),

        home_time_notes:
          clean(
            raw.home_time_notes,
            3000,
          ),

        operating_notes:
          clean(
            raw.operating_notes,
            5000,
          ),

        factoring_company:
          clean(
            raw.factoring_company,
            300,
          ),

        factoring_contact_email:
          clean(
            raw.factoring_contact_email,
            320,
          ),

        insurance_company:
          clean(
            raw.insurance_company,
            300,
          ),

        insurance_policy_number:
          clean(
            raw.insurance_policy_number,
            200,
          ),

        insurance_expiration:
          clean(
            raw.insurance_expiration,
            30,
          ),

        auto_liability_limit:
          clean(
            raw.auto_liability_limit,
            100,
          ),

        cargo_limit:
          clean(
            raw.cargo_limit,
            100,
          ),

        load_board_provider:
          clean(
            raw.load_board_provider,
            200,
          ),

        emergency_contact_name:
          clean(
            raw.emergency_contact_name,
            200,
          ),

        emergency_contact_phone:
          clean(
            raw.emergency_contact_phone,
            100,
          ),

        certification_name:
          clean(
            raw.certification_name,
            200,
          ),

        certification_title:
          clean(
            raw.certification_title,
            150,
          ),

        certification_email:
          clean(
            raw.certification_email,
            320,
          ),

        electronic_signature:
          clean(
            raw.electronic_signature,
            200,
          ),

        consent:
          raw.consent ===
          true,
      };

    /*
    |--------------------------------------------------------------------------
    | VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
      !form.company_name
    ) {
      return response(
        {
          ok: false,

          error:
            "Company name is required.",
        },
        400,
      );
    }

    const dotNumber =
      parseDotNumber(
        form.dot_number,
      );

    if (!dotNumber) {
      return response(
        {
          ok: false,

          error:
            "A valid USDOT number is required.",
        },
        400,
      );
    }

    if (
      !form.primary_contact_name
    ) {
      return response(
        {
          ok: false,

          error:
            "Primary contact name is required.",
        },
        400,
      );
    }

    if (
      !form.primary_contact_email ||
      !validEmail(
        form.primary_contact_email,
      )
    ) {
      return response(
        {
          ok: false,

          error:
            "A valid primary contact email is required.",
        },
        400,
      );
    }

    if (
      normalizeEmail(
        form.primary_contact_email,
      ) !==
      normalizeEmail(
        link.recipient_email,
      )
    ) {
      return response(
        {
          ok: false,

          error:
            "The primary contact email must match the email address that received this secure Carrier Packet.",
        },
        400,
      );
    }

    if (
      !form.primary_contact_phone
    ) {
      return response(
        {
          ok: false,

          error:
            "Primary contact phone is required.",
        },
        400,
      );
    }

    if (
      !form.business_address ||
      !form.city ||
      !form.state ||
      !form.zip_code
    ) {
      return response(
        {
          ok: false,

          error:
            "Complete business address is required.",
        },
        400,
      );
    }

    if (
      !form.operation_type
    ) {
      return response(
        {
          ok: false,

          error:
            "Operation type is required.",
        },
        400,
      );
    }

    if (
      !form.equipment_type
    ) {
      return response(
        {
          ok: false,

          error:
            "Equipment type is required.",
        },
        400,
      );
    }

    const truckCount =
      positiveInteger(
        form.truck_count,
      );

    if (!truckCount) {
      return response(
        {
          ok: false,

          error:
            "Enter a valid number of trucks.",
        },
        400,
      );
    }

    let driverCount:
      | number
      | null = null;

    if (
      form.driver_count
    ) {
      driverCount =
        positiveInteger(
          form.driver_count,
        );

      if (!driverCount) {
        return response(
          {
            ok: false,

            error:
              "Enter a valid number of drivers.",
          },
          400,
        );
      }
    }

    if (
      !form.certification_name
    ) {
      return response(
        {
          ok: false,

          error:
            "Authorized representative name is required.",
        },
        400,
      );
    }

    if (
      !form.certification_title
    ) {
      return response(
        {
          ok: false,

          error:
            "Authorized representative title is required.",
        },
        400,
      );
    }

    if (
      !form.certification_email ||
      !validEmail(
        form.certification_email,
      )
    ) {
      return response(
        {
          ok: false,

          error:
            "A valid certification email is required.",
        },
        400,
      );
    }

    if (
      normalizeEmail(
        form.certification_email,
      ) !==
      normalizeEmail(
        link.recipient_email,
      )
    ) {
      return response(
        {
          ok: false,

          error:
            "The certification email must match the email address that received the secure packet.",
        },
        400,
      );
    }

    if (
      !form.electronic_signature
    ) {
      return response(
        {
          ok: false,

          error:
            "Electronic certification signature is required.",
        },
        400,
      );
    }

    if (
      normalizeName(
        form.certification_name,
      ) !==
      normalizeName(
        form.electronic_signature,
      )
    ) {
      return response(
        {
          ok: false,

          error:
            "Your electronic signature must match the authorized representative name.",
        },
        400,
      );
    }

    if (!form.consent) {
      return response(
        {
          ok: false,

          error:
            "You must certify the Carrier Packet before submitting.",
        },
        400,
      );
    }

    const minimumRate =
      nullableNumber(
        form.minimum_rate_per_mile,
      );

    const weeklyRevenue =
      nullableNumber(
        form.weekly_revenue_target,
      );

    /*
    |--------------------------------------------------------------------------
    | AUDIT
    |--------------------------------------------------------------------------
    */

    const submittedAt =
      new Date().toISOString();

    const forwardedFor =
      request.headers.get(
        "x-forwarded-for",
      );

    const ip =
      forwardedFor
        ?.split(",")[0]
        ?.trim() ||
      request.headers.get(
        "x-real-ip",
      ) ||
      null;

    const userAgent =
      request.headers.get(
        "user-agent",
      );

    /*
    |--------------------------------------------------------------------------
    | GENERATE PDF
    |--------------------------------------------------------------------------
    */

    const pdfBytes =
      await generateCarrierPacketPdf(
        {
          form,

          submittedAt,

          audit: {
            ip,
            userAgent,
          },
        },
      );

    const safeCompany =
      form.company_name
        .replace(
          /[^a-zA-Z0-9]+/g,
          "-",
        )
        .replace(
          /^-+|-+$/g,
          "",
        )
        .slice(
          0,
          80,
        ) ||
      "carrier";

    const timestamp =
      submittedAt.replace(
        /[:.]/g,
        "-",
      );

    const fileName =
      `SlateLane-${safeCompany}-Carrier-Credential-Packet-${timestamp}.pdf`;

    const storageBucket =
      "carrier-document-vault";

    const storagePath =
      `onboarding/${onboarding.id}/carrier-packet/${fileName}`;

    uploadedBucket =
      storageBucket;

    uploadedPath =
      storagePath;

    const {
      error: uploadError,
    } =
      await supabase.storage
        .from(
          storageBucket,
        )
        .upload(
          storagePath,

          Buffer.from(
            pdfBytes,
          ),

          {
            contentType:
              "application/pdf",

            upsert:
              false,

            cacheControl:
              "0",
          },
        );

    if (uploadError) {
      throw new Error(
        `Carrier Packet PDF upload failed: ${uploadError.message}`,
      );
    }

    const pdfSha256 =
      hashBytes(
        pdfBytes,
      );

    /*
    |--------------------------------------------------------------------------
    | DOCUMENT RECORD
    |--------------------------------------------------------------------------
    */

    const {
      data:
        generatedDocument,

      error:
        documentError,
    } = await supabase
      .from(
        "carrier_document_records",
      )
      .insert({
        onboarding_id:
          onboarding.id,

        carrier_id:
          onboarding.carrier_id ||
          null,

        document_type:
          "carrier_packet",

        status:
          "received",

        storage_bucket:
          storageBucket,

        storage_path:
          storagePath,

        file_name:
          fileName,

        mime_type:
          "application/pdf",

        file_size_bytes:
          pdfBytes.length,

        sha256:
          pdfSha256,

        sent_to_email:
          link.recipient_email,

        received_at:
          submittedAt,

        signer_name:
          form.certification_name,

        signer_title:
          form.certification_title,

        metadata: {
          source:
            "secure_browser_form",

          packet_version:
            CARRIER_PACKET_VERSION,

          secure_link_id:
            link.id,

          electronically_certified:
            true,

          electronic_signature:
            form.electronic_signature,

          pdf_generated:
            true,
        },

        updated_at:
          submittedAt,
      })
      .select("*")
      .single();

    if (
      documentError ||
      !generatedDocument
    ) {
      throw new Error(
        `Carrier Packet document record failed: ${documentError?.message || "Unknown error"}`,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | SUBMISSION
    |--------------------------------------------------------------------------
    */

    const submissionData =
      {
        company_name:
          form.company_name,

        dot_number:
          form.dot_number,

        mc_number:
          form.mc_number,

        primary_contact_name:
          form.primary_contact_name,

        primary_contact_email:
          form.primary_contact_email,

        primary_contact_phone:
          form.primary_contact_phone,

        business_address:
          form.business_address,

        city:
          form.city,

        state:
          form.state,

        zip_code:
          form.zip_code,

        home_terminal:
          form.home_terminal,

        operation_type:
          form.operation_type,

        equipment_type:
          form.equipment_type,

        trailer_type:
          form.trailer_type,

        truck_count:
          truckCount,

        driver_count:
          driverCount,

        minimum_rate_per_mile:
          minimumRate,

        weekly_revenue_target:
          weeklyRevenue,

        preferred_lanes:
          toArray(
            form.preferred_lanes,
          ),

        preferred_states:
          toArray(
            form.preferred_states,
          ),

        regions_to_avoid:
          toArray(
            form.regions_to_avoid,
          ),

        home_time_notes:
          form.home_time_notes,

        operating_notes:
          form.operating_notes,

        factoring_company:
          form.factoring_company,

        factoring_contact_email:
          form.factoring_contact_email,

        insurance_company:
          form.insurance_company,

        insurance_policy_number:
          form.insurance_policy_number,

        insurance_expiration:
          form.insurance_expiration ||
          null,

        auto_liability_limit:
          form.auto_liability_limit,

        cargo_limit:
          form.cargo_limit,

        load_board_provider:
          form.load_board_provider,

        emergency_contact_name:
          form.emergency_contact_name,

        emergency_contact_phone:
          form.emergency_contact_phone,

        electronic_signature:
          form.electronic_signature,

        consent:
          true,
      };

    const auditData =
      {
        submitted_at:
          submittedAt,

        ip_address:
          ip,

        user_agent:
          userAgent,

        packet_version:
          CARRIER_PACKET_VERSION,

        recipient_email:
          link.recipient_email,

        secure_link_id:
          link.id,

        token_hash_verified:
          true,

        pdf_sha256:
          pdfSha256,
      };

    const {
      data:
        submission,

      error:
        submissionError,
    } = await supabase
      .from(
        "carrier_onboarding_submissions",
      )
      .insert({
        link_id:
          link.id,

        onboarding_id:
          onboarding.id,

        document_type:
          "carrier_packet",

        signer_name:
          form.certification_name,

        signer_title:
          form.certification_title,

        signer_email:
          form.certification_email,

        agreement_version:
          CARRIER_PACKET_VERSION,

        consented_at:
          submittedAt,

        generated_document_id:
          generatedDocument.id,

        submission_data:
          submissionData,

        audit_data:
          auditData,
      })
      .select("*")
      .single();

    if (
      submissionError ||
      !submission
    ) {
      throw new Error(
        `Carrier Packet submission record failed: ${submissionError?.message || "Unknown error"}`,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE ONBOARDING
    |--------------------------------------------------------------------------
    */

    const {
      error:
        onboardingUpdateError,
    } = await supabase
      .from(
        "carrier_onboardings",
      )
      .update({
        company_name:
          form.company_name,

        dot_number:
          dotNumber,

        mc_number:
          form.mc_number ||
          null,

        primary_contact_name:
          form.primary_contact_name,

        primary_contact_email:
          form.primary_contact_email,

        primary_contact_phone:
          form.primary_contact_phone,

        minimum_rate_per_mile:
          minimumRate,

        weekly_revenue_target:
          weeklyRevenue,

        preferred_lanes:
          toArray(
            form.preferred_lanes,
          ),

        preferred_states:
          toArray(
            form.preferred_states,
          ),

        regions_to_avoid:
          toArray(
            form.regions_to_avoid,
          ),

        home_time_notes:
          form.home_time_notes ||
          null,

        operating_notes:
          form.operating_notes ||
          null,

        factoring_company:
          form.factoring_company ||
          null,

        insurance_company:
          form.insurance_company ||
          null,

        insurance_expiration:
          form.insurance_expiration ||
          null,

        load_board_provider:
          form.load_board_provider ||
          null,

        status:
          onboarding.status ===
          "draft"
            ? "paperwork_pending"
            : onboarding.status,

        updated_at:
          submittedAt,
      })
      .eq(
        "id",
        onboarding.id,
      );

    if (
      onboardingUpdateError
    ) {
      throw new Error(
        `Carrier onboarding update failed: ${onboardingUpdateError.message}`,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | COMPLETE LINK
    |--------------------------------------------------------------------------
    */

    const {
      error:
        linkUpdateError,
    } = await supabase
      .from(
        "carrier_onboarding_links",
      )
      .update({
        status:
          "completed",

        completed_at:
          submittedAt,

        submission_document_id:
          generatedDocument.id,

        metadata: {
          ...(link.metadata ||
            {}),

          delivery:
            "secure_browser_form",

          packet_version:
            CARRIER_PACKET_VERSION,

          submission_id:
            submission.id,

          generated_document_id:
            generatedDocument.id,
        },

        updated_at:
          submittedAt,
      })
      .eq(
        "id",
        link.id,
      )
      .eq(
        "status",
        "active",
      );

    if (
      linkUpdateError
    ) {
      throw new Error(
        `Carrier Packet secure link completion failed: ${linkUpdateError.message}`,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | EVENT
    |--------------------------------------------------------------------------
    */

    const {
      error: eventError,
    } = await supabase
      .from(
        "carrier_document_events",
      )
      .insert({
        onboarding_id:
          onboarding.id,

        document_id:
          generatedDocument.id,

        event_type:
          "status_changed",

        from_status:
          "sent",

        to_status:
          "received",

        actor:
          "carrier",

        note:
          `Carrier Credential Packet completed by ${form.certification_name}`,

        metadata: {
          packet_version:
            CARRIER_PACKET_VERSION,

          submission_id:
            submission.id,

          recipient_email:
            link.recipient_email,

          pdf_sha256:
            pdfSha256,

          source:
            "secure_browser_form",
        },
      });

    if (
      eventError
    ) {
      console.error(
        "Carrier Packet event error:",
        eventError,
      );
    }

    return response({
      ok: true,

      completed:
        true,

      message:
        "Your Carrier Credential Packet has been completed successfully.",

      received_at:
        submittedAt,

      document_id:
        generatedDocument.id,

      submission_id:
        submission.id,
    });
  } catch (error) {
    console.error(
      "Carrier Packet POST error:",
      error,
    );

    if (
      uploadedBucket &&
      uploadedPath
    ) {
      try {
        const supabase =
          getAdminSupabase();

        await supabase.storage
          .from(
            uploadedBucket,
          )
          .remove([
            uploadedPath,
          ]);
      } catch (
        cleanupError
      ) {
        console.error(
          "Carrier Packet PDF cleanup error:",
          cleanupError,
        );
      }
    }

    return response(
      {
        ok: false,

        error:
          "We could not complete your Carrier Packet. Your secure link has not been marked completed. Please try again.",
      },
      500,
    );
  }
}