import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import { Reveal, RevealGroup, RevealItem } from "./Reveal";

const STORE_MAPS_URL = "https://maps.google.com/?q=30.645332,76.801170";

const AREAS = [
  "Zirakpur",
  "Dhakoli",
  "Baltana",
  "VIP Road",
  "Aerocity",
  "Peer Muchalla",
  "Lohgarh",
  "Bhabat",
  "Nabha Sahib",
  "Panchkula",
  "Mohali",
  "Kharar",
  "Dera Bassi",
];

// decorative pins on the abstract map (percentages)
const PINS = [
  { x: "22%", y: "30%", big: true },
  { x: "58%", y: "20%", big: false },
  { x: "74%", y: "44%", big: true },
  { x: "40%", y: "54%", big: false },
  { x: "30%", y: "72%", big: false },
  { x: "66%", y: "70%", big: true },
];

export function Coverage() {
  const reduce = useReducedMotion();
  const [pin, setPin] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim().length >= 4) setSubmitted(true);
  };

  return (
    <section id="coverage" className="section-pad relative overflow-hidden">
      <div className="container-bells grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Left — copy, pincode check, chips */}
        <div>
          <Reveal>
            <span className="eyebrow">Coverage</span>
            <h2 className="mt-4 text-3xl font-800 leading-[1.05] text-ink sm:text-4xl lg:text-[2.75rem]">
              One store. <span className="text-tide">All of the Tricity.</span>
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-ink/70">
              Our Zirakpur facility picks up and delivers right across the city
              and into nearby Panchkula, Mohali, Kharar and beyond. Drop your
              pincode and we'll confirm in a tap.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mt-7">
            <form
              onSubmit={onSubmit}
              className="flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <label htmlFor="pincode" className="sr-only">
                Your Zirakpur or Tricity pincode
              </label>
              <div className="flex flex-1 items-center gap-2 rounded-pill bg-foam px-5 py-1.5 ring-1 ring-ink/8 focus-within:ring-2 focus-within:ring-tide">
                <MapPin size={18} className="text-tide" />
                <input
                  id="pincode"
                  name="pincode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  spellCheck={false}
                  maxLength={6}
                  placeholder="e.g. 140603"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setSubmitted(false);
                  }}
                  className="w-full bg-transparent py-2.5 text-ink placeholder:text-ink/40 focus:outline-none"
                />
              </div>
              <button type="submit" className="btn-primary shrink-0">
                Check
                <ArrowRight size={18} strokeWidth={2.5} />
              </button>
            </form>
            <div className="mt-3 min-h-[1.5rem]" aria-live="polite">
              <AnimatePresence>
                {submitted && (
                  <motion.p
                    initial={reduce ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="inline-flex items-center gap-2 text-sm font-600 text-tide"
                  >
                    <CheckCircle2 size={16} />
                    Great news — we're serving your area. Book a pickup above!
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </Reveal>

          <RevealGroup
            staggerChildren={0.04}
            className="mt-7 flex flex-wrap gap-2.5"
          >
            {AREAS.map((area) => (
              <RevealItem key={area} small>
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-sand px-3.5 py-1.5 text-sm font-600 text-ink/75 shadow-tide-sm ring-1 ring-ink/5 transition-colors duration-200 hover:text-tide">
                  <span className="h-1.5 w-1.5 rounded-full bg-tide" />
                  {area}
                </span>
              </RevealItem>
            ))}
            <RevealItem small>
              <span className="inline-flex items-center rounded-pill bg-tide/10 px-3.5 py-1.5 text-sm font-700 text-tide">
                + more nearby
              </span>
            </RevealItem>
          </RevealGroup>
        </div>

        {/* Right — abstract map */}
        <Reveal delay={0.15}>
          <div className="relative aspect-square w-full overflow-hidden rounded-feature bg-pool shadow-ink">
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)",
                backgroundSize: "44px 44px",
              }}
            />
            {/* abstract roads */}
            <svg
              aria-hidden="true"
              viewBox="0 0 400 400"
              className="absolute inset-0 h-full w-full"
              fill="none"
            >
              <path
                d="M-20 120 C120 90 180 200 420 150"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M80 -20 C110 160 60 260 140 420"
                stroke="rgba(255,255,255,0.28)"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path
                d="M420 300 C260 320 200 260 -20 320"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="7"
                strokeLinecap="round"
              />
            </svg>

            {PINS.map((p, i) => (
              <motion.span
                key={i}
                className="absolute -translate-x-1/2 -translate-y-full"
                style={{ left: p.x, top: p.y }}
                initial={reduce ? false : { scale: 0, y: -8, opacity: 0 }}
                whileInView={{ scale: 1, y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{
                  delay: 0.3 + i * 0.12,
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <span className="relative grid place-items-center">
                  <MapPin
                    size={p.big ? 38 : 28}
                    className="fill-zest text-ink drop-shadow-[0_6px_10px_rgba(0,61,43,0.45)]"
                  />
                </span>
              </motion.span>
            ))}

            <a
              href={STORE_MAPS_URL}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-2xl bg-ink/40 p-4 text-sand backdrop-blur-md ring-1 ring-white/10 transition-colors duration-300 hover:bg-ink/55"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zest text-ink">
                <MapPin size={20} strokeWidth={2.25} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-700">Washing Bells · Zirakpur</p>
                <p className="truncate text-xs text-sand/70">
                  SCO 8, Juneja Square, Highground Rd — tap for directions
                </p>
              </div>
              <ArrowRight size={18} className="ml-auto shrink-0 text-zest" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
