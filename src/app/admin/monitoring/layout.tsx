import Link from "next/link";

import type {
  ReactNode,
} from "react";


export const dynamic =
  "force-dynamic";


const LINKS = [
  {
    href:
      "/admin/monitoring",

    label:
      "Monitoring",

    description:
      "Email & pilot metrics",
  },

  {
    href:
      "/admin/monitoring/reliability",

    label:
      "Reliability",

    description:
      "Failures & stale work",
  },

  {
    href:
      "/admin/monitoring/events",

    label:
      "Event Ledger",

    description:
      "Persistent incidents",
  },

  {
    href:
      "/admin/monitoring/safety",

    label:
      "Safety Center",

    description:
      "Sending protection",
  },
];


export default function MonitoringLayout({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <div className="space-y-6">

      <nav className="rounded-[17px] border border-white/[0.065] bg-white/[0.018] p-2">

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">

          {LINKS.map(
            (
              item,
            ) => (
              <Link
                href={
                  item.href
                }
                key={
                  item.href
                }
                className="rounded-xl border border-transparent px-4 py-3 transition hover:border-white/[0.06] hover:bg-white/[0.03]"
              >

                <div className="text-[9px] font-semibold text-zinc-300">
                  {item.label}
                </div>


                <div className="mt-1 text-[7px] text-zinc-700">
                  {item.description}
                </div>

              </Link>
            ),
          )}

        </div>

      </nav>


      {children}

    </div>
  );
}