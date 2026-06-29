"use client";

import HeroContent from "./HeroContent";
import HeroCard from "./HeroCard";

export default function Hero() {
  return (
    <section className="relative min-h-screen bg-black overflow-hidden">

      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-900/20 via-black to-blue-900/10"></div>

      <div className="relative container mx-auto px-6 lg:px-20 py-24">

        <div className="grid lg:grid-cols-2 gap-16 items-center">

          <HeroContent />

          <HeroCard />

        </div>

      </div>

    </section>
  );
}