import { Instagram, Linkedin, Mail, MapPin, Phone, Twitter } from "lucide-react";
import { Logo } from "./Logo";
import { AppBadges } from "./AppBadges";

const STORE_MAPS_URL = "https://maps.google.com/?q=30.645332,76.801170";

const COLUMNS = [
  {
    title: "Services",
    links: [
      { label: "Wash & Fold", href: "#services" },
      { label: "Dry Cleaning", href: "#services" },
      { label: "Steam Ironing", href: "#services" },
      { label: "Shoe & Sneaker Care", href: "#services" },
      { label: "Bedding & Household", href: "#services" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Pricing", href: "#pricing" },
      { label: "Coverage", href: "#coverage" },
      { label: "FAQ", href: "#faq" },
      { label: "Careers", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Delete account", href: "/delete-account" },
      { label: "Refund & re-wash", href: "#" },
      { label: "Contact us", href: "mailto:admin@washingbells.com" },
    ],
  },
];

const SOCIALS = [
  { Icon: Instagram, label: "Instagram", href: "#" },
  { Icon: Twitter, label: "Twitter", href: "#" },
  { Icon: Linkedin, label: "LinkedIn", href: "#" },
];

export function Footer() {
  return (
    <footer className="bg-ink text-sand">
      <div className="container-bells py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* brand + contact */}
          <div>
            <Logo inverted />
            <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-sand/65">
              Fresh clothes & dry cleaning, picked up and delivered across
              Zirakpur and the Tricity. Less time on chores, more on the things
              you love.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-sand/75">
              <li>
                <a
                  href="tel:+919501121012"
                  className="inline-flex items-center gap-2.5 transition-colors hover:text-zest"
                >
                  <Phone size={16} className="text-tide" /> +91&nbsp;95011&nbsp;21012
                </a>
              </li>
              <li>
                <a
                  href="mailto:admin@washingbells.com"
                  className="inline-flex items-center gap-2.5 transition-colors hover:text-zest"
                >
                  <Mail size={16} className="text-tide" /> admin@washingbells.com
                </a>
              </li>
              <li>
                <a
                  href={STORE_MAPS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-start gap-2.5 transition-colors hover:text-zest"
                >
                  <MapPin size={16} className="mt-0.5 shrink-0 text-tide" /> SCO 8,
                  Juneja Square, Highground Road, Zirakpur - 140603, Punjab
                </a>
              </li>
            </ul>

            <div className="mt-7">
              <p className="text-xs font-700 uppercase tracking-[0.14em] text-sand/50">
                Get the app
              </p>
              <AppBadges variant="light" className="mt-3" />
            </div>
          </div>

          {/* link columns */}
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="font-display text-sm font-700 uppercase tracking-[0.14em] text-sand/50">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-[15px] text-sand/75 transition-colors duration-200 hover:text-zest"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-5 border-t border-white/10 pt-7 sm:flex-row">
          <p className="text-sm text-sand/55">
            © {2026} Washing Bells Laundry Pvt. Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            {SOCIALS.map(({ Icon, label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-sand/70 ring-1 ring-white/10 transition-[transform,background-color,color] duration-300 ease-brand hover:-translate-y-0.5 hover:bg-tide hover:text-white"
              >
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
