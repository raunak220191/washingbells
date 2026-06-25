import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";

export default function QuantityStepper({ quantity, onIncrement, onDecrement, min = 0, max = 50 }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onDecrement}
        disabled={quantity <= min}
        style={[styles.btn, quantity <= min && styles.btnDisabled]}
      >
        <Ionicons name="remove" size={18} color={quantity <= min ? "#CCC" : COLORS.forestGreen} />
      </TouchableOpacity>

      <Text style={styles.qty}>{quantity}</Text>

      <TouchableOpacity
        onPress={onIncrement}
        disabled={quantity >= max}
        style={[styles.btn, quantity >= max && styles.btnDisabled]}
      >
        <Ionicons name="add" size={18} color={quantity >= max ? "#CCC" : COLORS.forestGreen} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.mintGreen,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  btnDisabled: {
    opacity: 0.4,
  },
  qty: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.forestGreen,
    minWidth: 28,
    textAlign: "center",
  },
});
