import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { SectionHeading } from "./SectionHeading";
import { RevealGroup, RevealItem } from "./Reveal";

type Plan = {
  name: string;
  tagline: string;
  monthly: number; // ₹ / month; 0 = pay as you go
  unit?: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Doorstep",
    tagline: "No subscription. Pay only for what you wash.",
    monthly: 0,
    features: [
      "Wash & fold at ₹69 / kg",
      "Free pickup & delivery over ₹300",
      "Standard 24-hour turnaround",
      "Live order tracking",
      "All specialist services à la carte",
    ],
    cta: "Start an order",
  },
  {
    name: "Weekly Fresh",
    tagline: "The sweet spot for working professionals & couples.",
    monthly: 1499,
    features: [
      "Up to 6 kg wash & fold, every week",
      "Priority 24-hour turnaround",
      "2 dry-clean items each month",
      "Always-free pickup & delivery",
      "Live tracking + re-wash promise",
    ],
    cta: "Choose Weekly",
    featured: true,
  },
  {
    name: "Household",
    tagline: "Built for busy families and bigger homes.",
    monthly: 2999,
    features: [
      "Up to 14 kg wash & fold, every week",
      "Unlimited free pickups",
      "6 dry-clean items each month",
      "Monthly bedding & towel refresh",
      "Dedicated WhatsApp support line",
    ],
    cta: "Choose Household",
  },
];

const formatINR = (n: number) => n.toLocaleString("en-IN");

export function Pricing() {
  const reduce = useReducedMotion();
  const [annual, setAnnual] = useState(false); // false = monthly, true = quarterly (save 15%)

  const priceFor = (p: Plan) =>
    annual ? Math.round(p.monthly * 0.85) : p.monthly;

  return (
    <section id="pricing" className="section-pad relative">
      <div className="container-bells">
        <SectionHeading
          eyebrow="Pricing & plans"
          title={
            <>
              Simple plans. <span className="text-tide">No surprises.</span>
            </>
          }
          description="Start pay-as-you-go, or subscribe and save. Cancel or pause any time — no lock-in, ever."
        />

        {/* billing toggle */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <span
            className={`text-sm font-600 ${!annual ? "text-ink" : "text-ink/50"}`}
          >
            Monthly
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={annual}
            aria-label="Switch to quarterly billing and save 15%"
            onClick={() => setAnnual((v) => !v)}
            className="relative h-8 w-14 rounded-pill bg-ink/12 transition-colors duration-300 data-[on=true]:bg-tide"
            data-on={annual}
          >
            <motion.span
              animate={{ x: annual ? 24 : 0 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 500, damping: 32 }
              }
              className="absolute left-1 top-1 h-6 w-6 rounded-full bg-sand shadow-sm"
            />
          </button>
          <span
            className={`text-sm font-600 ${annual ? "text-ink" : "text-ink/50"}`}
          >
            Quarterly
          </span>
          <span className="rounded-pill bg-zest/20 px-2.5 py-1 text-xs font-700 text-ink">
            Save 15%
          </span>
        </div>

        <RevealGroup
          staggerChildren={0.1}
          className="mt-12 grid gap-6 lg:grid-cols-3 lg:items-center"
        >
          {PLANS.map((plan) => {
            const price = priceFor(plan);
            const featured = plan.featured;
            return (
              <RevealItem key={plan.name} className="h-full">
                <motion.article
                  whileHover={reduce ? undefined : { y: -6 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className={`relative flex h-full flex-col rounded-feature p-7 sm:p-8 ${
                    featured
                      ? "bg-ink text-sand shadow-ink ring-1 ring-zest/40 lg:scale-[1.04]"
                      : "bg-sand text-ink shadow-tide-sm ring-1 ring-ink/5"
                  }`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-pill bg-zest px-4 py-1.5 text-xs font-800 uppercase tracking-wider text-ink shadow-zest">
                      <Sparkles size={13} strokeWidth={2.5} /> Most popular
                    </span>
                  )}

                  <h3
                    className={`font-display text-2xl font-800 ${
                      featured ? "text-sand" : "text-ink"
                    }`}
                  >
                    {plan.name}
                  </h3>
                  <p
                    className={`mt-2 min-h-[2.75rem] text-sm leading-relaxed ${
                      featured ? "text-sand/70" : "text-ink/60"
                    }`}
                  >
                    {plan.tagline}
                  </p>

                  <div className="mt-5 flex items-end gap-1">
                    {plan.monthly === 0 ? (
                      <span className="font-display text-4xl font-800">₹0</span>
                    ) : (
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={price}
                          initial={reduce ? false : { y: 12, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={reduce ? undefined : { y: -12, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                          className="font-display text-4xl font-800"
                        >
                          ₹{formatINR(price)}
                        </motion.span>
                      </AnimatePresence>
                    )}
                    <span
                      className={`pb-1 text-sm ${
                        featured ? "text-sand/60" : "text-ink/55"
                      }`}
                    >
                      {plan.monthly === 0 ? "/ pay as you go" : "/ month"}
                    </span>
                  </div>

                  <ul className="mt-6 flex flex-1 flex-col gap-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-[15px]">
                        <span
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                            featured ? "bg-zest text-ink" : "bg-tide/12 text-tide"
                          }`}
                        >
                          <Check size={13} strokeWidth={3} />
                        </span>
                        <span
                          className={featured ? "text-sand/85" : "text-ink/75"}
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href="#book"
                    className={`mt-8 inline-flex items-center justify-center rounded-pill px-6 py-3.5 font-700 transition-[transform,box-shadow] duration-300 ease-brand hover:-translate-y-0.5 ${
                      featured
                        ? "bg-zest text-ink shadow-zest hover:shadow-[0_22px_44px_-12px_rgba(191,161,74,0.6)]"
                        : "bg-ink text-sand hover:shadow-lift"
                    }`}
                  >
                    {plan.cta}
                  </a>
                </motion.article>
              </RevealItem>
            );
          })}
        </RevealGroup>

        <p className="mt-8 text-center text-sm text-ink/55">
          Prices include GST. Bulky and specialist items priced per piece — full
          rate card shared before every order.
        </p>
      </div>
    </section>
  );
}
