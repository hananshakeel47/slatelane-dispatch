export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <a href="/" className="text-2xl font-black tracking-tight text-white">
          Slate<span className="text-sky-400">Lane</span>
          <span className="ml-2 text-base font-medium text-gray-400">
            Dispatch
          </span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#services" className="text-gray-300 hover:text-white transition">
            Services
          </a>

          <a href="#contact" className="text-gray-300 hover:text-white transition">
            Contact
          </a>

          <a
            href="#contact"
            className="rounded-full bg-sky-500 px-5 py-2.5 font-semibold text-white transition hover:bg-sky-400"
          >
            Schedule a Call
          </a>
        </div>
      </div>
    </nav>
  );
}