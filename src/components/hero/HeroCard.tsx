export default function HeroCard() {
  return (
    <div className="flex justify-center">

      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-8">

        <div className="flex items-center justify-between mb-8">

          <div>
            <p className="text-gray-400 text-sm">
              Current Load
            </p>

            <h2 className="text-white text-2xl font-bold">
              Dallas → Atlanta
            </h2>
          </div>

          <div className="w-4 h-4 rounded-full bg-green-400 animate-pulse"></div>

        </div>

        <div className="space-y-6">

          <div className="flex justify-between">
            <span className="text-gray-400">Equipment</span>

            <span className="text-white font-semibold">
              Dry Van
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-400">Rate</span>

            <span className="text-sky-400 font-bold">
              $2,350
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-400">Distance</span>

            <span className="text-white">
              780 Miles
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-400">Status</span>

            <span className="text-green-400 font-semibold">
              Active
            </span>
          </div>

        </div>

        <div className="mt-8 rounded-xl bg-sky-500/10 border border-sky-500/20 p-4">

          <p className="text-sky-300 text-sm">
            Dedicated dispatch support, broker negotiation, route planning and paperwork — all handled by SlateLane Dispatch.
          </p>

        </div>

      </div>

    </div>
  );
}