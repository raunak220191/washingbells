import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS, TYPE, TINTS, FREE_DELIVERY_THRESHOLD, DELIVERY_FEE } from "../../../constants/theme";
import { useCartStore } from "../../../stores/cartStore";
import { useOrderStore } from "../../../stores/orderStore";
import { useAddressStore } from "../../../stores/addressStore";
import { useCouponStore } from "../../../stores/couponStore";
import { useWalletStore } from "../../../stores/walletStore";
import { useAuthStore } from "../../../stores/authStore";
import Button from "../../../components/common/Button";
import Screen from "../../../components/common/Screen";
import Header from "../../../components/common/Header";
import Chip, { ChipRow } from "../../../components/common/Chip";
import PriceRow from "../../../components/common/PriceRow";
import BottomBar from "../../../components/common/BottomBar";
import RazorpayCheckout from "../../../lib/RazorpayCheckout";
import api from "../../../lib/api";

// Local YYYY-MM-DD (don't use toISOString — it converts to UTC and can shift
// the date by a day in IST).
const fmtLocalDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const getAvailableDates = () => {
  const dates = [];
  const now = new Date();
  for (let i = 0; i <= 5; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    dates.push({
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow"
        : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
      value: fmtLocalDate(d),
    });
  }
  return dates;
};

export default function CheckoutScreen() {
  const router = useRouter();
  const { totalAmount, totalItems } = useCartStore();
  const { createOrder } = useOrderStore();
  const { addresses, selectedAddress, fetchAddresses } = useAddressStore();
  const { validationResult, validateCoupon, clearValidation, myCoupons, fetchMyCoupons } = useCouponStore();
  const { balance: walletBalance, fetchWallet } = useWalletStore();
  const { user, updateProfile } = useAuthStore();
  const availableDates = getAvailableDates();

  const [useWallet, setUseWallet] = useState(false);
  const [rzCheckout, setRzCheckout] = useState(null); // { orderId, options } when paying

  const [pickupDate, setPickupDate] = useState(availableDates[0]?.value);
  const [pickupSlot, setPickupSlot] = useState(null);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("online"); // online | cod
  const [loading, setLoading] = useState(false);

  const [nearbyStores, setNearbyStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);

  // API-driven slot picker — refetches when store or date changes
  const [slotData, setSlotData] = useState(null); // { closed, slots: [...] }
  const [slotsLoading, setSlotsLoading] = useState(false);

  // One-shot email capture nudge. Dismissed for the rest of this session if skipped.
  const [emailDraft, setEmailDraft] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailDismissed, setEmailDismissed] = useState(false);
  const showEmailNudge = !!user && !user.email && !emailDismissed;

  const handleSaveEmail = async () => {
    const trimmed = (emailDraft || "").trim().toLowerCase();
    if (!trimmed) { setEmailDismissed(true); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert("Invalid Email", "Please enter a valid email or tap Skip."); return;
    }
    setEmailSaving(true);
    try {
      await updateProfile({ email: trimmed });
      setEmailDismissed(true);
    } catch (e) {
      Alert.alert("Couldn't save email", e?.response?.data?.detail || "Try again later.");
    } finally { setEmailSaving(false); }
  };

  useEffect(() => { fetchAddresses(); fetchWallet(); fetchMyCoupons(); return () => clearValidation(); }, []);

  useEffect(() => {
    if (!selectedAddress?.latitude || !selectedAddress?.longitude) return;
    setSelectedStore(null);
    setStoresLoading(true);
    api
      .get("/stores/nearby", {
        params: { lat: selectedAddress.latitude, lng: selectedAddress.longitude, radius: 15 },
      })
      .then((res) => setNearbyStores(res.data))
      .catch(() => setNearbyStores([]))
      .finally(() => setStoresLoading(false));
  }, [selectedAddress?.id]);

  // Fetch slots when store + date are selected
  useEffect(() => {
    if (!selectedStore?.id || !pickupDate) { setSlotData(null); return; }
    setSlotsLoading(true);
    setPickupSlot(null);  // reset selection when store/date changes
    api
      .get(`/stores/${selectedStore.id}/slots`, { params: { date: pickupDate } })
      .then(res => setSlotData(res.data))
      .catch(() => setSlotData(null))
      .finally(() => setSlotsLoading(false));
  }, [selectedStore?.id, pickupDate]);

  const deliveryFee = totalAmount >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const discount = validationResult?.valid ? validationResult.discount_amount : 0;
  const payableBeforeWallet = Math.max(totalAmount + deliveryFee - discount, 0);
  // Wallet can cover up to the remaining payable amount.
  const walletApplied = useWallet ? Math.min(walletBalance || 0, payableBeforeWallet) : 0;
  const grandTotal = Math.max(payableBeforeWallet - walletApplied, 0);

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;
    await validateCoupon(couponCode.trim(), totalAmount);
  };

  // Tap-to-apply from the available-coupons strip (A5)
  const handleApplyCoupon = async (code) => {
    setCouponCode(code);
    await validateCoupon(code, totalAmount);
  };

  const goToConfirming = (orderId) =>
    router.replace({ pathname: "/(tabs)/orders/confirming", params: { orderId } });

  const handlePlaceOrder = async () => {
    if (!selectedAddress) { Alert.alert("No Address", "Please add a delivery address."); return; }
    if (!selectedStore) { Alert.alert("Select Store", "Please select a nearby store to handle your order."); return; }
    if (!pickupSlot) { Alert.alert("Pickup Time", "Please select a pickup time slot."); return; }

    // Step 1 — create the order. Only this can "fail to place an order".
    setLoading(true);
    let order;
    try {
      order = await createOrder({
        address_id: selectedAddress.id,
        pickup_slot: { date: pickupDate, slot: pickupSlot },
        delivery_slot: { date: pickupDate, slot: pickupSlot },
        special_instructions: specialInstructions || null,
        coupon_code: validationResult?.valid ? couponCode.trim() : null,
        payment_method: paymentMethod,
        wallet_amount: walletApplied,
        store_id: selectedStore.id,
      });
    } catch (error) {
      Alert.alert("Error", error?.response?.data?.detail || "Failed to place order.");
      setLoading(false);
      return;
    }
    if (walletApplied > 0) fetchWallet();
    // The server cleared the cart when it created the order — resync our copy
    // so the basket tab doesn't keep showing the old items.
    useCartStore.getState().resetLocal();
    setLoading(false);

    // The order is now placed. Everything below is best-effort — a payment
    // hiccup must never look like a failed order or trap the user here.
    if (paymentMethod !== "online" || order.total_amount <= 0) {
      goToConfirming(order.id);
      return;
    }

    try {
      const payRes = await api.post("/payments/create", { order_id: order.id });
      setRzCheckout({
        orderId: order.id,
        options: {
          key: payRes.data.razorpay_key_id,
          order_id: payRes.data.razorpay_order_id,
          amount: payRes.data.amount,
          currency: payRes.data.currency,
          name: "WashingBells",
          description: `Order ${order.order_number || ""}`.trim(),
          prefill: {
            name: user?.name || "",
            email: user?.email || "",
            contact: (user?.phone || "").replace("+91", ""),
          },
        },
      });
    } catch (e) {
      // Couldn't start payment — the order is still placed; let them pay later.
      Alert.alert("Order Placed", "Your order is placed. You can complete the payment from the Orders tab.");
      goToConfirming(order.id);
    }
  };

  // Razorpay WebView result handlers
  const handleRzSuccess = async (data) => {
    const target = rzCheckout;
    setRzCheckout(null);
    try {
      await api.post("/payments/verify", {
        order_id: target.orderId,
        razorpay_order_id: data.razorpay_order_id,
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature: data.razorpay_signature,
      });
    } catch (e) {
      Alert.alert("Payment Verification Failed", "We couldn't confirm your payment. If money was deducted it will be refunded. You can retry from Orders.");
    } finally {
      goToConfirming(target.orderId);
    }
  };

  const handleRzDismiss = () => {
    const target = rzCheckout;
    setRzCheckout(null);
    Alert.alert("Payment Pending", "Your order was placed but payment wasn't completed. You can pay for it from the Orders tab.");
    if (target) goToConfirming(target.orderId);
  };

  const handleRzError = (msg) => {
    const target = rzCheckout;
    setRzCheckout(null);
    Alert.alert("Payment Failed", msg || "Something went wrong with the payment.");
    if (target) goToConfirming(target.orderId);
  };

  return (
    <Screen padded={false}>
      <View style={styles.headerPad}>
        <Header title="Schedule & Pay" onBack={() => router.back()} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
        {/* Email Nudge — shown once per session if email is missing */}
        {showEmailNudge && (
          <View style={styles.emailNudge}>
            <View style={styles.emailNudgeHeader}>
              <Ionicons name="mail-outline" size={18} color={COLORS.forestGreen} />
              <Text style={styles.emailNudgeTitle}>Get your receipt by email?</Text>
              <TouchableOpacity onPress={() => setEmailDismissed(true)}>
                <Ionicons name="close" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.emailNudgeSub}>Order receipts and important updates land in your inbox. Optional.</Text>
            <View style={styles.emailNudgeRow}>
              <TextInput
                style={styles.emailNudgeInput}
                placeholder="your@email.com"
                placeholderTextColor={COLORS.textMuted}
                value={emailDraft}
                onChangeText={setEmailDraft}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                editable={!emailSaving}
              />
              <TouchableOpacity
                style={styles.emailNudgeSave}
                onPress={handleSaveEmail}
                disabled={emailSaving}
              >
                {emailSaving
                  ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <Text style={styles.emailNudgeSaveText}>{emailDraft ? "Save" : "Skip"}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          {selectedAddress ? (
            <View style={styles.addressCard}>
              <Ionicons name="location" size={20} color={COLORS.gold} />
              <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                <Text style={styles.addressLabel}>{selectedAddress.label}</Text>
                <Text style={styles.addressText} numberOfLines={2}>{selectedAddress.full_address}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push("/(tabs)/home/address")}>
                <Text style={styles.changeLink}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addAddressBtn} onPress={() => router.push("/(tabs)/home/address")}>
              <Ionicons name="add-circle-outline" size={20} color={COLORS.gold} />
              <Text style={styles.addAddressText}>Add Address</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Store Selection */}
        {selectedAddress && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Store</Text>
            {storesLoading ? (
              <View style={styles.storeLoader}>
                <ActivityIndicator size="small" color={COLORS.gold} />
                <Text style={styles.storeLoaderText}>Finding stores near you...</Text>
              </View>
            ) : nearbyStores.length === 0 ? (
              <View style={styles.noStoreBox}>
                <Ionicons name="storefront-outline" size={24} color={COLORS.textMuted} />
                <Text style={styles.noStoreText}>No stores available in your area right now.</Text>
              </View>
            ) : (
              nearbyStores.map((store) => {
                const isSelected = selectedStore?.id === store.id;
                return (
                  <TouchableOpacity
                    key={store.id}
                    style={[styles.storeCard, isSelected && styles.storeCardSelected]}
                    onPress={() => setSelectedStore(store)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.storeCardLeft}>
                      <Ionicons
                        name="storefront"
                        size={20}
                        color={isSelected ? COLORS.forestGreen : COLORS.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: SPACING.md }}>
                      <Text style={[styles.storeName, isSelected && { color: COLORS.forestGreen }]}>
                        {store.name}
                      </Text>
                      <Text style={styles.storeAddress} numberOfLines={1}>{store.address}</Text>
                      <View style={styles.storeMetaRow}>
                        <View style={[styles.openBadge, !store.is_open && styles.closedBadge]}>
                          <Text style={[styles.openBadgeText, !store.is_open && styles.closedBadgeText]}>
                            {store.is_open ? "Open" : "Closed"}
                          </Text>
                        </View>
                        <Text style={styles.storeDist}>{store.distance_km} km away</Text>
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={COLORS.forestGreen} />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* Pickup Schedule */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup Schedule</Text>
          <ChipRow style={styles.pillScroll}>
            {availableDates.map((d) => (
              <Chip
                key={d.value}
                label={d.label}
                active={pickupDate === d.value}
                onPress={() => setPickupDate(d.value)}
              />
            ))}
          </ChipRow>
          {!selectedStore ? (
            <Text style={styles.slotHint}>Select a store above to see available slots.</Text>
          ) : slotsLoading ? (
            <View style={{ paddingVertical: SPACING.md }}>
              <ActivityIndicator color={COLORS.forestGreen} />
            </View>
          ) : slotData?.closed ? (
            <View style={styles.slotClosedBox}>
              <Ionicons name="close-circle" size={16} color={COLORS.error} />
              <Text style={styles.slotClosedText}>
                Store closed on this date{slotData.closed_reason ? ` — ${slotData.closed_reason}` : ""}. Pick another day.
              </Text>
            </View>
          ) : !slotData?.slots?.length ? (
            <Text style={styles.slotHint}>No slots available for this date.</Text>
          ) : (
            <View style={styles.slotGrid}>
              {slotData.slots.map((slot) => {
                const isFull = !slot.available && !slot.is_past;
                const isPast = slot.is_past;
                const isSelected = pickupSlot === slot.slot;
                return (
                  <TouchableOpacity
                    key={slot.slot}
                    style={[
                      styles.slotPill,
                      isSelected && styles.slotPillActive,
                      (isFull || isPast) && styles.slotPillDisabled,
                    ]}
                    disabled={isFull || isPast}
                    onPress={() => setPickupSlot(slot.slot)}
                  >
                    <Text style={[
                      styles.slotText,
                      isSelected && styles.slotTextActive,
                      (isFull || isPast) && styles.slotTextDisabled,
                    ]}>
                      {slot.slot}
                    </Text>
                    {isFull && <Text style={styles.slotTagFull}>Full</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "flex-start", backgroundColor: COLORS.mintGreen, padding: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.md, gap: SPACING.sm }}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.forestGreen} style={{ marginTop: 1 }} />
            <Text style={{ fontSize: 12, color: COLORS.forestGreen, flex: 1, lineHeight: 18 }}>Delivery will be scheduled by WashingBells within 24–48 hrs of pickup. You’ll be notified before delivery.</Text>
          </View>
        </View>

        {/* Special Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Instructions</Text>
          <TextInput
            style={styles.instructionsInput}
            placeholder="e.g. Handle silk carefully, separate whites..."
            placeholderTextColor={COLORS.textMuted}
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Coupon Code */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coupon Code</Text>
          {myCoupons.length > 0 && (
            <ChipRow style={{ marginBottom: SPACING.sm }}>
              {myCoupons.map((c) => (
                <Chip
                  key={c.code}
                  label={c.name ? `${c.code} — ${c.name}` : c.code}
                  active={couponCode === c.code && !!validationResult?.valid}
                  onPress={() => handleApplyCoupon(c.code)}
                />
              ))}
            </ChipRow>
          )}
          <View style={styles.couponRow}>
            <TextInput
              style={styles.couponInput}
              placeholder="Enter promo code"
              placeholderTextColor={COLORS.textMuted}
              value={couponCode}
              onChangeText={setCouponCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.couponBtn} onPress={handleValidateCoupon}>
              <Text style={styles.couponBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
          {validationResult && (
            <Text style={[styles.couponMsg, { color: validationResult.valid ? COLORS.success : COLORS.error }]}>
              {validationResult.message}
            </Text>
          )}
        </View>

        {/* WB Wallet */}
        {walletBalance > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WB Wallet</Text>
            <TouchableOpacity
              style={[styles.walletCard, useWallet && styles.walletCardActive]}
              onPress={() => setUseWallet((v) => !v)}
              activeOpacity={0.8}
            >
              <Ionicons name="wallet" size={22} color={useWallet ? COLORS.forestGreen : COLORS.textMuted} />
              <View style={{ flex: 1, marginLeft: SPACING.md }}>
                <Text style={[styles.walletTitle, useWallet && { color: COLORS.forestGreen }]}>
                  Use WB Wallet Balance
                </Text>
                <Text style={styles.walletSub}>Available: ₹{(walletBalance || 0).toFixed(2)}</Text>
              </View>
              <View style={[styles.walletCheck, useWallet && styles.walletCheckOn]}>
                {useWallet && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentRow}>
            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === "online" && styles.paymentActive]}
              onPress={() => setPaymentMethod("online")}
            >
              <Ionicons name="card-outline" size={20} color={paymentMethod === "online" ? COLORS.white : COLORS.forestGreen} />
              <Text style={[styles.paymentText, paymentMethod === "online" && styles.paymentTextActive]}>Pay Now</Text>
              <Text style={[styles.paymentSub, paymentMethod === "online" && styles.paymentTextActive]}>UPI / Card</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === "cod" && styles.paymentActive]}
              onPress={() => setPaymentMethod("cod")}
            >
              <Ionicons name="cash-outline" size={20} color={paymentMethod === "cod" ? COLORS.white : COLORS.forestGreen} />
              <Text style={[styles.paymentText, paymentMethod === "cod" && styles.paymentTextActive]}>Cash on Delivery</Text>
              <Text style={[styles.paymentSub, paymentMethod === "cod" && styles.paymentTextActive]}>Pay when delivered</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <PriceRow label={`Items (${totalItems})`} value={totalAmount} />
          <PriceRow label="Delivery" value={deliveryFee} free={deliveryFee === 0} />
          {discount > 0 && (
            <PriceRow label="Discount" value={`-₹${discount.toFixed(2)}`} positive />
          )}
          {walletApplied > 0 && (
            <PriceRow label="WB Wallet" value={`-₹${walletApplied.toFixed(2)}`} positive />
          )}
          <PriceRow label="Total" value={grandTotal} emphasis style={styles.summaryTotal} />
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <BottomBar style={styles.bottomBarRow}>
        <View>
          <Text style={styles.bottomAmount}>₹{grandTotal.toFixed(2)}</Text>
          <Text style={styles.bottomSub}>{paymentMethod === "cod" ? "Cash on Delivery" : "Pay online"}</Text>
        </View>
        <Button
          title={paymentMethod === "cod" ? "Place Order (COD)" : "Pay & Place Order"}
          onPress={handlePlaceOrder}
          loading={loading}
          disabled={!pickupSlot}
          style={{ paddingHorizontal: 24 }}
        />
      </BottomBar>

      {/* Razorpay hosted checkout (opens after the order + payment are created) */}
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
  headerPad: { paddingHorizontal: SPACING.lg },
  section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.xl },
  emailNudge: {
    backgroundColor: COLORS.mintGreen,
    marginHorizontal: SPACING.lg, marginTop: SPACING.md, marginBottom: SPACING.sm,
    padding: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.forestGreen + "30",
  },
  emailNudgeHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: 4 },
  emailNudgeTitle: { flex: 1, fontSize: 13, fontWeight: "700", color: COLORS.forestGreen },
  emailNudgeSub: { fontSize: 11, color: COLORS.textLight, marginBottom: SPACING.sm, lineHeight: 16 },
  emailNudgeRow: { flexDirection: "row", gap: SPACING.sm },
  emailNudgeInput: {
    flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 8, fontSize: 13,
  },
  emailNudgeSave: {
    backgroundColor: COLORS.forestGreen, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md, paddingVertical: 8, minWidth: 70,
    alignItems: "center", justifyContent: "center",
  },
  emailNudgeSaveText: { color: COLORS.white, fontWeight: "700", fontSize: 13 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black, marginBottom: SPACING.md },
  addressCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, padding: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  addressLabel: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  addressText: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  changeLink: { fontSize: 13, color: COLORS.gold, fontWeight: "700" },
  addAddressBtn: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.white, padding: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gold, borderStyle: "dashed" },
  addAddressText: { fontSize: 14, fontWeight: "600", color: COLORS.gold },
  pillScroll: { marginBottom: SPACING.md },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  slotPill: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.sm, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  slotPillActive: { backgroundColor: COLORS.forestGreen, borderColor: COLORS.forestGreen },
  slotPillDisabled: { backgroundColor: COLORS.borderLight, borderColor: COLORS.border, opacity: 0.65 },
  slotText: { fontSize: 12, color: COLORS.text, fontWeight: "500" },
  slotTextActive: { color: COLORS.white, fontWeight: "700" },
  slotTextDisabled: { color: COLORS.textMuted, textDecorationLine: "line-through" },
  slotTagFull: { fontSize: 9, color: COLORS.error, fontWeight: "800", letterSpacing: 0.5 },
  slotHint: { fontSize: 12, color: COLORS.textMuted, fontStyle: "italic", paddingVertical: SPACING.md },
  slotClosedBox: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: TINTS.errorBg, padding: SPACING.md, borderRadius: RADIUS.sm },
  slotClosedText: { flex: 1, fontSize: 12, color: COLORS.error, fontWeight: "600", lineHeight: 17 },
  instructionsInput: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 14, color: COLORS.text, minHeight: 80, textAlignVertical: "top" },
  couponRow: { flexDirection: "row", gap: SPACING.sm },
  couponInput: { flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 14, color: COLORS.text },
  couponBtn: { backgroundColor: COLORS.forestGreen, paddingHorizontal: SPACING.xl, borderRadius: RADIUS.md, justifyContent: "center" },
  couponBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  couponMsg: { fontSize: 12, marginTop: SPACING.xs, fontWeight: "600" },
  walletCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.lg },
  walletCardActive: { borderColor: COLORS.forestGreen, backgroundColor: COLORS.mintGreen },
  walletTitle: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  walletSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  walletCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  walletCheckOn: { backgroundColor: COLORS.forestGreen, borderColor: COLORS.forestGreen },
  paymentRow: { flexDirection: "row", gap: SPACING.md },
  paymentOption: { flex: 1, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: "center" },
  paymentActive: { backgroundColor: COLORS.forestGreen, borderColor: COLORS.forestGreen },
  paymentText: { fontSize: 13, fontWeight: "700", color: COLORS.forestGreen, marginTop: 6 },
  paymentSub: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  paymentTextActive: { color: COLORS.white },
  summaryTotal: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm, marginTop: SPACING.xs },
  bottomBarRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bottomAmount: { ...TYPE.h2, color: COLORS.black },
  bottomSub: { ...TYPE.caption, color: COLORS.textMuted },
  // Store selection
  storeLoader: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.lg },
  storeLoaderText: { fontSize: 13, color: COLORS.textMuted },
  noStoreBox: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.lg, backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  noStoreText: { fontSize: 13, color: COLORS.textMuted, flex: 1 },
  storeCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, padding: SPACING.lg, marginBottom: SPACING.sm },
  storeCardSelected: { borderColor: COLORS.forestGreen, backgroundColor: COLORS.mintGreen },
  storeCardLeft: { width: 36, height: 36, borderRadius: RADIUS.sm, backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center" },
  storeName: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  storeAddress: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  storeMetaRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.xs },
  openBadge: { backgroundColor: TINTS.successBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  openBadgeText: { fontSize: 10, fontWeight: "700", color: TINTS.successText },
  closedBadge: { backgroundColor: TINTS.errorBg },
  closedBadgeText: { color: TINTS.errorText },
  storeDist: { fontSize: 11, color: COLORS.textMuted },
});
