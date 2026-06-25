import { motion, useReducedMotion } from "framer-motion";

type LogoProps = {
  className?: string;
  /** light text for use on dark surfaces */
  inverted?: boolean;
};

/** Washing Bells wordmark with the bell-mascot tile that gives a gentle tilt on hover. */
export function Logo({ className = "", inverted = false }: LogoProps) {
  const reduce = useReducedMotion();

  return (
    <a
      href="#top"
      aria-label="Washing Bells — home"
      className={`group inline-flex items-center gap-2.5 ${className}`}
    >
      <motion.img
        src="/logos/V_app_tile.png"
        alt=""
        width={44}
        height={44}
        className="h-10 w-10 rounded-[13px] shadow-tide-sm"
        whileHover={reduce ? undefined : { rotate: -6, scale: 1.05 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      />
      <span className="font-display text-xl font-800 tracking-tight">
        <span className={inverted ? "text-sand" : "text-tide"}>Washing</span>
        <span className="text-gold"> Bells</span>
      </span>
    </a>
  );
}
