"use client";

import { useState } from "react";
import ContactInput from "./ContactInput";

export default function ContactForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);

  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);

    setStatus("idle");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) throw new Error();

      setStatus("success");

      setForm({
        name: "",
        email: "",
        phone: "",
        message: "",
      });

    } catch {

      setStatus("error");

    }

    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-white/10 bg-zinc-900/70 p-8 backdrop-blur"
    >
      <ContactInput
        label="Full Name"
        name="name"
        value={form.name}
        onChange={handleChange}
        placeholder="John Smith"
      />

      <ContactInput
        label="Email"
        name="email"
        type="email"
        value={form.email}
        onChange={handleChange}
        placeholder="john@email.com"
      />

      <ContactInput
        label="Phone"
        name="phone"
        type="tel"
        value={form.phone}
        onChange={handleChange}
        placeholder="+1 (555) 123-4567"
      />

      <ContactInput
        label="Message"
        name="message"
        textarea
        value={form.message}
        onChange={handleChange}
        placeholder="Tell us about your trucking business..."
      />

      {status === "success" && (
        <div className="space-y-4 rounded-xl border border-green-500 bg-green-500/10 p-5">

          <p className="text-green-400 font-medium">
            ✅ Thank you! Your request has been sent successfully.
          </p>

          <a
            href="https://calendly.com/contact-slatelanedispatch/free-dispatch-consultation"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-xl bg-sky-500 py-3 text-center font-semibold text-white transition hover:bg-sky-400"
          >
            Schedule Your Free Consultation
          </a>

        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl border border-red-500 bg-red-500/10 p-4 text-red-400">
          Something went wrong. Please try again.
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-sky-500 py-4 font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Sending..." : "Book Free Consultation"}
      </button>
    </form>
  );
}