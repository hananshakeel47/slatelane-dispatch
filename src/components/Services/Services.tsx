import ServiceCard from "./ServiceCard";

export default function Services() {
  const services = [
    {
      icon: "🚛",
      title: "Dispatch Services",
      description:
        "We find the highest-paying freight so you stay loaded and profitable.",
    },
    {
      icon: "🤝",
      title: "Broker Negotiation",
      description:
        "Our experienced dispatchers negotiate the best rates on every load.",
    },
    {
      icon: "🗺️",
      title: "Route Planning",
      description:
        "Efficient route planning saves fuel, time, and keeps your wheels moving.",
    },
    {
      icon: "📄",
      title: "Paperwork Management",
      description:
        "Rate confirmations, invoices, and documents handled professionally.",
    },
    {
      icon: "📞",
      title: "24/7 Driver Support",
      description:
        "We're available around the clock whenever you need assistance.",
    },
    {
      icon: "💰",
      title: "Maximum Profit",
      description:
        "Our goal is to maximize your weekly revenue while reducing downtime.",
    },
  ];

  return (
    <section className="bg-black py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-white">
            Our Services
          </h2>

          <p className="text-gray-400 mt-5 max-w-2xl mx-auto">
            Everything you need to keep your truck moving and your
            business growing.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service) => (
            <ServiceCard
              key={service.title}
              icon={service.icon}
              title={service.title}
              description={service.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
}