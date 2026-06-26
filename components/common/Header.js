import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, TYPE, ICON } from "../../constants/theme";

const HIT = { top: 12, bottom: 12, left: 12, right: 12 };

/**
 * Header — fixed-height (56) screen header. Back button + centered title +
 * optional right slot. Identical position on every screen.
 *
 * Props:
 *  - title     centered title text
 *  - onBack    if provided, renders a back chevron (≥48dp touch target)
 *  - right     optional React node pinned to the right
 *  - border    show a hairline bottom border (default false)
 */
export default function Header({ title, onBack, right, border = false }) {
  return (
    <View style={[styles.row, border && styles.border]}>
      <View style={styles.side}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            hitSlop={HIT}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={ICON.md} color={COLORS.black} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const SIDE_W = 44;

const styles = StyleSheet.create({
  row: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  side: { width: SIDE_W, justifyContent: "center" },
  sideRight: { alignItems: "flex-end" },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  title: {
    flex: 1,
    textAlign: "center",
    ...TYPE.h2,
    color: COLORS.black,
  },
});
