"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are missing.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function promoteTo20Action(formData: FormData) {
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (confirmation !== "PROMOTE TO 20") {
    redirect("/admin/pilot/ramp?error=confirmation_required");
  }

  const supabase = getAdminSupabase();

  const { data, error } = await supabase.rpc(
    "promote_email_ramp_to_20",
    {
      p_confirmation: confirmation,
      p_note: note || null,
    }
  );

  if (error) {
    console.error("RAMP PROMOTION RPC ERROR:", error);

    redirect(
      `/admin/pilot/ramp?error=${encodeURIComponent(
        error.message || "promotion_failed"
      )}`
    );
  }

  const result = data as {
    success?: boolean;
    promoted?: boolean;
    reason?: string;
  } | null;

  if (!result?.success || !result?.promoted) {
    const reason = result?.reason || "not_ready";

    redirect(
      `/admin/pilot/ramp?error=${encodeURIComponent(reason)}`
    );
  }

  revalidatePath("/admin/pilot");
  revalidatePath("/admin/pilot/ramp");
  revalidatePath("/admin/monitoring");
  revalidatePath("/admin/monitoring/safety");

  redirect("/admin/pilot/ramp?success=promoted_to_20");
}