import Link from "next/link";


export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">

      {/* SIDEBAR */}

      <aside className="w-72 shrink-0 border-r border-zinc-800 bg-zinc-900 p-6">

        <div className="mb-10">

          <h1 className="text-2xl font-bold">
            SlateLane CRM
          </h1>

          <p className="mt-1 text-xs text-zinc-500">
            Dispatch Sales Operations
          </p>

        </div>


        <nav className="space-y-2">

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


          {/* NEW TASKS PAGE */}

          <Link
            href="/admin/tasks"
            className="flex items-center justify-between rounded-lg px-4 py-3 hover:bg-zinc-800"
          >
            <span>
              Tasks
            </span>

            <span className="rounded-full bg-blue-950 px-2 py-0.5 text-xs text-blue-300">
              Follow-up
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


      {/* PAGE */}

      <main className="min-w-0 flex-1 p-10">

        {children}

      </main>

    </div>
  );
}