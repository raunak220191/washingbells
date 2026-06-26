import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING, SHADOWS } from "../../constants/theme";

/**
 * BottomBar — a pinned action bar at the bottom of a screen. Owns its own
 * bottom safe-area inset and the upward brand shadow, so screens stop
 * re-implementing this block. Place it as the last child of a Screen (it
 * positions absolutely).
 */
export default function BottomBar({ children, style }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: SPACING.md + insets.bottom },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    ...SHADOWS.bar,
  },
});
