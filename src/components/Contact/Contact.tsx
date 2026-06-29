import ContactInfo from "./ContactInfo";
import ContactForm from "./ContactForm";

export default function Contact() {
  return (
    <section
      id="contact"
      className="bg-gradient-to-b from-black to-slate-950 py-28"
    >
      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-16">

          <span className="text-sky-400 uppercase tracking-widest text-sm font-semibold">
            Contact SlateLane
          </span>

          <h2 className="mt-4 text-5xl md:text-6xl font-black text-white">
            Let's Keep Your
            <span className="text-sky-400"> Truck Moving</span>
          </h2>

          <p className="mt-6 text-gray-400 max-w-2xl mx-auto text-lg">
            Ready to maximize your weekly revenue? Contact us today and
            let our dispatch experts find your next high-paying load.
          </p>

        </div>

        <div className="grid lg:grid-cols-2 gap-12">

          <ContactInfo />

          <ContactForm />

        </div>

      </div>
    </section>
  );
}