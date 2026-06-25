import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Phone } from "lucide-react";
import { Reveal } from "./Reveal";
import { AppBadges } from "./AppBadges";

export function FinalCTA() {
  const reduce = useReducedMotion();
  return (
    <section id="book" className="relative px-5 py-12 sm:px-8 lg:py-20">
      <Reveal className="mx-auto max-w-content">
        <div className="relative overflow-hidden rounded-[32px] bg-pool px-6 py-16 text-center shadow-ink sm:px-12 sm:py-20">
          {/* glow + bubbles */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(70% 60% at 80% 0%, rgba(191,161,74,0.26), transparent 55%)",
            }}
          />
          {!reduce &&
            [
              { s: 90, l: "8%", t: "20%", d: 0 },
              { s: 50, l: "20%", t: "62%", d: 1.4 },
              { s: 130, l: "82%", t: "30%", d: 0.6 },
              { s: 40, l: "70%", t: "70%", d: 2 },
            ].map((b, i) => (
              <motion.span
                key={i}
                aria-hidden="true"
                className="absolute rounded-full bg-white/10 ring-1 ring-white/15"
                style={{ width: b.s, height: b.s, left: b.l, top: b.t }}
                animate={{ y: [0, -16, 0], opacity: [0.5, 0.85, 0.5] }}
                transition={{
                  duration: 6 + i,
                  delay: b.d,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}

          <div className="relative mx-auto max-w-2xl">
            <span className="eyebrow bg-white/12 text-aqua">
              Your first pickup is on the house*
            </span>
            <h2 className="mt-5 font-display text-4xl font-800 leading-[1.02] text-white sm:text-5xl lg:text-6xl">
              Hand over the hamper.
              <br />
              <span className="text-zest">Get your time back.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-white/80">
              Schedule your first Washing Bells pickup in under a minute. Fresh,
              folded clothes — back at your door by tomorrow.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="#top"
                className="btn-primary !px-8 !py-4 !text-lg"
              >
                Book a pickup now
                <ArrowRight size={20} strokeWidth={2.5} />
              </a>
              <a
                href="tel:+919501121012"
                className="inline-flex items-center justify-center gap-2 rounded-pill border border-white/25 bg-white/10 px-8 py-4 text-lg font-600 text-white backdrop-blur transition-[transform,background-color] duration-300 ease-brand hover:-translate-y-0.5 hover:bg-white/20"
              >
                <Phone size={18} strokeWidth={2.25} />
                +91&nbsp;95011&nbsp;21012
              </a>
            </div>

            <div className="mt-8 flex flex-col items-center gap-3">
              <p className="text-sm font-600 text-white/70">
                Or grab the app — coming soon
              </p>
              <AppBadges variant="light" className="justify-center" />
            </div>

            <p className="mt-6 text-sm text-white/60">
              *New customers, capped at ₹150. No card needed to start.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
