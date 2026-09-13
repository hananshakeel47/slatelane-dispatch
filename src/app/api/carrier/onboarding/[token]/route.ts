import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  DISPATCH_AGREEMENT_VERSION,
  DispatchAgreementFormData,
  DispatchFeeType,
} from "@/lib/onboarding/dispatch-agreement";

import { generateDispatchAgreementPdf } from "@/lib/onboarding/generate-agreement-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

function getAdminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL",
    );
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function hashToken(token: string) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function hashBytes(bytes: Uint8Array) {
  return createHash("sha256")
    .update(Buffer.from(bytes))
    .digest("hex");
}

function clean(value: unknown, max = 5000) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeSigner(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function nullableNumber(value: string) {
  if (!value.trim()) return null;

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function parseDotNumber(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) return null;

  const parsed = Number(digits);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function toArray(value: string) {
  return value
    .split(/[\n,;]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 100);
}

function isFeeType(
  value: string,
): value is DispatchFeeType {
  return [
    "percentage",
    "flat_per_load",
    "weekly_flat",
  ].includes(value);
}

async function resolveLink(token: string) {
  const supabase = getAdminSupabase();
  const tokenHash = hashToken(token);

  const { data: link, error: linkError } = await supabase
    .from("carrier_onboarding_links")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkError) {
    throw new Error(linkError.message);
  }

  if (!link) {
    return {
      supabase,
      error: "invalid" as const,
    };
  }

  const { data: onboarding, error: onboardingError } =
    await supabase
      .from("carrier_onboardings")
      .select("*")
      .eq("id", link.onboarding_id)
      .maybeSingle();

  if (onboardingError) {
    throw new Error(onboardingError.message);
  }

  if (!onboarding) {
    return {
      supabase,
      error: "invalid" as const,
    };
  }

  return {
    supabase,
    link,
    onboarding,
    error: null,
  };
}

function response(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { token } = await context.params;

    if (!token || token.length < 20) {
      return response(
        {
          ok: false,
          error: "Invalid onboarding link.",
        },
        404,
      );
    }

    const resolved = await resolveLink(token);

    if (resolved.error) {
      return response(
        {
          ok: false,
          error: "This onboarding link is invalid.",
        },
        404,
      );
    }

    const { supabase, link, onboarding } = resolved;

    if (link.status === "completed") {
      return response({
        ok: true,
        completed: true,
        company_name: onboarding.company_name,
        completed_at: link.completed_at,
      });
    }

    if (
      link.status === "revoked" ||
      link.status === "expired"
    ) {
      return response(
        {
          ok: false,
          error:
            "This secure onboarding link is no longer active.",
        },
        410,
      );
    }

    const expiresAt = new Date(link.expires_at);

    if (
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt.getTime() <= Date.now()
    ) {
      await supabase
        .from("carrier_onboarding_links")
        .update({
          status: "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", link.id)
        .eq("status", "active");

      return response(
        {
          ok: false,
          error:
            "This secure onboarding link has expired. Please request a new agreement from Slate Lane Dispatch.",
        },
        410,
      );
    }

    await supabase
      .from("carrier_onboarding_links")
      .update({
        last_opened_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", link.id);

    return response({
      ok: true,
      completed: false,

      expires_at: link.expires_at,

      recipient_email: link.recipient_email,

      agreement_version:
        DISPATCH_AGREEMENT_VERSION,

      fee_locked:
        onboarding.dispatch_fee_type !== null &&
        onboarding.dispatch_fee_value !== null,

      prefill: {
        company_name:
          onboarding.company_name || "",

        dot_number:
          onboarding.dot_number?.toString() || "",

        mc_number:
          onboarding.mc_number || "",

        signer_name:
          onboarding.primary_contact_name || "",

        signer_title: "",

        signer_email:
          link.recipient_email ||
          onboarding.primary_contact_email ||
          "",

        electronic_signature: "",

        dispatch_fee_type:
          onboarding.dispatch_fee_type || "",

        dispatch_fee_value:
          onboarding.dispatch_fee_value?.toString() || "",

        minimum_rate_per_mile:
          onboarding.minimum_rate_per_mile?.toString() ||
          "",

        factoring_company:
          onboarding.factoring_company || "",

        insurance_company:
          onboarding.insurance_company || "",

        insurance_expiration:
          onboarding.insurance_expiration || "",

        preferred_lanes:
          Array.isArray(onboarding.preferred_lanes)
            ? onboarding.preferred_lanes.join(", ")
            : "",

        preferred_states:
          Array.isArray(onboarding.preferred_states)
            ? onboarding.preferred_states.join(", ")
            : "",

        regions_to_avoid:
          Array.isArray(onboarding.regions_to_avoid)
            ? onboarding.regions_to_avoid.join(", ")
            : "",

        home_time_notes:
          onboarding.home_time_notes || "",

        operating_notes:
          onboarding.operating_notes || "",

        consent: false,
      },
    });
  } catch (error) {
    console.error(
      "carrier onboarding GET error",
      error,
    );

    return response(
      {
        ok: false,
        error:
          "Unable to load this agreement right now.",
      },
      500,
    );
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  let uploadedBucket: string | null = null;
  let uploadedPath: string | null = null;

  try {
    const { token } = await context.params;

    if (!token || token.length < 20) {
      return response(
        {
          ok: false,
          error: "Invalid onboarding link.",
        },
        404,
      );
    }

    const resolved = await resolveLink(token);

    if (resolved.error) {
      return response(
        {
          ok: false,
          error:
            "This secure onboarding link is invalid.",
        },
        404,
      );
    }

    const { supabase, link, onboarding } = resolved;

    if (link.status === "completed") {
      return response(
        {
          ok: false,
          error:
            "This agreement has already been completed.",
        },
        409,
      );
    }

    if (link.status !== "active") {
      return response(
        {
          ok: false,
          error:
            "This onboarding link is no longer active.",
        },
        410,
      );
    }

    if (
      new Date(link.expires_at).getTime() <= Date.now()
    ) {
      await supabase
        .from("carrier_onboarding_links")
        .update({
          status: "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", link.id);

      return response(
        {
          ok: false,
          error:
            "This secure onboarding link has expired.",
        },
        410,
      );
    }

    const raw = await request.json();

    const form: DispatchAgreementFormData = {
      company_name: clean(raw.company_name, 300),
      dot_number: clean(raw.dot_number, 30),
      mc_number: clean(raw.mc_number, 50),

      signer_name: clean(raw.signer_name, 200),
      signer_title: clean(raw.signer_title, 150),
      signer_email: clean(raw.signer_email, 320),
      electronic_signature: clean(
        raw.electronic_signature,
        200,
      ),

      dispatch_fee_type: clean(
        raw.dispatch_fee_type,
        50,
      ) as DispatchFeeType,

      dispatch_fee_value: clean(
        raw.dispatch_fee_value,
        30,
      ),

      minimum_rate_per_mile: clean(
        raw.minimum_rate_per_mile,
        30,
      ),

      factoring_company: clean(
        raw.factoring_company,
        300,
      ),

      insurance_company: clean(
        raw.insurance_company,
        300,
      ),

      insurance_expiration: clean(
        raw.insurance_expiration,
        30,
      ),

      preferred_lanes: clean(
        raw.preferred_lanes,
        3000,
      ),

      preferred_states: clean(
        raw.preferred_states,
        2000,
      ),

      regions_to_avoid: clean(
        raw.regions_to_avoid,
        2000,
      ),

      home_time_notes: clean(
        raw.home_time_notes,
        3000,
      ),

      operating_notes: clean(
        raw.operating_notes,
        5000,
      ),

      consent: raw.consent === true,
    };

    if (!form.company_name) {
      return response(
        {
          ok: false,
          error: "Company name is required.",
        },
        400,
      );
    }

    if (!form.signer_name) {
      return response(
        {
          ok: false,
          error:
            "Authorized signer name is required.",
        },
        400,
      );
    }

    if (!form.signer_title) {
      return response(
        {
          ok: false,
          error:
            "Authorized signer title is required.",
        },
        400,
      );
    }

    if (
      !form.signer_email ||
      !validEmail(form.signer_email)
    ) {
      return response(
        {
          ok: false,
          error:
            "A valid signer email is required.",
        },
        400,
      );
    }

    if (
      normalizeEmail(form.signer_email) !==
      normalizeEmail(link.recipient_email)
    ) {
      return response(
        {
          ok: false,
          error:
            "The signer email must match the email address that received this secure agreement.",
        },
        400,
      );
    }

    if (!form.electronic_signature) {
      return response(
        {
          ok: false,
          error:
            "Electronic signature is required.",
        },
        400,
      );
    }

    if (
      normalizeSigner(form.signer_name) !==
      normalizeSigner(form.electronic_signature)
    ) {
      return response(
        {
          ok: false,
          error:
            "Your electronic signature must match the authorized signer name.",
        },
        400,
      );
    }

    if (!form.consent) {
      return response(
        {
          ok: false,
          error:
            "You must accept the agreement before submitting.",
        },
        400,
      );
    }

    if (!isFeeType(form.dispatch_fee_type)) {
      return response(
        {
          ok: false,
          error:
            "Please select a valid dispatch fee type.",
        },
        400,
      );
    }

    const submittedFeeValue = Number(
      form.dispatch_fee_value,
    );

    if (
      !Number.isFinite(submittedFeeValue) ||
      submittedFeeValue <= 0
    ) {
      return response(
        {
          ok: false,
          error:
            "Dispatch fee must be greater than zero.",
        },
        400,
      );
    }

    if (
      form.dispatch_fee_type === "percentage" &&
      submittedFeeValue > 100
    ) {
      return response(
        {
          ok: false,
          error:
            "Percentage dispatch fee cannot exceed 100%.",
        },
        400,
      );
    }

    const feeLocked =
      onboarding.dispatch_fee_type !== null &&
      onboarding.dispatch_fee_value !== null;

    if (feeLocked) {
      const existingType =
        onboarding.dispatch_fee_type;

      const existingValue = Number(
        onboarding.dispatch_fee_value,
      );

      if (
        form.dispatch_fee_type !== existingType ||
        Math.abs(
          submittedFeeValue - existingValue,
        ) > 0.0001
      ) {
        return response(
          {
            ok: false,
            error:
              "The dispatch fee terms were changed. Please reopen the agreement and use the fee terms provided by Slate Lane Dispatch.",
          },
          400,
        );
      }
    }

    const dotNumber = parseDotNumber(
      form.dot_number,
    );

    const minimumRate = nullableNumber(
      form.minimum_rate_per_mile,
    );

    const signedAt =
      new Date().toISOString();

    const forwardedFor =
      request.headers.get("x-forwarded-for");

    const ip =
      forwardedFor
        ?.split(",")[0]
        ?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    const userAgent =
      request.headers.get("user-agent");

    const pdfBytes =
      await generateDispatchAgreementPdf({
        onboarding: {
          id: onboarding.id,
          company_name: form.company_name,
          dot_number: dotNumber,
          mc_number: form.mc_number,
        },

        form,

        signedAt,

        audit: {
          ip,
          userAgent,
        },
      });

    const timestampForFile =
      signedAt.replace(/[:.]/g, "-");

    const safeCompany =
      form.company_name
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "carrier";

    const fileName =
      `SlateLane-${safeCompany}-Carrier-Dispatcher-Agreement-${timestampForFile}.pdf`;

    const storageBucket =
      "carrier-document-vault";

    const storagePath =
      `onboarding/${onboarding.id}/dispatch-agreement/${fileName}`;

    uploadedBucket = storageBucket;
    uploadedPath = storagePath;

    const { error: uploadError } =
      await supabase.storage
        .from(storageBucket)
        .upload(
          storagePath,
          Buffer.from(pdfBytes),
          {
            contentType: "application/pdf",
            upsert: false,
            cacheControl: "0",
          },
        );

    if (uploadError) {
      throw new Error(
        `PDF upload failed: ${uploadError.message}`,
      );
    }

    const pdfSha256 =
      hashBytes(pdfBytes);

    const {
      data: generatedDocument,
      error: documentError,
    } = await supabase
      .from("carrier_document_records")
      .insert({
        onboarding_id: onboarding.id,
        carrier_id: onboarding.carrier_id,

        document_type:
          "dispatch_agreement",

        status: "signed",

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
          signedAt,

        signed_at:
          signedAt,

        signer_name:
          form.signer_name,

        signer_title:
          form.signer_title,

        metadata: {
          source:
            "secure_browser_form",

          agreement_version:
            DISPATCH_AGREEMENT_VERSION,

          secure_link_id:
            link.id,

          electronic_signature:
            form.electronic_signature,

          consented:
            true,

          pdf_generated:
            true,
        },

        updated_at:
          signedAt,
      })
      .select("*")
      .single();

    if (documentError) {
      throw new Error(
        `Document record failed: ${documentError.message}`,
      );
    }

    const submissionData = {
      company_name:
        form.company_name,

      dot_number:
        form.dot_number,

      mc_number:
        form.mc_number,

      signer_name:
        form.signer_name,

      signer_title:
        form.signer_title,

      signer_email:
        form.signer_email,

      electronic_signature:
        form.electronic_signature,

      dispatch_fee_type:
        form.dispatch_fee_type,

      dispatch_fee_value:
        submittedFeeValue,

      minimum_rate_per_mile:
        minimumRate,

      factoring_company:
        form.factoring_company,

      insurance_company:
        form.insurance_company,

      insurance_expiration:
        form.insurance_expiration || null,

      preferred_lanes:
        toArray(form.preferred_lanes),

      preferred_states:
        toArray(form.preferred_states),

      regions_to_avoid:
        toArray(form.regions_to_avoid),

      home_time_notes:
        form.home_time_notes,

      operating_notes:
        form.operating_notes,

      consent:
        true,
    };

    const auditData = {
      submitted_at:
        signedAt,

      ip_address:
        ip,

      user_agent:
        userAgent,

      agreement_version:
        DISPATCH_AGREEMENT_VERSION,

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
      data: submission,
      error: submissionError,
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
          "dispatch_agreement",

        signer_name:
          form.signer_name,

        signer_title:
          form.signer_title,

        signer_email:
          form.signer_email,

        agreement_version:
          DISPATCH_AGREEMENT_VERSION,

        consented_at:
          signedAt,

        generated_document_id:
          generatedDocument.id,

        submission_data:
          submissionData,

        audit_data:
          auditData,
      })
      .select("*")
      .single();

    if (submissionError) {
      throw new Error(
        `Submission record failed: ${submissionError.message}`,
      );
    }

    const nextStatus =
      onboarding.status === "draft"
        ? "paperwork_pending"
        : onboarding.status;

    const onboardingUpdate: Record<
      string,
      unknown
    > = {
      company_name:
        form.company_name,

      dot_number:
        dotNumber,

      mc_number:
        form.mc_number || null,

      primary_contact_name:
        form.signer_name,

      primary_contact_email:
        form.signer_email,

      agreement_status:
        "signed",

      agreement_signed_at:
        signedAt,

      status:
        nextStatus,

      minimum_rate_per_mile:
        minimumRate,

      factoring_company:
        form.factoring_company || null,

      insurance_company:
        form.insurance_company || null,

      insurance_expiration:
        form.insurance_expiration || null,

      preferred_lanes:
        toArray(form.preferred_lanes),

      preferred_states:
        toArray(form.preferred_states),

      regions_to_avoid:
        toArray(form.regions_to_avoid),

      home_time_notes:
        form.home_time_notes || null,

      operating_notes:
        form.operating_notes || null,

      updated_at:
        signedAt,
    };

    if (
      onboarding.dispatch_fee_type === null
    ) {
      onboardingUpdate.dispatch_fee_type =
        form.dispatch_fee_type;
    }

    if (
      onboarding.dispatch_fee_value === null
    ) {
      onboardingUpdate.dispatch_fee_value =
        submittedFeeValue;
    }

    const { error: onboardingUpdateError } =
      await supabase
        .from("carrier_onboardings")
        .update(onboardingUpdate)
        .eq("id", onboarding.id);

    if (onboardingUpdateError) {
      throw new Error(
        `Onboarding update failed: ${onboardingUpdateError.message}`,
      );
    }

    const { error: linkUpdateError } =
      await supabase
        .from("carrier_onboarding_links")
        .update({
          status: "completed",

          completed_at:
            signedAt,

          submission_document_id:
            generatedDocument.id,

          metadata: {
            ...(link.metadata || {}),

            delivery:
              "secure_browser_form",

            agreement_version:
              DISPATCH_AGREEMENT_VERSION,

            submission_id:
              submission.id,

            generated_document_id:
              generatedDocument.id,
          },

          updated_at:
            signedAt,
        })
        .eq("id", link.id)
        .eq("status", "active");

    if (linkUpdateError) {
      throw new Error(
        `Secure link completion failed: ${linkUpdateError.message}`,
      );
    }

    const { error: eventError } =
      await supabase
        .from("carrier_document_events")
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
            "signed",

          actor:
            "carrier",

          note:
            `Carrier-Dispatcher Agreement electronically signed by ${form.signer_name}`,

          metadata: {
            agreement_version:
              DISPATCH_AGREEMENT_VERSION,

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

    if (eventError) {
      console.error(
        "Unable to create document event:",
        eventError,
      );
    }

    return response({
      ok: true,
      completed: true,

      message:
        "Your Carrier-Dispatcher Agreement has been signed successfully.",

      signed_at:
        signedAt,

      document_id:
        generatedDocument.id,

      submission_id:
        submission.id,
    });
  } catch (error) {
    console.error(
      "carrier onboarding POST error",
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
          .from(uploadedBucket)
          .remove([uploadedPath]);
      } catch (cleanupError) {
        console.error(
          "Unable to clean up uploaded PDF:",
          cleanupError,
        );
      }
    }

    return response(
      {
        ok: false,
        error:
          "We could not complete your agreement. Your secure link has not been marked completed. Please try again.",
      },
      500,
    );
  }
}