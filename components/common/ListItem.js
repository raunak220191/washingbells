import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS, TYPE, ICON } from "../../constants/theme";

/**
 * ListItem — a consistent row. Optional leading icon (name or node) +
 * title/subtitle + trailing (chevron by default, or a custom node, or none).
 *
 * Props:
 *  - leadingIcon   Ionicons name; rendered in a tinted square
 *  - leadingColor  tint for the icon square (default forestGreen on mint)
 *  - leading       custom leading node (overrides leadingIcon)
 *  - title, subtitle
 *  - trailing      custom right node; if omitted and onPress set, a chevron shows
 *  - chevron       force show/hide the chevron
 */
export default function ListItem({
  leadingIcon,
  leadingColor = COLORS.forestGreen,
  leadingBg = COLORS.mintGreen,
  leading,
  title,
  subtitle,
  trailing,
  chevron,
  onPress,
  style,
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  const showChevron = chevron ?? (!!onPress && !trailing);

  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.row, style]}
      accessibilityRole={onPress ? "button" : undefined}
    >
      {leading ? (
        <View style={styles.leadingWrap}>{leading}</View>
      ) : leadingIcon ? (
        <View style={[styles.iconBox, { backgroundColor: leadingBg }]}>
          <Ionicons name={leadingIcon} size={ICON.sm} color={leadingColor} />
        </View>
      ) : null}

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing ? (
        <View style={styles.trailing}>{trailing}</View>
      ) : showChevron ? (
        <Ionicons name="chevron-forward" size={ICON.sm} color={COLORS.textMuted} />
      ) : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
  },
  leadingWrap: { marginRight: SPACING.md },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  body: { flex: 1 },
  title: { ...TYPE.bodyLg, color: COLORS.black },
  subtitle: { ...TYPE.bodySm, color: COLORS.textLight, marginTop: 2 },
  trailing: { marginLeft: SPACING.sm },
});
