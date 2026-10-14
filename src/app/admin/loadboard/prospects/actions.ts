"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/admin";

const EQUIPMENT = new Set([
  "sprinter", "box_truck", "dry_van", "reefer",
  "flatbed", "step_deck", "hotshot", "power_only",
  "specialized", "other",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(form: FormData, key: string, maximum = 500): string {
  return String(form.get(key) ?? "").trim().slice(0, maximum);
}

function optional(form: FormData, key: string, maximum = 500): string | null {
  return text(form, key, maximum) || null;
}

function state(form: FormData, key: string): string | null {
  const value = text(form, key, 5).toUpperCase();
  if (!value) return null;
  if (!/^[A-Z]{2}$/.test(value)) throw new Error(`${key} must be a two-letter US state.`);
  return value;
}

function date(form: FormData, key: string): string | null {
  const value = text(form, key, 10);
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid ${key}.`);
  return value;
}

function numeric(
  form: FormData,
  key: string,
  max: number,
  integer: boolean,
): number | null {
  const value = text(form, key, 24);
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max || (integer && !Number.isInteger(n))) {
    throw new Error(`Invalid ${key}.`);
  }
  return n;
}

async function leadExists(id: string) {
  if (!UUID.test(id)) throw new Error("Invalid lead ID.");
  const db = createAdminSupabase();
  const { data, error } = await db
    .from("leads").select("id").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Lead not found.");
  return db;
}

function destination(id: string, saved: "profile" | "load") {
  revalidatePath("/admin/loadboard/prospects");
  redirect(`/admin/loadboard/prospects?lead=${encodeURIComponent(id)}&saved=${saved}`);
}

export async function saveProspectTruckAction(form: FormData) {
  const leadId = text(form, "lead_id", 36);
  const equipment = text(form, "equipment_type", 40);
  const db = await leadExists(leadId);

  if (!EQUIPMENT.has(equipment)) throw new Error("Choose a supported equipment type.");

  const length = numeric(form, "trailer_length_ft", 120, false);
  const payload = numeric(form, "max_payload_lbs", 150000, true);
  const deadhead = numeric(form, "max_deadhead_miles", 5000, true);
  if (length === 0 || payload === 0) throw new Error("Length and payload must be positive.");

  const { error } = await db.from("prospect_truck_profiles").upsert({
    lead_id: leadId,
    equipment_type: equipment,
    equipment_details: optional(form, "equipment_details", 300),
    trailer_length_ft: length,
    max_payload_lbs: payload,
    liftgate_required: form.get("liftgate_required") === "on",
    origin_city: optional(form, "origin_city", 100),
    origin_state: state(form, "origin_state"),
    available_date: date(form, "available_date"),
    preferred_destinations: optional(form, "preferred_destinations", 400),
    max_deadhead_miles: deadhead,
    notes: optional(form, "notes", 1200),
    updated_at: new Date().toISOString(),
  }, { onConflict: "lead_id" });
  if (error) throw new Error(`Cannot save truck profile: ${error.message}`);
  destination(leadId, "profile");
}

export async function saveObservedLoadAction(form: FormData) {
  const leadId = text(form, "lead_id", 36);
  const db = await leadExists(leadId);
  const source = text(form, "source_name", 100);
  const rawUrl = text(form, "source_url", 1000);

  if (!source || !rawUrl) throw new Error("Source name and URL are required.");
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid HTTPS posting URL.");
  }
  if (
    url.protocol !== "https:" ||
    !url.hostname.includes(".") ||
    url.username ||
    url.password
  ) {
    throw new Error("Only public HTTPS posting URLs are accepted.");
  }

  const status = text(form, "status", 40) || "observed_unconfirmed";
  if (!["observed_unconfirmed", "details_incomplete", "expired"].includes(status)) {
    throw new Error("Invalid posting status.");
  }

  const now = new Date();
  const { error } = await db.from("prospect_load_research").insert({
    lead_id: leadId,
    source_name: source,
    source_url: url.toString(),
    origin_city: optional(form, "origin_city", 100),
    origin_state: state(form, "origin_state"),
    destination_city: optional(form, "destination_city", 100),
    destination_state: state(form, "destination_state"),
    equipment_type: optional(form, "equipment_type", 80),
    pickup_date: date(form, "pickup_date"),
    posted_rate_usd: numeric(form, "posted_rate_usd", 1000000, false),
    status,
    notes: optional(form, "notes", 1200),
    observed_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    updated_at: now.toISOString(),
  });

  if (error) throw new Error(`Cannot save research posting: ${error.message}`);
  destination(leadId, "load");
}
