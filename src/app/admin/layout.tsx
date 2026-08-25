import type {
  ReactNode,
} from "react";

import Link from "next/link";


export const dynamic =
  "force-dynamic";


type Props = {
  children:
    ReactNode;
};


const navigation = [
  {
    href:
      "/admin/dashboard",

    label:
      "Dashboard",

    badge:
      null,
  },

  {
    href:
      "/admin/carriers",

    label:
      "Carriers",

    badge:
      null,
  },

  {
    href:
      "/admin/leads",

    label:
      "Leads",

    badge:
      null,
  },

  {
    href:
      "/admin/replies",

    label:
      "Replies",

    badge:
      "Inbox",
  },

  {
    href:
      "/admin/tasks",

    label:
      "Tasks",

    badge:
      "Follow-up",
  },

  {
    href:
      "/admin/pilot",

    label:
      "Pilot Launch",

    badge:
      "Launch",
  },

  {
    href:
      "/admin/import",

    label:
      "FMCSA Import",

    badge:
      null,
  },

  {
    href:
      "/admin/settings",

    label:
      "Settings",

    badge:
      null,
  },
];


export default function AdminLayout({
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-[#08090b] text-white">

      <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">

        {/* SIDEBAR */}

        <aside className="border-b border-zinc-800 bg-[#17181b] lg:min-h-screen lg:border-b-0 lg:border-r">

          <div className="lg:sticky lg:top-0">

            {/* BRAND */}

            <div className="px-5 pb-5 pt-6">

              <Link
                href="/admin/dashboard"
                className="block"
              >

                <div className="text-xl font-bold tracking-tight">
                  SlateLane CRM
                </div>

                <div className="mt-1 text-[11px] text-zinc-500">
                  Dispatch Sales Operations
                </div>

              </Link>

            </div>


            {/* NAV */}

            <nav className="flex gap-2 overflow-x-auto px-3 pb-4 lg:block lg:space-y-1 lg:overflow-visible lg:px-4">

              {navigation.map(
                (
                  item
                ) => (

                  <Link
                    key={
                      item.href
                    }
                    href={
                      item.href
                    }
                    className="flex shrink-0 items-center justify-between gap-4 rounded-xl px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 hover:text-white lg:w-full"
                  >

                    <span>
                      {item.label}
                    </span>


                    {item.badge && (

                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          item.badge ===
                          "Launch"
                            ? "bg-amber-950 text-amber-300"
                            : item.badge ===
                                "Inbox"
                              ? "bg-emerald-950 text-emerald-300"
                              : "bg-blue-950 text-blue-300"
                        }`}
                      >
                        {item.badge}
                      </span>

                    )}

                  </Link>

                )
              )}

            </nav>


            {/* SAFETY NOTE */}

            <div className="hidden px-5 py-6 lg:block">

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">

                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Production
                </div>

                <div className="mt-2 text-xs leading-5 text-zinc-400">
                  Outreach is governed by Launch Controls and Pilot protection.
                </div>

              </div>

            </div>

          </div>

        </aside>


        {/* CONTENT */}

        <main className="min-w-0">

          <div className="mx-auto w-full max-w-[1700px] p-5 sm:p-7 lg:p-8 xl:p-10">

            {children}

          </div>

        </main>

      </div>

    </div>
  );
}