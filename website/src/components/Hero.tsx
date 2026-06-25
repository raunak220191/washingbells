import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { ArrowRight, PlayCircle, Shirt, Sparkles, Star, Truck } from "lucide-react";
import { SoapBubbles } from "./SoapBubbles";
import { EASE_BRAND, wordRise } from "../lib/motion";

const HEADLINE_LINE_1 = ["Fresh", "clothes,"];
const HEADLINE_LINE_2 = ["delivered", "to", "your", "door."];

const AVATARS = [
  { c: "#006241", i: "S" },
  { c: "#BFA14A", i: "R" },
  { c: "#A8C86B", i: "M" },
  { c: "#003D2B", i: "H" },
];

export function Hero() {
  const reduce = useReducedMotion();
  // light parallax driven by window scroll — different layers drift at different rates
  const { scrollY } = useScroll();
  const yPanel = useTransform(scrollY, [0, 700], [0, reduce ? 0 : 70]);
  const yCardA = useTransform(scrollY, [0, 700], [0, reduce ? 0 : -50]);
  const yCardB = useTransform(scrollY, [0, 700], [0, reduce ? 0 : 120]);

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
  };

  return (
    <section
      id="top"
      className="relative overflow-hidden pt-32 sm:pt-36 lg:pt-44"
    >
      {/* soft sage + gold wash behind everything */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(80% 60% at 78% 8%, rgba(191,161,74,0.16), transparent 55%), radial-gradient(70% 70% at 8% 0%, rgba(168,200,107,0.22), transparent 60%)",
        }}
      />
      <SoapBubbles />

      <div className="container-bells grid items-center gap-12 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pb-28">
        {/* ---------------- Copy ---------------- */}
        <div className="relative z-10 max-w-xl">
          <motion.span
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_BRAND }}
            className="eyebrow"
          >
            <Sparkles size={14} strokeWidth={2.5} />
            Now serving Zirakpur &amp; Tricity
          </motion.span>

          <motion.h1
            variants={container}
            initial="hidden"
            animate="show"
            className="mt-5 font-display text-[2.75rem] font-800 leading-[0.98] text-ink sm:text-6xl lg:text-[4.25rem]"
          >
            <span className="block overflow-hidden">
              {HEADLINE_LINE_1.map((w, i) => (
                <span key={i} className="mr-[0.25em] inline-block overflow-hidden">
                  <motion.span variants={wordRise} className="inline-block">
                    {w}
                  </motion.span>
                </span>
              ))}
            </span>
            <span className="block overflow-hidden">
              {HEADLINE_LINE_2.map((w, i) => (
                <span key={i} className="mr-[0.25em] inline-block overflow-hidden">
                  <motion.span
                    variants={wordRise}
                    className={`relative inline-block ${i === 0 ? "text-tide" : ""}`}
                  >
                    {w}
                    {i === 0 && (
                      <motion.svg
                        aria-hidden="true"
                        viewBox="0 0 220 18"
                        className="absolute -bottom-2 left-0 h-3 w-full"
                        initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 0.7, delay: 0.9, ease: EASE_BRAND }}
                      >
                        <motion.path
                          d="M4 11C52 4 150 2 216 9"
                          fill="none"
                          stroke="#BFA14A"
                          strokeWidth="5"
                          strokeLinecap="round"
                        />
                      </motion.svg>
                    )}
                  </motion.span>
                </span>
              ))}
            </span>
          </motion.h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55, ease: EASE_BRAND }}
            className="mt-6 max-w-md text-lg leading-relaxed text-ink/70"
          >
            Free doorstep pickup, an eco-friendly wash, and a perfectly folded
            return in <span className="font-700 text-ink">24 hours</span>. Schedule
            in under a minute — we'll take it from there.
          </motion.p>

          <motion.a
            href="#pricing"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65, ease: EASE_BRAND }}
            className="mt-6 inline-flex items-center gap-2 rounded-pill bg-sun-text px-4 py-2 text-sm font-800 text-ink shadow-zest transition-transform duration-300 ease-brand hover:-translate-y-0.5"
          >
            <Shirt size={16} strokeWidth={2.5} />
            Get your daily clothes pressed at just ₹8
          </motion.a>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.78, ease: EASE_BRAND }}
            className="mt-7 flex flex-wrap items-center gap-3"
          >
            <a href="#book" className="btn-primary">
              Book a pickup
              <ArrowRight size={18} strokeWidth={2.5} />
            </a>
            <a href="#how-it-works" className="btn-ghost">
              <PlayCircle size={18} strokeWidth={2.25} />
              See how it works
            </a>
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.95 }}
            className="mt-7 flex items-center gap-4 text-sm text-ink/70"
          >
            <div className="flex -space-x-2.5">
              {AVATARS.map((a, i) => (
                <span
                  key={i}
                  className="grid h-8 w-8 place-items-center rounded-full font-display text-xs font-700 text-white ring-2 ring-sand"
                  style={{ background: a.c }}
                >
                  {a.i}
                </span>
              ))}
            </div>
            <p>
              <span className="inline-flex items-center gap-1 font-700 text-ink">
                <Star size={14} className="fill-zest text-zest" /> 4.9
              </span>{" "}
              from 12,000+ happy customers
            </p>
          </motion.div>
        </div>

        {/* ---------------- Visual ---------------- */}
        <div className="relative">
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: EASE_BRAND }}
            style={{
              y: yPanel,
              background:
                "radial-gradient(120% 92% at 50% 28%, #F5F5F2 0%, #CFE3D8 100%)",
            }}
            className="relative mx-auto aspect-[4/4.4] w-full max-w-[420px] overflow-hidden rounded-[32px] shadow-ink ring-2 ring-gold/50"
          >
            {/* emerald emblem halo so the mascot reads as the centrepiece */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-[44%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(0,98,65,0.16), transparent 68%)",
              }}
            />

            {/* the brand mascot (centred via grid so the float animation's
                transform doesn't fight a translate-based centre) */}
            <div className="absolute inset-0 grid place-items-center pb-6">
              <motion.img
                src="/logos/V_icon_only.png"
                alt="The Washing Bells mascot holding a freshly folded stack of clothes"
                className="w-[82%]"
                animate={reduce ? undefined : { y: [0, -14, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            <p className="absolute inset-x-0 bottom-5 text-center font-display text-sm font-700 uppercase tracking-[0.2em] text-tide/80">
              Fresh · Folded · Delivered
            </p>
          </motion.div>

          {/* floating card: pickup confirmed */}
          <motion.div
            style={{ y: yCardA }}
            initial={reduce ? false : { opacity: 0, x: -20, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease: EASE_BRAND }}
            className="absolute -left-2 top-10 flex items-center gap-3 rounded-2xl bg-paper/95 p-3 pr-4 shadow-lift ring-1 ring-ink/10 backdrop-blur sm:-left-6"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-tide/12 text-tide">
              <Truck size={20} strokeWidth={2.25} />
            </span>
            <div>
              <p className="text-sm font-700 text-ink">Pickup confirmed</p>
              <p className="text-xs text-ink/65">Rider arriving in 12 min</p>
            </div>
          </motion.div>

          {/* floating card: live tracking */}
          <motion.div
            style={{ y: yCardB }}
            initial={reduce ? false : { opacity: 0, x: 20, y: -10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.85, ease: EASE_BRAND }}
            className="absolute -right-1 bottom-12 w-[200px] rounded-2xl bg-paper/95 p-4 shadow-lift ring-1 ring-ink/10 backdrop-blur sm:-right-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-700 uppercase tracking-wider text-ink/55">
                Your order
              </p>
              <span className="rounded-pill bg-tide/12 px-2 py-0.5 text-[11px] font-700 text-tide">
                Washing
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              {[1, 1, 1, 0].map((done, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    done ? "bg-tide" : "bg-ink/10"
                  }`}
                />
              ))}
            </div>
            <p className="mt-2.5 text-sm font-600 text-ink">
              Back by <span className="text-tide">tomorrow, 6 PM</span>
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
