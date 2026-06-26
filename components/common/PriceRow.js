import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SPACING, TYPE } from "../../constants/theme";

/**
 * PriceRow — a label ↔ value row for bills and order summaries. Consistent
 * baseline everywhere. Use `emphasis` for the grand total and `free` to render
 * a struck/positive value (e.g. waived delivery).
 *
 * Pass `value` as a number to auto-format as ₹, or a string to render verbatim.
 */
export default function PriceRow({
  label,
  value,
  emphasis = false,
  muted = false,
  free = false,
  positive = false,
  style,
}) {
  const display =
    typeof value === "number" ? `₹${value.toFixed(value % 1 === 0 ? 0 : 2)}` : value;

  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.label, emphasis && styles.labelEmphasis, muted && styles.muted]}>
        {label}
      </Text>
      <Text
        style={[
          styles.value,
          emphasis && styles.valueEmphasis,
          muted && styles.muted,
          (free || positive) && styles.free,
        ]}
      >
        {free ? "FREE" : display}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.xs,
  },
  label: { ...TYPE.body, color: COLORS.textLight },
  value: { ...TYPE.body, color: COLORS.text, fontWeight: "600" },
  labelEmphasis: { ...TYPE.h3, color: COLORS.black },
  valueEmphasis: { ...TYPE.h3, color: COLORS.forestGreen },
  muted: { color: COLORS.textMuted },
  free: { color: COLORS.success, fontWeight: "700" },
});
