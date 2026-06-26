import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS, FREE_DELIVERY_THRESHOLD, DELIVERY_FEE } from "../../../constants/theme";
import { useCartStore } from "../../../stores/cartStore";
import QuantityStepper from "../../../components/common/QuantityStepper";
import Button from "../../../components/common/Button";

export default function BasketScreen() {
  const router = useRouter();
  const { items, totalItems, totalAmount, fetchCart, updateItem, removeItem, clearCart, isLoading } = useCartStore();

  useEffect(() => {
    fetchCart();
  }, []);

  const deliveryFee = totalAmount >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const grandTotal = totalAmount + deliveryFee;

  const handleClearCart = () => {
    Alert.alert("Clear Basket", "Remove all items from your basket?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => clearCart() },
    ]);
  };

  // Empty state
  if (!isLoading && items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Basket</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="basket-outline" size={80} color={COLORS.border} />
          <Text style={styles.emptyTitle}>Your basket is empty</Text>
          <Text style={styles.emptySub}>Add items from our services to get started</Text>
          <Button
            title="Browse Services"
            onPress={() => router.push("/(tabs)/home")}
            style={{ marginTop: SPACING.xl }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Basket</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleClearCart}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Items */}
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.service_id}_${item.item_id}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 220 }}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemTop}>
              <View style={styles.itemInfo}>
                <Text style={styles.serviceBadge}>{item.service_name}</Text>
                <Text style={styles.itemName}>{item.item_name}</Text>
                <Text style={styles.itemPrice}>₹{item.price} each</Text>
              </View>
              <TouchableOpacity
                onPress={() => removeItem(item.service_id, item.item_id)}
                style={styles.removeBtn}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>

            <View style={styles.itemBottom}>
              <QuantityStepper
                quantity={item.quantity}
                onIncrement={() => updateItem(item.service_id, item.item_id, item.quantity + 1)}
                onDecrement={() => {
                  if (item.quantity <= 1) {
                    removeItem(item.service_id, item.item_id);
                  } else {
                    updateItem(item.service_id, item.item_id, item.quantity - 1);
                  }
                }}
                min={0}
              />
              <Text style={styles.itemSubtotal}>₹{item.subtotal}</Text>
            </View>
          </View>
        )}
      />

      {/* Pricing Footer */}
      {items.length > 0 && (
        <View style={styles.footer}>
          {/* Price Breakdown */}
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Subtotal ({totalItems} {totalItems === 1 ? "item" : "items"})</Text>
            <Text style={styles.priceValue}>₹{totalAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Delivery Fee</Text>
            {deliveryFee === 0 ? (
              <Text style={[styles.priceValue, { color: COLORS.success }]}>FREE</Text>
            ) : (
              <Text style={styles.priceValue}>₹{deliveryFee}</Text>
            )}
          </View>
          {deliveryFee > 0 && (
            <Text style={styles.freeDeliveryHint}>
              Add ₹{(FREE_DELIVERY_THRESHOLD - totalAmount).toFixed(0)} more for free delivery
            </Text>
          )}
          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{grandTotal.toFixed(2)}</Text>
          </View>

          <Button
            title="Proceed to Schedule"
            onPress={() => router.push("/(tabs)/basket/checkout")}
            style={{ marginTop: SPACING.md }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.black,
  },
  clearText: {
    fontSize: 14,
    color: COLORS.error,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.xxxl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  emptySub: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: SPACING.sm,
  },
  itemCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  itemInfo: {
    flex: 1,
  },
  serviceBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.gold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  itemPrice: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  removeBtn: {
    padding: SPACING.xs,
  },
  itemBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SPACING.md,
  },
  itemSubtotal: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.black,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.xs,
  },
  priceLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  freeDeliveryHint: {
    fontSize: 11,
    color: COLORS.gold,
    fontWeight: "600",
    marginBottom: SPACING.sm,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.black,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.forestGreen,
  },
});
