import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { TrustStrip } from "./components/TrustStrip";
import { HowItWorks } from "./components/HowItWorks";
import { Services } from "./components/Services";
import { WhyWashingBells } from "./components/WhyWashingBells";
import { Pricing } from "./components/Pricing";
import { Testimonials } from "./components/Testimonials";
import { Coverage } from "./components/Coverage";
import { FAQ } from "./components/FAQ";
import { FinalCTA } from "./components/FinalCTA";
import { Footer } from "./components/Footer";
import { WaveDivider } from "./components/WaveDivider";

export default function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-pill focus:bg-ink focus:px-5 focus:py-3 focus:font-600 focus:text-sand"
      >
        Skip to content
      </a>

      <Nav />

      <main id="main">
        <Hero />

        {/* trust bar lifts up to overlap the hero for layered depth */}
        <div className="relative z-20 -mt-2 sm:-mt-8">
          <TrustStrip />
        </div>

        <HowItWorks />
        <Services />
        <WhyWashingBells />
        <Pricing />

        {/* wave: sand -> forest, into the testimonials band */}
        <WaveDivider fill="#003D2B" className="bg-sand" />
        <Testimonials />
        {/* wave: forest -> sand, out of the testimonials band */}
        <WaveDivider fill="#F5F5F2" className="bg-ink" />

        <Coverage />
        <FAQ />
        <FinalCTA />
      </main>

      <Footer />
    </>
  );
}
