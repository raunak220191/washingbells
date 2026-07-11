// SearchBar — Material-3-style search input (upgrade_last TASK 4.2).
// Leading search icon, clear "×" button. Debounce is the caller's concern;
// this stays a controlled dumb primitive per the design system.
import React from "react";
import { View, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS, TYPE, ICON } from "../../constants/theme";

export default function SearchBar({ value, onChange, placeholder = "Search", style }) {
  return (
    <View style={[styles.wrap, style]}>
      <Ionicons name="search-outline" size={ICON.sm} color={COLORS.textMuted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel={placeholder}
      />
      {value?.length > 0 && (
        <TouchableOpacity
          onPress={() => onChange("")}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={ICON.sm} color={COLORS.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 44,
  },
  input: {
    flex: 1,
    ...TYPE.body,
    color: COLORS.text,
    paddingVertical: 0,
  },
});
