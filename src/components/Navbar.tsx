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

        <div className="hidden md:flex items-center gap-8">
          <a
            href="#services"
            className="text-gray-300 transition hover:text-sky-400"
          >
            Services
          </a>

          <a
            href="#contact"
            className="text-gray-300 transition hover:text-sky-400"
          >
            Contact
          </a>

          <a
            href="https://calendly.com/contact-slatelanedispatch/free-dispatch-consultation"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-sky-500 px-6 py-3 font-semibold text-white transition hover:bg-sky-400"
          >
            Schedule a Call
          </a>
        </div>
      </div>
    </nav>
  );
}