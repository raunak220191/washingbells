import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS, ORDER_STATUS_LABELS } from "../../../constants/theme";
import { useOrderStore } from "../../../stores/orderStore";

const STATUS_COLORS = {
  pending_payment: COLORS.warning,
  confirmed: COLORS.info,
  picked_up: "#5856D6",
  processing: "#AF52DE",
  out_for_delivery: COLORS.success,
  delivered: COLORS.success,
  cancelled: COLORS.error,
};

export default function OrdersScreen() {
  const router = useRouter();
  const { orders, isLoading, fetchOrders } = useOrderStore();

  useEffect(() => {
    fetchOrders();
  }, []);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (isLoading && orders.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Orders</Text>
        </View>
        <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!isLoading && orders.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Orders</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="clipboard-outline" size={80} color={COLORS.border} />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySub}>Your order history will appear here</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 20 }}
        onRefresh={fetchOrders}
        refreshing={isLoading}
        renderItem={({ item: order }) => (
          <TouchableOpacity
            style={styles.orderCard}
            onPress={() => router.push(`/(tabs)/orders/${order.id}`)}
            activeOpacity={0.7}
          >
            {/* Top row */}
            <View style={styles.orderTop}>
              <Text style={styles.orderNumber}>{order.order_number}</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: (STATUS_COLORS[order.status] || COLORS.textMuted) + "20" },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: STATUS_COLORS[order.status] || COLORS.textMuted },
                  ]}
                >
                  {ORDER_STATUS_LABELS[order.status] || order.status}
                </Text>
              </View>
            </View>

            {/* Items summary */}
            <Text style={styles.itemsSummary} numberOfLines={1}>
              {order.items.map((i) => `${i.item_name} x${i.quantity}`).join(", ")}
            </Text>

            {/* Bottom row */}
            <View style={styles.orderBottom}>
              <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
              <Text style={styles.orderTotal}>₹{order.total_amount.toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.black,
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
  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.black,
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  itemsSummary: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: SPACING.md,
  },
  orderBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: SPACING.sm,
  },
  orderDate: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.forestGreen,
  },
});
