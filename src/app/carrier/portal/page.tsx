import type { Metadata } from "next";

import CarrierPortalDashboard from "./portal-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Carrier Onboarding Status",
  robots: { index: false, follow: false },
};

export default function CarrierPortalPage() {
  return <CarrierPortalDashboard />;
}
