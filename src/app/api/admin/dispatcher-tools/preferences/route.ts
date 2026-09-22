import { NextResponse } from "next/server";

import { createAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PreferencePayload = {
  onboarding_id?: string;
  minimum_rate_per_mile?: number | null;
  target_rate_per_mile?: number | null;
  weekly_revenue_target?: number | null;
  max_deadhead_miles?: number | null;
  preferred_trip_min_miles?: number | null;
  preferred_trip_max_miles?: number | null;
  default_mpg?: number | null;
  default_fuel_price?: number | null;
  operating_cost_per_mile?: number | null;
  preferred_states?: string[];
  regions_to_avoid?: string[];
  preferred_lanes?: string[];
  home_time_notes?: string | null;
  operating_notes?: string | null;
};

const SELECT_FIELDS = `
  id,
  company_name,
  dot_number,
  mc_number,
  status,
  dispatch_fee_type,
  dispatch_fee_value,
  minimum_rate_per_mile,
  target_rate_per_mile,
  weekly_revenue_target,
  max_deadhead_miles,
  preferred_trip_min_miles,
  preferred_trip_max_miles,
  default_mpg,
  default_fuel_price,
  operating_cost_per_mile,
  preferred_states,
  regions_to_avoid,
  preferred_lanes,
  home_time_notes,
  operating_notes,
  updated_at
`;

function cleanText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();
  return cleaned.length ? cleaned : null;
}

function cleanNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 100);
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    return true;
  }

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const supabase = createAdminSupabase();

    const { data, error } = await supabase
      .from("carrier_onboardings")
      .select(SELECT_FIELDS)
      .order("company_name", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      carriers: data ?? [],
    });
  } catch (error) {
    console.error("Dispatcher preference GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not load carrier dispatch preferences.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) {
      return NextResponse.json(
        { success: false, message: "Invalid request origin." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as PreferencePayload;
    const onboardingId = cleanText(body.onboarding_id);

    if (!onboardingId) {
      return NextResponse.json(
        { success: false, message: "Choose a carrier first." },
        { status: 400 },
      );
    }

    const minTrip = cleanNumber(body.preferred_trip_min_miles);
    const maxTrip = cleanNumber(body.preferred_trip_max_miles);

    if (minTrip !== null && maxTrip !== null && minTrip > maxTrip) {
      return NextResponse.json(
        {
          success: false,
          message: "Minimum trip miles cannot exceed maximum trip miles.",
        },
        { status: 400 },
      );
    }

    const nonNegativeValues = [
      cleanNumber(body.minimum_rate_per_mile),
      cleanNumber(body.target_rate_per_mile),
      cleanNumber(body.weekly_revenue_target),
      cleanNumber(body.max_deadhead_miles),
      minTrip,
      maxTrip,
      cleanNumber(body.default_mpg),
      cleanNumber(body.default_fuel_price),
      cleanNumber(body.operating_cost_per_mile),
    ];

    if (nonNegativeValues.some((value) => value !== null && value < 0)) {
      return NextResponse.json(
        { success: false, message: "Numeric preferences cannot be negative." },
        { status: 400 },
      );
    }

    const update = {
      minimum_rate_per_mile: cleanNumber(body.minimum_rate_per_mile),
      target_rate_per_mile: cleanNumber(body.target_rate_per_mile),
      weekly_revenue_target: cleanNumber(body.weekly_revenue_target),
      max_deadhead_miles: cleanNumber(body.max_deadhead_miles),
      preferred_trip_min_miles: minTrip,
      preferred_trip_max_miles: maxTrip,
      default_mpg: cleanNumber(body.default_mpg),
      default_fuel_price: cleanNumber(body.default_fuel_price),
      operating_cost_per_mile: cleanNumber(body.operating_cost_per_mile),
      preferred_states: cleanStringArray(body.preferred_states),
      regions_to_avoid: cleanStringArray(body.regions_to_avoid),
      preferred_lanes: cleanStringArray(body.preferred_lanes),
      home_time_notes: cleanText(body.home_time_notes),
      operating_notes: cleanText(body.operating_notes),
      updated_at: new Date().toISOString(),
    };

    const supabase = createAdminSupabase();

    const { data, error } = await supabase
      .from("carrier_onboardings")
      .update(update)
      .eq("id", onboardingId)
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      carrier: data,
    });
  } catch (error) {
    console.error("Dispatcher preference POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not save carrier dispatch preferences.",
      },
      { status: 500 },
    );
  }
}
