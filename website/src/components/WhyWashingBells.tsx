import { motion, useReducedMotion } from "framer-motion";
import {
  BadgeCheck,
  Leaf,
  Radar,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Reveal, RevealGroup, RevealItem } from "./Reveal";

const REASONS = [
  {
    icon: Leaf,
    title: "Genuinely eco-friendly",
    body: "Plant-based, hypoallergenic detergents and cold-water cycles that are kinder to your skin, your clothes and the planet.",
  },
  {
    icon: Zap,
    title: "Same-day when you need it",
    body: "Order before noon and choose same-day return. Standard turnaround is a dependable 24 hours, every time.",
  },
  {
    icon: Radar,
    title: "Live order tracking",
    body: "Watch your order move from pickup to wash to doorstep, with honest ETAs and a ping at every step.",
  },
  {
    icon: ShieldCheck,
    title: "Fabric-first, hand-checked",
    body: "Every load is sorted, treated and quality-inspected by people — not just machines — so colours stay true and fabrics last.",
  },
  {
    icon: BadgeCheck,
    title: "The re-wash promise",
    body: "Not fresh enough? We'll re-clean it free, no questions asked. If we still miss, it's on the house.",
  },
];

export function WhyWashingBells() {
  const reduce = useReducedMotion();
  return (
    <section id="why" className="section-pad bg-foam">
      <div className="container-bells grid items-start gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        {/* Left — heading + guarantee seal */}
        <div className="lg:sticky lg:top-28">
          <Reveal>
            <span className="eyebrow">Why Washing Bells</span>
            <h2 className="mt-4 text-3xl font-800 leading-[1.05] text-ink sm:text-4xl lg:text-[2.75rem]">
              The boring parts done{" "}
              <span className="text-tide">brilliantly</span>.
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-ink/65">
              Anyone can wash clothes. We obsess over the details that make wash
              day feel effortless — and trustworthy.
            </p>
          </Reveal>

          <Reveal delay={0.15} className="mt-8">
            <div className="relative flex items-center gap-5 overflow-hidden rounded-feature bg-pool p-6 text-white shadow-ink">
              <div
                aria-hidden="true"
                className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl"
              />
              <motion.span
                aria-hidden="true"
                animate={reduce ? undefined : { rotate: 360 }}
                transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
                className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-zest text-ink shadow-zest"
              >
                <BadgeCheck size={30} strokeWidth={2.25} />
              </motion.span>
              <div>
                <p className="font-display text-xl font-800">
                  Freshness, guaranteed
                </p>
                <p className="mt-1 text-sm text-white/75">
                  98% of orders rated 5 stars — or we re-wash on us.
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Right — differentiators */}
        <RevealGroup staggerChildren={0.09} className="flex flex-col gap-3">
          {REASONS.map(({ icon: Icon, title, body }) => (
            <RevealItem key={title}>
              <motion.div
                whileHover={reduce ? undefined : { x: 6 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="group flex items-start gap-5 rounded-feature bg-sand p-5 shadow-tide-sm ring-1 ring-ink/5 sm:p-6"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-tide/10 text-tide transition-colors duration-300 group-hover:bg-tide group-hover:text-white">
                  <Icon size={24} strokeWidth={2} />
                </span>
                <div>
                  <h3 className="text-lg font-700 text-ink">{title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink/65">
                    {body}
                  </p>
                </div>
              </motion.div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
