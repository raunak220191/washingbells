import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { fadeUp, fadeUpSm, inView, stagger } from "../lib/motion";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** smaller travel for tight/inline reveals */
  small?: boolean;
  delay?: number;
  as?: "div" | "section" | "li" | "article" | "header";
};

/**
 * Scroll-reveal wrapper: fade + rise on enter, once.
 * Honours prefers-reduced-motion by rendering content statically.
 */
export function Reveal({ children, className, small, delay = 0, as = "div" }: RevealProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];

  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  const variants = small ? fadeUpSm : fadeUp;

  return (
    <MotionTag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={inView}
      transition={{ delay }}
    >
      {children}
    </MotionTag>
  );
}

type RevealGroupProps = {
  children: ReactNode;
  className?: string;
  staggerChildren?: number;
  delayChildren?: number;
  as?: "div" | "ul" | "section";
};

/**
 * Staggered container — pair with <RevealItem> children.
 * Honours prefers-reduced-motion.
 */
export function RevealGroup({
  children,
  className,
  staggerChildren = 0.08,
  delayChildren = 0,
  as = "div",
}: RevealGroupProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];

  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      variants={stagger(staggerChildren, delayChildren)}
      initial="hidden"
      whileInView="show"
      viewport={inView}
    >
      {children}
    </MotionTag>
  );
}

type RevealItemProps = {
  children: ReactNode;
  className?: string;
  small?: boolean;
  as?: "div" | "li" | "article";
};

/** Child of <RevealGroup>; inherits the stagger timing. */
export function RevealItem({ children, className, small, as = "div" }: RevealItemProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];

  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag className={className} variants={small ? fadeUpSm : fadeUp}>
      {children}
    </MotionTag>
  );
}
