---
name: design-system
description: The enforceable design standard for the WashingBells customer app (Expo/React Native). Read before touching any UI. Defines the token set, the primitive components every screen must compose, the hard styling rules, and the per-screen review rubric.
---

# WashingBells Customer App — Design System

This file is the **source of truth**. If a screen disagrees with this file, the
screen is wrong. If you deliberately change a standard, change it *here first*,
then conform the code.

The bar: **"a senior product designer would ship this."** Not "technically fine."
References: Material 3 (Android), Apple HIG (iOS), and the conventions of polished
commerce apps — clear hierarchy, generous *consistent* spacing, restraint, one
type scale, one elevation language.

---

## 0. The one hard rule

**Never style a screen directly once a primitive exists. Always compose primitives.**

- A screen file contains *layout and data*, not visual constants.
- No raw hex in a screen — only `COLORS.*` / `TINTS.*`.
- No raw font sizes in a screen — only a primitive, or `TYPE.*`.
- No raw spacing literals where a `SPACING.*` token fits.
- No ad-hoc `SafeAreaView` + header + bottom-bar reimplementation — use `<Screen>` / `<Header>`.

If you find yourself copy-pasting a `StyleSheet` block from one screen to another,
stop: that block belongs in a primitive.

---

## 1. Tokens (`constants/theme.js` is the only definition site)

### Color (`COLORS`)
Brand: WashingBells green + gold.
- `forestGreen #006241` — primary brand. `darkForest #003D2B` — deepest / headings & shadow tint.
- `gold #BFA14A` — premium accent **and the primary CTA color**.
- `mintGreen #CFE3D8`, `olive #A8C86B` — soft fresh tints.
- Surfaces: `cream / background #F5F5F2` (page), `white #FFFFFF` (cards). Pure white is for cards only; pages use `background`.
- Text: `black #1A1A1A` (headings), `text #333` (body), `textLight #666`, `textMuted #888`.
- Lines: `border #EEE`, `borderLight #F0F0F0`.

### Semantic tints (`TINTS`) — status banners/badges
Canonical = **Material-family pastels** with high-contrast text:
`successBg/Text`, `errorBg/Text`, `infoBg/Text`, `warningBg/Text`, `whatsapp`.
The old Bootstrap badge palette (`#D4EDDA/#155724/#F8D7DA`) is **banned** — do not reintroduce.

### Order status (`ORDER_STATUS_LABELS`, `ORDER_STATUS_COLORS`)
Every backend status (incl. `placed`, `at_store`, `ready_for_delivery`, `rejected`)
is mapped. **Render the same label text in the list and the detail screen** — never
`textTransform: uppercase` in one and title-case in the other.

### Spacing (`SPACING`) — 4pt base, 8pt rhythm
`xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · xxxl 32`.
- Screen horizontal padding is **always `lg` (16)** — owned by `<Screen>`. This is
  what makes every header sit at the same offset.
- Card inner padding is `lg` (16). Gap between stacked cards is `sm`–`md`.
- Section vertical rhythm uses `xl`–`xxl`.

### Radius (`RADIUS`)
`sm 8 · md 12 · lg 16 · xl 20 · full 9999`. Cards: `lg`. Inputs/small controls: `md`.
Pills/chips/buttons: `full`. Vary them — not everything is the same radius.

### Icons (`ICON`)
`xs 16 · sm 20 · md 24 · lg 28 · xl 32 · hero 48`. Default glyph = `md`.

### Elevation (`SHADOWS`)
Brand-tinted, soft. `card` (resting), `raised` (lifted), `bar` (upward, for pinned
bottom bars). **No flat neutral-grey drop shadows anywhere.**

### Type (`TYPE`) — ONE scale
`display 28 · h1 24 · h2 20 · h3 17 · bodyLg 16 · body 15 · bodySm 13 · label 13 · caption 12 · price 16`.
Each role carries `fontSize` + `lineHeight` + `fontWeight`. Screens pick a role; they
do not invent sizes.

---

## 2. Primitives (`components/common/`)

Every screen composes these. Each is verified in isolation/on a real device before rollout.

| Primitive | Responsibility | Key props |
|-----------|----------------|-----------|
| `<Screen>` | Owns SafeArea (top + bottom insets), status-bar style, page background, and the **canonical horizontal padding (`lg`)**. Optional `scroll`. This is why every screen's header sits at the same offset. | `scroll`, `padded`, `edges`, `style`, `contentContainerStyle` |
| `<Header>` | Fixed-height (56) row: back button (≥48dp touch target via hitSlop) + centered title + optional right slot. Consistent everywhere. | `title`, `onBack`, `right`, `border` |
| `<Chip>` | ONE compact pill. Single height, `full` radius, in a horizontal scroll row, **never clipped, identical in every selected/unselected state on every screen.** | `label`, `active`, `onPress` |
| `<Button>` | Filled/secondary/outline + **obvious, intentional disabled state** and loading. Primary = gold. | `title`, `variant`, `size`, `disabled`, `loading`, `onPress`, `fullWidth` |
| `<Card>` | Surface container: `white`, `RADIUS.lg`, `SHADOWS.card`, padding `lg`. The one card look. | `onPress`, `padded`, `style` |
| `<ListItem>` | Row: optional leading icon/box, title + subtitle, optional trailing (chevron / value / control). Consistent padding & dividers. | `title`, `subtitle`, `leading`, `trailing`, `onPress` |
| `<PriceRow>` | Label ↔ value row for bills/summaries. Consistent baseline; `emphasis` for totals; `free` styling. | `label`, `value`, `emphasis`, `muted` |

Composite shared pieces (not primitives, but shared): `StatusBadge`, `OrderStatusTracker`, `BottomBar` (pinned action bar using `SHADOWS.bar`).

---

## 3. Per-screen rubric (score each /5, ship at ≥4 on every line)

1. **Header & top spacing** — uses `<Screen>`+`<Header>`; title/back at the canonical
   offset; correct notch/safe-area gap (identical across screens).
2. **Spacing & grid** — all spacing from tokens; consistent card padding/margins; no
   cramped or random gaps; aligned to the 8pt rhythm.
3. **Type hierarchy** — only `TYPE` roles; one clear heading→body→caption hierarchy;
   no competing bold sizes.
4. **Color & elevation** — tokens only; brand-tinted soft shadows; no raw hex; no
   pure-white pages; status colors from the canonical maps.
5. **Components** — composes primitives; no screen-level reimplementation of header/
   card/chip/button/bottom-bar; chips never clipped; disabled buttons obviously intentional.
6. **States** — loading, empty, and error states are designed (not raw spinners/blank);
   labels consistent with the rest of the app (e.g. status casing).
7. **A11y & touch** — ≥48dp touch targets, visible/legible contrast (WCAG AA), real
   `accessibilityLabel`s on icon-only controls.
8. **Senior-designer gut check** — would a senior product designer ship this exact
   screen? If hesitant, it fails.

---

## 4. Working rules

- Branch: `overnight-polish` only.
- Commit each primitive and each screen separately.
- Screenshot BEFORE and AFTER every screen on a **real device** (Android emulator /
  iOS simulator via mobile MCP). Never judge UI against react-native-web.
- Do not break working functionality. Visual-only changes must not touch business logic.
- Replace obvious placeholder seed data (Xyz / Ddd / SI3 / "Store N, Sector N") with
  realistic content so finished screens never look unfinished.
