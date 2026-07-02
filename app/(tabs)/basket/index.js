import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS, TYPE, ICON, FREE_DELIVERY_THRESHOLD, DELIVERY_FEE } from "../../../constants/theme";
import { useCartStore } from "../../../stores/cartStore";
import QuantityStepper from "../../../components/common/QuantityStepper";
import Button from "../../../components/common/Button";
import Screen from "../../../components/common/Screen";
import Card from "../../../components/common/Card";
import PriceRow from "../../../components/common/PriceRow";
import BottomBar from "../../../components/common/BottomBar";

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
      <Screen>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Basket</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="basket-outline" size={ICON.hero} color={COLORS.mintGreen} />
          <Text style={styles.emptyTitle}>Your basket is empty</Text>
          <Text style={styles.emptySub}>Add items from our services to get started</Text>
          <Button
            title="Browse Services"
            onPress={() => router.push("/(tabs)/home")}
            style={{ marginTop: SPACING.xl }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Basket</Text>
        {items.length > 0 && (
          <TouchableOpacity
            onPress={handleClearCart}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => `${item.service_id}_${item.item_id}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            <View style={styles.itemTop}>
              <View style={styles.itemInfo}>
                <Text style={styles.serviceBadge}>{item.service_name}</Text>
                <Text style={styles.itemName}>{item.item_name}</Text>
                <Text style={styles.itemPrice}>
                  ₹{item.price}{item.unit === "kg" ? "/kg" : " each"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => removeItem(item.service_id, item.item_id)}
                style={styles.removeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={`Remove ${item.item_name}`}
              >
                <Ionicons name="trash-outline" size={ICON.xs} color={COLORS.error} />
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
          </Card>
        )}
      />

      {items.length > 0 && (
        <BottomBar>
          <PriceRow
            label={`Subtotal (${totalItems} ${totalItems === 1 ? "item" : "items"})`}
            value={totalAmount}
          />
          <PriceRow label="Delivery Fee" value={deliveryFee} free={deliveryFee === 0} />
          {deliveryFee > 0 && (
            <Text style={styles.freeDeliveryHint}>
              Add ₹{(FREE_DELIVERY_THRESHOLD - totalAmount).toFixed(0)} more for free delivery
            </Text>
          )}
          <PriceRow label="Total" value={grandTotal} emphasis style={styles.totalRow} />
          <Button
            title="Proceed to Schedule"
            fullWidth
            onPress={() => router.push("/(tabs)/basket/checkout")}
            style={{ marginTop: SPACING.md }}
          />
        </BottomBar>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  headerTitle: {
    ...TYPE.h1,
    color: COLORS.black,
  },
  clearText: {
    ...TYPE.label,
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
    ...TYPE.h2,
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  emptySub: {
    ...TYPE.body,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: SPACING.sm,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 240,
  },
  itemCard: {
    marginBottom: SPACING.sm,
  },
  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  itemInfo: {
    flex: 1,
  },
  serviceBadge: {
    ...TYPE.caption,
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.gold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  itemName: {
    ...TYPE.bodyLg,
    fontWeight: "600",
    color: COLORS.text,
  },
  itemPrice: {
    ...TYPE.caption,
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
    ...TYPE.h3,
    color: COLORS.black,
  },
  freeDeliveryHint: {
    ...TYPE.caption,
    color: COLORS.gold,
    fontWeight: "600",
    marginBottom: SPACING.xs,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
  },
});
