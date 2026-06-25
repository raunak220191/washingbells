import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

type SectionHeadingProps = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  invert?: boolean;
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  invert = false,
  className = "",
}: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <Reveal
      className={`${centered ? "mx-auto text-center" : "text-left"} max-w-2xl ${className}`}
    >
      <span
        className={`eyebrow ${
          invert ? "bg-white/10 text-aqua" : ""
        }`}
      >
        {eyebrow}
      </span>
      <h2
        className={`mt-4 text-3xl font-800 leading-[1.05] sm:text-4xl lg:text-[2.75rem] ${
          invert ? "text-sand" : "text-ink"
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-4 text-lg leading-relaxed ${
            invert ? "text-sand/70" : "text-ink/65"
          } ${centered ? "mx-auto" : ""}`}
        >
          {description}
        </p>
      )}
    </Reveal>
  );
}
