type AppBadgesProps = {
  className?: string;
  /** lighter outline style for use on dark backgrounds */
  variant?: "dark" | "light";
};

/**
 * App Store + Google Play download badges (placeholders — apps coming soon).
 * Hand-built so they stay crisp at any size and match the brand radii.
 */
export function AppBadges({ className = "", variant = "dark" }: AppBadgesProps) {
  const base =
    "group inline-flex items-center gap-3 rounded-2xl px-4 py-2.5 transition-[transform,box-shadow] duration-300 ease-brand hover:-translate-y-0.5";
  const skin =
    variant === "dark"
      ? "bg-ink text-sand shadow-lift hover:shadow-ink"
      : "bg-white/10 text-sand ring-1 ring-white/20 backdrop-blur hover:bg-white/20";

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <a
        href="#"
        aria-label="Download Washing Bells on the App Store (coming soon)"
        className={`${base} ${skin}`}
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
          <path d="M16.365 1.43c0 1.14-.42 2.2-1.12 3-.78.88-2.05 1.56-3.1 1.48-.13-1.1.42-2.27 1.06-2.99.74-.84 2.06-1.47 3.16-1.49zM20.94 17.2c-.57 1.31-.85 1.89-1.59 3.05-1.03 1.62-2.49 3.64-4.29 3.65-1.6.02-2.01-1.04-4.18-1.03-2.17.01-2.62 1.05-4.22 1.04-1.8-.02-3.18-1.84-4.21-3.46C-.93 16.93-1.2 11.6 1.07 8.85c1.21-1.49 3.12-2.43 4.83-2.43 1.74 0 2.84 1.04 4.28 1.04 1.4 0 2.25-1.04 4.27-1.04 1.52 0 3.13.83 4.28 2.26-3.76 2.06-3.15 7.43.34 8.56z" />
        </svg>
        <span className="text-left leading-tight">
          <span className="block text-[10px] font-500 uppercase tracking-wide opacity-70">
            Download on the
          </span>
          <span className="block font-display text-base font-700">App Store</span>
        </span>
      </a>

      <a
        href="#"
        aria-label="Get Washing Bells on Google Play (coming soon)"
        className={`${base} ${skin}`}
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
          <path d="M3.6 1.8a1.6 1.6 0 0 0-.6 1.25v17.9c0 .5.22.95.6 1.25l10-10.2-10-10.2z" fill="#A8C86B" />
          <path d="M17.4 8.9 13.6 6.7 3.9 1.2c-.1-.06-.2-.1-.3-.13L13.6 11l3.8-2.1z" fill="#006241" />
          <path d="M3.6 22.8c.1-.03.2-.07.3-.13l9.7-5.5-3.8-3.86L3.6 22.8z" fill="#003D2B" />
          <path d="m17.4 8.9-3.8 2.1 3.8 3.86 3.4-1.92c.7-.4.7-1.62 0-2.02L17.4 8.9z" fill="#BFA14A" />
        </svg>
        <span className="text-left leading-tight">
          <span className="block text-[10px] font-500 uppercase tracking-wide opacity-70">
            Get it on
          </span>
          <span className="block font-display text-base font-700">Google Play</span>
        </span>
      </a>
    </div>
  );
}
