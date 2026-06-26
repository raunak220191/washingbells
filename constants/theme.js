/**
 * WashingBells Design Tokens
 * Central source of truth for colors, spacing, typography.
 */

export const COLORS = {
  // Primary brand — Washing Bells green + gold
  forestGreen: "#006241", // Deep Emerald (primary brand)
  darkForest: "#003D2B", // Dark Forest (deepest shade / headings)
  gold: "#BFA14A", // Gold (premium accent)
  mintGreen: "#CFE3D8", // Pale Sage (soft light tint)
  olive: "#A8C86B", // Soft Olive (fresh accent)
  cream: "#F5F5F2", // Off-White (neutral surface)

  // UI
  background: "#F5F5F2",
  white: "#FFFFFF",
  black: "#1A1A1A",
  text: "#333333",
  textLight: "#666666",
  textMuted: "#888888",
  border: "#EEEEEE",
  borderLight: "#F0F0F0",
  shadow: "#00000010",

  // Status
  success: "#34C759",
  error: "#FF3B30",
  warning: "#FF9500",
  info: "#007AFF",

  // Order status colors
  pending: "#FF9500",
  confirmed: "#007AFF",
  pickedUp: "#5856D6",
  processing: "#AF52DE",
  outForDelivery: "#34C759",
  delivered: "#34C759",
  cancelled: "#FF3B30",
};

export const FONTS = {
  regular: { fontSize: 14, color: COLORS.text },
  medium: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  bold: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  h1: { fontSize: 24, fontWeight: "700", color: COLORS.black },
  h2: { fontSize: 20, fontWeight: "700", color: COLORS.black },
  h3: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  caption: { fontSize: 12, color: COLORS.textLight },
  small: { fontSize: 10, color: COLORS.textMuted },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

// Delivery fee threshold
export const FREE_DELIVERY_THRESHOLD = 299;
export const DELIVERY_FEE = 40;

// Time slots for pickup/delivery
export const TIME_SLOTS = [
  { label: "7:00 AM - 9:00 AM", value: "07:00-09:00" },
  { label: "9:00 AM - 11:00 AM", value: "09:00-11:00" },
  { label: "11:00 AM - 1:00 PM", value: "11:00-13:00" },
  { label: "1:00 PM - 3:00 PM", value: "13:00-15:00" },
  { label: "3:00 PM - 5:00 PM", value: "15:00-17:00" },
  { label: "5:00 PM - 7:00 PM", value: "17:00-19:00" },
  { label: "7:00 PM - 9:00 PM", value: "19:00-21:00" },
];

// Order status labels
export const ORDER_STATUS_LABELS = {
  placed: "Awaiting Confirmation",
  pending_payment: "Pending Payment",
  confirmed: "Confirmed",
  picked_up: "Picked Up",
  at_store: "At Store",
  processing: "Processing",
  ready_for_delivery: "Ready for Delivery",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  rejected: "Not Accepted",
};

// Semantic surface tints — status banners/badges and contact-channel colors.
// Single source of truth so screens stop hardcoding hex (see brand guidelines).
// CANONICAL SET (decided 2026-06-26, overnight-design audit): Material-family
// pastel backgrounds (already used by Help cards, the profile email banner and
// wallet) paired with high-contrast text. The old Bootstrap badge palette
// (#D4EDDA/#155724/#F8D7DA) used on checkout was migrated here — do not reintroduce.
export const TINTS = {
  successBg: "#E8F5E9",
  successText: "#155724",
  errorBg: "#FFEBEE",
  errorText: "#721C24",
  infoBg: "#E3F2FD",
  infoText: "#1976D2",
  warningBg: "#FFF3E0",
  warningText: "#E65100",
  whatsapp: "#25D366",
};

// Single source of truth for order-status badge colors. Every status in the
// backend lifecycle is mapped so badges never fall back to raw grey text.
export const ORDER_STATUS_COLORS = {
  placed: COLORS.warning,
  pending_payment: COLORS.warning,
  confirmed: COLORS.info,
  picked_up: COLORS.pickedUp,
  at_store: COLORS.processing,
  processing: COLORS.processing,
  ready_for_delivery: COLORS.info,
  out_for_delivery: COLORS.outForDelivery,
  delivered: COLORS.delivered,
  cancelled: COLORS.cancelled,
  rejected: COLORS.error,
};
