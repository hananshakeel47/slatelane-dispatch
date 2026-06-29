export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-10 md:flex-row">

        <div>
          <h2 className="text-2xl font-black text-white">
            Slate<span className="text-sky-400">Lane</span>
            <span className="ml-2 text-base font-medium text-gray-400">
              Dispatch
            </span>
          </h2>

          <p className="mt-3 max-w-md text-sm text-gray-400">
            Dedicated dispatch support for owner operators and small fleets.
          </p>
        </div>

        <div className="text-center md:text-right">
          <p className="text-sm text-gray-400">
            contact@slatelanedispatch.com
          </p>

          <p className="mt-2 text-sm text-gray-500">
            © {new Date().getFullYear()} SlateLane Dispatch.
            All Rights Reserved.
          </p>
        </div>

      </div>
    </footer>
  );
}