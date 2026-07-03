import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS, TYPE, TINTS } from "../../../constants/theme";
import { useOrderStore } from "../../../stores/orderStore";
import { useCartStore } from "../../../stores/cartStore";
import { reorderToCart } from "../../../lib/reorder";
import RescheduleModal from "../../../components/RescheduleModal";
import Screen from "../../../components/common/Screen";
import Header from "../../../components/common/Header";
import Button from "../../../components/common/Button";
import StatusBadge from "../../../components/common/StatusBadge";
import PriceRow from "../../../components/common/PriceRow";
import BottomBar from "../../../components/common/BottomBar";
import api from "../../../lib/api";
import { printInvoice, shareInvoice } from "../../../lib/invoice";
import RazorpayCheckout from "../../../lib/RazorpayCheckout";
import { useAuthStore } from "../../../stores/authStore";

const LIFECYCLE = ["placed", "picked_up", "in_progress", "packed", "delivered"];
const LIFECYCLE_LABELS = { placed: "Order Placed", picked_up: "Picked Up", in_progress: "In Progress", packed: "Packed & Ready", delivered: "Delivered" };

// Map EVERY backend status onto the 5-step customer lifecycle so the tracker
// always highlights where the order actually is. Without this, statuses that
// aren't lifecycle keys (confirmed / at_store / processing / ready_for_delivery
// / out_for_delivery) fell through and every step rendered as "future".
const STATUS_TO_STEP = {
  placed: 0,
  pending_payment: 0,
  confirmed: 0,
  rider_assigned_pickup: 1,
  picked_up: 1,
  at_store: 2,
  processing: 2,
  in_progress: 2,
  ready_for_delivery: 3,
  packed: 3,
  out_for_delivery: 3,
  delivered: 4,
};

function getStepState(currentStatus, stepIndex) {
  if (currentStatus === "cancelled" || currentStatus === "rejected") return "cancelled";
  const ci = STATUS_TO_STEP[currentStatus] ?? 0;
  if (stepIndex < ci) return "done";
  if (stepIndex === ci) return "active";
  return "future";
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { currentOrder, fetchOrder, cancelOrder } = useOrderStore();
  const addItem = useCartStore((s) => s.addItem);
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [rzCheckout, setRzCheckout] = useState(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [billLoading, setBillLoading] = useState(false);
  const [reordering, setReordering] = useState(false);

  useEffect(() => { fetchOrder(id).finally(() => setLoading(false)); }, [id]);

  const order = currentOrder;

  const handleReorder = async () => {
    setReordering(true);
    try {
      const { added, skipped } = await reorderToCart(order, addItem);
      if (added === 0) {
        Alert.alert("Unavailable", "These items aren't available to reorder right now.");
        return;
      }
      const note = skipped > 0 ? ` (${skipped} item${skipped > 1 ? "s" : ""} no longer available)` : "";
      Alert.alert("Added to Basket", `${added} item${added > 1 ? "s" : ""} added to your basket${note}.`, [
        { text: "Keep Browsing" },
        { text: "View Basket", onPress: () => router.replace("/(tabs)/basket") },
      ]);
    } catch (e) {
      Alert.alert("Error", "Could not reorder. Please try again.");
    } finally {
      setReordering(false);
    }
  };

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

  // Real Razorpay flow — same WebView checkout the basket uses. Works for any
  // unpaid order (COD, pending, or a failed earlier attempt), including while
  // the order is out for delivery.
  const handlePayNow = async () => {
    setPayLoading(true);
    try {
      const payRes = await api.post("/payments/create", { order_id: id });
      setRzCheckout({
        options: {
          key: payRes.data.razorpay_key_id,
          order_id: payRes.data.razorpay_order_id,
          amount: payRes.data.amount,
          currency: payRes.data.currency,
          name: "WashingBells",
          description: `Order ${order?.order_number || ""}`.trim(),
          prefill: {
            name: user?.name || "",
            email: user?.email || "",
            contact: (user?.phone || "").replace("+91", ""),
          },
        },
      });
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Could not start the payment. Try again.");
    } finally { setPayLoading(false); }
  };

  const handleRzSuccess = async (data) => {
    setRzCheckout(null);
    try {
      await api.post("/payments/verify", {
        order_id: id,
        razorpay_order_id: data.razorpay_order_id,
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature: data.razorpay_signature,
      });
      Alert.alert("Paid!", "Payment successful.");
    } catch (e) {
      Alert.alert("Payment Verification Failed", "We couldn't confirm your payment. If money was deducted it will be refunded. You can retry.");
    } finally { fetchOrder(id); }
  };

  const handleRzDismiss = () => setRzCheckout(null);
  const handleRzError = (msg) => {
    setRzCheckout(null);
    Alert.alert("Payment Failed", msg || "Something went wrong with the payment.");
  };

  if (loading) return (<View style={styles.center}><ActivityIndicator size="large" color={COLORS.forestGreen} /></View>);
  if (!order) return (<View style={styles.center}><Text>Order not found</Text></View>);

  // Any unpaid, non-cancelled order can be paid in-app — cod_pending, pending,
  // or a previously failed attempt (retry) — at any stage incl. out for delivery.
  const isCODPending =
    order.payment_status !== "paid" &&
    !["cancelled", "rejected"].includes(order.status) &&
    order.total_amount > 0;
  const canCancel = ["placed", "pending_payment", "confirmed"].includes(order.status);
  const canReschedule = ["placed", "pending_payment", "confirmed", "rider_assigned_pickup"].includes(order.status);

  return (
    <Screen padded={false}>
      <View style={styles.headerPad}>
        <Header title="Order Details" onBack={() => router.back()} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Order Info */}
        <View style={styles.section}>
          <View style={styles.orderInfoRow}>
            <View>
              <Text style={styles.orderNumber}>{order.order_number}</Text>
              <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Text>
            </View>
            <StatusBadge status={order.status} />
          </View>
          <Text style={styles.totalAmount}>₹{order.total_amount.toFixed(2)}</Text>
          {order.payment_method === "cod" && <Text style={styles.codLabel}>💵 Cash on Delivery</Text>}
        </View>

        {/* Status Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Lifecycle</Text>
          {LIFECYCLE.map((step, i) => {
            const state = getStepState(order.status, i);
            const tlEntry = order.status_timeline?.find(t => (STATUS_TO_STEP[t.status] ?? -1) === i);
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

        {/* Handover OTPs — the customer reads these out to the rider */}
        {order.pickup_otp && !order.pickup_otp_verified && !["delivered", "cancelled", "rejected"].includes(order.status) && (
          <View style={styles.otpCard}>
            <Ionicons name="key-outline" size={22} color={COLORS.forestGreen} />
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={styles.otpTitle}>Pickup OTP</Text>
              <Text style={styles.otpHint}>Share this code with your rider when handing over the clothes</Text>
            </View>
            <Text style={styles.otpCode}>{order.pickup_otp}</Text>
          </View>
        )}
        {order.delivery_otp && !order.delivery_otp_verified && !["delivered", "cancelled", "rejected"].includes(order.status) && (
          <View style={styles.otpCard}>
            <Ionicons name="key-outline" size={22} color={COLORS.forestGreen} />
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={styles.otpTitle}>Delivery OTP</Text>
              <Text style={styles.otpHint}>Share this code with your rider to receive your clothes</Text>
            </View>
            <Text style={styles.otpCode}>{order.delivery_otp}</Text>
          </View>
        )}

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
              <Text style={styles.itemName}>{item.item_name} <Text style={styles.itemQty}>x{item.quantity}{item.unit === "kg" ? " kg" : ""}</Text></Text>
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
          <PriceRow label="Subtotal" value={order.subtotal} />
          <PriceRow label="Delivery" value={order.delivery_fee} free={order.delivery_fee === 0} />
          {order.discount > 0 && (
            <PriceRow label="Discount" value={`-₹${order.discount.toFixed(2)}`} positive />
          )}
          {(order.wallet_applied || 0) > 0 && (
            <PriceRow label="Wallet" value={`-₹${order.wallet_applied.toFixed(2)}`} positive />
          )}
          <PriceRow label="Total" value={order.total_amount} emphasis style={styles.billTotalRow} />
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
      <BottomBar>
        {(isCODPending || canReschedule || canCancel) && (
          <View style={styles.actionRow}>
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
        )}
        <Button
          title="Order Again"
          variant="secondary"
          fullWidth
          loading={reordering}
          onPress={handleReorder}
          style={(isCODPending || canReschedule || canCancel) ? { marginTop: SPACING.sm } : undefined}
        />
      </BottomBar>

      <RescheduleModal
        visible={showReschedule}
        orderId={id}
        accent={COLORS.forestGreen}
        onClose={() => setShowReschedule(false)}
        onDone={() => { setShowReschedule(false); fetchOrder(id); Alert.alert("Rescheduled", "Your pickup time has been updated."); }}
      />

      <RazorpayCheckout
        visible={!!rzCheckout}
        options={rzCheckout?.options}
        onSuccess={handleRzSuccess}
        onDismiss={handleRzDismiss}
        onError={handleRzError}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background },
  headerPad: { paddingHorizontal: SPACING.lg },
  section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.xl },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.black, marginBottom: SPACING.md },
  orderInfoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderNumber: { fontSize: 18, fontWeight: "800", color: COLORS.forestGreen },
  orderDate: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  totalAmount: { fontSize: 22, fontWeight: "800", color: COLORS.black, marginTop: SPACING.sm },
  codLabel: { fontSize: 13, color: COLORS.gold, fontWeight: "600", marginTop: 4 },
  // Handover OTP card
  otpCard: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: SPACING.lg, marginBottom: SPACING.xl,
    padding: SPACING.lg, borderRadius: RADIUS.md,
    backgroundColor: TINTS.successBg, borderWidth: 1, borderColor: COLORS.mintGreen,
  },
  otpTitle: { fontSize: 14, fontWeight: "800", color: COLORS.forestGreen },
  otpHint: { fontSize: 12, color: COLORS.textLight, marginTop: 2, lineHeight: 16 },
  otpCode: { fontSize: 26, fontWeight: "800", color: COLORS.forestGreen, letterSpacing: 4, marginLeft: SPACING.md },
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
  timelineLabel: { fontSize: 14, fontWeight: "600", color: COLORS.black },
  timelineTime: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  cancelledBanner: { flexDirection: "row", alignItems: "center", backgroundColor: TINTS.errorBg, padding: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.sm },
  cancelledText: { color: COLORS.error, fontWeight: "700", marginLeft: SPACING.sm },
  // Agent
  agentCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, padding: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  agentAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.mintGreen, justifyContent: "center", alignItems: "center" },
  agentInitial: { fontWeight: "800", fontSize: 18, color: COLORS.forestGreen },
  agentName: { fontWeight: "700", fontSize: 14, color: COLORS.black },
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
  billTotalRow: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm, marginTop: SPACING.xs },
  billBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: SPACING.md, paddingVertical: 11, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.forestGreen },
  billBtnText: { color: COLORS.forestGreen, fontSize: 13, fontWeight: "700" },
  // Schedule
  scheduleRow: { flexDirection: "row", gap: SPACING.md },
  scheduleBlock: { flex: 1, backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  scheduleLabel: { fontSize: 12, fontWeight: "700", color: COLORS.black, marginTop: 4 },
  scheduleVal: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  instructions: { fontSize: 13, color: COLORS.textLight, lineHeight: 20, backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.md },
  // Bottom
  actionRow: { flexDirection: "row", justifyContent: "center", gap: SPACING.md },
  payNowBtn: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.forestGreen, paddingHorizontal: 24, paddingVertical: 14, borderRadius: RADIUS.full },
  payNowText: { color: COLORS.white, fontWeight: "700", fontSize: 15, marginLeft: 8 },
  cancelBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.error },
  cancelText: { color: COLORS.error, fontWeight: "700", fontSize: 15 },
  rescheduleBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 14, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.forestGreen },
  rescheduleText: { color: COLORS.forestGreen, fontWeight: "700", fontSize: 15 },
});
