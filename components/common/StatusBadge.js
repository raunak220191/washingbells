import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SPACING, RADIUS, TYPE } from "../../constants/theme";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "../../constants/theme";

/**
 * StatusBadge — renders an order status as a soft, tinted pill. ONE source of
 * truth for both the list and the detail screen, so the label text and casing
 * are identical everywhere. Never uppercase in one place and title-case in another.
 */
export default function StatusBadge({ status, style }) {
  const color = ORDER_STATUS_COLORS[status] || COLORS.textMuted;
  const label = ORDER_STATUS_LABELS[status] || (status ? String(status) : "—");

  return (
    <View style={[styles.badge, { backgroundColor: tint(color) }, style]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// 14% alpha tint of the status color for the pill background.
function tint(hex) {
  return hex.length === 7 ? `${hex}24` : hex;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
  },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: SPACING.sm },
  text: { ...TYPE.label },
});
