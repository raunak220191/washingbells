import { motion, useReducedMotion } from "framer-motion";
import {
  Footprints,
  Shirt,
  Sparkles,
  WashingMachine,
  Wind,
  ArrowUpRight,
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";
import { RevealGroup, RevealItem } from "./Reveal";

type Service = {
  icon: typeof Shirt;
  name: string;
  body: string;
  price: string;
  span: string;
  accent: string; // tailwind text colour for the icon chip
  chip: string; // tailwind bg for the icon chip
};

const SERVICES: Service[] = [
  {
    icon: WashingMachine,
    name: "Wash & Fold",
    body: "Everyday clothes washed, dried and folded by the kilo. Sorted by colour and fabric, returned in a neat stack you'll almost not want to unpack.",
    price: "from ₹69 / kg",
    span: "lg:col-span-3 lg:row-span-2",
    accent: "text-white",
    chip: "bg-white/15",
  },
  {
    icon: Shirt,
    name: "Dry Cleaning",
    body: "Suits, silks, sarees and delicates handled with solvent-gentle care and a crisp finish.",
    price: "from ₹149 / item",
    span: "lg:col-span-3",
    accent: "text-tide",
    chip: "bg-tide/10",
  },
  {
    icon: Wind,
    name: "Steam Ironing",
    body: "Wrinkle-free, press-perfect clothes — ready to wear straight off the hanger. Daily wear pressed from just ₹8 a piece.",
    price: "from ₹8 / item",
    span: "lg:col-span-3",
    accent: "text-coral",
    chip: "bg-coral/12",
  },
  {
    icon: Footprints,
    name: "Shoe & Sneaker Care",
    body: "Deep-clean, deodorise and restore your favourite kicks and leather.",
    price: "from ₹249 / pair",
    span: "lg:col-span-2",
    accent: "text-zest",
    chip: "bg-zest/15",
  },
  {
    icon: Sparkles,
    name: "Bedding & Household",
    body: "Duvets, curtains, blankets and bulky home textiles — freshly laundered and fluffed, picked up and returned at your doorstep.",
    price: "from ₹199 / item",
    span: "lg:col-span-4",
    accent: "text-tide",
    chip: "bg-tide/10",
  },
];

export function Services() {
  const reduce = useReducedMotion();
  return (
    <section id="services" className="section-pad relative">
      <div className="container-bells">
        <SectionHeading
          eyebrow="Services"
          title={
            <>
              Whatever's in the hamper,{" "}
              <span className="text-tide">we've got it</span>.
            </>
          }
          description="One service for the everyday, specialists for everything else — all under one friendly roof."
        />

        <RevealGroup
          staggerChildren={0.09}
          className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:auto-rows-[210px] lg:grid-cols-6"
        >
          {SERVICES.map((s, i) => {
            const featured = i === 0;
            const Icon = s.icon;
            return (
              <RevealItem key={s.name} className={`${s.span} h-full`} small>
                <motion.article
                  whileHover={reduce ? undefined : { y: -6 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className={`group relative flex h-full flex-col overflow-hidden rounded-feature p-6 sm:p-7 ${
                    featured
                      ? "bg-pool text-white shadow-ink"
                      : "bg-sand text-ink shadow-tide-sm ring-1 ring-ink/5"
                  }`}
                >
                  {featured && (
                    <div
                      aria-hidden="true"
                      className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl"
                    />
                  )}
                  <div className="flex items-start justify-between">
                    <span
                      className={`grid h-14 w-14 place-items-center rounded-2xl ${s.chip} ${s.accent} transition-transform duration-300 ease-brand group-hover:-rotate-6 group-hover:scale-110`}
                    >
                      <Icon size={26} strokeWidth={2} />
                    </span>
                    <ArrowUpRight
                      size={22}
                      className={`translate-y-1 opacity-0 transition-[transform,opacity] duration-300 ease-brand group-hover:translate-y-0 group-hover:opacity-100 ${
                        featured ? "text-white/80" : "text-tide"
                      }`}
                    />
                  </div>

                  <h3
                    className={`mt-5 font-display font-800 ${
                      featured ? "text-3xl" : "text-xl"
                    }`}
                  >
                    {s.name}
                  </h3>
                  <p
                    className={`mt-2 max-w-sm flex-1 text-[15px] leading-relaxed ${
                      featured ? "text-white/80" : "text-ink/65"
                    }`}
                  >
                    {s.body}
                  </p>
                  <p
                    className={`mt-5 inline-flex w-fit items-center rounded-pill px-3 py-1 text-sm font-700 ${
                      featured
                        ? "bg-zest text-ink"
                        : "bg-foam text-tide"
                    }`}
                  >
                    {s.price}
                  </p>
                </motion.article>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}
