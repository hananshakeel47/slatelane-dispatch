import type { Metadata } from "next";
import type { ReactNode } from "react";

import AdminShell from "./admin-shell";
import "./admin.css";

export const metadata: Metadata = {
  title: "CRM",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}