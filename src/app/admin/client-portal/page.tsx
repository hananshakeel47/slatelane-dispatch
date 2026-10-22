import type { Metadata } from "next";

import ClientPortalManager from "./client-portal-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client Portal Access",
  robots: { index: false, follow: false },
};

export default function ClientPortalAdminPage() {
  return <ClientPortalManager />;
}
