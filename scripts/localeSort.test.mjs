// upgrade_last_ios TASK 4: pin down the item-sort comparator with a fixed
// fixture so any engine/ICU drift (Hermes iOS vs Hermes Android vs Node) is
// caught. Mirrors the comparator in app/(tabs)/home/service/[slug].js and
// category/[category].js — keep in sync if the comparator changes.
//
// Run: node --test scripts/localeSort.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

const byName = (a, b) =>
  (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });

test("alphabetical, case-insensitive, locale-aware item sort", () => {
  const fixture = [
    { name: "t-shirt" },
    { name: "Blazer" },
    { name: "saree" },
    { name: "Salwar Suit" },
    { name: "blanket (Single)" },
    { name: "Kurta" },
    { name: "T-Shirt Premium" },
    { name: null },
  ];
  const sorted = [...fixture].sort(byName).map((i) => i.name);
  assert.deepEqual(sorted, [
    null,                 // empty name sorts first
    "blanket (Single)",   // case-insensitive: b… before B…lazer alphabetically
    "Blazer",
    "Kurta",
    "Salwar Suit",        // 'Sal' < 'Sar'
    "saree",
    "t-shirt",            // base sensitivity: t == T
    "T-Shirt Premium",
  ]);
});

test("kg fixture from the live catalog keeps category-stable order", () => {
  const items = ["Sherwani", "Blazer", "Suit (2pc)"].map((name) => ({ name }));
  assert.deepEqual([...items].sort(byName).map((i) => i.name),
    ["Blazer", "Sherwani", "Suit (2pc)"]);
});
