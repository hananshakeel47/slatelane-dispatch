type Props = {
  title: string;
  description: string;
  icon: string;
};

export default function ServiceCard({
  title,
  description,
  icon,
}: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 hover:border-sky-500 hover:-translate-y-2 transition-all duration-300">
      <div className="text-5xl mb-5">{icon}</div>

      <h3 className="text-2xl font-bold text-white mb-3">
        {title}
      </h3>

      <p className="text-gray-400 leading-7">
        {description}
      </p>
    </div>
  );
}