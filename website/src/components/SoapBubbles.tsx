import { motion, useReducedMotion } from "framer-motion";

type Bubble = {
  size: number;
  left: string;
  delay: number;
  duration: number;
  drift: number;
  opacity: number;
};

// Hand-tuned, deterministic bubble field — keeps layout stable, no random reflow.
const BUBBLES: Bubble[] = [
  { size: 120, left: "6%", delay: 0, duration: 13, drift: 18, opacity: 0.5 },
  { size: 54, left: "18%", delay: 1.6, duration: 9, drift: -14, opacity: 0.65 },
  { size: 200, left: "30%", delay: 0.8, duration: 16, drift: 22, opacity: 0.32 },
  { size: 38, left: "44%", delay: 2.4, duration: 8, drift: 12, opacity: 0.7 },
  { size: 92, left: "57%", delay: 0.4, duration: 12, drift: -20, opacity: 0.5 },
  { size: 150, left: "70%", delay: 1.2, duration: 15, drift: 16, opacity: 0.38 },
  { size: 46, left: "82%", delay: 3, duration: 9.5, drift: -10, opacity: 0.7 },
  { size: 110, left: "90%", delay: 0.6, duration: 14, drift: 14, opacity: 0.45 },
  { size: 28, left: "12%", delay: 2.1, duration: 7, drift: 10, opacity: 0.8 },
  { size: 64, left: "50%", delay: 1.9, duration: 11, drift: -16, opacity: 0.55 },
];

/**
 * Drifting soap bubbles for the hero. Decorative only (aria-hidden).
 * Fully disabled under prefers-reduced-motion.
 */
export function SoapBubbles() {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {BUBBLES.map((b, i) => (
        <motion.span
          key={i}
          className="absolute bottom-[-12%] rounded-full"
          style={{
            left: b.left,
            width: b.size,
            height: b.size,
            background:
              "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95), rgba(255,255,255,0.25) 42%, rgba(125,211,216,0.12) 70%, transparent 78%)",
            boxShadow: "inset 0 0 18px rgba(255,255,255,0.45)",
            border: "1px solid rgba(255,255,255,0.35)",
          }}
          initial={{ y: 0, x: 0, opacity: 0 }}
          animate={{
            y: ["6vh", "-118vh"],
            x: [0, b.drift, 0],
            opacity: [0, b.opacity, b.opacity, 0],
          }}
          transition={{
            duration: b.duration,
            delay: b.delay,
            repeat: Infinity,
            ease: "easeInOut",
            times: [0, 0.15, 0.85, 1],
          }}
        />
      ))}
    </div>
  );
}
