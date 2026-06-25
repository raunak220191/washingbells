type WaveDividerProps = {
  /** fill colour of the wave (the section the wave flows *into*) */
  fill?: string;
  /** flip vertically so the wave hangs from the top of a section */
  flip?: boolean;
  className?: string;
};

/**
 * Soft, hand-drawn-feeling wave divider between sections.
 * Purely decorative (aria-hidden) and layout-stable.
 */
export function WaveDivider({
  fill = "#F5F5F2",
  flip = false,
  className = "",
}: WaveDividerProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none -mb-px w-full leading-[0] ${flip ? "rotate-180" : ""} ${className}`}
    >
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="block h-[60px] w-full sm:h-[90px] lg:h-[120px]"
      >
        <path
          fill={fill}
          d="M0,48 C180,96 360,96 540,72 C720,48 900,0 1080,12 C1260,24 1380,72 1440,84 L1440,120 L0,120 Z"
        />
      </svg>
    </div>
  );
}
