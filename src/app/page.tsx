import Script from "next/script";

import Navbar from "@/components/Navbar";
import Hero from "@/components/hero/Hero";
import Services from "@/components/Services/Services";
import Contact from "@/components/Contact/Contact";

export default function Home() {
  return (
    <>
      <Script
        id="schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfessionalService",
            name: "SlateLane Dispatch",
            url: "https://slatelanedispatch.com",
            email: "contact@slatelanedispatch.com",
            telephone: "+17734922051",
            areaServed: "United States",
            serviceType: "Truck Dispatch Services",
            description:
              "Professional truck dispatch services helping owner-operators and small fleets maximize profits with high-paying freight across the USA.",
          }),
        }}
      />

      <Navbar />
      <Hero />
      <Services />
      <Contact />
    </>
  );
}