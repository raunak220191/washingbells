import type { Variants, Transition } from "framer-motion";

/** Confident, controlled easing used across the site. */
export const EASE_BRAND: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const transition = (
  duration = 0.6,
  delay = 0,
): Transition => ({
  duration,
  delay,
  ease: EASE_BRAND,
});

/** Fade + rise — the workhorse scroll-reveal. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: transition(0.6),
  },
};

/** A softer, smaller rise for fine-grained children. */
export const fadeUpSm: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: transition(0.5) },
};

/** Parent that staggers its children into view. */
export const stagger = (staggerChildren = 0.08, delayChildren = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren, delayChildren },
  },
});

/** Words rising up for the hero headline. */
export const wordRise: Variants = {
  hidden: { opacity: 0, y: "0.5em" },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE_BRAND },
  },
};

/** Shared viewport config so every section reveals once, a touch before fully in view. */
export const inView = { once: true, amount: 0.25, margin: "0px 0px -10% 0px" } as const;
