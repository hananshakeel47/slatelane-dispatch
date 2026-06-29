import Navbar from "@/components/Navbar";
import Hero from "@/components/hero/Hero";
import Services from "@/components/Services/Services";
import Contact from "@/components/Contact/Contact";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <Services />
      <Contact />
    </>
  );
}