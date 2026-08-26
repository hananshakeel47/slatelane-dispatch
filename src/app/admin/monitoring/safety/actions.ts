"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

export async function runSafetyCheckAction(
  _formData: FormData
) {
  const supabase = createServerSupabase();

  const { error } = await supabase.rpc(
    "evaluate_email_safety"
  );

  if (error) {
    throw new Error(
      `Safety check failed: ${error.message}`
    );
  }

  revalidatePath("/admin/monitoring");
  revalidatePath("/admin/monitoring/safety");
  revalidatePath("/admin/settings");
}

export async function resetSafetyLockAction(
  formData: FormData
) {
  const confirmation = String(
    formData.get("confirmation") ?? ""
  )
    .trim()
    .toUpperCase();

  const note = String(
    formData.get("note") ?? ""
  ).trim();

  if (confirmation !== "RESET") {
    throw new Error(
      "Safety reset cancelled. Type RESET exactly."
    );
  }

  const supabase = createServerSupabase();

  const { error } = await supabase.rpc(
    "reset_email_safety_pause",
    {
      p_note:
        note ||
        "Manual safety reset from SlateLane Safety Center",
    }
  );

  if (error) {
    throw new Error(
      `Could not reset safety lock: ${error.message}`
    );
  }

  /*
   * IMPORTANT:
   * reset_email_safety_pause() does NOT enable
   * Master Sending.
   *
   * Master Sending must still be turned ON manually
   * from Launch Controls after the underlying problem
   * has been investigated.
   */

  revalidatePath("/admin/monitoring");
  revalidatePath("/admin/monitoring/safety");
  revalidatePath("/admin/settings");
}