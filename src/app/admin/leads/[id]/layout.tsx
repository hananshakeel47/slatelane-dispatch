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

      {children}

    </div>
  );
}