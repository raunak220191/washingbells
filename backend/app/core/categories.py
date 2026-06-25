"""Canonical item-category list — the single source of truth for the backend.

Adding a new category later is a one-line change here (and one line in each
app's category constant). Apps keep their own presentation metadata (icons,
colours, home-tile flags); the backend only needs the keys for validation.
"""

# Order matters only for display fallbacks; membership is what's enforced.
ITEM_CATEGORIES = [
    "men",
    "women",
    "kids",
    "unisex",       # default — generic apparel worn by everyone
    "home",         # household linens & furnishings (curtains, bedsheets, sofa…)
    "footwear",     # shoes
    "accessories",  # bags, soft toys, caps, ties…
    "other",        # catch-all
]

DEFAULT_CATEGORY = "unisex"


def is_valid(category: str) -> bool:
    return category in ITEM_CATEGORIES


def normalize(category) -> str:
    """Return a valid category, falling back to the default."""
    return category if category in ITEM_CATEGORIES else DEFAULT_CATEGORY
