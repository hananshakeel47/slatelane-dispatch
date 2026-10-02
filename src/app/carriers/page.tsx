import {
  redirect,
} from "next/navigation";


export default function LegacyCarriersPage() {
  /*
   * Phase 3F
   *
   * Retire the original public carrier CRM.
   */

  redirect(
    "/admin/carriers",
  );
}