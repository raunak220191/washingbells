import React from "react";
import { Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { COLORS, SPACING, RADIUS, TYPE } from "../../constants/theme";

/**
 * Chip — ONE compact pill. Single fixed height, full radius. Identical in every
 * selected/unselected state on every screen. Designed to live inside a
 * horizontally-scrollable row so it is never clipped.
 */
export default function Chip({ label, active = false, onPress, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive, style]}
    >
      <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * ChipRow — horizontal scroll container for chips. Bleeds to the screen edge by
 * cancelling the canonical Screen padding, so chips are never clipped and scroll
 * fully to the right edge.
 */
export function ChipRow({ children, style }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.rowScroll, style]}
      contentContainerStyle={styles.rowContent}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm,
  },
  chipActive: {
    borderColor: COLORS.forestGreen,
    backgroundColor: COLORS.forestGreen,
  },
  text: {
    ...TYPE.label,
    color: COLORS.textLight,
  },
  textActive: {
    color: COLORS.white,
    fontWeight: "700",
  },
  rowScroll: {
    marginHorizontal: -SPACING.lg,
  },
  rowContent: {
    paddingHorizontal: SPACING.lg,
    alignItems: "center",
  },
});
