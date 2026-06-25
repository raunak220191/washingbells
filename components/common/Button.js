import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";
import { COLORS, RADIUS } from "../../constants/theme";

export default function Button({
  title,
  onPress,
  variant = "primary", // primary | secondary | outline
  disabled = false,
  loading = false,
  style,
  textStyle,
}) {
  const bgColor =
    variant === "primary"
      ? COLORS.gold
      : variant === "secondary"
      ? COLORS.forestGreen
      : "transparent";

  const txtColor =
    variant === "outline" ? COLORS.forestGreen : COLORS.white;

  const borderStyle =
    variant === "outline"
      ? { borderWidth: 1.5, borderColor: COLORS.forestGreen }
      : {};

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.button,
        { backgroundColor: disabled ? "#D3D3D3" : bgColor },
        borderStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={txtColor} />
      ) : (
        <Text style={[styles.text, { color: disabled ? "#999" : txtColor }, textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 16,
    fontWeight: "700",
  },
});
