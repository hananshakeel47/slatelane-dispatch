import type {
  ReactNode,
} from "react";

import CarrierSettings from "./carrier-settings";
import OperationsControls from "./operations-controls";
import OperationsHistory from "./operations-history";


export const dynamic =
  "force-dynamic";


export default function OperationsLayout({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <div className="space-y-6">

      {children}

      <CarrierSettings />

      <OperationsControls />

      <OperationsHistory />

    </div>
  );
}