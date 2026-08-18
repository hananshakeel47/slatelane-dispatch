import {
  loadEnvConfig,
} from "@next/env";


loadEnvConfig(
  process.cwd()
);


async function main() {
  const email =
    process.argv[2]
      ?.trim()
      .toLowerCase();


  if (!email) {
    console.error(`
Usage:

npx tsx scripts/test-email-sequence.ts YOUR_OWN_EMAIL@example.com
`);

    process.exit(1);
  }


  console.log("");
  console.log(
    "SlateLane Email Automation Test"
  );

  console.log(
    "=============================="
  );

  console.log(
    `Recipient: ${email}`
  );

  console.log("");


  const {
    createAdminSupabase,
  } =
    await import(
      "../src/lib/supabase/admin"
    );


  const {
    enrollLeadInSequence,
    processDueEmailEnrollments,
  } =
    await import(
      "../src/lib/email/sequences"
    );


  const {
    DEFAULT_SEQUENCE_NAME,
  } =
    await import(
      "../src/lib/email/templates"
    );


  const supabase =
    createAdminSupabase();


  // ==========================================================
  // FIND / CREATE TEST LEAD
  // ==========================================================

  let {
    data: lead,
  } = await supabase
    .from("leads")
    .select(
      "id, email"
    )
    .eq(
      "email",
      email
    )
    .eq(
      "source",
      "email_test"
    )
    .limit(1)
    .maybeSingle();


  if (!lead) {
    const {
      data:
        newLead,

      error:
        leadError,
    } = await supabase
      .from("leads")
      .insert({
        name:
          "SlateLane Test",

        company_name:
          "SlateLane Test Carrier",

        email,

        phone:
          null,

        message:
          "Internal email automation test.",

        source:
          "email_test",

        status:
          "new",
      })
      .select(
        "id, email"
      )
      .single();


    if (
      leadError ||
      !newLead
    ) {
      throw new Error(
        `Could not create test lead: ${
          leadError
            ?.message ||
          "Unknown error"
        }`
      );
    }


    lead =
      newLead;
  }


  // ==========================================================
  // LOAD DEFAULT SEQUENCE
  // ==========================================================

  const {
    data: sequence,
    error:
      sequenceError,
  } = await supabase
    .from(
      "email_sequences"
    )
    .select(
      "id, name"
    )
    .eq(
      "name",
      DEFAULT_SEQUENCE_NAME
    )
    .maybeSingle();


  if (
    sequenceError ||
    !sequence
  ) {
    throw new Error(
      "Default email sequence was not found. Run migration 007 first."
    );
  }


  console.log(
    `Lead ID: ${lead.id}`
  );

  console.log(
    `Sequence: ${sequence.name}`
  );


  // ==========================================================
  // ENROLL
  // ==========================================================

  const enrollment =
    await enrollLeadInSequence(
      lead.id,
      sequence.id
    );


  console.log(
    `Enrollment: ${enrollment.id}`
  );


  // ==========================================================
  // PROCESS FIRST DUE EMAIL
  // ==========================================================

  const result =
    await processDueEmailEnrollments(
      1
    );


  console.log("");
  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  console.log("");
  console.log(
    "EMAIL TEST COMPLETE"
  );

  console.log("");
}


main().catch(
  (error) => {
    console.error("");
    console.error(
      "EMAIL TEST FAILED"
    );

    console.error(
      error
    );

    process.exit(1);
  }
);