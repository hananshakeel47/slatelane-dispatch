interface ContactInputProps {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  textarea?: boolean;
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
}

export default function ContactInput({
  label,
  name,
  type = "text",
  placeholder,
  textarea = false,
  value,
  onChange,
}: ContactInputProps) {
  return (
    <div>
      <label className="mb-2 block text-sm text-gray-300">
        {label}
      </label>

      {textarea ? (
        <textarea
          rows={5}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-gray-500 outline-none transition focus:border-sky-500"
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-gray-500 outline-none transition focus:border-sky-500"
        />
      )}
    </div>
  );
}