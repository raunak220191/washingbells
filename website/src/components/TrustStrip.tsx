import { Clock, Leaf, MapPin, Star } from "lucide-react";
import { RevealGroup, RevealItem } from "./Reveal";

const STATS = [
  { icon: Clock, value: "24 hrs", label: "Standard turnaround" },
  { icon: MapPin, value: "Tricity", label: "Zirakpur, Panchkula & Mohali" },
  { icon: Star, value: "4.9 / 5", label: "Across 12,000+ orders" },
  { icon: Leaf, value: "100%", label: "Eco-friendly detergents" },
];

export function TrustStrip() {
  return (
    <section aria-label="Why people trust Washing Bells" className="relative">
      <div className="container-bells">
        <RevealGroup
          as="ul"
          staggerChildren={0.1}
          className="grid grid-cols-2 gap-px overflow-hidden rounded-feature bg-ink/8 shadow-tide-sm ring-1 ring-ink/5 lg:grid-cols-4"
        >
          {STATS.map(({ icon: Icon, value, label }) => (
            <RevealItem
              as="li"
              key={label}
              className="group flex items-center gap-4 bg-sand p-6 transition-colors duration-300 hover:bg-foam sm:p-7"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-tide/10 text-tide transition-transform duration-300 ease-brand group-hover:-rotate-6 group-hover:scale-110">
                <Icon size={22} strokeWidth={2.25} />
              </span>
              <div>
                <p className="font-display text-2xl font-800 leading-none text-ink">
                  {value}
                </p>
                <p className="mt-1.5 text-sm leading-tight text-ink/70">{label}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
