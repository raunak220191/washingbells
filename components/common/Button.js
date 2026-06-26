import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import { COLORS, RADIUS, SPACING, TYPE, SHADOWS } from "../../constants/theme";

/**
 * Button — the one button. Variants: primary (gold CTA), secondary (forest),
 * outline, ghost. Sizes: md (default), lg, sm.
 *
 * Disabled is an OBVIOUSLY intentional state: a warm neutral surface + muted
 * label that keeps the button's full shape — never a cold broken grey.
 */
export default function Button({
  title,
  onPress,
  variant = "primary", // primary | secondary | outline | ghost
  size = "md", // sm | md | lg
  disabled = false,
  loading = false,
  fullWidth = false,
  icon = null, // optional leading node
  style,
  textStyle,
}) {
  const isDisabled = disabled || loading;

  const palette = {
    primary: { bg: COLORS.gold, fg: COLORS.white, border: "transparent" },
    secondary: { bg: COLORS.forestGreen, fg: COLORS.white, border: "transparent" },
    outline: { bg: "transparent", fg: COLORS.forestGreen, border: COLORS.forestGreen },
    ghost: { bg: "transparent", fg: COLORS.forestGreen, border: "transparent" },
  }[variant];

  const sizing = {
    sm: { paddingVertical: 8, paddingHorizontal: SPACING.lg, font: TYPE.label },
    md: { paddingVertical: 13, paddingHorizontal: SPACING.xxl, font: TYPE.bodyLg },
    lg: { paddingVertical: 16, paddingHorizontal: SPACING.xxl, font: TYPE.bodyLg },
  }[size];

  const bg = isDisabled
    ? variant === "outline" || variant === "ghost"
      ? "transparent"
      : COLORS.disabledBg
    : palette.bg;

  const fg = isDisabled ? COLORS.disabledText : palette.fg;

  const borderColor = isDisabled
    ? variant === "outline"
      ? COLORS.disabledBg
      : "transparent"
    : palette.border;

  const elevated = variant === "primary" && !isDisabled;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={[
        styles.button,
        {
          paddingVertical: sizing.paddingVertical,
          paddingHorizontal: sizing.paddingHorizontal,
          backgroundColor: bg,
          borderColor,
          borderWidth: borderColor === "transparent" ? 0 : 1.5,
        },
        elevated && SHADOWS.card,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text style={[sizing.font, styles.text, { color: fg }, textStyle]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: { alignSelf: "stretch", width: "100%" },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  icon: { marginRight: SPACING.sm },
  text: { fontWeight: "700" },
});
