import "server-only";

import {
  revalidatePath,
} from "next/cache";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";

import {
  getLaunchSnapshot,
} from "@/lib/email/launch-controls";


function normalizeEmail(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}


function isUsableEmail(
  value: unknown
) {
  const email =
    normalizeEmail(
      value
    );

  return (
    email.length >= 5 &&
    email.includes("@") &&
    email.includes(".") &&
    !email.includes(" ")
  );
}


function chunk<T>(
  values: T[],
  size = 100
) {
  const result: T[][] =
    [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    result.push(
      values.slice(
        index,
        index + size
      )
    );
  }

  return result;
}


async function getActiveSequence() {
  const supabase =
    createAdminSupabase();


  const {
    data,
    error,
  } = await supabase
    .from(
      "email_sequences"
    )
    .select(`
      id,
      name,
      description,
      active,
      created_at
    `)
    .eq(
      "active",
      true
    )
    .order(
      "created_at",
      {
        ascending: true,
      }
    )
    .limit(1)
    .maybeSingle();


  if (
    error ||
    !data
  ) {
    throw new Error(
      error?.message ||
      "No active email sequence was found."
    );
  }


  return data;
}


export async function getPilotPreview(
  requestedLimit?: number
) {
  const supabase =
    createAdminSupabase();


  const snapshot =
    await getLaunchSnapshot();


  const settings =
    snapshot.settings;


  const sequence =
    await getActiveSequence();


  const requested =
    Number.isFinite(
      Number(
        requestedLimit
      )
    )
      ? Number(
          requestedLimit
        )
      : settings.pilot_limit;


  const limit =
    Math.max(
      1,
      Math.min(
        Math.floor(
          requested
        ),
        settings.pilot_limit,
        100
      )
    );


  /*
   * Pull a larger pool because some records
   * will later be rejected for:
   *
   * - existing leads
   * - suppression
   * - prior pilots
   * - duplicate emails
   * - invalid addresses
   */
  const scanLimit =
    Math.max(
      500,
      Math.min(
        1000,
        limit * 30
      )
    );


  let carrierQuery =
    supabase
      .from("carriers")
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
        client
      `)
      .gte(
        "lead_score",
        settings.minimum_carrier_score
      )
      .order(
        "lead_score",
        {
          ascending: false,
        }
      )
      .order(
        "dispatcher_probability",
        {
          ascending: false,
        }
      );


  if (
    settings.require_active_authority
  ) {
    carrierQuery =
      carrierQuery.eq(
        "status_code",
        "A"
      );
  }


  if (
    settings.require_email
  ) {
    carrierQuery =
      carrierQuery.not(
        "email",
        "is",
        null
      );
  }


  const {
    data: rawCarriers,
    error: carrierError,
  } =
    await carrierQuery.limit(
      scanLimit
    );


  if (carrierError) {
    throw new Error(
      `Could not load pilot carriers: ${carrierError.message}`
    );
  }


  const baseCandidates =
    (
      rawCarriers ??
      []
    ).filter(
      (
        carrier
      ) => {

        if (
          !carrier.dot_number
        ) {
          return false;
        }


        if (
          !isUsableEmail(
            carrier.email
          )
        ) {
          return false;
        }


        /*
         * Already-contacted carriers do not belong
         * in a brand-new cold pilot.
         */
        if (
          carrier.contacted ===
          true
        ) {
          return false;
        }


        if (
          carrier.client ===
          true
        ) {
          return false;
        }


        return true;
      }
    );


  const dotNumbers =
    baseCandidates.map(
      (
        carrier
      ) =>
        carrier.dot_number
    );


  const carrierIds =
    baseCandidates.map(
      (
        carrier
      ) =>
        carrier.id
    );


  const candidateEmails =
    [
      ...new Set(
        baseCandidates.map(
          (
            carrier
          ) =>
            normalizeEmail(
              carrier.email
            )
        )
      ),
    ];


  /*
   * Existing leads:
   * any carrier already in Leads is excluded.
   */
  const existingDotNumbers =
    new Set<number>();


  const existingLeadEmails =
    new Set<string>();


  for (
    const group
    of chunk(
      dotNumbers,
      100
    )
  ) {
    if (
      group.length === 0
    ) {
      continue;
    }


    const {
      data,
      error,
    } = await supabase
      .from("leads")
      .select(`
        carrier_dot_number,
        email
      `)
      .in(
        "carrier_dot_number",
        group
      );


    if (error) {
      throw new Error(
        `Could not check existing leads: ${error.message}`
      );
    }


    for (
      const lead
      of data ?? []
    ) {
      if (
        lead.carrier_dot_number
      ) {
        existingDotNumbers.add(
          Number(
            lead.carrier_dot_number
          )
        );
      }


      if (
        lead.email
      ) {
        existingLeadEmails.add(
          normalizeEmail(
            lead.email
          )
        );
      }
    }
  }


  /*
   * Suppression list.
   */
  const suppressedEmails =
    new Set<string>();


  for (
    const group
    of chunk(
      candidateEmails,
      100
    )
  ) {
    if (
      group.length === 0
    ) {
      continue;
    }


    const {
      data,
      error,
    } = await supabase
      .from(
        "email_suppressions"
      )
      .select("email")
      .in(
        "email",
        group
      );


    if (error) {
      throw new Error(
        `Could not check email suppressions: ${error.message}`
      );
    }


    for (
      const row
      of data ?? []
    ) {
      if (
        row.email
      ) {
        suppressedEmails.add(
          normalizeEmail(
            row.email
          )
        );
      }
    }
  }


  /*
   * Never use a carrier that has already belonged
   * to any previous pilot batch.
   */
  const previousPilotCarrierIds =
    new Set<number>();


  for (
    const group
    of chunk(
      carrierIds,
      100
    )
  ) {
    if (
      group.length === 0
    ) {
      continue;
    }


    const {
      data,
      error,
    } = await supabase
      .from(
        "email_pilot_members"
      )
      .select(
        "carrier_id"
      )
      .in(
        "carrier_id",
        group
      );


    if (error) {
      throw new Error(
        `Could not check previous pilots: ${error.message}`
      );
    }


    for (
      const member
      of data ?? []
    ) {
      previousPilotCarrierIds.add(
        Number(
          member.carrier_id
        )
      );
    }
  }


  const usedEmails =
    new Set<string>();


  const eligible =
    baseCandidates.filter(
      (
        carrier
      ) => {

        const email =
          normalizeEmail(
            carrier.email
          );


        const dot =
          Number(
            carrier.dot_number
          );


        if (
          existingDotNumbers.has(
            dot
          )
        ) {
          return false;
        }


        if (
          existingLeadEmails.has(
            email
          )
        ) {
          return false;
        }


        if (
          suppressedEmails.has(
            email
          )
        ) {
          return false;
        }


        if (
          previousPilotCarrierIds.has(
            Number(
              carrier.id
            )
          )
        ) {
          return false;
        }


        /*
         * Avoid two DOT records using the same
         * email address inside one pilot.
         */
        if (
          usedEmails.has(
            email
          )
        ) {
          return false;
        }


        usedEmails.add(
          email
        );


        return true;
      }
    );


  return {
    settings,
    sequence,

    carriers:
      eligible.slice(
        0,
        limit
      ),

    requested:
      limit,

    scanned:
      rawCarriers?.length ??
      0,

    eligibleFound:
      eligible.length,

    sentToday:
      snapshot.sentToday,

    effectiveCap:
      snapshot.effectiveCap,

    remainingToday:
      snapshot.remainingToday,
  };
}


export async function preparePilotAction(
  formData: FormData
) {
  "use server";


  const confirmation =
    String(
      formData.get(
        "confirmation"
      ) ?? ""
    )
      .trim()
      .toUpperCase();


  if (
    confirmation !==
    "PREPARE"
  ) {
    throw new Error(
      "Type PREPARE exactly before creating the pilot."
    );
  }


  const snapshot =
    await getLaunchSnapshot();


  if (
    snapshot.settings
      .sending_enabled
  ) {
    throw new Error(
      "Master Sending must be OFF before preparing a real-carrier pilot."
    );
  }


  if (
    !snapshot.settings
      .pilot_mode
  ) {
    throw new Error(
      "Pilot Mode must be ON before preparing the pilot."
    );
  }


  const requested =
    Math.max(
      1,
      Math.min(
        Math.floor(
          Number(
            formData.get(
              "pilotCount"
            ) ??
            snapshot.settings
              .pilot_limit
          )
        ),
        snapshot.settings
          .pilot_limit,
        100
      )
    );


  const supabase =
    createAdminSupabase();


  /*
   * Only one unfinished pilot is allowed.
   */
  const {
    data: existingBatch,
    error:
      existingBatchError,
  } = await supabase
    .from(
      "email_pilot_batches"
    )
    .select(`
      id,
      status
    `)
    .in(
      "status",
      [
        "prepared",
        "armed",
      ]
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(1)
    .maybeSingle();


  if (
    existingBatchError
  ) {
    throw new Error(
      existingBatchError.message
    );
  }


  if (
    existingBatch
  ) {
    throw new Error(
      "A prepared or armed pilot already exists. Cancel or finish it before creating another."
    );
  }


  const preview =
    await getPilotPreview(
      requested
    );


  if (
    preview.carriers.length <
    requested
  ) {
    throw new Error(
      `Only ${preview.carriers.length} eligible carriers were found. Requested ${requested}.`
    );
  }


  const sequence =
    preview.sequence;


  const now =
    new Date()
      .toISOString();


  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from(
      "email_pilot_batches"
    )
    .insert({
      sequence_id:
        sequence.id,

      status:
        "prepared",

      requested_count:
        requested,

      prepared_count:
        0,

      minimum_score:
        snapshot.settings
          .minimum_carrier_score,

      notes:
        "Controlled real-carrier pilot prepared while Master Sending was OFF.",

      updated_at:
        now,
    })
    .select("id")
    .single();


  if (
    batchError ||
    !batch
  ) {
    throw new Error(
      `Could not create pilot batch: ${
        batchError?.message ||
        "Unknown error."
      }`
    );
  }


  const createdLeadIds:
    string[] = [];


  const createdEnrollmentIds:
    string[] = [];


  try {

    for (
      const carrier
      of preview.carriers
    ) {

      const email =
        normalizeEmail(
          carrier.email
        );


      /*
       * Final duplicate check immediately before insert.
       */
      const {
        data:
          existingLead,
        error:
          duplicateError,
      } = await supabase
        .from("leads")
        .select("id")
        .eq(
          "carrier_dot_number",
          carrier.dot_number
        )
        .limit(1)
        .maybeSingle();


      if (
        duplicateError
      ) {
        throw new Error(
          duplicateError.message
        );
      }


      if (
        existingLead
      ) {
        throw new Error(
          `USDOT ${carrier.dot_number} became an existing lead while the pilot was being prepared. Pilot preparation stopped safely.`
        );
      }


      /*
       * Create CRM lead.
       */
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
            "Real carrier prospect selected for controlled SlateLane email pilot.",

          carrier_dot_number:
            carrier.dot_number,

          mc_number:
            carrier.mc_number,

          source:
            "fmcsa_pilot",

          status:
            "new",

          notes:
            `Prepared in SlateLane controlled real-carrier pilot ${batch.id}.`,

          updated_at:
            now,
        })
        .select("id")
        .single();


      if (
        leadError ||
        !lead
      ) {
        throw new Error(
          `Could not create lead for USDOT ${carrier.dot_number}: ${
            leadError?.message ||
            "Unknown error."
          }`
        );
      }


      createdLeadIds.push(
        lead.id
      );


      /*
       * Critical safety feature:
       *
       * Enrollment begins PAUSED with no next_send_at.
       * Preparing a pilot therefore cannot send an email.
       */
      const {
        data:
          enrollment,
        error:
          enrollmentError,
      } = await supabase
        .from(
          "email_sequence_enrollments"
        )
        .insert({
          lead_id:
            lead.id,

          sequence_id:
            sequence.id,

          status:
            "paused",

          current_step:
            1,

          next_send_at:
            null,

          updated_at:
            now,
        })
        .select("id")
        .single();


      if (
        enrollmentError ||
        !enrollment
      ) {
        throw new Error(
          `Could not create paused enrollment for USDOT ${carrier.dot_number}: ${
            enrollmentError?.message ||
            "Unknown error."
          }`
        );
      }


      createdEnrollmentIds.push(
        enrollment.id
      );


      const {
        error:
          memberError,
      } = await supabase
        .from(
          "email_pilot_members"
        )
        .insert({
          batch_id:
            batch.id,

          carrier_id:
            carrier.id,

          lead_id:
            lead.id,

          enrollment_id:
            enrollment.id,

          dot_number:
            carrier.dot_number,

          email,
        });


      if (
        memberError
      ) {
        throw new Error(
          `Could not add USDOT ${carrier.dot_number} to the pilot batch: ${memberError.message}`
        );
      }
    }


    const {
      error:
        finalizeError,
    } = await supabase
      .from(
        "email_pilot_batches"
      )
      .update({
        prepared_count:
          createdLeadIds.length,

        prepared_at:
          new Date()
            .toISOString(),

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        batch.id
      );


    if (
      finalizeError
    ) {
      throw new Error(
        finalizeError.message
      );
    }

  } catch (
    error
  ) {

    /*
     * Best-effort rollback.
     *
     * Delete batch first so member rows cascade away,
     * then remove created enrollments and leads.
     */

    await supabase
      .from(
        "email_pilot_batches"
      )
      .delete()
      .eq(
        "id",
        batch.id
      );


    for (
      const group
      of chunk(
        createdEnrollmentIds,
        100
      )
    ) {
      if (
        group.length > 0
      ) {
        await supabase
          .from(
            "email_sequence_enrollments"
          )
          .delete()
          .in(
            "id",
            group
          );
      }
    }


    for (
      const group
      of chunk(
        createdLeadIds,
        100
      )
    ) {
      if (
        group.length > 0
      ) {
        await supabase
          .from(
            "leads"
          )
          .delete()
          .in(
            "id",
            group
          );
      }
    }


    throw error;
  }


  revalidatePath(
    "/admin/pilot"
  );

  revalidatePath(
    "/admin/dashboard"
  );

  revalidatePath(
    "/admin/leads"
  );

  revalidatePath(
    "/admin/settings"
  );
}


export async function armPilotAction(
  formData: FormData
) {
  "use server";


  const confirmation =
    String(
      formData.get(
        "confirmation"
      ) ?? ""
    )
      .trim()
      .toUpperCase();


  if (
    confirmation !==
    "ARM"
  ) {
    throw new Error(
      "Type ARM exactly before arming the pilot."
    );
  }


  const batchId =
    String(
      formData.get(
        "batchId"
      ) ?? ""
    ).trim();


  if (
    !batchId
  ) {
    throw new Error(
      "Missing pilot batch ID."
    );
  }


  const snapshot =
    await getLaunchSnapshot();


  /*
   * Even arming must happen while Master Sending
   * is still OFF.
   */
  if (
    snapshot.settings
      .sending_enabled
  ) {
    throw new Error(
      "Turn Master Sending OFF before arming the pilot."
    );
  }


  if (
    !snapshot.settings
      .pilot_mode
  ) {
    throw new Error(
      "Pilot Mode must remain ON."
    );
  }


  const supabase =
    createAdminSupabase();


  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from(
      "email_pilot_batches"
    )
    .select(`
      id,
      status,
      prepared_count
    `)
    .eq(
      "id",
      batchId
    )
    .single();


  if (
    batchError ||
    !batch
  ) {
    throw new Error(
      batchError?.message ||
      "Pilot batch not found."
    );
  }


  if (
    batch.status !==
    "prepared"
  ) {
    throw new Error(
      `Pilot must be prepared before arming. Current status: ${batch.status}`
    );
  }


  const {
    data: members,
    error: memberError,
  } = await supabase
    .from(
      "email_pilot_members"
    )
    .select(
      "enrollment_id"
    )
    .eq(
      "batch_id",
      batchId
    );


  if (
    memberError
  ) {
    throw new Error(
      memberError.message
    );
  }


  const enrollmentIds =
    (
      members ??
      []
    ).map(
      (
        member
      ) =>
        member.enrollment_id
    );


  if (
    enrollmentIds.length ===
    0
  ) {
    throw new Error(
      "Pilot has no enrollments."
    );
  }


  if (
    enrollmentIds.length !==
    batch.prepared_count
  ) {
    throw new Error(
      "Pilot member count does not match the prepared count. Arming was blocked."
    );
  }


  const now =
    new Date()
      .toISOString();


  const {
    data:
      activated,
    error:
      activationError,
  } = await supabase
    .from(
      "email_sequence_enrollments"
    )
    .update({
      status:
        "active",

      current_step:
        1,

      next_send_at:
        now,

      updated_at:
        now,
    })
    .in(
      "id",
      enrollmentIds
    )
    .eq(
      "status",
      "paused"
    )
    .select("id");


  if (
    activationError
  ) {
    throw new Error(
      `Could not arm enrollments: ${activationError.message}`
    );
  }


  if (
    (
      activated ??
      []
    ).length !==
    enrollmentIds.length
  ) {

    /*
     * Roll back anything activated.
     */
    await supabase
      .from(
        "email_sequence_enrollments"
      )
      .update({
        status:
          "paused",

        next_send_at:
          null,

        updated_at:
          new Date()
            .toISOString(),
      })
      .in(
        "id",
        enrollmentIds
      );


    throw new Error(
      "Not every enrollment could be armed. All pilot enrollments were returned to PAUSED."
    );
  }


  const {
    error:
      batchUpdateError,
  } = await supabase
    .from(
      "email_pilot_batches"
    )
    .update({
      status:
        "armed",

      armed_at:
        now,

      updated_at:
        now,
    })
    .eq(
      "id",
      batchId
    );


  if (
    batchUpdateError
  ) {

    await supabase
      .from(
        "email_sequence_enrollments"
      )
      .update({
        status:
          "paused",

        next_send_at:
          null,

        updated_at:
          new Date()
            .toISOString(),
      })
      .in(
        "id",
        enrollmentIds
      );


    throw new Error(
      batchUpdateError.message
    );
  }


  revalidatePath(
    "/admin/pilot"
  );

  revalidatePath(
    "/admin/dashboard"
  );

  revalidatePath(
    "/admin/settings"
  );
}


export async function cancelPilotAction(
  formData: FormData
) {
  "use server";


  const confirmation =
    String(
      formData.get(
        "confirmation"
      ) ?? ""
    )
      .trim()
      .toUpperCase();


  if (
    confirmation !==
    "CANCEL"
  ) {
    throw new Error(
      "Type CANCEL exactly before cancelling the pilot."
    );
  }


  const batchId =
    String(
      formData.get(
        "batchId"
      ) ?? ""
    ).trim();


  if (
    !batchId
  ) {
    throw new Error(
      "Missing pilot batch ID."
    );
  }


  const supabase =
    createAdminSupabase();


  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from(
      "email_pilot_batches"
    )
    .select(
      "id, status"
    )
    .eq(
      "id",
      batchId
    )
    .single();


  if (
    batchError ||
    !batch
  ) {
    throw new Error(
      batchError?.message ||
      "Pilot batch not found."
    );
  }


  if (
    ![
      "prepared",
      "armed",
    ].includes(
      batch.status
    )
  ) {
    throw new Error(
      `Pilot cannot be cancelled from status ${batch.status}.`
    );
  }


  const {
    data: members,
    error: memberError,
  } = await supabase
    .from(
      "email_pilot_members"
    )
    .select(
      "enrollment_id"
    )
    .eq(
      "batch_id",
      batchId
    );


  if (
    memberError
  ) {
    throw new Error(
      memberError.message
    );
  }


  const enrollmentIds =
    (
      members ??
      []
    ).map(
      (
        member
      ) =>
        member.enrollment_id
    );


  const now =
    new Date()
      .toISOString();


  if (
    enrollmentIds.length >
    0
  ) {
    await supabase
      .from(
        "email_sequence_enrollments"
      )
      .update({
        status:
          "stopped",

        next_send_at:
          null,

        stopped_at:
          now,

        updated_at:
          now,
      })
      .in(
        "id",
        enrollmentIds
      );
  }


  const {
    error:
      cancelError,
  } = await supabase
    .from(
      "email_pilot_batches"
    )
    .update({
      status:
        "cancelled",

      cancelled_at:
        now,

      updated_at:
        now,
    })
    .eq(
      "id",
      batchId
    );


  if (
    cancelError
  ) {
    throw new Error(
      cancelError.message
    );
  }


  revalidatePath(
    "/admin/pilot"
  );

  revalidatePath(
    "/admin/dashboard"
  );

  revalidatePath(
    "/admin/settings"
  );
}