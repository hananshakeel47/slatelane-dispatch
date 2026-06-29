"use client";

import HeroButtons from "./HeroButtons";
import HeroStats from "./HeroStats";

export default function HeroContent() {
  return (
    <div className="text-center lg:text-left">

      {/* Badge */}
      <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-300 mb-8">

        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>

        Accepting New Owner Operators

      </div>

      {/* Heading */}

      <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-tight">

        Keep Your Wheels Moving.

        <br />

        <span className="bg-gradient-to-r from-sky-400 to-blue-600 bg-clip-text text-transparent">

          We Handle The Rest.

        </span>

      </h1>

      {/* Description */}

      <p className="mt-8 text-gray-400 text-lg leading-8 max-w-xl">

        SlateLane Dispatch helps owner operators and small fleets maximize revenue through professional dispatching, broker negotiation, route planning and dedicated back-office support.

      </p>

      <HeroButtons />

      <HeroStats />

    </div>
  );
}