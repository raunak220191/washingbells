/**
 * Canonical item categories for the customer app — single source of truth.
 * Adding a new category = one entry here (keep it in sync with the backend
 * list in backend/app/core/categories.py).
 *
 * - tile:          shown as a "Shop by Category" home tile.
 * - includesUnisex: when this filter is active, generic `unisex` items also show
 *                   (true for apparel tabs; false for Home/Footwear/etc).
 */
import { COLORS } from "./theme";

export const CATEGORIES = [
  { key: "men",         label: "Men",         icon: "man-outline",        color: "#4A5D4E", tile: true,  includesUnisex: true },
  { key: "women",       label: "Women",       icon: "woman-outline",      color: "#C5A358", tile: true,  includesUnisex: true },
  { key: "kids",        label: "Kids",        icon: "happy-outline",      color: "#5856D6", tile: true,  includesUnisex: true },
  { key: "home",        label: "Home",        icon: "bed-outline",        color: "#2E7D6F", tile: true,  includesUnisex: false },
  { key: "footwear",    label: "Footwear",    icon: "footsteps-outline",  color: "#8D6E63", tile: true,  includesUnisex: false },
  { key: "accessories", label: "Accessories", icon: "bag-handle-outline", color: "#AD1457", tile: true,  includesUnisex: false },
  { key: "unisex",      label: "Unisex",      icon: "shirt-outline",      color: COLORS.textMuted, tile: false, includesUnisex: false },
  { key: "other",       label: "Other",       icon: "pricetag-outline",   color: COLORS.textMuted, tile: false, includesUnisex: false },
];

const BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

export function tileCategories() {
  return CATEGORIES.filter((c) => c.tile);
}

export function categoryMeta(key) {
  return BY_KEY[key] || null;
}

export function categoryLabel(key) {
  return BY_KEY[key]?.label || (key ? key.charAt(0).toUpperCase() + key.slice(1) : "Category");
}

/** Does an item with `itemCat` belong under the given filter tab? */
export function matches(itemCat, filterKey) {
  if (!filterKey || filterKey === "all") return true;
  const cat = itemCat || "unisex";
  if (cat === filterKey) return true;
  const meta = BY_KEY[filterKey];
  return !!(meta && meta.includesUnisex && cat === "unisex");
}

/**
 * Build the filter chips for a list of items: "All" + each category present,
 * in canonical order. `hasCategories` is false when everything is unisex (so
 * the caller can hide the chip row entirely).
 */
export function filtersFor(items) {
  const present = new Set((items || []).map((i) => i.category || "unisex"));
  const chips = [{ key: "all", label: "All" }];
  for (const c of CATEGORIES) {
    if (present.has(c.key)) chips.push({ key: c.key, label: c.label });
  }
  const meaningful = chips.filter((ch) => !["all", "unisex", "other"].includes(ch.key));
  return { chips, hasCategories: meaningful.length > 0 };
}
