import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result || null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function validLinkedInUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com"))
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prospectId = clean(body.prospect_id);
    if (!prospectId) {
      return NextResponse.json(
        { success: false, message: "Prospect ID is required." },
        { status: 400 }
      );
    }

    const linkedinUrl = clean(body.linkedin_url);
    if (!validLinkedInUrl(linkedinUrl)) {
      return NextResponse.json(
        { success: false, message: "Enter a valid LinkedIn profile URL." },
        { status: 400 }
      );
    }

    const email = clean(body.email)?.toLowerCase() ?? null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, message: "Enter a valid email address or leave the email field blank." },
        { status: 400 }
      );
    }

    const dotInput = body.carrier_dot_number;
    const dot = numberOrNull(dotInput);
    if (dotInput !== null && dotInput !== undefined && dotInput !== "" && dot === null) {
      return NextResponse.json(
        { success: false, message: "Carrier DOT number must be a non-negative number." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("linkedin_prospects")
      .update({
        linkedin_url: linkedinUrl,
        first_name: clean(body.first_name),
        last_name: clean(body.last_name),
        company_name: clean(body.company_name),
        job_title: clean(body.job_title),
        location: clean(body.location),
        email,
        phone: clean(body.phone),
        carrier_dot_number: dot,
        notes: clean(body.notes),
        updated_at: new Date().toISOString(),
      })
      .eq("id", prospectId)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { success: false, message: "That LinkedIn profile is already saved to another prospect." },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }

    if (!data) {
      return NextResponse.json(
        { success: false, message: "Prospect not found. Refresh the page and try again." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Prospect details updated.",
    });
  } catch (error) {
    console.error("LINKEDIN PROSPECT UPDATE ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not update prospect details.",
      },
      { status: 500 }
    );
  }
}
