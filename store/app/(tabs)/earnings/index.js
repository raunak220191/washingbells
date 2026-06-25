import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../../constants/theme";
import { useOrderStore } from "../../../stores/orderStore";
import { useAuthStore } from "../../../stores/authStore";
import { printOrderInvoice, shareOrderInvoice } from "../../../lib/printTags";

function fmtDate(d) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch (e) { return String(d); }
}

export default function BillingScreen() {
  const { getEarnings, getPayouts, fetchOrders, orders } = useOrderStore();
  const { store } = useAuthStore();
  const [earnings, setEarnings] = useState(null);
  const [payouts, setPayouts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const loadAll = async () => {
    try {
      const [e, p] = await Promise.all([getEarnings(), getPayouts()]);
      setEarnings(e);
      setPayouts(p);
      await fetchOrders();
    } catch (e) {
      console.log("Billing load error:", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleInvoice = async (order) => {
    setBusyId(order.id);
    try {
      await printOrderInvoice(order.id, order.order_number);
    } catch (e) {
      // Fall back to share sheet if printing isn't available
      try { await shareOrderInvoice(order.id, order.order_number); }
      catch (err) { Alert.alert("Invoice", err?.message || "Could not open invoice."); }
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>Billing & Earnings</Text></View>
        <ActivityIndicator color={COLORS.storeOrange} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const totalEarnings = payouts?.total_earnings ?? store?.total_earnings ?? 0;
  const pendingPayout = payouts?.pending_payout ?? store?.pending_payout ?? 0;
  const totalPaidOut = payouts?.total_paid_out ?? 0;
  const history = payouts?.history || [];
  const recentOrders = (orders || []).slice(0, 10);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Billing & Earnings</Text>
        <Text style={styles.vendorCode}>{store?.vendor_code}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.storeOrange} />}
      >
        {/* Total Earnings Card */}
        <View style={styles.earningsCard}>
          <Text style={styles.cardLabel}>Total Lifetime Earnings</Text>
          <Text style={styles.cardAmount}>₹{Number(totalEarnings).toFixed(2)}</Text>
          <Text style={styles.cardSub}>Your 80% share of completed orders</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={22} color={COLORS.warning} />
            <Text style={styles.statAmount}>₹{Number(pendingPayout).toFixed(0)}</Text>
            <Text style={styles.statLabel}>Pending Payout</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={22} color={COLORS.success} />
            <Text style={styles.statAmount}>₹{Number(totalPaidOut).toFixed(0)}</Text>
            <Text style={styles.statLabel}>Paid Out</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.info} />
            <Text style={styles.statAmount}>{earnings?.total_completed_orders || 0}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
          </View>
        </View>

        {/* Payout History */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payout History</Text>
          {history.length === 0 ? (
            <Text style={styles.emptyText}>No payouts settled yet. Pending balance is settled by admin to your bank account.</Text>
          ) : (
            history.map((p) => (
              <View key={p.id} style={styles.payoutRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payoutAmount}>₹{Number(p.amount).toFixed(2)}</Text>
                  <Text style={styles.payoutMeta}>
                    {fmtDate(p.created_at)}{p.reference ? ` · Ref: ${p.reference}` : ""}
                  </Text>
                </View>
                <View style={styles.paidBadge}><Text style={styles.paidBadgeText}>PAID</Text></View>
              </View>
            ))
          )}
        </View>

        {/* Recent Invoices */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recent Bills</Text>
          {recentOrders.length === 0 ? (
            <Text style={styles.emptyText}>No orders yet.</Text>
          ) : (
            recentOrders.map((o) => (
              <View key={o.id} style={styles.billRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.billNumber}>{o.order_number}</Text>
                  <Text style={styles.billMeta}>
                    {o.customer_name || "Customer"} · ₹{Number(o.total_amount).toFixed(0)}
                    {o.order_source === "walk_in" ? " · Walk-in" : ""}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.billBtn}
                  onPress={() => handleInvoice(o)}
                  disabled={busyId === o.id}
                >
                  {busyId === o.id ? (
                    <ActivityIndicator size="small" color={COLORS.storeOrange} />
                  ) : (
                    <>
                      <Ionicons name="document-text-outline" size={15} color={COLORS.storeOrange} />
                      <Text style={styles.billBtnText}>Bill</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Payout Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.info} />
          <Text style={styles.infoText}>
            Pending balances are settled by admin to your registered bank account. Bills are GST tax invoices generated per order.
          </Text>
        </View>

        {/* Store Info */}
        <View style={styles.storeCard}>
          <Text style={styles.sectionTitle}>Store Details</Text>
          {[
            { icon: "storefront-outline", label: "Store Name", value: store?.name },
            { icon: "document-outline", label: "GSTIN", value: store?.gst_number },
            { icon: "call-outline", label: "Phone", value: store?.phone },
            { icon: "barcode-outline", label: "Vendor Code", value: store?.vendor_code },
          ].map((item, i) => (
            <View key={i} style={styles.storeRow}>
              <Ionicons name={item.icon} size={16} color={COLORS.storeOrange} />
              <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                <Text style={styles.storeLabel}>{item.label}</Text>
                <Text style={styles.storeValue}>{item.value || "—"}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg },
  headerTitle: { fontSize: 24, fontWeight: "700", color: COLORS.black },
  vendorCode: { fontSize: 13, fontWeight: "700", color: COLORS.storeOrange, backgroundColor: COLORS.storeOrangeLight, paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: RADIUS.full },
  earningsCard: { margin: SPACING.lg, backgroundColor: COLORS.storeOrange, borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: "center" },
  cardLabel: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: "600" },
  cardAmount: { fontSize: 40, fontWeight: "900", color: COLORS.white, marginVertical: SPACING.sm },
  cardSub: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  statsRow: { flexDirection: "row", paddingHorizontal: SPACING.lg, gap: SPACING.sm, marginBottom: SPACING.md },
  statCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: "center", borderWidth: 1, borderColor: COLORS.borderLight },
  statAmount: { fontSize: 18, fontWeight: "800", color: COLORS.black, marginTop: SPACING.sm },
  statLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 2, textAlign: "center" },
  card: { backgroundColor: COLORS.white, marginHorizontal: SPACING.lg, marginBottom: SPACING.md, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.borderLight },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.black, marginBottom: SPACING.md },
  emptyText: { fontSize: 12, color: COLORS.textMuted, lineHeight: 18 },
  payoutRow: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  payoutAmount: { fontSize: 15, fontWeight: "700", color: COLORS.black },
  payoutMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  paidBadge: { backgroundColor: "#E8F5E9", paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  paidBadgeText: { fontSize: 10, fontWeight: "800", color: COLORS.success },
  billRow: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  billNumber: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  billMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  billBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1.5, borderColor: COLORS.storeOrange, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 6, minWidth: 60, justifyContent: "center" },
  billBtnText: { color: COLORS.storeOrange, fontWeight: "700", fontSize: 12 },
  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm, backgroundColor: "#E3F2FD", marginHorizontal: SPACING.lg, marginBottom: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.lg },
  infoText: { flex: 1, fontSize: 12, color: "#1565C0", lineHeight: 18 },
  storeCard: { backgroundColor: COLORS.white, marginHorizontal: SPACING.lg, marginBottom: 40, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.borderLight },
  storeRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  storeLabel: { fontSize: 11, color: COLORS.textMuted },
  storeValue: { fontSize: 14, color: COLORS.text, fontWeight: "500", marginTop: 1 },
});
