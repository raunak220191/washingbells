Project

Washing Bells is a laundry & dry-cleaning service. This repo is its public informative marketing website — a single, polished landing page that explains the service, builds trust, and drives sign-ups. It is not a web app: no auth, no dashboard, no backend. Marketing site only.

North star for any UI work

Produce a site that looks like it was designed by a senior product designer for a well-funded consumer brand — not a template. Visually striking, motion-rich, fast, accessible. Avoid generic AI output: no default Inter-on-white, no purple-on-white gradients, no grid of evenly-spaced rounded cards with grey drop shadows. Commit to the brand direction below and make confident, intentional choices.

Tech stack


Vite + React + TypeScript
Tailwind CSS for styling (wire the tokens below into tailwind.config.ts; avoid arbitrary hex in JSX)
Framer Motion for animation
lucide-react for icons
Google Fonts via @fontsource packages or a <link> in index.html
Do not add a component library (no MUI/Chakra/Bootstrap). Hand-build components.


Brand direction

Personality: fresh, effortless, cheerful-premium. Think sunlit linen, ocean-clean water, the calm of a fresh-folded stack. Warm and human, never clinical. The teals are water and freshness; the amber accent is sunshine.

Design tokens (use these exactly)

Colors


ink (primary text / dark): #0B2540
tide (primary brand): #0E9F94
aqua (secondary): #7DD3D8
foam (light surface): #EAF7F6
sand (page background): #FBFAF6
zest (accent / primary CTA): #FFB200
coral (secondary accent, use sparingly): #FF6B5C


Usage: ink for body text, sand/foam for surfaces, tide for primary brand moments, zest for primary CTAs and energy. Pure white is banned for large surfaces — use sand.

Typography


Display / headings: "Bricolage Grotesque" (700/800), tight leading, large and confident
Body / UI: "Manrope" (400/500/600)
Never use Inter as a hero font here.


Shape & scale


Spacing base unit 4px; generous section padding (96–160px vertical on desktop)
Radii: large (24px) on feature surfaces, pill (9999px) on buttons/chips — vary them, don't make everything uniform
Shadows: soft and tinted (low-opacity tide/ink), never flat grey drop shadows everywhere
Max content width ~1200px


Motion guidelines (Framer Motion)


Hero: layered entrance — heading words stagger up, the visual floats in; one key element has a subtle continuous float (a bubble or bell).
Scroll: reveal each section on enter (fade + 20–32px rise), stagger children ~0.08s.
Micro-interactions: buttons lift + shadow on hover, cards scale/tilt subtly, icons animate on hover.
Flourishes: drifting soap-bubbles in the hero background, a gentle wave divider between a couple of sections, light parallax on 1–2 layers.
Easing: custom cubic-bezier [0.22, 1, 0.36, 1] for a confident, controlled feel. Durations 0.4–0.8s.
Always respect prefers-reduced-motion — gate all non-essential animation behind it.


Page structure (single-page, anchor-scroll nav)


Sticky nav — logo "Washing Bells", links (How it works, Services, Pricing, Coverage, FAQ), primary CTA.
Hero — bold headline, one-line value prop, primary + secondary CTA, animated visual.
Trust strip — quick stats / badges (turnaround time, areas served, rating).
How it works — 3–4 steps (Schedule pickup → We wash → We deliver), animated on scroll.
Services — wash & fold, dry cleaning, ironing, shoe/care, as distinctive cards.
Why Washing Bells — differentiators (eco detergents, same-day, live tracking).
Pricing / plans — simple, scannable; highlight one recommended plan (use ₹).
Testimonials — real-feeling, with motion.
Coverage area — where the service operates.
FAQ — accordion.
Final CTA banner — book now / sign up.
Footer — links, contact, social, copyright.


Write real copy throughout — friendly, confident, concise. No lorem ipsum. Indian context is fine.

Quality bar


Mobile-first; flawless responsive down to 360px.
Semantic HTML, alt text, keyboard-navigable, visible focus states, WCAG AA contrast.
Lighthouse 90+ across the board; lazy-load heavy assets; no layout shift; no console errors.


Conventions


Components in src/components/, one per file, PascalCase; sections composed in App.tsx.
Tokens defined once in tailwind.config.ts and referenced by name.
Keep it a single page (anchor scrolling). No routing.