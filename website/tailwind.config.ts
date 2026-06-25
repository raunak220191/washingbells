import type { Config } from "tailwindcss";

/**
 * Washing Bells design tokens — defined once here, referenced by name everywhere.
 * Brand: fresh, effortless, cheerful-premium. Teal = water; amber = sunshine.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // legacy token names remapped to the green + gold brand palette
        ink: "#003D2B", // Dark Forest — primary text + reverse/dark surfaces
        tide: "#006241", // Deep Emerald — primary brand
        aqua: "#A8C86B", // Soft Olive — fresh secondary accent
        foam: "#CFE3D8", // Pale Sage — soft light surface
        sand: "#F5F5F2", // Off-White — page / paper base
        zest: "#BFA14A", // Gold — premium metallic accent / primary CTA
        coral: "#A8C86B", // (collapsed into Soft Olive)
        // explicit palette aliases (self-documenting)
        forest: "#003D2B",
        emerald: "#006241",
        sage: "#CFE3D8",
        olive: "#A8C86B",
        paper: "#F5F5F2",
        gold: "#BFA14A",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Manrope"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // numeric weight utilities (font-400 … font-800) referenced across components
      fontWeight: {
        "400": "400",
        "500": "500",
        "600": "600",
        "700": "700",
        "800": "800",
      },
      borderRadius: {
        feature: "24px",
        pill: "9999px",
      },
      maxWidth: {
        content: "1200px",
      },
      boxShadow: {
        // soft, tinted — never flat grey (emerald / forest / gold)
        tide: "0 18px 40px -16px rgba(0, 98, 65, 0.38)",
        "tide-sm": "0 8px 24px -12px rgba(0, 98, 65, 0.30)",
        ink: "0 28px 60px -24px rgba(0, 61, 43, 0.42)",
        zest: "0 16px 36px -14px rgba(191, 161, 74, 0.50)",
        lift: "0 24px 50px -20px rgba(0, 61, 43, 0.30)",
      },
      transitionTimingFunction: {
        // confident, controlled
        brand: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-22px) rotate(3deg)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-slow": "float-slow 9s ease-in-out infinite",
        shimmer: "shimmer 6s linear infinite",
      },
      backgroundImage: {
        // fresh emerald "pool" — olive highlight into deep forest
        "pool": "radial-gradient(120% 120% at 20% 10%, #A8C86B 0%, #006241 52%, #003D2B 100%)",
        // premium gold sheen for accent text
        "sun-text": "linear-gradient(90deg, #BFA14A, #D8C074)",
      },
    },
  },
  plugins: [],
} satisfies Config;
