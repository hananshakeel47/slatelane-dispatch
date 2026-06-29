export default function HeroButtons() {
  return (
    <div className="mt-10 flex flex-col gap-4 sm:flex-row">

      <a
        href="#contact"
        className="rounded-xl bg-sky-500 px-8 py-4 text-center font-semibold text-white transition hover:bg-sky-400"
      >
        Schedule a Discovery Call
      </a>

      <a
        href="#services"
        className="rounded-xl border border-white/15 px-8 py-4 text-center font-semibold text-white transition hover:bg-white/5"
      >
        Explore Services
      </a>

    </div>
  );
}