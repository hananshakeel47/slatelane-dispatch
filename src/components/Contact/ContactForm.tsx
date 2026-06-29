"use client";

import ContactInput from "./ContactInput";

export default function ContactForm() {
  return (
    <form className="space-y-6 rounded-2xl border border-white/10 bg-zinc-900/70 p-8 backdrop-blur">
      <ContactInput
        label="Full Name"
        type="text"
        placeholder="John Smith"
      />

      <ContactInput
        label="Email"
        type="email"
        placeholder="john@email.com"
      />

      <ContactInput
        label="Phone"
        type="tel"
        placeholder="+1 (555) 123-4567"
      />

      <ContactInput
        label="Message"
        textarea
        placeholder="Tell us about your trucking business..."
      />

      <button
        type="submit"
        className="w-full rounded-xl bg-sky-500 py-4 font-semibold text-white transition hover:bg-sky-400"
      >
        Book Free Consultation
      </button>
    </form>
  );
}