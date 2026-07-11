import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  TextInput, ActivityIndicator, Image, Modal, FlatList, Platform, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { COLORS, SPACING, RADIUS, ORDER_STATUS_COLORS } from "../../../constants/theme";
import { useOrderStore } from "../../../stores/orderStore";
import RiderTracker from "../../../components/RiderTracker";
import PickupPhotosCard from "../../../components/PickupPhotosCard";
import RescheduleModal from "../../../components/RescheduleModal";
import { printOrderTags, shareOrderTags, printOrderInvoice, shareOrderInvoice } from "../../../lib/printTags";

const ACTIONS = {
  placed: ["accept", "reject"],
  confirmed: ["assign_pickup_rider"],
  rider_assigned_pickup: [],
  // Rider has the clothes and is arriving at the store: owner verifies the
  // rider's store-drop OTP here (receive_otp) → moves order to "at_store".
  picked_up: ["receive_otp", "start_processing"],
  at_store: ["start_processing"],
  processing: ["set_time", "mark_ready"],
  ready_for_delivery: ["book_rider"],
  out_for_delivery: [],
  delivered: [],
  cancelled: [],
  rejected: [],
};

// Backend allows scale confirmation/correction in these statuses (TASK 2.4)
const WEIGHABLE_STATUSES = ["rider_assigned_pickup", "picked_up", "at_store", "processing"];

// Inline scale-entry for one kg line — store verifies or corrects the rider's
// weighing; every change goes through the same PATCH + audit trail.
function StoreWeighRow({ orderId, item }) {
  const { updateLineWeight } = useOrderStore();
  const [val, setVal] = useState(
    String(item.actual_qty ?? item.tentative_qty ?? item.quantity ?? "")
  );
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    // iOS decimal-pad emits "," on many locales — normalize before validating
    const normalized = val.trim().replace(",", ".");
    if (!/^\d{1,3}(\.\d)?$/.test(normalized)) {
      Alert.alert("Invalid weight", "Use a number with at most 1 decimal place, e.g. 3.6");
      return;
    }
    const q = parseFloat(normalized);
    if (!(q > 0 && q <= 100)) {
      Alert.alert("Invalid weight", "Weight must be between 0 and 100 kg.");
      return;
    }
    setBusy(true);
    try {
      await updateLineWeight(orderId, item.line_id, q);
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Could not save the weight. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.weighRow}>
      <TextInput
        style={styles.weighInput}
        keyboardType="decimal-pad"
        value={val}
        onChangeText={setVal}
        placeholder="0.0"
        placeholderTextColor={COLORS.textMuted}
        accessibilityLabel={`Weighed quantity for ${item.item_name}`}
      />
      <Text style={styles.weighUnit}>kg</Text>
      <TouchableOpacity
        style={[styles.weighBtn, busy && { opacity: 0.5 }]}
        onPress={confirm}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <Text style={styles.weighBtnText}>{item.actual_qty != null ? "Correct" : "Confirm"}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const HOUR_OPTIONS = [
  { label: "+1 hr", hours: 1 },
  { label: "+2 hrs", hours: 2 },
  { label: "+3 hrs", hours: 3 },
  { label: "+4 hrs", hours: 4 },
];

export default function OrderDetailScreen() {
  const router = useRouter();
  // Safe back — falls back to the orders list when there's no history to pop
  // (deep link / push-notification entry), avoiding an unhandled GO_BACK.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/orders"));
  const { orderId } = useLocalSearchParams();
  const { currentOrder, fetchOrderDetail, acceptOrder, rejectOrder, receiveClothes, startProcessing, setDeliveryTime, markReady, bookRider, assignPickupRider, fetchNearbyRiders, completeCounterOrder, uploadOrderPhotos } = useOrderStore();
  const [loading, setLoading] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [otp, setOtp] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [showTimeInput, setShowTimeInput] = useState(false);
  // Reject flow
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  // Rider picker (shared for pickup + delivery)
  const [riderPickerMode, setRiderPickerMode] = useState(null); // "pickup" | "delivery"
  const [nearbyRiders, setNearbyRiders] = useState([]);
  const [ridersLoading, setRidersLoading] = useState(false);

  useEffect(() => {
    fetchOrderDetail(orderId);
    const interval = setInterval(() => fetchOrderDetail(orderId), 15000);
    return () => clearInterval(interval);
  }, [orderId]);

  const order = currentOrder && currentOrder.id === orderId ? currentOrder : null;

  const handleAccept = async () => {
    setLoading(true);
    try {
      await acceptOrder(orderId);
      Alert.alert("Accepted!", "Order confirmed. Assign a rider for pickup when ready.");
      await fetchOrderDetail(orderId);
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed.");
    } finally { setLoading(false); }
  };

  const handleReceiveOTP = async () => {
    if (otp.length < 4) { Alert.alert("Enter OTP", "Ask the rider for their OTP."); return; }
    setLoading(true);
    try {
      await receiveClothes(orderId, otp);
      setOtp(""); setShowOtpInput(false);
      Alert.alert("Received!", "Clothes received. Start processing when ready.");
      await fetchOrderDetail(orderId);
    } catch (e) {
      Alert.alert("Wrong OTP", e?.response?.data?.detail || "Incorrect OTP.");
    } finally { setLoading(false); }
  };

  const handleStartProcessing = async () => {
    setLoading(true);
    try {
      await startProcessing(orderId);
      Alert.alert("Processing!", "Started. Set delivery time now.");
      await fetchOrderDetail(orderId);
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed.");
    } finally { setLoading(false); }
  };

  const handleSetTime = async (hours) => {
    setLoading(true);
    try {
      const dt = new Date(Date.now() + hours * 3600 * 1000);
      const iso = dt.toISOString().slice(0, 19);
      await setDeliveryTime(orderId, iso);
      setShowTimeInput(false);
      Alert.alert("Time Set!", "Delivery expected in " + hours + " hour(s).");
      await fetchOrderDetail(orderId);
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed.");
    } finally { setLoading(false); }
  };

  const handleMarkReady = async () => {
    setLoading(true);
    try {
      await markReady(orderId);
      Alert.alert("Ready!", "Order is ready. Book a rider for delivery.");
      await fetchOrderDetail(orderId);
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed.");
    } finally { setLoading(false); }
  };

  const handleBookRider = () => openRiderPicker("delivery");

  const handleReject = async () => {
    setLoading(true);
    try {
      await rejectOrder(orderId, rejectReason.trim() || null);
      setShowRejectInput(false);
      setRejectReason("");
      Alert.alert("Order Rejected", "The customer has been notified.");
      goBack();
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to reject order.");
    } finally { setLoading(false); }
  };

  const openRiderPicker = async (mode) => {
    setRiderPickerMode(mode);
    setRidersLoading(true);
    try {
      const riders = await fetchNearbyRiders(15);
      setNearbyRiders(riders);
    } catch {
      setNearbyRiders([]);
    } finally { setRidersLoading(false); }
  };

  const handleSelectRider = async (rider) => {
    setRiderPickerMode(null);
    setLoading(true);
    try {
      if (riderPickerMode === "pickup") {
        const result = await assignPickupRider(orderId, rider.id);
        Alert.alert("Pickup Rider Assigned", `${result.rider_name || "Rider"} will collect the clothes.`);
      } else {
        const result = await bookRider(orderId, rider.id);
        Alert.alert("Delivery Rider Assigned", `${result.rider_name || "Rider"} assigned for delivery.`);
      }
      await fetchOrderDetail(orderId);
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Assignment failed.");
    } finally { setLoading(false); }
  };

  const handlePrintTags = async () => {
    setLoading(true);
    try {
      await printOrderTags(orderId, order?.order_number);
    } catch (e) {
      // Fall back to share sheet if printing isn't available
      try {
        await shareOrderTags(orderId, order?.order_number);
      } catch (e2) {
        Alert.alert("Print Failed", e?.message || e2?.message || "Could not open the print dialog.");
      }
    } finally { setLoading(false); }
  };

  const handlePrintInvoice = async () => {
    setInvoiceBusy(true);
    try {
      await printOrderInvoice(orderId, order?.order_number);
    } catch (e) {
      try {
        await shareOrderInvoice(orderId, order?.order_number);
      } catch (e2) {
        Alert.alert("Invoice Failed", e?.message || e2?.message || "Could not open the invoice.");
      }
    } finally { setInvoiceBusy(false); }
  };

  const handleCompleteCounter = async () => {
    Alert.alert("Complete Order", "Confirm the customer has collected the finished clothes?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Complete",
        onPress: async () => {
          setLoading(true);
          try {
            await completeCounterOrder(orderId);
            Alert.alert("Done!", "Order marked delivered.");
            await fetchOrderDetail(orderId);
          } catch (e) {
            Alert.alert("Error", e?.response?.data?.detail || "Failed.");
          } finally { setLoading(false); }
        },
      },
    ]);
  };

  const handleCaptureStorePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera Required", "Enable camera access in Settings to photograph garments.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true, allowsEditing: false });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setPhotoBusy(true);
    try {
      await uploadOrderPhotos(orderId, [`data:image/jpeg;base64,${result.assets[0].base64}`], "store_intake");
      await fetchOrderDetail(orderId);
    } catch (e) {
      Alert.alert("Upload Failed", e?.response?.data?.detail || "Could not upload photo.");
    } finally { setPhotoBusy(false); }
  };

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerNav}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Detail</Text>
          <View style={{ width: 40 }} />
        </View>
        <ActivityIndicator color={COLORS.storeOrange} size="large" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const sc = ORDER_STATUS_COLORS[order.status] || ORDER_STATUS_COLORS.placed;
  const isCounter = order.fulfillment_mode === "counter_pickup";
  const isWalkIn = order.order_source === "walk_in";
  let availableActions = [...(ACTIONS[order.status] || [])];
  if (isCounter) {
    // Counter pickup never books a delivery rider — it's handed over at the counter.
    availableActions = availableActions.filter((a) => a !== "book_rider");
    if (["processing", "ready_for_delivery"].includes(order.status)) {
      availableActions.push("complete_counter");
    }
  }
  const canCapturePhotos = !["delivered", "cancelled", "rejected"].includes(order.status);
  const canReschedule = ["placed", "confirmed", "rider_assigned_pickup"].includes(order.status);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerNav}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{order.order_number}</Text>
        {canReschedule ? (
          <TouchableOpacity onPress={() => setShowReschedule(true)} style={styles.rescheduleHeaderBtn}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.storeOrange} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
          </View>
        )}
      </View>

      {/* iOS: keep the weigh input + confirm visible above the keyboard */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

        {/* Walk-in / fulfillment banner */}
        {isWalkIn ? (
          <View style={styles.walkInBanner}>
            <Ionicons name="storefront" size={16} color={COLORS.storeOrange} />
            <Text style={styles.walkInBannerText}>
              Walk-in order · {isCounter ? "Counter Pickup" : "Rider Delivery"}
            </Text>
            <View style={[styles.payPill, order.payment_status === "paid" ? styles.payPillPaid : styles.payPillPending]}>
              <Text style={[styles.payPillText, order.payment_status === "paid" ? { color: COLORS.success } : { color: COLORS.warning }]}>
                {(order.payment_status || "").toUpperCase()}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Live rider tracking — silently hidden when no active trip */}
        <RiderTracker orderId={orderId} />

        {/* Pickup photos uploaded by rider — silently hidden when none */}
        <PickupPhotosCard
          photos={order.pickup_proof_photos || []}
          photosAt={order.pickup_photos_at}
        />

        {/* Customer */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person-circle-outline" size={18} color={COLORS.storeOrange} />
            <Text style={styles.infoText}>{order.customer_name || "—"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={18} color={COLORS.storeOrange} />
            <Text style={styles.infoText}>{order.customer_phone || "—"}</Text>
          </View>
          {order.address && order.address.full_address ? (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color={COLORS.storeOrange} />
              <Text style={styles.infoText} numberOfLines={2}>{order.address.full_address}</Text>
            </View>
          ) : null}
          {order.pickup_slot ? (
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={18} color={COLORS.storeOrange} />
              <Text style={styles.infoText}>{"Pickup: " + order.pickup_slot.date + " · " + order.pickup_slot.slot}</Text>
            </View>
          ) : null}
        </View>

        {/* Items */}
        <View style={styles.card}>
          <View style={styles.itemsHeader}>
            <Text style={styles.cardTitle}>{"Items (" + (order.items ? order.items.length : 0) + ")"}</Text>
            {(order.garment_tags || []).length > 0 && (
              <TouchableOpacity
                style={styles.printTagsBtn}
                onPress={handlePrintTags}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <>
                      <Ionicons name="print" size={14} color={COLORS.white} />
                      <Text style={styles.printTagsText}>{`Print Tags (${(order.garment_tags || []).length})`}</Text>
                    </>}
              </TouchableOpacity>
            )}
          </View>
          {(order.items || []).map((item, i) => (
            <View key={i} style={[styles.itemRow, i === (order.items.length - 1) && { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemService}>{item.service_name}</Text>
                <Text style={styles.itemName}>
                  {item.unit === "kg"
                    ? item.item_name + (item.actual_qty != null
                        ? ` · ${item.actual_qty} kg (weighed${item.weighed_by?.role ? " by " + (item.weighed_by.role === "store_owner" ? "store" : item.weighed_by.role) : ""})`
                        : ` · ~${item.tentative_qty ?? item.quantity} kg (customer estimate)`)
                    : item.item_name + " x" + item.quantity}
                </Text>
                {item.unit === "kg" && item.line_id && WEIGHABLE_STATUSES.includes(order.status) && (
                  <StoreWeighRow orderId={order.id} item={item} />
                )}
              </View>
              <Text style={styles.itemPrice}>{"Rs " + (item.subtotal ? item.subtotal.toFixed(0) : "0")}</Text>
            </View>
          ))}
          {order.special_instructions ? (
            <View style={styles.noteBox}>
              <Ionicons name="information-circle-outline" size={14} color={COLORS.info} />
              <Text style={styles.noteText}>{order.special_instructions}</Text>
            </View>
          ) : null}
        </View>

        {/* Payment */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{"Payment · " + (order.payment_method || "").toUpperCase()}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Subtotal</Text>
            <Text style={styles.priceValue}>{"Rs " + (order.subtotal ? order.subtotal.toFixed(0) : "0")}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Delivery Fee</Text>
            <Text style={styles.priceValue}>{"Rs " + (order.delivery_fee ? order.delivery_fee.toFixed(0) : "0")}</Text>
          </View>
          {order.discount > 0 ? (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Discount</Text>
              <Text style={[styles.priceValue, { color: COLORS.success }]}>{"-Rs " + order.discount.toFixed(0)}</Text>
            </View>
          ) : null}
          <View style={[styles.priceRow, styles.priceRowTotal]}>
            <Text style={styles.priceLabelBold}>Total</Text>
            <Text style={styles.priceValueBold}>{"Rs " + (order.total_amount ? order.total_amount.toFixed(0) : "0")}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Your Share (80%)</Text>
            <Text style={[styles.priceValue, { color: COLORS.success, fontWeight: "700" }]}>
              {"Rs " + ((order.total_amount || 0) * 0.8).toFixed(0)}
            </Text>
          </View>
          <TouchableOpacity style={styles.invoiceBtn} onPress={handlePrintInvoice} disabled={invoiceBusy}>
            {invoiceBusy ? <ActivityIndicator size="small" color={COLORS.white} /> : (
              <React.Fragment>
                <Ionicons name="document-text-outline" size={16} color={COLORS.white} />
                <Text style={styles.invoiceBtnText}>Generate GST Bill / Invoice</Text>
              </React.Fragment>
            )}
          </TouchableOpacity>
        </View>

        {/* Store Photos — capture intake/proof at the counter */}
        <PickupPhotosCard
          photos={order.store_photos || []}
          title="Store Photos"
          onCapture={canCapturePhotos ? handleCaptureStorePhoto : null}
          capturing={photoBusy}
        />

        {/* Pickup Photos */}
        {order.pickup_proof_photos && order.pickup_proof_photos.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{"Pickup Photos (" + order.pickup_proof_photos.length + ")"}</Text>
            <View style={styles.photosRow}>
              {order.pickup_proof_photos.map((photo, i) => (
                <Image key={i} source={{ uri: photo }} style={styles.photoThumb} />
              ))}
            </View>
          </View>
        ) : null}

        {/* Garment Tags */}
        {order.garment_tags && order.garment_tags.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{"Garment Tags (" + order.garment_tags.length + ")"}</Text>
            <View style={styles.tagsWrap}>
              {order.garment_tags.map((tag, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{tag.tag_code}</Text>
                  <Text style={styles.tagSub}>{tag.item_name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Timeline</Text>
          {(order.status_timeline || []).map((entry, i, arr) => (
            <View key={i} style={styles.timelineRow}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, i === arr.length - 1 && { backgroundColor: COLORS.storeOrange }]} />
                {i < arr.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStatus}>{(entry.status || "").replace(/_/g, " ").toUpperCase()}</Text>
                {entry.note ? <Text style={styles.timelineNote}>{entry.note}</Text> : null}
                <Text style={styles.timelineTime}>
                  {entry.timestamp ? new Date(entry.timestamp).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Actions */}
        {availableActions.length > 0 ? (
          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>Actions Required</Text>

            {availableActions.includes("accept") ? (
              <TouchableOpacity style={styles.actionBtn} onPress={handleAccept} disabled={loading}>
                {loading ? <ActivityIndicator color={COLORS.white} /> : (
                  <React.Fragment>
                    <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.white} />
                    <Text style={styles.actionBtnText}>Accept Order</Text>
                  </React.Fragment>
                )}
              </TouchableOpacity>
            ) : null}

            {availableActions.includes("reject") ? (
              showRejectInput ? (
                <View style={styles.rejectBox}>
                  <Text style={styles.rejectHint}>Reason for rejection (optional):</Text>
                  <TextInput
                    style={styles.rejectInput}
                    placeholder="e.g. Fully booked, out of service area…"
                    placeholderTextColor={COLORS.textMuted}
                    value={rejectReason}
                    onChangeText={setRejectReason}
                    autoFocus
                  />
                  <View style={styles.rejectRowBtns}>
                    <TouchableOpacity style={styles.rejectCancelBtn} onPress={() => { setShowRejectInput(false); setRejectReason(""); }}>
                      <Text style={styles.rejectCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectConfirmBtn} onPress={handleReject} disabled={loading}>
                      {loading ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.rejectConfirmText}>Confirm Reject</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.rejectBtn} onPress={() => setShowRejectInput(true)} disabled={loading}>
                  <Ionicons name="close-circle-outline" size={18} color={COLORS.error} />
                  <Text style={styles.rejectBtnText}>Reject Order</Text>
                </TouchableOpacity>
              )
            ) : null}

            {availableActions.includes("assign_pickup_rider") ? (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#5856D6" }]} onPress={() => openRiderPicker("pickup")} disabled={loading}>
                {loading ? <ActivityIndicator color={COLORS.white} /> : (
                  <React.Fragment>
                    <Ionicons name="bicycle-outline" size={18} color={COLORS.white} />
                    <Text style={styles.actionBtnText}>Assign Pickup Rider</Text>
                  </React.Fragment>
                )}
              </TouchableOpacity>
            ) : null}

            {availableActions.includes("receive_otp") ? (
              <View>
                {!showOtpInput ? (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.info }]} onPress={() => setShowOtpInput(true)}>
                    <Ionicons name="keypad-outline" size={18} color={COLORS.white} />
                    <Text style={styles.actionBtnText}>Verify Rider Drop OTP</Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    <Text style={styles.otpHint}>Enter the OTP shown on the rider's app:</Text>
                    <View style={styles.otpRow}>
                      <TextInput
                        style={styles.otpInput}
                        placeholder="_ _ _ _"
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="number-pad"
                        maxLength={4}
                        value={otp}
                        onChangeText={setOtp}
                        autoFocus
                        textAlign="center"
                      />
                      <TouchableOpacity
                        style={[styles.actionBtn, { flex: 0, paddingHorizontal: SPACING.xl, backgroundColor: COLORS.info }]}
                        onPress={handleReceiveOTP}
                        disabled={loading || otp.length < 4}
                      >
                        {loading ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.actionBtnText}>Confirm</Text>}
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => setShowOtpInput(false)} style={{ alignSelf: "center", marginTop: SPACING.sm }}>
                      <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : null}

            {availableActions.includes("start_processing") ? (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.warning }]} onPress={handleStartProcessing} disabled={loading}>
                {loading ? <ActivityIndicator color={COLORS.white} /> : (
                  <React.Fragment>
                    <Ionicons name="construct-outline" size={18} color={COLORS.white} />
                    <Text style={styles.actionBtnText}>Start Processing</Text>
                  </React.Fragment>
                )}
              </TouchableOpacity>
            ) : null}

            {availableActions.includes("set_time") ? (
              <View>
                {!showTimeInput ? (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#7B1FA2" }]} onPress={() => setShowTimeInput(true)} disabled={loading}>
                    <Ionicons name="time-outline" size={18} color={COLORS.white} />
                    <Text style={styles.actionBtnText}>Set Expected Delivery Time</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.timePicker}>
                    <Text style={styles.timePickerTitle}>Ready in how many hours?</Text>
                    <View style={styles.timePickerRow}>
                      {HOUR_OPTIONS.map((opt) => (
                        <TouchableOpacity key={opt.hours} style={styles.timeBtn} onPress={() => handleSetTime(opt.hours)} disabled={loading}>
                          {loading ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.timeBtnText}>{opt.label}</Text>}
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity onPress={() => setShowTimeInput(false)} style={{ alignSelf: "center", marginTop: SPACING.sm }}>
                      <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : null}

            {availableActions.includes("mark_ready") ? (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#00695C" }]} onPress={handleMarkReady} disabled={loading}>
                {loading ? <ActivityIndicator color={COLORS.white} /> : (
                  <React.Fragment>
                    <Ionicons name="checkmark-done-outline" size={18} color={COLORS.white} />
                    <Text style={styles.actionBtnText}>Mark Ready for Delivery</Text>
                  </React.Fragment>
                )}
              </TouchableOpacity>
            ) : null}

            {availableActions.includes("book_rider") ? (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.forestGreen }]} onPress={handleBookRider} disabled={loading}>
                {loading ? <ActivityIndicator color={COLORS.white} /> : (
                  <React.Fragment>
                    <Ionicons name="bicycle-outline" size={18} color={COLORS.white} />
                    <Text style={styles.actionBtnText}>Assign Delivery Rider</Text>
                  </React.Fragment>
                )}
              </TouchableOpacity>
            ) : null}

            {availableActions.includes("complete_counter") ? (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.success }]} onPress={handleCompleteCounter} disabled={loading}>
                {loading ? <ActivityIndicator color={COLORS.white} /> : (
                  <React.Fragment>
                    <Ionicons name="bag-check-outline" size={18} color={COLORS.white} />
                    <Text style={styles.actionBtnText}>Hand to Customer (Complete)</Text>
                  </React.Fragment>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Rider Picker Modal */}
      <Modal
        visible={riderPickerMode !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setRiderPickerMode(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {riderPickerMode === "pickup" ? "Select Pickup Rider" : "Select Delivery Rider"}
              </Text>
              <TouchableOpacity onPress={() => setRiderPickerMode(null)} style={styles.modalClose}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {ridersLoading ? (
              <View style={styles.modalLoader}>
                <ActivityIndicator color={COLORS.storeOrange} />
                <Text style={styles.modalLoaderText}>Finding nearby riders…</Text>
              </View>
            ) : nearbyRiders.length === 0 ? (
              <View style={styles.modalLoader}>
                <Ionicons name="bicycle-outline" size={40} color={COLORS.border} />
                <Text style={styles.modalLoaderText}>No riders online nearby.</Text>
              </View>
            ) : (
              <FlatList
                data={nearbyRiders}
                keyExtractor={(r) => r.id}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item: rider }) => (
                  <TouchableOpacity
                    style={styles.riderCard}
                    onPress={() => handleSelectRider(rider)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.riderAvatar}>
                      <Ionicons name="person" size={20} color={COLORS.storeOrange} />
                    </View>
                    <View style={{ flex: 1, marginLeft: SPACING.md }}>
                      <Text style={styles.riderName}>{rider.name}</Text>
                      <Text style={styles.riderMeta}>
                        {(rider.vehicle_type || "bike").toUpperCase()} · {rider.vehicle_number || "—"} · {rider.total_trips} trips
                      </Text>
                    </View>
                    <View style={styles.riderDistBadge}>
                      <Text style={styles.riderDist}>{rider.distance_km} km</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      <RescheduleModal
        visible={showReschedule}
        orderId={orderId}
        accent={COLORS.storeOrange}
        onClose={() => setShowReschedule(false)}
        onDone={() => { setShowReschedule(false); fetchOrderDetail(orderId); Alert.alert("Rescheduled", "Pickup time updated."); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rescheduleHeaderBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.storeOrangeLight, alignItems: "center", justifyContent: "center" },
  container: { flex: 1, backgroundColor: COLORS.background },
  headerNav: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.black, flex: 1, marginHorizontal: SPACING.sm },
  statusBadge: { paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: RADIUS.sm },
  statusText: { fontSize: 11, fontWeight: "800" },
  card: { backgroundColor: COLORS.white, marginHorizontal: SPACING.lg, marginBottom: SPACING.sm, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.borderLight },
  cardTitle: { fontSize: 14, fontWeight: "700", color: COLORS.black, marginBottom: SPACING.md },
  itemsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.md },
  printTagsBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.xs,
    backgroundColor: COLORS.storeOrange,
    paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full,
    marginBottom: -SPACING.md / 2,
  },
  printTagsText: { color: COLORS.white, fontSize: 11, fontWeight: "700" },
  invoiceBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, backgroundColor: COLORS.forestGreen, paddingVertical: 12, borderRadius: RADIUS.md, marginTop: SPACING.md },
  invoiceBtnText: { color: COLORS.white, fontSize: 14, fontWeight: "700" },
  walkInBanner: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.storeOrangeLight, marginHorizontal: SPACING.lg, marginBottom: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: RADIUS.md },
  walkInBannerText: { flex: 1, fontSize: 13, fontWeight: "700", color: COLORS.storeOrange },
  payPill: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  payPillPaid: { backgroundColor: "#E8F5E9" },
  payPillPending: { backgroundColor: "#FFF3E0" },
  payPillText: { fontSize: 10, fontWeight: "800" },
  noPhotosText: { fontSize: 12, color: COLORS.textMuted },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm, marginBottom: SPACING.sm },
  infoText: { flex: 1, fontSize: 14, color: COLORS.text },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  itemService: { fontSize: 10, color: COLORS.textMuted, fontWeight: "700", textTransform: "uppercase" },
  itemName: { fontSize: 14, color: COLORS.text, fontWeight: "500" },
  itemPrice: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  weighRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.sm },
  weighInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: 6, minWidth: 72,
    fontSize: 15, fontWeight: "600", color: COLORS.black, backgroundColor: COLORS.white,
    textAlign: "center",
  },
  weighUnit: { fontSize: 13, color: COLORS.textMuted, fontWeight: "600" },
  weighBtn: {
    backgroundColor: COLORS.forestGreen, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 8, minWidth: 84, alignItems: "center",
  },
  weighBtnText: { color: COLORS.white, fontSize: 13, fontWeight: "700" },
  noteBox: { flexDirection: "row", gap: SPACING.sm, backgroundColor: "#E3F2FD", padding: SPACING.sm, borderRadius: RADIUS.sm, marginTop: SPACING.md },
  noteText: { flex: 1, fontSize: 12, color: "#1565C0", lineHeight: 18 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: SPACING.xs },
  priceRowTotal: { borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: SPACING.sm, marginTop: SPACING.sm },
  priceLabel: { fontSize: 14, color: COLORS.textLight },
  priceLabelBold: { fontSize: 15, fontWeight: "700", color: COLORS.black },
  priceValue: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  priceValueBold: { fontSize: 16, fontWeight: "800", color: COLORS.black },
  photosRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  photoThumb: { width: 80, height: 80, borderRadius: RADIUS.md },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  tag: { backgroundColor: COLORS.mintGreen, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm },
  tagText: { fontSize: 11, fontWeight: "700", color: COLORS.forestGreen },
  tagSub: { fontSize: 9, color: COLORS.textMuted, marginTop: 1 },
  timelineRow: { flexDirection: "row", marginBottom: SPACING.sm },
  timelineLeft: { width: 20, alignItems: "center" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.border, marginTop: 3 },
  timelineLine: { flex: 1, width: 2, backgroundColor: COLORS.borderLight, marginTop: 2 },
  timelineContent: { flex: 1, paddingLeft: SPACING.sm, paddingBottom: SPACING.sm },
  timelineStatus: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  timelineNote: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  timelineTime: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  actionsCard: { backgroundColor: COLORS.white, marginHorizontal: SPACING.lg, marginTop: SPACING.sm, marginBottom: SPACING.sm, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 2, borderColor: COLORS.storeOrange, gap: SPACING.sm },
  actionsTitle: { fontSize: 15, fontWeight: "800", color: COLORS.storeOrange, marginBottom: SPACING.sm },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, backgroundColor: COLORS.storeOrange, paddingVertical: SPACING.md, borderRadius: RADIUS.full },
  actionBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  otpHint: { fontSize: 12, color: COLORS.textMuted, marginBottom: SPACING.sm },
  otpRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "center" },
  otpInput: { backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 24, letterSpacing: 10, width: 140, textAlign: "center", color: COLORS.text },
  timePicker: { backgroundColor: COLORS.background, padding: SPACING.md, borderRadius: RADIUS.lg },
  timePickerTitle: { fontSize: 13, color: COLORS.textLight, textAlign: "center", marginBottom: SPACING.md, fontWeight: "600" },
  timePickerRow: { flexDirection: "row", gap: SPACING.sm },
  timeBtn: { flex: 1, backgroundColor: "#7B1FA2", paddingVertical: SPACING.md, borderRadius: RADIUS.full, alignItems: "center" },
  timeBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 13 },
  // Reject flow
  rejectBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.error, paddingVertical: SPACING.md, borderRadius: RADIUS.full },
  rejectBtnText: { color: COLORS.error, fontWeight: "700", fontSize: 14 },
  rejectBox: { backgroundColor: "#FFF5F5", padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: "#FFCCCC" },
  rejectHint: { fontSize: 12, color: COLORS.textMuted, marginBottom: SPACING.sm },
  rejectInput: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.md, fontSize: 14, color: COLORS.text, marginBottom: SPACING.sm },
  rejectRowBtns: { flexDirection: "row", gap: SPACING.sm },
  rejectCancelBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, alignItems: "center" },
  rejectCancelText: { fontSize: 13, color: COLORS.textMuted, fontWeight: "600" },
  rejectConfirmBtn: { flex: 1, backgroundColor: COLORS.error, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, alignItems: "center" },
  rejectConfirmText: { color: COLORS.white, fontWeight: "700", fontSize: 13 },
  // Rider picker modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, maxHeight: "75%", paddingBottom: 30 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  modalTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  modalClose: { padding: SPACING.sm },
  modalLoader: { alignItems: "center", paddingVertical: 40, gap: SPACING.md },
  modalLoaderText: { fontSize: 14, color: COLORS.textMuted },
  riderCard: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  riderAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.storeOrangeLight, justifyContent: "center", alignItems: "center" },
  riderName: { fontSize: 15, fontWeight: "700", color: COLORS.black },
  riderMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  riderDistBadge: { backgroundColor: COLORS.mintGreen, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full },
  riderDist: { fontSize: 12, fontWeight: "700", color: COLORS.forestGreen },
});
