import { supabase } from "@/lib/supabase";

export default async function CarriersPage() {
  const { data: carriers, error } = await supabase
    .from("carriers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <main className="p-10 text-red-500">
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-10">
      <h1 className="text-4xl font-bold mb-8">
        Carrier CRM
      </h1>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full">
          <thead className="bg-zinc-900">
            <tr>
              <th className="p-4 text-left">Company</th>
              <th className="p-4 text-left">State</th>
              <th className="p-4 text-left">Phone</th>
              <th className="p-4 text-left">Score</th>
              <th className="p-4 text-left">Contacted</th>
            </tr>
          </thead>

          <tbody>
            {carriers?.map((carrier) => (
              <tr
                key={carrier.id}
                className="border-t border-zinc-800"
              >
                <td className="p-4">{carrier.legal_name}</td>
                <td className="p-4">{carrier.state}</td>
                <td className="p-4">{carrier.phone}</td>
                <td className="p-4">{carrier.lead_score}</td>
                <td className="p-4">
                  {carrier.contacted ? "✅" : "❌"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}