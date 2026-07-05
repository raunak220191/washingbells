import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Audio } from "expo-av";
import { COLORS, SPACING, RADIUS, SHADOW, ORDER_STATUS_COLORS } from "../../../constants/theme";
import { useOrderStore } from "../../../stores/orderStore";

const TABS = [
  { key: null, label: "All" },
  { key: "placed", label: "New" },
  { key: "at_store", label: "In Store" },
  { key: "processing", label: "Processing" },
  { key: "ready_for_delivery", label: "Ready" },
  { key: "delivered", label: "Done" },
];

export default function OrdersScreen() {
  const router = useRouter();
  const { orders, isLoading, fetchOrders } = useOrderStore();
  const [activeTab, setActiveTab] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const soundRef = useRef(null);
  const knownPlacedIds = useRef(null); // null = not yet initialised (first load)

  // Load alert sound once on mount
  useEffect(() => {
    let sound;
    Audio.Sound.createAsync(require("../../../assets/sounds/new-order.wav"))
      .then(({ sound: s }) => { sound = s; soundRef.current = s; })
      .catch(() => {}); // graceful degradation if audio fails
    return () => { sound?.unloadAsync(); };
  }, []);

  const playAlert = async () => {
    try {
      await soundRef.current?.replayAsync();
    } catch {}
  };

  // Poll every 10 s; detect new `placed` orders and play alert
  const pollOrders = React.useCallback(async () => {
    await fetchOrders(activeTab);
  }, [activeTab]);

  useEffect(() => {
    pollOrders();
    const interval = setInterval(pollOrders, 10000); // A4: ≤10s poll fallback
    return () => clearInterval(interval);
  }, [activeTab]);

  // Watch orders list for new `placed` entries
  useEffect(() => {
    const placedIds = new Set(orders.filter((o) => o.status === "placed").map((o) => o.id));
    if (knownPlacedIds.current === null) {
      // First load — just record current state, don't alarm
      knownPlacedIds.current = placedIds;
      return;
    }
    const hasNew = [...placedIds].some((id) => !knownPlacedIds.current.has(id));
    if (hasNew) playAlert();
    knownPlacedIds.current = placedIds;
  }, [orders]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders(activeTab);
    setRefreshing(false);
  };

  const renderOrder = ({ item: o }) => {
    const sc = ORDER_STATUS_COLORS[o.status] || ORDER_STATUS_COLORS.placed;
    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => router.push(`/(tabs)/orders/${o.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.orderTop}>
          <Text style={styles.orderNum}>{o.order_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
          </View>
        </View>
        <View style={styles.orderMid}>
          <Ionicons name="person-outline" size={13} color={COLORS.textMuted} />
          <Text style={styles.orderCustomer}>{o.customer_name}</Text>
          <Text style={styles.orderDot}>•</Text>
          <Ionicons name="shirt-outline" size={13} color={COLORS.textMuted} />
          <Text style={styles.orderItems}>{o.items_count} item{o.items_count > 1 ? "s" : ""}</Text>
        </View>
        <View style={styles.orderBottom}>
          <Text style={styles.orderAmount}>₹{o.total_amount?.toFixed(0)}</Text>
          <Text style={styles.orderPayout}>Your share: ₹{(o.total_amount * 0.8).toFixed(0)}</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>Orders</Text></View>

      {/* Tab Filter */}
      <FlatList
        horizontal
        data={TABS}
        keyExtractor={(t) => String(t.key)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabList}
        renderItem={({ item: t }) => (
          <TouchableOpacity
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        )}
      />

      {isLoading && !refreshing ? (
        <ActivityIndicator color={COLORS.storeOrange} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.storeOrange} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No orders</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg },
  headerTitle: { fontSize: 24, fontWeight: "700", color: COLORS.black },
  tabList: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, gap: SPACING.sm },
  tab: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.full, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  tabActive: { backgroundColor: COLORS.storeOrange, borderColor: COLORS.storeOrange },
  tabText: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
  tabTextActive: { color: COLORS.white },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },
  orderCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOW },
  orderTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm },
  orderNum: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.sm },
  statusText: { fontSize: 11, fontWeight: "700" },
  orderMid: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: SPACING.sm },
  orderCustomer: { fontSize: 13, color: COLORS.textLight },
  orderDot: { color: COLORS.textMuted },
  orderItems: { fontSize: 13, color: COLORS.textLight },
  orderBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderAmount: { fontSize: 17, fontWeight: "800", color: COLORS.black },
  orderPayout: { fontSize: 12, color: COLORS.success, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginTop: SPACING.md },
});
