import React from "react";
import { View, ScrollView, StatusBar, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, SPACING } from "../../constants/theme";

/**
 * Screen — the root primitive every screen composes.
 *
 * Owns: safe-area insets, status-bar style, page background, and the ONE
 * canonical horizontal padding (SPACING.lg). Because every screen pads through
 * here, every header/title sits at the same offset on every screen.
 *
 * Props:
 *  - scroll   render children in a ScrollView (default false)
 *  - padded   apply the canonical horizontal padding (default true)
 *  - edges    safe-area edges (default ["top"]; tab bar owns the bottom inset)
 *  - background  page background color (default COLORS.background)
 */
export default function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ["top"],
  background = COLORS.background,
  style,
  contentContainerStyle,
}) {
  const pad = padded ? { paddingHorizontal: SPACING.lg } : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }, style]} edges={edges}>
      <StatusBar barStyle="dark-content" backgroundColor={background} />
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[pad, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, pad, contentContainerStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
});
