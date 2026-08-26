import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

const navItems = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
  },
  {
    href: "/admin/monitoring",
    label: "Monitoring",
    badge: "Live",
  },
  {
    href: "/admin/carriers",
    label: "Carriers",
  },
  {
    href: "/admin/leads",
    label: "Leads",
  },
  {
    href: "/admin/replies",
    label: "Replies",
    badge: "Inbox",
  },
  {
    href: "/admin/tasks",
    label: "Tasks",
    badge: "Follow-up",
  },
  {
    href: "/admin/pilot",
    label: "Pilot Launch",
    badge: "Launch",
  },
  {
    href: "/admin/import",
    label: "FMCSA Import",
  },
  {
    href: "/admin/settings",
    label: "Settings",
  },
];

function getBadgeClasses(badge?: string) {
  switch (badge) {
    case "Inbox":
      return "border-emerald-800 bg-emerald-950 text-emerald-300";

    case "Follow-up":
      return "border-blue-800 bg-blue-950 text-blue-300";

    case "Launch":
      return "border-amber-800 bg-amber-950 text-amber-300";

    case "Live":
      return "border-cyan-800 bg-cyan-950 text-cyan-300";

    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
  }
}

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#07090b] text-white">
      <div className="flex min-h-screen">
        {/* =====================================================
            SIDEBAR
        ===================================================== */}

        <aside className="fixed left-0 top-0 z-40 flex h-screen w-[248px] flex-col border-r border-zinc-800 bg-[#17181c]">
          {/* BRAND */}

          <div className="px-5 pb-6 pt-6">
            <Link href="/admin/dashboard">
              <div className="text-xl font-bold tracking-tight text-white">
                SlateLane CRM
              </div>

              <div className="mt-1 text-[11px] text-zinc-500">
                Dispatch Sales Operations
              </div>
            </Link>
          </div>

          {/* NAVIGATION */}

          <nav className="flex-1 space-y-1 px-4">
            {navItems.map((item) => {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="
                    group flex min-h-[46px]
                    items-center justify-between
                    rounded-xl px-3 py-2
                    text-sm font-medium text-zinc-200
                    transition
                    hover:bg-zinc-800/80
                    hover:text-white
                  "
                >
                  <span>{item.label}</span>

                  {item.badge ? (
                    <span
                      className={`
                        rounded-full border
                        px-2 py-0.5
                        text-[10px] font-semibold
                        ${getBadgeClasses(item.badge)}
                      `}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* PRODUCTION INFO */}

          <div className="p-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
                Production
              </div>

              <p className="mt-3 text-xs leading-5 text-zinc-500">
                Outreach is governed by Launch Controls, Pilot protection and
                automated safety systems.
              </p>
            </div>
          </div>
        </aside>

        {/* =====================================================
            MAIN CONTENT
        ===================================================== */}

        <main className="ml-[248px] min-h-screen w-[calc(100%-248px)] flex-1">
          <div className="mx-auto w-full max-w-[1700px] px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}