"use client";

interface ContactInputProps {
  label: string;
  type?: string;
  placeholder?: string;
  textarea?: boolean;
}

export default function ContactInput({
  label,
  type = "text",
  placeholder,
  textarea = false,
}: ContactInputProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-300">
        {label}
      </label>

      {textarea ? (
        <textarea
          rows={5}
          placeholder={placeholder}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-gray-500 outline-none transition focus:border-sky-500"
        />
      ) : (
        <input
          type={type}
          placeholder={placeholder}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-gray-500 outline-none transition focus:border-sky-500"
        />
      )}
    </div>
  );
}