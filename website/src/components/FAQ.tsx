import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { SectionHeading } from "./SectionHeading";
import { Reveal } from "./Reveal";

const FAQS = [
  {
    q: "How fast is the turnaround?",
    a: "Standard wash & fold and ironing come back within 24 hours. Order before noon and you can pick same-day return at checkout. Dry cleaning and specialist items typically take 48 hours — you'll always see the exact ETA before you confirm.",
  },
  {
    q: "How does pickup and delivery work?",
    a: "Choose a 60-minute slot and a Washing Bells rider collects your clothes from your door in clean, reusable packaging. You'll get a live track-and-trace link, and we return everything to the same spot — neatly folded or pressed.",
  },
  {
    q: "Is there a minimum order?",
    a: "Pay-as-you-go orders start at just ₹300, and pickup & delivery are free above that. Subscription plans include a generous weekly weight allowance with no per-order minimum at all.",
  },
  {
    q: "What detergents do you use? I have sensitive skin.",
    a: "We use plant-based, hypoallergenic, fragrance-light detergents by default, with cold-water cycles that are gentle on fabric and skin. Just flag any allergies in the app and we'll note them on every future order.",
  },
  {
    q: "What if I'm not happy with the result?",
    a: "That's what our re-wash promise is for. If anything comes back less than fresh, we'll collect and re-clean it free, same day where possible. If we still miss the mark, that item is on us.",
  },
  {
    q: "Can I pause or cancel my plan?",
    a: "Any time, from the app — no notice period, no cancellation fee. Travelling for a month? Pause your plan and your weekly allowance simply waits for you.",
  },
];

function FaqRow({
  q,
  a,
  open,
  onToggle,
  id,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
  id: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      className={`overflow-hidden rounded-feature ring-1 transition-colors duration-300 ${
        open ? "bg-sand ring-tide/30 shadow-tide-sm" : "bg-sand ring-ink/5"
      }`}
    >
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-button`}
          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
        >
          <span className="text-lg font-700 text-ink">{q}</span>
          <motion.span
            animate={reduce ? undefined : { rotate: open ? 135 : 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors duration-300 ${
              open ? "bg-tide text-white" : "bg-foam text-tide"
            }`}
          >
            <Plus size={18} strokeWidth={2.5} />
          </motion.span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${id}-panel`}
            role="region"
            aria-labelledby={`${id}-button`}
            initial={reduce ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-6 text-[15px] leading-relaxed text-ink/65">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="section-pad bg-foam">
      <div className="container-bells">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions, answered"
          description="Everything you might want to know before your first pickup. Still curious? We're a message away."
        />

        <Reveal className="mx-auto mt-12 flex max-w-3xl flex-col gap-3">
          {FAQS.map((f, i) => (
            <FaqRow
              key={f.q}
              id={`faq-${i}`}
              q={f.q}
              a={f.a}
              open={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
