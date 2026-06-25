import { motion, useReducedMotion } from "framer-motion";
import { CalendarCheck, PackageCheck, Sparkles, Truck } from "lucide-react";
import { SectionHeading } from "./SectionHeading";
import { RevealGroup, RevealItem } from "./Reveal";

const STEPS = [
  {
    icon: CalendarCheck,
    step: "01",
    title: "Schedule a pickup",
    body: "Pick a 60-minute slot in the app or online. Same-day slots open until 7 PM, seven days a week.",
  },
  {
    icon: Truck,
    step: "02",
    title: "We collect at your door",
    body: "A Washing Bells rider arrives in branded, contactless packaging. No counting, no forms — just hand it over.",
  },
  {
    icon: Sparkles,
    step: "03",
    title: "We wash & care",
    body: "Sorted by fabric, washed with gentle eco detergents, pressed and quality-checked by hand at our facility.",
  },
  {
    icon: PackageCheck,
    step: "04",
    title: "Folded, back to you",
    body: "Neatly folded and delivered within 24 hours — tracked live, the moment it leaves our door.",
  },
];

export function HowItWorks() {
  const reduce = useReducedMotion();
  return (
    <section id="how-it-works" className="section-pad relative">
      <div className="container-bells">
        <SectionHeading
          eyebrow="How it works"
          title={
            <>
              Four steps. <span className="text-tide">Zero</span> chore days.
            </>
          }
          description="From overflowing hamper to fresh-folded stack without lifting a finger. Here's the whole journey."
        />

        <div className="relative mt-16">
          {/* connecting dashed line on desktop */}
          <div
            aria-hidden="true"
            className="absolute left-0 right-0 top-[34px] hidden lg:block"
          >
            <svg
              className="h-2 w-full"
              viewBox="0 0 1200 8"
              preserveAspectRatio="none"
              fill="none"
            >
              <motion.path
                d="M40 4 H1160"
                stroke="#006241"
                strokeWidth="2.5"
                strokeDasharray="2 10"
                strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
          </div>

          <RevealGroup
            staggerChildren={0.12}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {STEPS.map(({ icon: Icon, step, title, body }) => (
              <RevealItem key={step}>
                <motion.div
                  whileHover={reduce ? undefined : { y: -8 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="group relative h-full rounded-feature bg-sand p-6 shadow-tide-sm ring-1 ring-ink/5"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid h-[68px] w-[68px] place-items-center rounded-2xl bg-tide text-white shadow-tide transition-transform duration-300 ease-brand group-hover:scale-105">
                      <Icon size={28} strokeWidth={2} />
                    </span>
                    <span className="font-display text-4xl font-800 text-ink/8 transition-colors duration-300 group-hover:text-zest/60">
                      {step}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-700 text-ink">{title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink/65">
                    {body}
                  </p>
                </motion.div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}
