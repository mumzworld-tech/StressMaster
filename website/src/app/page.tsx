import { Navbar } from "@/components/sections/navbar";
import { Hero } from "@/components/sections/hero";
import { Features } from "@/components/sections/features";
import { Architecture } from "@/components/sections/architecture";
import { CliDemo } from "@/components/sections/cli-demo";
import { Metrics } from "@/components/sections/metrics";
import { Providers } from "@/components/sections/providers";
import { Installation } from "@/components/sections/installation";
import { CTA } from "@/components/sections/cta";
import { Footer } from "@/components/sections/footer";
import { NoiseOverlay } from "@/components/effects/noise-overlay";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-[#030303] overflow-x-hidden">
      <NoiseOverlay />
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Architecture />
        <CliDemo />
        <Metrics />
        <Providers />
        <Installation />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
