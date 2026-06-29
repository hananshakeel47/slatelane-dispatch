export default function ContactInfo() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-10">

      <h3 className="text-3xl font-bold text-white mb-10">
        Contact Information
      </h3>

      <div className="space-y-8">

        {/* Phone */}
        <div className="flex items-start gap-5">

          <div className="w-14 h-14 rounded-xl bg-sky-500/20 flex items-center justify-center text-2xl">
            📞
          </div>

          <div>

            <h4 className="text-white font-semibold">
              Call Us
            </h4>

            <p className="text-gray-400 mt-1">
              Quick Response
            </p>

            <a
              href="tel:+17734922051"
              className="text-sky-400 hover:text-sky-300 transition"
            >
              +1 (773) 492-2051
            </a>

          </div>

        </div>

        {/* Email */}
        <div className="flex items-start gap-5">

          <div className="w-14 h-14 rounded-xl bg-sky-500/20 flex items-center justify-center text-2xl">
            ✉️
          </div>

          <div>

            <h4 className="text-white font-semibold">
              Email
            </h4>

            <p className="text-gray-400 mt-1">
              Send us anytime
            </p>

            <a
              href="mailto:contact@slatelanedispatch.com"
              className="text-sky-400 hover:text-sky-300 transition"
            >
              contact@slatelanedispatch.com
            </a>

          </div>

        </div>

        {/* Service Area */}
        <div className="flex items-start gap-5">

          <div className="w-14 h-14 rounded-xl bg-sky-500/20 flex items-center justify-center text-2xl">
            🚛
          </div>

          <div>

            <h4 className="text-white font-semibold">
              Service Area
            </h4>

            <p className="text-gray-400 mt-1">
              Nationwide USA
            </p>

          </div>

        </div>

        {/* Business Hours */}
        <div className="flex items-start gap-5">

          <div className="w-14 h-14 rounded-xl bg-sky-500/20 flex items-center justify-center text-2xl">
            🕒
          </div>

          <div>

            <h4 className="text-white font-semibold">
              Business Hours
            </h4>

            <p className="text-gray-400 mt-1">
              Monday – Saturday
            </p>

            <p className="text-sky-400">
              8:00 AM – 8:00 PM CST
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}