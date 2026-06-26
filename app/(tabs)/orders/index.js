import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, SPACING, TYPE, ICON } from "../../../constants/theme";
import { useOrderStore } from "../../../stores/orderStore";
import Screen from "../../../components/common/Screen";
import Card from "../../../components/common/Card";
import StatusBadge from "../../../components/common/StatusBadge";

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
      <Screen>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Orders</Text>
        </View>
        <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 100 }} />
      </Screen>
    );
  }

  if (!isLoading && orders.length === 0) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Orders</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="clipboard-outline" size={ICON.hero} color={COLORS.mintGreen} />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySub}>Your order history will appear here</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        onRefresh={fetchOrders}
        refreshing={isLoading}
        renderItem={({ item: order }) => (
          <Card
            style={styles.orderCard}
            onPress={() => router.push(`/(tabs)/orders/${order.id}`)}
          >
            <View style={styles.orderTop}>
              <Text style={styles.orderNumber}>{order.order_number}</Text>
              <StatusBadge status={order.status} />
            </View>

            <Text style={styles.itemsSummary} numberOfLines={1}>
              {order.items.map((i) => `${i.item_name} x${i.quantity}`).join(", ")}
            </Text>

            <View style={styles.orderBottom}>
              <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
              <Text style={styles.orderTotal}>₹{order.total_amount.toFixed(2)}</Text>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  headerTitle: {
    ...TYPE.h1,
    color: COLORS.black,
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
    paddingBottom: SPACING.xl,
  },
  orderCard: {
    marginBottom: SPACING.md,
  },
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  orderNumber: {
    ...TYPE.body,
    fontWeight: "700",
    color: COLORS.black,
  },
  itemsSummary: {
    ...TYPE.bodySm,
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
    ...TYPE.caption,
    color: COLORS.textMuted,
  },
  orderTotal: {
    ...TYPE.price,
    fontWeight: "700",
    color: COLORS.forestGreen,
  },
});
