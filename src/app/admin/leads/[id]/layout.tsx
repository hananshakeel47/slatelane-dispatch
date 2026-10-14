import Link from "next/link";

import type {
  ReactNode,
} from "react";

import LeadConversionControls from "./conversion-controls";


export const dynamic =
  "force-dynamic";


type Props = {
  children:
    ReactNode;

  params:
    Promise<{
      id: string;
    }>;
};


export default async function LeadDetailLayout({
  children,
  params,
}: Props) {
  const {
    id,
  } =
    await params;


  return (
    <div className="space-y-6">

      <LeadConversionControls
        leadId={
          id
        }
      />

      <div className="flex justify-end">
        <Link href={`/admin/loadboard/prospects?lead=${encodeURIComponent(id)}`}
          className="inline-flex rounded-xl border border-sky-500/25 bg-sky-500/[0.06] px-4 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-500/[0.1]">
          Research Freight Opportunities →
        </Link>
      </div>

      {children}

    </div>
  );
}