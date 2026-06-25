// Canonical item categories for the admin panel — single source of truth.
// Keep in sync with backend/app/core/categories.py. Adding a category later =
// one entry here.

export const CATEGORIES = [
  "men",
  "women",
  "kids",
  "unisex",
  "home",
  "footwear",
  "accessories",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_STYLES: Record<string, string> = {
  men: "bg-blue-100 text-blue-700",
  women: "bg-pink-100 text-pink-700",
  kids: "bg-purple-100 text-purple-700",
  home: "bg-teal-100 text-teal-700",
  footwear: "bg-amber-100 text-amber-700",
  accessories: "bg-rose-100 text-rose-700",
  unisex: "bg-gray-100 text-gray-500",
  other: "bg-gray-100 text-gray-500",
};

export function categoryStyle(key: string): string {
  return CATEGORY_STYLES[key] || CATEGORY_STYLES.unisex;
}
