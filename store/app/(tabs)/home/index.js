import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS, SHADOW, ORDER_STATUS_COLORS } from "../../../constants/theme";
import { useAuthStore } from "../../../stores/authStore";
import { useOrderStore } from "../../../stores/orderStore";
import TabletContainer from "../../../components/TabletContainer";

export default function DashboardScreen() {
  const router = useRouter();
  const { store, refreshStore } = useAuthStore();
  const { orders, fetchOrders } = useOrderStore();
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { toggleStore } = useOrderStore();

  useEffect(() => {
    fetchOrders();
    // 10s poll — client SLA (A4): a new order must surface in-store within
    // 10s even if the push notification doesn't arrive.
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders();
    await refreshStore();
    setRefreshing(false);
  }, []);

  const handleToggle = async (val) => {
    if (!store?.approved) { Alert.alert("Not Approved", "Your store is pending admin approval."); return; }
    setToggling(true);
    try {
      await toggleStore(val);
      await refreshStore();
    } catch { Alert.alert("Error", "Could not update store status."); }
    finally { setToggling(false); }
  };

  const isOpen = store?.is_open ?? false;
  const newOrders = orders.filter(o => o.status === "placed").length;
  const activeOrders = orders.filter(o => !["delivered", "cancelled"].includes(o.status)).length;
  const todayRevenue = orders.filter(o => o.status === "delivered")
    .reduce((s, o) => s + (o.total_amount * 0.8), 0);

  const recentOrders = orders.slice(0, 5);

  return (
    <SafeAreaView style={styles.container}>
      <TabletContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.storeOrange} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good day! 👋</Text>
            <Text style={styles.storeName}>{store?.name || "Your Store"}</Text>
            <Text style={styles.vendorCode}>{store?.vendor_code || "—"}</Text>
          </View>
          {store?.approved ? (
            <View style={styles.approvedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
              <Text style={styles.approvedText}>Approved</Text>
            </View>
          ) : (
            <View style={styles.pendingBadge}>
              <Ionicons name="time-outline" size={14} color={COLORS.warning} />
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          )}
        </View>

        {/* Open/Close Toggle */}
        <View style={[styles.toggleCard, isOpen ? styles.toggleOpen : styles.toggleClosed]}>
          <View style={styles.toggleLeft}>
            <View style={[styles.statusDot, { backgroundColor: isOpen ? COLORS.success : COLORS.textMuted }]} />
            <View>
              <Text style={styles.toggleTitle}>{isOpen ? "Store is Open" : "Store is Closed"}</Text>
              <Text style={styles.toggleSub}>{isOpen ? "Accepting new orders" : "Not accepting orders"}</Text>
            </View>
          </View>
          <Switch
            value={isOpen}
            onValueChange={handleToggle}
            disabled={toggling}
            trackColor={{ false: COLORS.border, true: "#A5D6A7" }}
            thumbColor={isOpen ? COLORS.success : COLORS.textMuted}
          />
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push("/(tabs)/orders")}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.storeOrange} />
            <Text style={styles.statNum}>{newOrders}</Text>
            <Text style={styles.statLabel}>New Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push("/(tabs)/orders")}>
            <Ionicons name="time-outline" size={22} color={COLORS.info} />
            <Text style={styles.statNum}>{activeOrders}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push("/(tabs)/earnings")}>
            <Ionicons name="cash-outline" size={22} color={COLORS.success} />
            <Text style={styles.statNum}>₹{todayRevenue.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Today's Rev</Text>
          </TouchableOpacity>
        </View>

        {/* Walk-in / Counter order quick action */}
        <TouchableOpacity style={styles.walkInBtn} onPress={() => router.push("/(tabs)/home/walk-in")}>
          <View style={styles.walkInIcon}>
            <Ionicons name="storefront" size={22} color={COLORS.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.walkInTitle}>New Walk-in Order</Text>
            <Text style={styles.walkInSub}>Bill a customer at the counter</Text>
          </View>
          <Ionicons name="add-circle" size={26} color={COLORS.storeOrange} />
        </TouchableOpacity>

        {/* New Orders Alert */}
        {newOrders > 0 && (
          <TouchableOpacity style={styles.alertBanner} onPress={() => router.push("/(tabs)/orders")}>
            <Ionicons name="alert-circle" size={20} color={COLORS.white} />
            <Text style={styles.alertText}>{newOrders} new order{newOrders > 1 ? "s" : ""} waiting for acceptance!</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
          </TouchableOpacity>
        )}

        {/* Recent Orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/orders")}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {recentOrders.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No orders yet</Text>
              <Text style={styles.emptySub}>Open your store to start receiving orders</Text>
            </View>
          ) : (
            recentOrders.map((order) => {
              const sc = ORDER_STATUS_COLORS[order.status] || ORDER_STATUS_COLORS.placed;
              return (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderRow}
                  onPress={() => router.push(`/(tabs)/orders/${order.id}`)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderNum}>{order.order_number}</Text>
                    <Text style={styles.orderCustomer}>{order.customer_name} • {order.items_count} item{order.items_count > 1 ? "s" : ""}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.orderAmount}>₹{order.total_amount?.toFixed(0)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
      </TabletContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg },
  greeting: { fontSize: 14, color: COLORS.textMuted },
  storeName: { fontSize: 22, fontWeight: "800", color: COLORS.black },
  vendorCode: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  approvedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E8F5E9", paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full },
  approvedText: { fontSize: 11, color: COLORS.success, fontWeight: "700" },
  pendingBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF3E0", paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full },
  pendingText: { fontSize: 11, color: COLORS.warning, fontWeight: "700" },
  toggleCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: SPACING.lg, padding: SPACING.lg, borderRadius: RADIUS.lg, marginBottom: SPACING.md, borderWidth: 1.5, ...SHADOW },
  toggleOpen: { backgroundColor: "#F1F8E9", borderColor: "#A5D6A7" },
  toggleClosed: { backgroundColor: COLORS.white, borderColor: COLORS.border },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  toggleTitle: { fontSize: 15, fontWeight: "700", color: COLORS.black },
  toggleSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  statsRow: { flexDirection: "row", paddingHorizontal: SPACING.lg, gap: SPACING.sm, marginBottom: SPACING.md },
  statCard: { flex: 1, backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.lg, alignItems: "center", borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOW },
  statNum: { fontSize: 18, fontWeight: "800", color: COLORS.black, marginTop: 4 },
  statLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 2, textAlign: "center" },
  alertBanner: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.storeOrange, marginHorizontal: SPACING.lg, padding: SPACING.lg, borderRadius: RADIUS.lg, marginBottom: SPACING.md, ...SHADOW, shadowColor: COLORS.storeOrange, shadowOpacity: 0.25 },
  walkInBtn: { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: COLORS.white, marginHorizontal: SPACING.lg, padding: SPACING.lg, borderRadius: RADIUS.lg, marginBottom: SPACING.md, borderWidth: 1.5, borderColor: COLORS.storeOrange, ...SHADOW },
  walkInIcon: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.storeOrange, justifyContent: "center", alignItems: "center" },
  walkInTitle: { fontSize: 15, fontWeight: "800", color: COLORS.black },
  walkInSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  alertText: { flex: 1, color: COLORS.white, fontWeight: "700", fontSize: 14 },
  section: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  seeAll: { fontSize: 13, color: COLORS.storeOrange, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: SPACING.xxxl },
  emptyText: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginTop: SPACING.md },
  emptySub: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  orderRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOW },
  orderNum: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  orderCustomer: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  orderAmount: { fontSize: 15, fontWeight: "700", color: COLORS.forestGreen },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.sm, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: "700" },
});
