import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS } from "../../../constants/theme";
import { useOrderStore } from "../../../stores/orderStore";
import RescheduleModal from "../../../components/RescheduleModal";
import api from "../../../lib/api";
import { printInvoice, shareInvoice } from "../../../lib/invoice";

const LIFECYCLE = ["placed", "picked_up", "in_progress", "packed", "delivered"];
const LIFECYCLE_LABELS = { placed: "Order Placed", picked_up: "Picked Up", in_progress: "In Progress", packed: "Packed & Ready", delivered: "Delivered" };

function getStepState(currentStatus, stepStatus) {
  if (currentStatus === "cancelled") return "cancelled";
  const ci = LIFECYCLE.indexOf(currentStatus);
  const si = LIFECYCLE.indexOf(stepStatus);
  if (si < ci) return "done";
  if (si === ci) return "active";
  return "future";
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { currentOrder, fetchOrder, cancelOrder } = useOrderStore();
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [billLoading, setBillLoading] = useState(false);

  useEffect(() => { fetchOrder(id).finally(() => setLoading(false)); }, [id]);

  const order = currentOrder;

  const handleCancel = () => {
    Alert.alert("Cancel Order", "Are you sure?", [
      { text: "No" },
      { text: "Yes, Cancel", style: "destructive", onPress: async () => {
        try { await cancelOrder(id); Alert.alert("Cancelled", "Order has been cancelled."); }
        catch (e) { Alert.alert("Error", e?.response?.data?.detail || "Cannot cancel"); }
      }},
    ]);
  };

  const handleDownloadBill = async () => {
    setBillLoading(true);
    try {
      await printInvoice(id, order?.order_number);
    } catch (e) {
      try { await shareInvoice(id, order?.order_number); }
      catch (e2) { Alert.alert("Invoice", e?.message || e2?.message || "Could not open the invoice."); }
    } finally { setBillLoading(false); }
  };

  const handlePayNow = async () => {
    setPayLoading(true);
    try {
      const payRes = await api.post("/payments/create", { order_id: id });
      await api.post("/payments/verify", {
        order_id: id, razorpay_order_id: payRes.data.razorpay_order_id,
        razorpay_payment_id: `pay_dev_${Date.now()}`, razorpay_signature: "dev_signature",
      });
      Alert.alert("Paid!", "Payment successful.");
      fetchOrder(id);
    } catch (e) { Alert.alert("Error", "Payment failed. Try again."); }
    finally { setPayLoading(false); }
  };

  if (loading) return (<View style={styles.center}><ActivityIndicator size="large" color={COLORS.forestGreen} /></View>);
  if (!order) return (<View style={styles.center}><Text>Order not found</Text></View>);

  const isCODPending = order.payment_method === "cod" && order.payment_status === "cod_pending";
  const canCancel = ["placed", "pending_payment", "confirmed"].includes(order.status);
  const canReschedule = ["placed", "pending_payment", "confirmed", "rider_assigned_pickup"].includes(order.status);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Order Info */}
        <View style={styles.section}>
          <View style={styles.orderInfoRow}>
            <View>
              <Text style={styles.orderNumber}>{order.order_number}</Text>
              <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: order.status === "delivered" ? COLORS.success : order.status === "cancelled" ? COLORS.error : COLORS.gold }]}>
              <Text style={styles.statusText}>{order.status.replace(/_/g, " ").toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.totalAmount}>₹{order.total_amount.toFixed(2)}</Text>
          {order.payment_method === "cod" && <Text style={styles.codLabel}>💵 Cash on Delivery</Text>}
        </View>

        {/* Status Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Lifecycle</Text>
          {LIFECYCLE.map((step, i) => {
            const state = getStepState(order.status, step);
            const tlEntry = order.status_timeline?.find(t => t.status === step);
            return (
              <View key={step} style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, state === "done" && styles.dotDone, state === "active" && styles.dotActive, state === "cancelled" && styles.dotCancelled]} >
                    {state === "done" && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
                    {state === "active" && <View style={styles.dotPulse} />}
                  </View>
                  {i < LIFECYCLE.length - 1 && <View style={[styles.timelineLine, state === "done" && styles.lineDone]} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineLabel, state === "active" && { fontWeight: "800", color: COLORS.forestGreen }]}>{LIFECYCLE_LABELS[step]}</Text>
                  {tlEntry && <Text style={styles.timelineTime}>{new Date(tlEntry.timestamp).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</Text>}
                </View>
              </View>
            );
          })}
          {order.status === "cancelled" && (
            <View style={styles.cancelledBanner}><Ionicons name="close-circle" size={18} color={COLORS.error} /><Text style={styles.cancelledText}>Order Cancelled</Text></View>
          )}
        </View>

        {/* Agent Info */}
        {order.agent_info && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Agent</Text>
            <View style={styles.agentCard}>
              <View style={styles.agentAvatar}><Text style={styles.agentInitial}>{order.agent_info.name?.charAt(0)}</Text></View>
              <View style={{ flex: 1, marginLeft: SPACING.md }}>
                <Text style={styles.agentName}>{order.agent_info.name}</Text>
                <Text style={styles.agentPhone}>{order.agent_info.phone}</Text>
              </View>
              <TouchableOpacity><Ionicons name="call-outline" size={22} color={COLORS.forestGreen} /></TouchableOpacity>
            </View>
          </View>
        )}

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          {order.items?.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.item_name} <Text style={styles.itemQty}>x{item.quantity}</Text></Text>
              <Text style={styles.itemPrice}>₹{item.subtotal.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Garment Tags */}
        {order.garment_tags?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Garment Tags</Text>
            <View style={styles.tagGrid}>
              {order.garment_tags.map((tag, i) => (
                <View key={i} style={styles.tagChip}>
                  <Ionicons name="pricetag-outline" size={12} color={COLORS.forestGreen} />
                  <Text style={styles.tagCode}>{tag.tag_code}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Billing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Billing</Text>
          <View style={styles.billRow}><Text style={styles.billLabel}>Subtotal</Text><Text style={styles.billVal}>₹{order.subtotal.toFixed(2)}</Text></View>
          <View style={styles.billRow}><Text style={styles.billLabel}>Delivery</Text><Text style={[styles.billVal, order.delivery_fee === 0 && { color: COLORS.success }]}>{order.delivery_fee === 0 ? "FREE" : `₹${order.delivery_fee}`}</Text></View>
          {order.discount > 0 && <View style={styles.billRow}><Text style={styles.billLabel}>Discount</Text><Text style={[styles.billVal, { color: COLORS.success }]}>-₹{order.discount.toFixed(2)}</Text></View>}
          {(order.wallet_applied || 0) > 0 && <View style={styles.billRow}><Text style={styles.billLabel}>Wallet</Text><Text style={[styles.billVal, { color: COLORS.success }]}>-₹{order.wallet_applied.toFixed(2)}</Text></View>}
          <View style={[styles.billRow, { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm, marginTop: SPACING.xs }]}>
            <Text style={styles.billTotal}>Total</Text><Text style={styles.billTotalVal}>₹{order.total_amount.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.billBtn} onPress={handleDownloadBill} disabled={billLoading}>
            {billLoading ? <ActivityIndicator color={COLORS.forestGreen} /> : (
              <><Ionicons name="document-text-outline" size={17} color={COLORS.forestGreen} /><Text style={styles.billBtnText}>Download Bill / GST Invoice</Text></>
            )}
          </TouchableOpacity>
        </View>

        {/* Pickup/Delivery Schedule */}
        <View style={styles.section}>
          {order.order_source === "walk_in" ? (
            <View style={styles.scheduleRow}>
              <View style={styles.scheduleBlock}>
                <Ionicons name="storefront-outline" size={18} color={COLORS.gold} />
                <Text style={styles.scheduleLabel}>Order type</Text>
                <Text style={styles.scheduleVal}>Walk-in at store</Text>
              </View>
              <View style={styles.scheduleBlock}>
                <Ionicons name={order.fulfillment_mode === "counter_pickup" ? "bag-check-outline" : "bicycle-outline"} size={18} color={COLORS.forestGreen} />
                <Text style={styles.scheduleLabel}>Collection</Text>
                <Text style={styles.scheduleVal}>{order.fulfillment_mode === "counter_pickup" ? "Counter pickup" : "Rider delivery"}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.scheduleRow}>
              <View style={styles.scheduleBlock}><Ionicons name="arrow-up-circle-outline" size={18} color={COLORS.gold} /><Text style={styles.scheduleLabel}>Pickup</Text><Text style={styles.scheduleVal}>{order.pickup_slot?.date} · {order.pickup_slot?.slot}</Text></View>
              <View style={styles.scheduleBlock}><Ionicons name="arrow-down-circle-outline" size={18} color={COLORS.forestGreen} /><Text style={styles.scheduleLabel}>Delivery</Text><Text style={styles.scheduleVal}>{order.delivery_slot?.date} · {order.delivery_slot?.slot}</Text></View>
            </View>
          )}
        </View>

        {order.special_instructions && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            <Text style={styles.instructions}>{order.special_instructions}</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomBar}>
        {isCODPending && (
          <TouchableOpacity style={styles.payNowBtn} onPress={handlePayNow} disabled={payLoading}>
            {payLoading ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="card" size={18} color={COLORS.white} /><Text style={styles.payNowText}>Pay Now ₹{order.total_amount.toFixed(0)}</Text></>}
          </TouchableOpacity>
        )}
        {canReschedule && (
          <TouchableOpacity style={styles.rescheduleBtn} onPress={() => setShowReschedule(true)}>
            <Ionicons name="calendar-outline" size={17} color={COLORS.forestGreen} />
            <Text style={styles.rescheduleText}>Reschedule</Text>
          </TouchableOpacity>
        )}
        {canCancel && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel Order</Text>
          </TouchableOpacity>
        )}
      </View>

      <RescheduleModal
        visible={showReschedule}
        orderId={id}
        accent={COLORS.forestGreen}
        onClose={() => setShowReschedule(false)}
        onDone={() => { setShowReschedule(false); fetchOrder(id); Alert.alert("Rescheduled", "Your pickup time has been updated."); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: COLORS.black },
  section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.xl },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.black, marginBottom: SPACING.md },
  orderInfoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderNumber: { fontSize: 18, fontWeight: "800", color: COLORS.forestGreen },
  orderDate: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: COLORS.white, fontSize: 11, fontWeight: "700" },
  totalAmount: { fontSize: 22, fontWeight: "800", color: COLORS.black, marginTop: SPACING.sm },
  codLabel: { fontSize: 13, color: COLORS.gold, fontWeight: "600", marginTop: 4 },
  // Timeline
  timelineRow: { flexDirection: "row", minHeight: 50 },
  timelineLeft: { width: 30, alignItems: "center" },
  timelineDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.border, justifyContent: "center", alignItems: "center", zIndex: 1 },
  dotDone: { backgroundColor: COLORS.success },
  dotActive: { backgroundColor: COLORS.forestGreen, borderWidth: 3, borderColor: COLORS.mintGreen },
  dotCancelled: { backgroundColor: COLORS.error },
  dotPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.white },
  timelineLine: { width: 2, flex: 1, backgroundColor: COLORS.border, marginVertical: 2 },
  lineDone: { backgroundColor: COLORS.success },
  timelineContent: { flex: 1, marginLeft: SPACING.md, paddingBottom: SPACING.md },
  timelineLabel: { fontSize: 14, fontWeight: "600", color: COLORS.textDark },
  timelineTime: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  cancelledBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF0F0", padding: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.sm },
  cancelledText: { color: COLORS.error, fontWeight: "700", marginLeft: SPACING.sm },
  // Agent
  agentCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, padding: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  agentAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.mintGreen, justifyContent: "center", alignItems: "center" },
  agentInitial: { fontWeight: "800", fontSize: 18, color: COLORS.forestGreen },
  agentName: { fontWeight: "700", fontSize: 14, color: COLORS.textDark },
  agentPhone: { fontSize: 12, color: COLORS.textMuted },
  // Items
  itemRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: SPACING.xs },
  itemName: { fontSize: 14, color: COLORS.text },
  itemQty: { color: COLORS.textMuted },
  itemPrice: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  // Tags
  tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagChip: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.mintGreen, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tagCode: { fontSize: 11, fontWeight: "600", color: COLORS.forestGreen, marginLeft: 4 },
  // Billing
  billRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  billLabel: { fontSize: 13, color: COLORS.textLight },
  billVal: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  billTotal: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  billTotalVal: { fontSize: 16, fontWeight: "700", color: COLORS.forestGreen },
  billBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: SPACING.md, paddingVertical: 11, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.forestGreen },
  billBtnText: { color: COLORS.forestGreen, fontSize: 13, fontWeight: "700" },
  // Schedule
  scheduleRow: { flexDirection: "row", gap: SPACING.md },
  scheduleBlock: { flex: 1, backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  scheduleLabel: { fontSize: 12, fontWeight: "700", color: COLORS.textDark, marginTop: 4 },
  scheduleVal: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  instructions: { fontSize: 13, color: COLORS.textLight, lineHeight: 20, backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.md },
  // Bottom
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: SPACING.md, backgroundColor: COLORS.white, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.border },
  payNowBtn: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.forestGreen, paddingHorizontal: 24, paddingVertical: 14, borderRadius: RADIUS.full },
  payNowText: { color: COLORS.white, fontWeight: "700", fontSize: 15, marginLeft: 8 },
  cancelBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.error },
  cancelText: { color: COLORS.error, fontWeight: "700", fontSize: 15 },
  rescheduleBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 14, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.forestGreen },
  rescheduleText: { color: COLORS.forestGreen, fontWeight: "700", fontSize: 15 },
});
