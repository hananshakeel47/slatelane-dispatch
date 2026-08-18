import { createServerSupabase } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createServerSupabase();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    { count: totalLeads },
    { count: todayLeads },
    { count: totalCarriers },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("*", {
        count: "exact",
        head: true,
      }),

    supabase
      .from("leads")
      .select("*", {
        count: "exact",
        head: true,
      })
      .gte("created_at", today.toISOString()),

    supabase
      .from("carriers")
      .select("*", {
        count: "exact",
        head: true,
      }),
  ]);

  const cards = [
    {
      title: "Today's Leads",
      value: todayLeads ?? 0,
    },
    {
      title: "Total Leads",
      value: totalLeads ?? 0,
    },
    {
      title: "Total Carriers",
      value: totalCarriers ?? 0,
    },
    {
      title: "FMCSA Sync",
      value: "Ready",
    },
  ];

  return (
    <>
      <h1 className="mb-8 text-4xl font-bold">
        Dashboard
      </h1>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
          >
            <p className="text-zinc-400">
              {card.title}
            </p>

            <h2 className="mt-4 text-4xl font-bold text-sky-400">
              {card.value}
            </h2>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <h2 className="mb-4 text-2xl font-bold">
          Recent Activity
        </h2>

        <p className="text-zinc-400">
          FMCSA importer not executed yet.
        </p>
      </div>
    </>
  );
}