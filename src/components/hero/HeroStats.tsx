export default function HeroStats() {
  return (
    <div className="mt-12 grid grid-cols-3 gap-6">

      <div className="text-center lg:text-left">
        <h3 className="text-3xl font-bold text-sky-400">
          24/7
        </h3>

        <p className="mt-2 text-gray-400 text-sm">
          Dispatch Support
        </p>
      </div>

      <div className="text-center lg:text-left">
        <h3 className="text-3xl font-bold text-sky-400">
          USA
        </h3>

        <p className="mt-2 text-gray-400 text-sm">
          Nationwide Coverage
        </p>
      </div>

      <div className="text-center lg:text-left">
        <h3 className="text-3xl font-bold text-sky-400">
          100%
        </h3>

        <p className="mt-2 text-gray-400 text-sm">
          Dedicated Dispatch
        </p>
      </div>

    </div>
  );
}