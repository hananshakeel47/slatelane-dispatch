"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";


function clean(
  value:
    FormDataEntryValue |
    null,
) {
  return String(
    value ?? "",
  ).trim();
}


function refreshActivationPaths({
  leadId,
  dotNumber,
  onboardingId,
}: {
  leadId:
    string |
    null;

  dotNumber:
    number |
    null;

  onboardingId:
    string;
}) {
  revalidatePath(
    "/admin/conversions",
  );

  revalidatePath(
    "/admin/dashboard",
  );

  revalidatePath(
    "/admin/leads",
  );

  revalidatePath(
    "/admin/carriers",
  );

  revalidatePath(
    "/admin/onboarding",
  );

  revalidatePath(
    `/admin/onboarding/${onboardingId}/documents`,
  );


  if (
    leadId
  ) {
    revalidatePath(
      `/admin/leads/${leadId}`,
    );
  }


  if (
    dotNumber
  ) {
    revalidatePath(
      `/admin/carriers/${dotNumber}`,
    );
  }
}


/* ============================================================
   PHASE 3D-C
   ACTIVATE COMPLETED CLIENT
============================================================ */

export async function activateCarrierAction(
  formData:
    FormData,
) {
  const onboardingId =
    clean(
      formData.get(
        "onboardingId",
      ),
    );


  if (
    !onboardingId
  ) {
    return;
  }


  const db =
    createAdminSupabase();


  /* ==========================================================
     LOAD REAL ONBOARDING RECORD

     Never trust status, lead ID, carrier ID or readiness
     supplied from the browser.
  ========================================================== */

  const {
    data:
      onboarding,

    error:
      onboardingError,
  } =
    await db
      .from(
        "carrier_onboardings",
      )
      .select(`
        id,
        lead_id,
        carrier_id,
        company_name,
        dot_number,
        mc_number,
        status,
        agreement_status,
        onboarding_completed_at,
        activated_at
      `)
      .eq(
        "id",
        onboardingId,
      )
      .maybeSingle();


  if (
    onboardingError
  ) {
    throw new Error(
      `Could not load onboarding: ${onboardingError.message}`,
    );
  }


  if (
    !onboarding
  ) {
    return;
  }


  /*
   * Idempotency:
   * pressing the button again does nothing destructive.
   */
  if (
    onboarding.status ===
    "active"
  ) {
    refreshActivationPaths({
      leadId:
        onboarding.lead_id,

      dotNumber:
        onboarding.dot_number,

      onboardingId:
        onboarding.id,
    });

    return;
  }


  if (
    onboarding.status ===
      "closed" ||
    onboarding.status ===
      "paused"
  ) {
    throw new Error(
      "This onboarding cannot be activated from its current status.",
    );
  }


  /* ==========================================================
     VERIFY DOCUMENT VAULT SERVER-SIDE
  ========================================================== */

  const {
    data:
      vault,

    error:
      vaultError,
  } =
    await db
      .from(
        "carrier_document_vault_status",
      )
      .select(`
        onboarding_id,
        agreement_ready,
        carrier_packet_ready,
        tax_form_ready,
        insurance_ready,
        authority_ready,
        factoring_ready,
        broker_packet_ready,
        missing_documents
      `)
      .eq(
        "onboarding_id",
        onboarding.id,
      )
      .maybeSingle();


  if (
    vaultError
  ) {
    throw new Error(
      `Could not verify Document Vault: ${vaultError.message}`,
    );
  }


  /*
   * Activation is intentionally fail-closed.
   *
   * Browser manipulation cannot bypass
   * Broker Packet readiness.
   */
  if (
    !vault ||
    !vault.broker_packet_ready
  ) {
    throw new Error(
      "Carrier cannot be activated until the Broker Packet is ready.",
    );
  }


  /*
   * Agreement status gets an independent check.
   */
  if (
    onboarding.agreement_status !==
    "signed"
  ) {
    throw new Error(
      "Carrier cannot be activated until the dispatch agreement is signed.",
    );
  }


  const now =
    new Date()
      .toISOString();


  /* ==========================================================
     ACTIVATE ONBOARDING
  ========================================================== */

  const {
    error:
      activationError,
  } =
    await db
      .from(
        "carrier_onboardings",
      )
      .update({
        status:
          "active",

        onboarding_completed_at:
          onboarding.onboarding_completed_at ??
          now,

        activated_at:
          onboarding.activated_at ??
          now,

        updated_at:
          now,
      })
      .eq(
        "id",
        onboarding.id,
      )
      .neq(
        "status",
        "closed",
      );


  if (
    activationError
  ) {
    throw new Error(
      `Could not activate carrier: ${activationError.message}`,
    );
  }


  /* ==========================================================
     KEEP LEAD AS CLIENT
  ========================================================== */

  if (
    onboarding.lead_id
  ) {
    const {
      error:
        leadError,
    } =
      await db
        .from(
          "leads",
        )
        .update({
          status:
            "client",

          updated_at:
            now,
        })
        .eq(
          "id",
          onboarding.lead_id,
        );


    if (
      leadError
    ) {
      throw new Error(
        `Carrier activated, but Lead status could not be synchronized: ${leadError.message}`,
      );
    }


    /*
     * Active clients must never remain
     * inside prospecting automation.
     */
    const {
      error:
        sequenceError,
    } =
      await db
        .from(
          "email_sequence_enrollments",
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
          onboarding.lead_id,
        )
        .in(
          "status",
          [
            "active",
            "paused",
          ],
        );


    if (
      sequenceError
    ) {
      throw new Error(
        `Carrier activated, but prospecting sequence could not be stopped: ${sequenceError.message}`,
      );
    }


    /*
     * Sales follow-up work is no longer needed
     * after activation.
     */
    const {
      error:
        taskError,
    } =
      await db
        .from(
          "lead_tasks",
        )
        .update({
          status:
            "cancelled",

          updated_at:
            now,
        })
        .eq(
          "lead_id",
          onboarding.lead_id,
        )
        .eq(
          "status",
          "open",
        );


    if (
      taskError
    ) {
      console.error(
        "ACTIVE CLIENT TASK CLEANUP ERROR:",
        taskError.message,
      );
    }
  }


  /* ==========================================================
     KEEP FMCSA CARRIER CRM STATE SYNCHRONIZED
  ========================================================== */

  if (
    onboarding.carrier_id
  ) {
    const {
      error:
        carrierError,
    } =
      await db
        .from(
          "carriers",
        )
        .update({
          contacted:
            true,

          client:
            true,

          lead_status:
            "client",

          updated_at:
            now,
        })
        .eq(
          "id",
          onboarding.carrier_id,
        );


    if (
      carrierError
    ) {
      console.error(
        "ACTIVE CARRIER SYNC ERROR:",
        carrierError.message,
      );
    }
  } else if (
    onboarding.dot_number
  ) {
    /*
     * Fallback when an older onboarding row
     * does not contain carrier_id.
     */
    const {
      error:
        carrierError,
    } =
      await db
        .from(
          "carriers",
        )
        .update({
          contacted:
            true,

          client:
            true,

          lead_status:
            "client",

          updated_at:
            now,
        })
        .eq(
          "dot_number",
          onboarding.dot_number,
        );


    if (
      carrierError
    ) {
      console.error(
        "ACTIVE CARRIER DOT SYNC ERROR:",
        carrierError.message,
      );
    }
  }


  refreshActivationPaths({
    leadId:
      onboarding.lead_id,

    dotNumber:
      onboarding.dot_number,

    onboardingId:
      onboarding.id,
  });
}