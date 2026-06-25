export const COLORS = {
  // Primary brand — Washing Bells green + gold
  forestGreen: "#006241", // Deep Emerald (primary brand)
  darkForest: "#003D2B", // Dark Forest (deepest shade / headings)
  gold: "#BFA14A", // Gold (premium accent)
  mintGreen: "#CFE3D8", // Pale Sage (soft light tint)
  olive: "#A8C86B", // Soft Olive (fresh accent)
  cream: "#F5F5F2", // Off-White (neutral surface)
  storeOrange: "#E65100",
  storeOrangeLight: "#FFF3E0",
  background: "#F5F5F2",
  white: "#FFFFFF",
  black: "#1A1A1A",
  text: "#333333",
  textLight: "#666666",
  textMuted: "#888888",
  textDark: "#111111",
  border: "#EEEEEE",
  borderLight: "#F5F5F5",
  success: "#34C759",
  error: "#FF3B30",
  warning: "#FF9500",
  info: "#007AFF",
};

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, full: 9999 };

// Soft, consistent card elevation (iOS shadow + Android elevation)
export const SHADOW = {
  shadowColor: "#1A1A1A",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

export const ORDER_STATUS_LABELS = {
  placed: "New Order",
  confirmed: "Confirmed",
  rider_assigned_pickup: "Rider Assigned",
  picked_up: "Picked Up",
  at_store: "At Store",
  processing: "Processing",
  ready_for_delivery: "Ready",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_COLORS = {
  placed:                { bg: "#FFF3E0", text: "#E65100", label: "New Order" },
  confirmed:             { bg: "#E3F2FD", text: "#1565C0", label: "Confirmed" },
  rider_assigned_pickup: { bg: "#EDE7F6", text: "#4527A0", label: "Rider Assigned" },
  picked_up:             { bg: "#F3E5F5", text: "#6A1B9A", label: "Picked Up" },
  at_store:              { bg: "#FFF8E1", text: "#F57F17", label: "At Store" },
  processing:            { bg: "#E8EAF6", text: "#283593", label: "Processing" },
  ready_for_delivery:    { bg: "#E8F5E9", text: "#2E7D32", label: "Ready" },
  out_for_delivery:      { bg: "#E8EAF6", text: "#283593", label: "Out for Delivery" },
  delivered:             { bg: "#E8F5E9", text: "#2E7D32", label: "Delivered" },
  cancelled:             { bg: "#FFEBEE", text: "#C62828", label: "Cancelled" },
  rejected:              { bg: "#FFEBEE", text: "#C62828", label: "Rejected" },
};
