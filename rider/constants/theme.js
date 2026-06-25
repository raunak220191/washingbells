// WashingBells Rider App — Design Tokens
// Same brand as customer app, with rider-specific accents

export const COLORS = {
  // Primary brand — Washing Bells green + gold
  forestGreen: "#006241", // Deep Emerald (primary brand)
  darkForest: "#003D2B", // Dark Forest (deepest shade / headings)
  gold: "#BFA14A", // Gold (premium accent)
  mintGreen: "#CFE3D8", // Pale Sage (soft light tint)
  olive: "#A8C86B", // Soft Olive (fresh accent)
  cream: "#F5F5F2", // Off-White (neutral surface)

  // Rider accent
  riderBlue: "#1976D2",
  riderBlueLight: "#E3F2FD",

  // UI
  background: "#F5F5F2",
  white: "#FFFFFF",
  black: "#1A1A1A",
  text: "#333333",
  textLight: "#666666",
  textMuted: "#888888",
  textDark: "#111111",
  border: "#EEEEEE",
  borderLight: "#F5F5F5",

  // Status
  success: "#34C759",
  error: "#FF3B30",
  warning: "#FF9500",
  info: "#007AFF",

  // Trip status colors
  assigned: "#FF9500",
  accepted: "#007AFF",
  started: "#5856D6",
  completed: "#34C759",
  cancelled: "#FF3B30",
};

export const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
};

export const RADIUS = {
  sm: 8, md: 12, lg: 16, xl: 20, full: 9999,
};

// Soft, consistent card elevation (iOS shadow + Android elevation)
export const SHADOW = {
  shadowColor: "#1A1A1A",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};
