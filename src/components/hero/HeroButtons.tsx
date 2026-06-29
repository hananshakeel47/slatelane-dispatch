export default function HeroButtons() {
  return (
    <div className="mt-10 flex flex-col sm:flex-row gap-4">

      <a
        href="#contact"
        className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-8 py-4 text-white font-semibold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-sky-500/30 text-center"
      >
        Book Free Consultation
      </a>

      <a
        href="tel:+10000000000"
        className="rounded-xl border border-sky-500/30 px-8 py-4 text-white font-semibold transition-all duration-300 hover:bg-sky-500/10 hover:scale-105 text-center"
      >
        Call Now
      </a>

    </div>
  );
}