import { motion, useReducedMotion } from "framer-motion";
import { Quote, Star } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

type Review = {
  name: string;
  role: string;
  initial: string;
  color: string;
  quote: string;
};

const REVIEWS: Review[] = [
  {
    name: "Simran Kaur",
    role: "Dhakoli, Zirakpur",
    initial: "S",
    color: "#006241",
    quote:
      "I've genuinely got my Sundays back. Pickup is always on time and my clothes come back smelling incredible — folded better than I ever manage.",
  },
  {
    name: "Rohan Gupta",
    role: "VIP Road, Zirakpur",
    initial: "R",
    color: "#BFA14A",
    quote:
      "The live tracking is weirdly satisfying. I know exactly when my shirts are coming back, ironed and ready for the week. Worth every rupee.",
  },
  {
    name: "Meher Sethi",
    role: "Baltana",
    initial: "M",
    color: "#A8C86B",
    quote:
      "Their re-wash promise won me over. One stain didn't lift the first time, they collected it again the same day. No fuss, no charge.",
  },
  {
    name: "Harpreet Singh",
    role: "Panchkula",
    initial: "H",
    color: "#003D2B",
    quote:
      "As a parent of two, the Household plan is a lifesaver. Bedding, school uniforms, the lot — all handled. Easily the best ₹2,999 I spend.",
  },
  {
    name: "Divya Bansal",
    role: "Peer Muchalla",
    initial: "D",
    color: "#006241",
    quote:
      "My silk suits came back perfect — pressed, wrapped, spotless. You can tell real people handle these, not just machines.",
  },
  {
    name: "Arjun Malhotra",
    role: "Mohali",
    initial: "A",
    color: "#BFA14A",
    quote:
      "Switched from a local dhobi and never looked back. Eco detergents, no harsh smell, and my gym wear actually feels fresh again.",
  },
  {
    name: "Priya Sharma",
    role: "Kharar",
    initial: "P",
    color: "#A8C86B",
    quote:
      "Booking takes thirty seconds and the rider is always polite and contactless. It quietly became the service I'm most grateful for.",
  },
  {
    name: "Karan Ahuja",
    role: "Chandigarh",
    initial: "K",
    color: "#003D2B",
    quote:
      "Same-day turnaround saved me before a last-minute trip. Suit dry-cleaned and back by evening. Absolute legends.",
  },
];

function ReviewCard({ r }: { r: Review }) {
  return (
    <figure className="flex w-[300px] shrink-0 flex-col rounded-feature bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur-sm transition-colors duration-300 hover:bg-white/[0.08] sm:w-[360px]">
      <div className="flex items-center justify-between">
        <Quote size={26} className="text-zest" />
        <div className="flex gap-0.5" aria-label="Rated 5 out of 5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={15} className="fill-zest text-zest" />
          ))}
        </div>
      </div>
      <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-sand/85">
        &ldquo;{r.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <span
          className="grid h-10 w-10 place-items-center rounded-full font-display text-sm font-700 text-white"
          style={{ background: r.color }}
        >
          {r.initial}
        </span>
        <div>
          <p className="text-sm font-700 text-sand">{r.name}</p>
          <p className="text-xs text-sand/55">{r.role}</p>
        </div>
      </figcaption>
    </figure>
  );
}

function Marquee({
  items,
  reverse = false,
}: {
  items: Review[];
  reverse?: boolean;
}) {
  // duplicate the row so the loop is seamless
  const doubled = [...items, ...items];
  return (
    <div className="group relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
      <motion.div
        className="flex shrink-0 gap-5 pr-5"
        animate={{ x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration: 46, repeat: Infinity, ease: "linear" }}
        style={{ willChange: "transform" }}
      >
        {doubled.map((r, i) => (
          <ReviewCard key={i} r={r} />
        ))}
      </motion.div>
    </div>
  );
}

export function Testimonials() {
  const reduce = useReducedMotion();

  return (
    <section
      id="testimonials"
      className="section-pad relative overflow-hidden bg-ink"
    >
      {/* soft brand glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 15% 10%, rgba(0,98,65,0.45), transparent 60%), radial-gradient(50% 50% at 90% 90%, rgba(191,161,74,0.16), transparent 60%)",
        }}
      />
      <div className="relative">
        <div className="container-bells">
          <SectionHeading
            invert
            eyebrow="Loved in the neighbourhood"
            title={
              <>
                12,000 loads later,{" "}
                <span className="text-zest">they keep coming back.</span>
              </>
            }
            description="Real words from real Washing Bells regulars across Zirakpur and the Tricity."
          />
        </div>

        {reduce ? (
          <div className="container-bells mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {REVIEWS.slice(0, 6).map((r) => (
              <ReviewCard key={r.name} r={r} />
            ))}
          </div>
        ) : (
          <div className="mt-12 flex flex-col gap-5">
            <Marquee items={REVIEWS.slice(0, 4)} />
            <Marquee items={REVIEWS.slice(4)} reverse />
          </div>
        )}
      </div>
    </section>
  );
}
