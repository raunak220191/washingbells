/**
 * E7 — iPad presentation decision (documented):
 * The store app keeps its phone-first layout, but on wide screens (iPad /
 * large tablets) content is constrained to a centered 700pt column instead of
 * stretching edge-to-edge. Full adaptive tablet layouts were deliberately
 * deferred; this removes the "stretched phone app" look on the client's iPad
 * with zero per-screen redesign risk.
 */
import { View, StyleSheet } from "react-native";

export default function TabletContainer({ children, style }) {
  return <View style={[styles.column, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
  },
});
