"use client";

import BackgroundFX from "@/components/landing/BackgroundFX";
import FAQSection from "@/components/landing/FAQSection";

import FeaturesSection from "@/components/landing/FeaturesSection";
import Footer from "@/components/landing/Footer";
import Hero from "@/components/landing/Hero";
import RoadmapSection from "@/components/landing/RoadmapSection";
import TokenomicsSection from "@/components/landing/TokenomicsSection";

export default function HomePage() {
  return (
    <main className="flex min-h-screen overflow-hidden bg-transparent text-white">
      <div>
      <BackgroundFX />
      <Hero />
      <FeaturesSection />
      <RoadmapSection />
      <TokenomicsSection />
      <FAQSection />
      <Footer />
      </div>
    </main>
  );
}
