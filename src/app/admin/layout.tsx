import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">

      <aside className="w-72 border-r border-zinc-800 bg-zinc-900 p-6">

        <h1 className="mb-10 text-2xl font-bold">
          SlateLane CRM
        </h1>

        <nav className="space-y-3">

          <Link
            href="/admin/dashboard"
            className="block rounded-lg px-4 py-3 hover:bg-zinc-800"
          >
            Dashboard
          </Link>

          <Link
            href="/admin/carriers"
            className="block rounded-lg px-4 py-3 hover:bg-zinc-800"
          >
            Carriers
          </Link>

          <Link
            href="/admin/leads"
            className="block rounded-lg px-4 py-3 hover:bg-zinc-800"
          >
            Leads
          </Link>

          <Link
            href="/admin/replies"
            className="flex items-center justify-between rounded-lg px-4 py-3 hover:bg-zinc-800"
          >
            <span>
              Replies
            </span>

            <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">
              Inbox
            </span>
          </Link>

          <Link
            href="/admin/import"
            className="block rounded-lg px-4 py-3 hover:bg-zinc-800"
          >
            FMCSA Import
          </Link>

          <Link
            href="/admin/settings"
            className="block rounded-lg px-4 py-3 hover:bg-zinc-800"
          >
            Settings
          </Link>

        </nav>

      </aside>

      <main className="min-w-0 flex-1 p-10">
        {children}
      </main>

    </div>
  );
}