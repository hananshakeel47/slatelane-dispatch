import type {
  ReactNode,
} from "react";

import ActivationPanel from "./activation-panel";


export const dynamic =
  "force-dynamic";


export default function ConversionsLayout({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <div className="space-y-6">

      {children}

      <ActivationPanel />

    </div>
  );
}