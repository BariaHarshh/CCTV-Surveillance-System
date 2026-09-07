import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { TrustBar } from "@/components/landing/TrustBar";
import { PlatformConcept } from "@/components/landing/PlatformConcept";
import { CoreIntelligence } from "@/components/landing/CoreIntelligence";
import { RiskEngine } from "@/components/landing/RiskEngine";
import { DashboardPreview } from "@/components/landing/DashboardPreview";
import { SecuritySection } from "@/components/landing/SecuritySection";
import { FutureIntelligence } from "@/components/landing/FutureIntelligence";
import { InterestForm } from "@/components/landing/InterestForm";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <TrustBar />
        <PlatformConcept />
        <CoreIntelligence />
        <RiskEngine />
        <DashboardPreview />
        <SecuritySection />
        <FutureIntelligence />
        <InterestForm />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
