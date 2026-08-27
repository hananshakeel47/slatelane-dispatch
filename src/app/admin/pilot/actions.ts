import "server-only";

import { revalidatePath } from "next/cache";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { getLaunchSnapshot } from "@/lib/email/launch-controls";

// ============================================================
// HELPERS
// ============================================================

function normalizeEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isUsableEmail(value: unknown) {
  const email = normalizeEmail(value);

  return (
    email.length >= 5 &&
    email.includes("@") &&
    email.includes(".") &&
    !email.includes(" ")
  );
}

function chunk<T>(values: T[], size = 100) {
  const result: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }

  return result;
}

type EligibilityResult = {
  allowed?: boolean;
  reason?: string;
  carrier_id?: number;
  email?: string;
  verification_status?: string | null;
  email_health_status?: string | null;
  risk_score?: number | null;
};

// ============================================================
// STRICT EMAIL ELIGIBILITY CHECK
// ============================================================

async function checkCarrierEligibility(
  carrierId: number
): Promise<EligibilityResult> {
  const supabase = createAdminSupabase();

  const { data, error } = await supabase.rpc(
    "carrier_email_send_eligibility",
    {
      p_carrier_id: carrierId,
    }
  );

  if (error) {
    throw new Error(
      `Could not verify carrier ${carrierId}: ${error.message}`
    );
  }

  if (!data || typeof data !== "object") {
    throw new Error(
      `Carrier ${carrierId} returned an invalid eligibility result.`
    );
  }

  return data as EligibilityResult;
}

// ============================================================
// ACTIVE EMAIL SEQUENCE
// ============================================================

async function getActiveSequence() {
  const supabase = createAdminSupabase();

  const { data, error } = await supabase
    .from("email_sequences")
    .select(`
      id,
      name,
      description,
      active,
      created_at
    `)
    .eq("active", true)
    .order("created_at", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      error?.message ||
        "No active email sequence was found."
    );
  }

  return data;
}

// ============================================================
// PILOT PREVIEW
// ============================================================

export async function getPilotPreview(
  requestedLimit?: number
) {
  const supabase = createAdminSupabase();

  const snapshot = await getLaunchSnapshot();

  const settings = snapshot.settings;

  const sequence = await getActiveSequence();

  const requested = Number.isFinite(
    Number(requestedLimit)
  )
    ? Number(requestedLimit)
    : settings.pilot_limit;

  const limit = Math.max(
    1,
    Math.min(
      Math.floor(requested),
      settings.pilot_limit,
      100
    )
  );

  // Scan extra records because later safety filters may exclude some.
  const scanLimit = Math.max(
    250,
    Math.min(1000, limit * 30)
  );

  // ==========================================================
  // LOAD STRICT SENDABLE CARRIERS
  // ==========================================================

  let carrierQuery = supabase
    .from("email_sendable_carriers")
    .select(`
      id,
      dot_number,
      mc_number,
      legal_name,
      dba_name,
      owner_name,
      phone,
      email,
      state,
      status_code,
      authority_status,
      power_units,
      drivers,
      lead_score,
      dispatcher_probability,
      contacted,
      client,
      email_health_status,
      email_health_reason,
      email_verification_status,
      email_risk_score,
      email_verification_reason,
      email_role_based,
      email_disposable,
      email_free_provider,
      email_verification_checked_at
    `)
    .gte(
      "lead_score",
      settings.minimum_carrier_score
    )
    .order("lead_score", {
      ascending: false,
    })
    .order("email_risk_score", {
      ascending: true,
    })
    .order("dispatcher_probability", {
      ascending: false,
    });

  // ==========================================================
  // ACTIVE FMCSA AUTHORITY
  // ==========================================================

  if (settings.require_active_authority) {
    carrierQuery = carrierQuery.eq(
      "status_code",
      "A"
    );
  }

  // ==========================================================
  // REQUIRE EMAIL
  // ==========================================================

  if (settings.require_email) {
    carrierQuery = carrierQuery.not(
      "email",
      "is",
      null
    );
  }

  const {
    data: rawCarriers,
    error: carrierError,
  } = await carrierQuery.limit(scanLimit);

  if (carrierError) {
    throw new Error(
      `Could not load verified pilot carriers: ${carrierError.message}`
    );
  }

  // ==========================================================
  // EXCLUSION COUNTERS
  // ==========================================================

  const exclusions: Record<string, number> = {
    invalidEmail: 0,
    unverifiedEmail: 0,
    highRiskEmail: 0,
    contacted: 0,
    clients: 0,

    existingLeads: 0,
    existingLead: 0,
    existingLeadDots: 0,
    existingLeadEmails: 0,

    suppressed: 0,
    suppressedEmails: 0,

    previousPilot: 0,
    previousPilots: 0,

    duplicateEmail: 0,
    duplicateEmails: 0,
  };

  // ==========================================================
  // BASIC SAFETY FILTER
  // ==========================================================

  const baseCandidates = (rawCarriers ?? []).filter(
    (carrier) => {
      if (!carrier.dot_number) {
        return false;
      }

      if (!isUsableEmail(carrier.email)) {
        exclusions.invalidEmail += 1;
        return false;
      }

      if (
        carrier.email_verification_status !==
        "verified_format"
      ) {
        exclusions.unverifiedEmail += 1;
        return false;
      }

      if (
        Number(carrier.email_risk_score ?? 100) >=
        70
      ) {
        exclusions.highRiskEmail += 1;
        return false;
      }

      if (carrier.contacted === true) {
        exclusions.contacted += 1;
        return false;
      }

      if (carrier.client === true) {
        exclusions.clients += 1;
        return false;
      }

      return true;
    }
  );

  const dotNumbers = baseCandidates.map(
    (carrier) => Number(carrier.dot_number)
  );

  const carrierIds = baseCandidates.map(
    (carrier) => Number(carrier.id)
  );

  const candidateEmails = [
    ...new Set(
      baseCandidates.map((carrier) =>
        normalizeEmail(carrier.email)
      )
    ),
  ];

  // ==========================================================
  // EXISTING LEAD CHECK
  // ==========================================================

  const existingDotNumbers = new Set<number>();

  const existingLeadEmails = new Set<string>();

  for (const group of chunk(dotNumbers, 100)) {
    if (group.length === 0) {
      continue;
    }

    const { data, error } = await supabase
      .from("leads")
      .select(`
        carrier_dot_number,
        email
      `)
      .in("carrier_dot_number", group);

    if (error) {
      throw new Error(
        `Could not check existing leads: ${error.message}`
      );
    }

    for (const lead of data ?? []) {
      if (lead.carrier_dot_number) {
        existingDotNumbers.add(
          Number(lead.carrier_dot_number)
        );
      }

      if (lead.email) {
        existingLeadEmails.add(
          normalizeEmail(lead.email)
        );
      }
    }
  }

  // ==========================================================
  // EMAIL SUPPRESSION CHECK
  // ==========================================================

  const suppressedEmails = new Set<string>();

  for (const group of chunk(candidateEmails, 100)) {
    if (group.length === 0) {
      continue;
    }

    const { data, error } = await supabase
      .from("email_suppressions")
      .select("email")
      .in("email", group);

    if (error) {
      throw new Error(
        `Could not check email suppressions: ${error.message}`
      );
    }

    for (const row of data ?? []) {
      if (row.email) {
        suppressedEmails.add(
          normalizeEmail(row.email)
        );
      }
    }
  }

  // ==========================================================
  // PREVIOUS PILOT PROTECTION
  // ==========================================================

  const previousPilotCarrierIds =
    new Set<number>();

  for (const group of chunk(carrierIds, 100)) {
    if (group.length === 0) {
      continue;
    }

    const { data, error } = await supabase
      .from("email_pilot_members")
      .select("carrier_id")
      .in("carrier_id", group);

    if (error) {
      throw new Error(
        `Could not check previous pilots: ${error.message}`
      );
    }

    for (const member of data ?? []) {
      previousPilotCarrierIds.add(
        Number(member.carrier_id)
      );
    }
  }

  // ==========================================================
  // FINAL PREVIEW FILTER
  // ==========================================================

  const usedEmails = new Set<string>();

  const eligible = baseCandidates.filter(
    (carrier) => {
      const email = normalizeEmail(
        carrier.email
      );

      const dot = Number(
        carrier.dot_number
      );

      const carrierId = Number(
        carrier.id
      );

      if (existingDotNumbers.has(dot)) {
        exclusions.existingLeads += 1;
        exclusions.existingLead += 1;
        exclusions.existingLeadDots += 1;

        return false;
      }

      if (existingLeadEmails.has(email)) {
        exclusions.existingLeadEmails += 1;

        return false;
      }

      if (suppressedEmails.has(email)) {
        exclusions.suppressed += 1;
        exclusions.suppressedEmails += 1;

        return false;
      }

      if (
        previousPilotCarrierIds.has(
          carrierId
        )
      ) {
        exclusions.previousPilot += 1;
        exclusions.previousPilots += 1;

        return false;
      }

      if (usedEmails.has(email)) {
        exclusions.duplicateEmail += 1;
        exclusions.duplicateEmails += 1;

        return false;
      }

      usedEmails.add(email);

      return true;
    }
  );

  // ==========================================================
  // RETURN PREVIEW
  // ==========================================================

  return {
    settings,

    sequence,

    carriers: eligible.slice(
      0,
      limit
    ),

    requested: limit,

    scanned:
      rawCarriers?.length ?? 0,

    eligibleFound:
      eligible.length,

    exclusions,

    sentToday:
      snapshot.sentToday,

    effectiveCap:
      snapshot.effectiveCap,

    remainingToday:
      snapshot.remainingToday,
  };
}

// ============================================================
// PREPARE PILOT
// ============================================================

export async function preparePilotAction(
  formData: FormData
) {
  "use server";

  const confirmation = String(
    formData.get("confirmation") ?? ""
  )
    .trim()
    .toUpperCase();

  if (confirmation !== "PREPARE") {
    throw new Error(
      "Type PREPARE exactly before creating the pilot."
    );
  }

  const snapshot = await getLaunchSnapshot();

  // Never prepare while Master Sending is ON.
  if (snapshot.settings.sending_enabled) {
    throw new Error(
      "Master Sending must be OFF before preparing a real-carrier pilot."
    );
  }

  if (!snapshot.settings.pilot_mode) {
    throw new Error(
      "Pilot Mode must be ON before preparing the pilot."
    );
  }

  const requested = Math.max(
    1,
    Math.min(
      Math.floor(
        Number(
          formData.get("pilotCount") ??
            snapshot.settings.pilot_limit
        )
      ),
      snapshot.settings.pilot_limit,
      100
    )
  );

  const supabase = createAdminSupabase();

  // ==========================================================
  // ONLY ONE OPEN PILOT ALLOWED
  // ==========================================================

  const {
    data: existingBatch,
    error: existingBatchError,
  } = await supabase
    .from("email_pilot_batches")
    .select(`
      id,
      status
    `)
    .in("status", [
      "prepared",
      "armed",
    ])
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (existingBatchError) {
    throw new Error(
      existingBatchError.message
    );
  }

  if (existingBatch) {
    throw new Error(
      "A prepared or armed pilot already exists. Cancel or finish it before creating another."
    );
  }

  // ==========================================================
  // GET VERIFIED CARRIERS
  // ==========================================================

  const preview =
    await getPilotPreview(requested);

  if (
    preview.carriers.length <
    requested
  ) {
    throw new Error(
      `Only ${preview.carriers.length} strictly verified eligible carriers were found. Requested ${requested}.`
    );
  }

  const sequence = preview.sequence;

  const now = new Date().toISOString();

  // ==========================================================
  // CREATE PILOT BATCH
  // ==========================================================

  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from("email_pilot_batches")
    .insert({
      sequence_id: sequence.id,

      status: "prepared",

      requested_count: requested,

      prepared_count: 0,

      minimum_score:
        snapshot.settings
          .minimum_carrier_score,

      notes:
        "Strict verified-email real-carrier pilot prepared while Master Sending was OFF.",

      updated_at: now,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    throw new Error(
      `Could not create pilot batch: ${
        batchError?.message ??
        "Unknown error."
      }`
    );
  }

  const createdLeadIds: string[] = [];

  const createdEnrollmentIds: string[] =
    [];

  try {
    // ========================================================
    // CREATE PILOT MEMBERS
    // ========================================================

    for (const carrier of preview.carriers) {
      const carrierId = Number(
        carrier.id
      );

      const email = normalizeEmail(
        carrier.email
      );

      // ======================================================
      // FINAL ELIGIBILITY CHECK BEFORE LEAD CREATION
      // ======================================================

      const eligibility =
        await checkCarrierEligibility(
          carrierId
        );

      if (eligibility.allowed !== true) {
        throw new Error(
          `USDOT ${carrier.dot_number} failed final email eligibility: ${
            eligibility.reason ??
            "unknown_reason"
          }. Pilot preparation stopped safely.`
        );
      }

      const currentEligibleEmail =
        normalizeEmail(
          eligibility.email
        );

      if (
        currentEligibleEmail !== email
      ) {
        throw new Error(
          `USDOT ${carrier.dot_number} email changed during pilot preparation. Pilot preparation stopped safely.`
        );
      }

      // ======================================================
      // FINAL DUPLICATE LEAD CHECK
      // ======================================================

      const {
        data: existingLead,
        error: duplicateError,
      } = await supabase
        .from("leads")
        .select("id")
        .eq(
          "carrier_dot_number",
          carrier.dot_number
        )
        .limit(1)
        .maybeSingle();

      if (duplicateError) {
        throw new Error(
          duplicateError.message
        );
      }

      if (existingLead) {
        throw new Error(
          `USDOT ${carrier.dot_number} became an existing lead while the pilot was being prepared. Pilot preparation stopped safely.`
        );
      }

      // ======================================================
      // CREATE CRM LEAD
      // ======================================================

      const {
        data: lead,
        error: leadError,
      } = await supabase
        .from("leads")
        .insert({
          name:
            carrier.owner_name ||
            carrier.legal_name,

          company_name:
            carrier.legal_name,

          email,

          phone:
            carrier.phone,

          message:
            "Strict verified real-carrier prospect selected for controlled SlateLane email pilot.",

          carrier_dot_number:
            carrier.dot_number,

          mc_number:
            carrier.mc_number,

          source:
            "fmcsa_pilot",

          status:
            "new",

          notes:
            `Prepared in strict verified SlateLane pilot ${batch.id}.`,

          updated_at: now,
        })
        .select("id")
        .single();

      if (leadError || !lead) {
        throw new Error(
          `Could not create lead for USDOT ${carrier.dot_number}: ${
            leadError?.message ??
            "Unknown error."
          }`
        );
      }

      createdLeadIds.push(
        lead.id
      );

      // ======================================================
      // CREATE PAUSED ENROLLMENT
      //
      // No email can send yet.
      // ======================================================

      const {
        data: enrollment,
        error: enrollmentError,
      } = await supabase
        .from(
          "email_sequence_enrollments"
        )
        .insert({
          lead_id: lead.id,

          sequence_id:
            sequence.id,

          status:
            "paused",

          current_step: 1,

          next_send_at: null,

          updated_at: now,
        })
        .select("id")
        .single();

      if (
        enrollmentError ||
        !enrollment
      ) {
        throw new Error(
          `Could not create paused enrollment for USDOT ${carrier.dot_number}: ${
            enrollmentError?.message ??
            "Unknown error."
          }`
        );
      }

      createdEnrollmentIds.push(
        enrollment.id
      );

      // ======================================================
      // RECORD PILOT MEMBERSHIP
      // ======================================================

      const { error: memberError } =
        await supabase
          .from(
            "email_pilot_members"
          )
          .insert({
            batch_id: batch.id,

            carrier_id:
              carrierId,

            lead_id: lead.id,

            enrollment_id:
              enrollment.id,

            dot_number:
              carrier.dot_number,

            email,
          });

      if (memberError) {
        throw new Error(
          `Could not add USDOT ${carrier.dot_number} to pilot batch: ${memberError.message}`
        );
      }
    }

    // ========================================================
    // FINALIZE PREPARED PILOT
    // ========================================================

    const { error: finalizeError } =
      await supabase
        .from(
          "email_pilot_batches"
        )
        .update({
          prepared_count:
            createdLeadIds.length,

          prepared_at:
            new Date().toISOString(),

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", batch.id);

    if (finalizeError) {
      throw new Error(
        finalizeError.message
      );
    }
  } catch (error) {
    // ========================================================
    // SAFE ROLLBACK
    // ========================================================

    await supabase
      .from("email_pilot_batches")
      .delete()
      .eq("id", batch.id);

    for (const group of chunk(
      createdEnrollmentIds,
      100
    )) {
      if (group.length > 0) {
        await supabase
          .from(
            "email_sequence_enrollments"
          )
          .delete()
          .in("id", group);
      }
    }

    for (const group of chunk(
      createdLeadIds,
      100
    )) {
      if (group.length > 0) {
        await supabase
          .from("leads")
          .delete()
          .in("id", group);
      }
    }

    throw error;
  }

  revalidatePath("/admin/pilot");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/leads");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/monitoring");
}

// ============================================================
// ARM PILOT
// ============================================================

export async function armPilotAction(
  formData: FormData
) {
  "use server";

  const confirmation = String(
    formData.get("confirmation") ?? ""
  )
    .trim()
    .toUpperCase();

  if (confirmation !== "ARM") {
    throw new Error(
      "Type ARM exactly before arming the pilot."
    );
  }

  const batchId = String(
    formData.get("batchId") ?? ""
  ).trim();

  if (!batchId) {
    throw new Error(
      "Missing pilot batch ID."
    );
  }

  const snapshot = await getLaunchSnapshot();

  // Arm only while Master Sending is OFF.
  if (snapshot.settings.sending_enabled) {
    throw new Error(
      "Turn Master Sending OFF before arming the pilot."
    );
  }

  if (!snapshot.settings.pilot_mode) {
    throw new Error(
      "Pilot Mode must remain ON."
    );
  }

  const supabase = createAdminSupabase();

  // ==========================================================
  // LOAD BATCH
  // ==========================================================

  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from("email_pilot_batches")
    .select(`
      id,
      status,
      prepared_count
    `)
    .eq("id", batchId)
    .single();

  if (batchError || !batch) {
    throw new Error(
      batchError?.message ||
        "Pilot batch not found."
    );
  }

  if (batch.status !== "prepared") {
    throw new Error(
      `Pilot must be prepared before arming. Current status: ${batch.status}`
    );
  }

  // ==========================================================
  // LOAD PILOT MEMBERS
  // ==========================================================

  const {
    data: members,
    error: memberError,
  } = await supabase
    .from("email_pilot_members")
    .select(`
      carrier_id,
      enrollment_id,
      dot_number,
      email
    `)
    .eq("batch_id", batchId);

  if (memberError) {
    throw new Error(
      memberError.message
    );
  }

  const pilotMembers =
    members ?? [];

  if (pilotMembers.length === 0) {
    throw new Error(
      "Pilot has no members."
    );
  }

  if (
    pilotMembers.length !==
    batch.prepared_count
  ) {
    throw new Error(
      "Pilot member count does not match prepared count. Arming was blocked."
    );
  }

  // ==========================================================
  // RE-VERIFY EVERY CARRIER
  // ==========================================================

  for (const member of pilotMembers) {
    const carrierId = Number(
      member.carrier_id
    );

    const storedEmail =
      normalizeEmail(member.email);

    const eligibility =
      await checkCarrierEligibility(
        carrierId
      );

    if (eligibility.allowed !== true) {
      throw new Error(
        `USDOT ${
          member.dot_number ??
          carrierId
        } is no longer eligible: ${
          eligibility.reason ??
          "unknown_reason"
        }. The pilot remains safely PREPARED.`
      );
    }

    const currentEmail =
      normalizeEmail(
        eligibility.email
      );

    if (
      currentEmail !==
      storedEmail
    ) {
      throw new Error(
        `USDOT ${
          member.dot_number ??
          carrierId
        } email changed after pilot preparation. Arming was blocked.`
      );
    }
  }

  const enrollmentIds =
    pilotMembers.map(
      (member) =>
        member.enrollment_id
    );

  const now = new Date().toISOString();

  // ==========================================================
  // ACTIVATE ENROLLMENTS
  // ==========================================================

  const {
    data: activated,
    error: activationError,
  } = await supabase
    .from(
      "email_sequence_enrollments"
    )
    .update({
      status: "active",

      current_step: 1,

      next_send_at: now,

      updated_at: now,
    })
    .in("id", enrollmentIds)
    .eq("status", "paused")
    .select("id");

  if (activationError) {
    throw new Error(
      `Could not arm enrollments: ${activationError.message}`
    );
  }

  // ==========================================================
  // REQUIRE 100% ACTIVATION
  // ==========================================================

  if (
    (activated ?? []).length !==
    enrollmentIds.length
  ) {
    await supabase
      .from(
        "email_sequence_enrollments"
      )
      .update({
        status: "paused",

        next_send_at: null,

        updated_at:
          new Date().toISOString(),
      })
      .in("id", enrollmentIds);

    throw new Error(
      "Not every enrollment could be armed. All pilot enrollments were returned to PAUSED."
    );
  }

  // ==========================================================
  // MARK BATCH ARMED
  // ==========================================================

  const {
    error: batchUpdateError,
  } = await supabase
    .from("email_pilot_batches")
    .update({
      status: "armed",

      armed_at: now,

      updated_at: now,
    })
    .eq("id", batchId);

  if (batchUpdateError) {
    await supabase
      .from(
        "email_sequence_enrollments"
      )
      .update({
        status: "paused",

        next_send_at: null,

        updated_at:
          new Date().toISOString(),
      })
      .in("id", enrollmentIds);

    throw new Error(
      batchUpdateError.message
    );
  }

  revalidatePath("/admin/pilot");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/monitoring");
}

// ============================================================
// CANCEL PILOT
// ============================================================

export async function cancelPilotAction(
  formData: FormData
) {
  "use server";

  const confirmation = String(
    formData.get("confirmation") ?? ""
  )
    .trim()
    .toUpperCase();

  if (confirmation !== "CANCEL") {
    throw new Error(
      "Type CANCEL exactly before cancelling the pilot."
    );
  }

  const batchId = String(
    formData.get("batchId") ?? ""
  ).trim();

  if (!batchId) {
    throw new Error(
      "Missing pilot batch ID."
    );
  }

  const supabase = createAdminSupabase();

  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from("email_pilot_batches")
    .select(`
      id,
      status
    `)
    .eq("id", batchId)
    .single();

  if (batchError || !batch) {
    throw new Error(
      batchError?.message ||
        "Pilot batch not found."
    );
  }

  if (
    ![
      "prepared",
      "armed",
    ].includes(batch.status)
  ) {
    throw new Error(
      `Pilot cannot be cancelled from status ${batch.status}.`
    );
  }

  const {
    data: members,
    error: memberError,
  } = await supabase
    .from("email_pilot_members")
    .select("enrollment_id")
    .eq("batch_id", batchId);

  if (memberError) {
    throw new Error(
      memberError.message
    );
  }

  const enrollmentIds =
    (members ?? []).map(
      (member) =>
        member.enrollment_id
    );

  const now = new Date().toISOString();

  // ==========================================================
  // STOP PILOT ENROLLMENTS
  // ==========================================================

  if (enrollmentIds.length > 0) {
    await supabase
      .from(
        "email_sequence_enrollments"
      )
      .update({
        status: "stopped",

        next_send_at: null,

        stopped_at: now,

        updated_at: now,
      })
      .in("id", enrollmentIds);
  }

  // ==========================================================
  // CANCEL BATCH
  // ==========================================================

  const {
    error: cancelError,
  } = await supabase
    .from("email_pilot_batches")
    .update({
      status: "cancelled",

      cancelled_at: now,

      updated_at: now,
    })
    .eq("id", batchId);

  if (cancelError) {
    throw new Error(
      cancelError.message
    );
  }

  revalidatePath("/admin/pilot");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/monitoring");
}