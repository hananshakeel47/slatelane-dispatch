"use client";

import Link from "next/link";

type DocumentVaultButtonProps = {
  onboardingId: string;
  brokerPacketReady?: boolean;
};

export default function DocumentVaultButton({
  onboardingId,
  brokerPacketReady = false,
}: DocumentVaultButtonProps) {
  return (
    <Link
      href={`/admin/onboarding/${encodeURIComponent(
        onboardingId
      )}/documents`}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
        brokerPacketReady
          ? "bg-emerald-600 text-white hover:bg-emerald-700"
          : "bg-slate-950 text-white hover:bg-slate-800"
      }`}
    >
      <span className="text-base">
        {brokerPacketReady ? "✓" : "▣"}
      </span>

      <span>
        {brokerPacketReady
          ? "Broker Packet Ready"
          : "Documents"}
      </span>
    </Link>
  );
}