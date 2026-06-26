import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS, RADIUS, SPACING, SHADOWS } from "../../constants/theme";

/**
 * Card — the one surface container. White, RADIUS.lg, soft brand-tinted shadow,
 * canonical inner padding (SPACING.lg). Pass onPress to make it tappable.
 */
export default function Card({ children, onPress, padded = true, style, ...rest }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      style={[styles.card, padded && styles.padded, style]}
      {...rest}
    >
      {children}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    ...SHADOWS.card,
  },
  padded: { padding: SPACING.lg },
});
