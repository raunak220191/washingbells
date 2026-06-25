import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";
import { tileCategories } from "../../constants/categories";

export default function CategoryRow({ onCategoryPress }) {
  const tiles = tileCategories();
  return (
    <View style={styles.wrap}>
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.sectionTitle}>Shop by Category</Text>
        <View style={styles.line} />
      </View>
      <View style={styles.grid}>
        {tiles.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => onCategoryPress(cat.key)}
          >
            <View style={[styles.iconBox, { backgroundColor: cat.color }]}>
              <Ionicons name={cat.icon} size={24} color={COLORS.white} />
            </View>
            <Text style={styles.label}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: SPACING.sm },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  line: { flex: 1, height: 1, backgroundColor: COLORS.border },
  sectionTitle: {
    paddingHorizontal: SPACING.sm,
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: "bold",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
  },
  card: {
    width: "31%",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    alignItems: "center",
    paddingVertical: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  label: { fontSize: 12, fontWeight: "700", color: COLORS.text },
});
