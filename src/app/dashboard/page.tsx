import {
  redirect,
} from "next/navigation";


export default function LegacyDashboardPage() {
  /*
   * Phase 3F
   *
   * The original /dashboard directly queried
   * the leads table using the public Supabase
   * compatibility client.
   *
   * It is now retired.
   */

  redirect(
    "/admin/dashboard",
  );
}