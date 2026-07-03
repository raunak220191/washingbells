import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  TextInput, ActivityIndicator, Image, Linking, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { COLORS, SPACING, RADIUS } from "../../../constants/theme";
import { useTripStore } from "../../../stores/tripStore";
import RescheduleModal from "../../../components/RescheduleModal";

// Step indices per trip type
const STEPS = {
  pickup: [
    { key: "start",  label: "Start Trip",        icon: "navigate",   desc: "Head to customer location" },
    { key: "photos", label: "Take Photos",        icon: "camera",     desc: "Photograph all garments" },
    { key: "otp",    label: "Verify Pickup OTP",  icon: "keypad",     desc: "Enter OTP from customer" },
    { key: "drop",   label: "Drop at Store",      icon: "storefront", desc: "Hand clothes to the store" },
  ],
  delivery: [
    { key: "start",  label: "Start Delivery",     icon: "navigate",  desc: "Head to customer location" },
    { key: "otp",    label: "Verify Delivery OTP",icon: "keypad",    desc: "Enter OTP from customer" },
  ],
};

// Derive the current step from trip state so the screen survives navigation
function deriveStep(trip) {
  if (!trip) return 0;
  // Pickup trip past customer-pickup → on the store-drop step.
  if (trip.trip_type === "pickup" && trip.pickup_done) return 3;
  if (trip.status === "accepted") return 0;
  if (trip.status === "started") {
    if (trip.trip_type === "pickup") {
      return trip.photos_uploaded ? 2 : 1;
    }
    return 1;
  }
  return 0;
}

export default function ActiveTaskScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams();
  const {
    worklist, startTrip, uploadPhotos,
    generatePickupOTP, verifyPickupOTP,
    generateDeliveryOTP, verifyDeliveryOTP,
    generateStoreDropOTP, fetchWorklist,
  } = useTripStore();

  const trip = worklist.find(t => t.id === tripId);
  const [currentStep, setCurrentStep] = useState(() => deriveStep(trip));
  const [photos, setPhotos] = useState([]);
  const [otp, setOtp] = useState("");
  const [storeOTP, setStoreOTP] = useState(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync step from server state on mount and whenever trip changes
  useEffect(() => {
    if (!trip) {
      fetchWorklist();
    } else {
      setCurrentStep(deriveStep(trip));
    }
  }, [trip?.status, trip?.photos_uploaded, trip?.pickup_done]);

  if (!trip) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={COLORS.forestGreen} />
          <Text style={{ marginTop: SPACING.md, color: COLORS.textMuted }}>Loading trip...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const steps = STEPS[trip.trip_type] || STEPS.pickup;
  const isPickup = trip.trip_type === "pickup";

  const openMaps = (address) => {
    const encoded = encodeURIComponent(address);
    const url = Platform.OS === "ios"
      ? `maps://?q=${encoded}`
      : `geo:0,0?q=${encoded}`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://maps.google.com/?q=${encoded}`));
  };

  const handleStartTrip = async () => {
    setLoading(true);
    try {
      await startTrip(tripId);
      setCurrentStep(1);
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Could not start trip. Try again.");
    } finally { setLoading(false); }
  };

  const pickPhoto = async () => {
    // Always request camera — pickup photos must be live shots, not gallery uploads
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera Required",
        "Camera permission is required to photograph garments. Please enable it in your device Settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5, base64: true, allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhotos(prev => [...prev, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  const handleUploadPhotos = async () => {
    if (photos.length === 0) { Alert.alert("No Photos", "Please take at least 1 photo."); return; }
    setLoading(true);
    try {
      await uploadPhotos(tripId, photos);
      setCurrentStep(2);
    } catch (e) {
      Alert.alert("Upload Failed", e?.response?.data?.detail || "Failed to upload photos. Check your connection.");
    } finally { setLoading(false); }
  };

  const handleGeneratePickupOTP = async () => {
    setLoading(true);
    try {
      await generatePickupOTP(tripId);
      Alert.alert("OTP Sent", "The customer received an OTP in their app. Ask them for the code and enter it below.");
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to generate OTP.");
    } finally { setLoading(false); }
  };

  const handleGenerateDeliveryOTP = async () => {
    setLoading(true);
    try {
      await generateDeliveryOTP(tripId);
      Alert.alert("OTP Sent", "The customer received an OTP in their app. Ask them for the code and enter it below.");
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to generate OTP.");
    } finally { setLoading(false); }
  };

  const handleGenerateStoreDropOTP = async () => {
    setLoading(true);
    try {
      const res = await generateStoreDropOTP(tripId);
      setStoreOTP(res.otp);
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to generate store OTP.");
    } finally { setLoading(false); }
  };

  const handleVerifyPickupOTP = async () => {
    if (otp.length < 4) { Alert.alert("Enter OTP", "Please enter the 4-digit OTP from customer."); return; }
    setLoading(true);
    try {
      const res = await verifyPickupOTP(tripId, otp);
      if (res.store_drop_otp) setStoreOTP(res.store_drop_otp);
      setOtp("");
      // Trip stays active and advances to the Drop-at-Store step.
      await fetchWorklist();
      setCurrentStep(3);
      Alert.alert(
        "Pickup Confirmed ✅",
        `Order ${res.order_number} picked up.\nNow drop the clothes at the store and show the store-drop OTP to the owner.`
      );
    } catch (e) {
      Alert.alert("Wrong OTP", e?.response?.data?.detail || "The OTP entered is incorrect.");
    } finally { setLoading(false); }
  };

  const handleVerifyDeliveryOTP = async () => {
    if (otp.length < 4) { Alert.alert("Enter OTP", "Please enter the 4-digit OTP from customer."); return; }
    setLoading(true);
    try {
      const res = await verifyDeliveryOTP(tripId, otp);
      Alert.alert(
        "Delivered ✅",
        `Order ${res.order_number} delivered!\nYou earned ₹${res.rider_fee || 40} for this trip!`,
        [{ text: "Done", onPress: () => router.replace("/(tabs)/home") }]
      );
    } catch (e) {
      Alert.alert("Wrong OTP", e?.response?.data?.detail || "The OTP entered is incorrect.");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{isPickup ? "Pickup Task" : "Delivery Task"}</Text>
          <Text style={styles.headerOrder}>{trip.order_number}</Text>
        </View>
        <View style={styles.feeBadge}>
          <Text style={styles.feeText}>₹{trip.fee}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Step Progress */}
        <View style={styles.progressRow}>
          {steps.map((step, i) => (
            <React.Fragment key={step.key}>
              <View style={styles.stepItem}>
                <View style={[styles.stepCircle, i < currentStep && styles.stepDone, i === currentStep && styles.stepActive]}>
                  {i < currentStep ? (
                    <Ionicons name="checkmark" size={14} color={COLORS.white} />
                  ) : (
                    <Text style={[styles.stepNum, i === currentStep && styles.stepNumActive]}>{i + 1}</Text>
                  )}
                </View>
                <Text style={[styles.stepLabel, i === currentStep && styles.stepLabelActive]}>{step.label}</Text>
              </View>
              {i < steps.length - 1 && <View style={[styles.stepLine, i < currentStep && styles.stepLineDone]} />}
            </React.Fragment>
          ))}
        </View>

        {/* Address Cards */}
        <View style={styles.addressSection}>
          <TouchableOpacity style={styles.addrCard} onPress={() => openMaps(trip.pickup_address)}>
            <View style={styles.addrDotGreen} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addrLabel}>{isPickup ? "Pickup from" : "Collect from"}</Text>
              <Text style={styles.addrText}>{trip.pickup_address}</Text>
            </View>
            <Ionicons name="navigate-outline" size={20} color={COLORS.riderBlue} />
          </TouchableOpacity>
          <View style={styles.addrDivider} />
          <TouchableOpacity style={styles.addrCard} onPress={() => openMaps(trip.drop_address)}>
            <View style={styles.addrDotBlue} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addrLabel}>{isPickup ? "Drop at store" : "Deliver to"}</Text>
              <Text style={styles.addrText}>{trip.drop_address}</Text>
            </View>
            <Ionicons name="navigate-outline" size={20} color={COLORS.riderBlue} />
          </TouchableOpacity>
        </View>

        {/* Reschedule pickup (before the clothes are collected) */}
        {isPickup && !trip.pickup_done && (
          <TouchableOpacity style={styles.rescheduleRow} onPress={() => setShowReschedule(true)}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.forestGreen} />
            <Text style={styles.rescheduleRowText}>Reschedule Pickup</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}

        {/* Customer Info */}
        {trip.customer_name && (
          <View style={styles.customerCard}>
            <Ionicons name="person-circle" size={40} color={COLORS.forestGreen} />
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={styles.customerName}>{trip.customer_name}</Text>
              <Text style={styles.customerPhone}>{trip.customer_phone}</Text>
            </View>
            <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${trip.customer_phone}`)}>
              <Ionicons name="call" size={18} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 0: Start Trip ── */}
        {currentStep === 0 && (
          <View style={styles.actionCard}>
            <Ionicons name="navigate" size={32} color={COLORS.forestGreen} />
            <Text style={styles.actionTitle}>Ready to Start?</Text>
            <Text style={styles.actionDesc}>
              Tap below to start your trip and navigate to the {isPickup ? "customer" : "store"} location.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleStartTrip} disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.white} /> : (
                <>
                  <Ionicons name="navigate" size={20} color={COLORS.white} />
                  <Text style={styles.primaryBtnText}>Start Trip</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 1 (Pickup): Photo Upload ── */}
        {currentStep === 1 && isPickup && (
          <View style={styles.actionCard}>
            <Ionicons name="camera" size={32} color={COLORS.forestGreen} />
            <Text style={styles.actionTitle}>Photograph Garments</Text>
            <Text style={styles.actionDesc}>Take clear photos of all items before pickup. Minimum 1 photo required.</Text>

            <View style={styles.photosGrid}>
              {photos.map((photo, i) => (
                <View key={i} style={styles.photoThumb}>
                  <Image source={{ uri: photo }} style={styles.photoImg} />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => setPhotos(p => p.filter((_, j) => j !== i))}>
                    <Ionicons name="close-circle" size={22} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addPhotoBtn} onPress={pickPhoto}>
                <Ionicons name="camera-outline" size={24} color={COLORS.textMuted} />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, photos.length === 0 && styles.btnDisabled]}
              onPress={handleUploadPhotos}
              disabled={photos.length === 0 || loading}
            >
              {loading ? <ActivityIndicator color={COLORS.white} /> : (
                <>
                  <Ionicons name="cloud-upload" size={20} color={COLORS.white} />
                  <Text style={styles.primaryBtnText}>Upload & Continue ({photos.length})</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 2 (Pickup): Customer OTP Verify ── */}
        {currentStep === 2 && isPickup && (
          <View style={styles.actionCard}>
            <Ionicons name="keypad" size={32} color={COLORS.forestGreen} />
            <Text style={styles.actionTitle}>Verify Pickup OTP</Text>
            <Text style={styles.actionDesc}>Ask the customer for the OTP sent to their phone, then confirm pickup.</Text>

            <TouchableOpacity style={styles.secondaryBtn} onPress={handleGeneratePickupOTP} disabled={loading}>
              <Text style={styles.secondaryBtnText}>Send OTP to Customer</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.otpInput}
              placeholder="Enter 4-digit OTP"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              value={otp}
              onChangeText={setOtp}
              textAlign="center"
            />

            <TouchableOpacity
              style={[styles.primaryBtn, otp.length < 4 && styles.btnDisabled]}
              onPress={handleVerifyPickupOTP}
              disabled={otp.length < 4 || loading}
            >
              {loading ? <ActivityIndicator color={COLORS.white} /> : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                  <Text style={styles.primaryBtnText}>Confirm Pickup</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.storeDropHint}>After confirming, you'll get a store-drop OTP to hand the clothes to the store.</Text>
          </View>
        )}

        {/* ── STEP 3 (Pickup): Drop at Store ── */}
        {currentStep === 3 && isPickup && (
          <View style={styles.actionCard}>
            <Ionicons name="storefront" size={32} color={COLORS.forestGreen} />
            <Text style={styles.actionTitle}>Drop Clothes at Store</Text>
            <Text style={styles.actionDesc}>
              Take the clothes to the store and show this OTP to the owner. You'll be paid ₹{trip.fee} once they confirm receipt.
            </Text>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => openMaps(trip.drop_address)}>
              <Ionicons name="navigate" size={18} color={COLORS.forestGreen} />
              <Text style={styles.secondaryBtnText}>Navigate to Store</Text>
            </TouchableOpacity>

            {(trip.store_drop_otp || storeOTP) ? (
              <View style={styles.otpDisplay}>
                <Text style={styles.otpDisplayLabel}>Show this OTP to the store owner:</Text>
                <Text style={styles.otpDisplayCode}>{trip.store_drop_otp || storeOTP}</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.storeDropBtn} onPress={handleGenerateStoreDropOTP} disabled={loading}>
                <Ionicons name="refresh" size={16} color={COLORS.forestGreen} />
                <Text style={styles.storeDropBtnText}>Show Store-Drop OTP</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.primaryBtn, { marginTop: SPACING.lg }]} onPress={() => router.replace("/(tabs)/tasks")}>
              <Ionicons name="checkmark-done" size={20} color={COLORS.white} />
              <Text style={styles.primaryBtnText}>Done — Back to Tasks</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 1 (Delivery): OTP Verify ── */}
        {currentStep === 1 && !isPickup && (
          <View style={styles.actionCard}>
            <Ionicons name="keypad" size={32} color={COLORS.forestGreen} />
            <Text style={styles.actionTitle}>Verify Delivery OTP</Text>
            <Text style={styles.actionDesc}>Ask the customer for the OTP sent to their phone, then confirm delivery.</Text>

            {trip?.payment_status !== "paid" && (trip?.total_amount || 0) > 0 && (
              <View style={styles.cashBanner}>
                <Ionicons name="cash-outline" size={20} color={COLORS.gold} />
                <Text style={styles.cashBannerText}>
                  Collect ₹{Number(trip.total_amount).toFixed(0)} from the customer (unless they pay in the app) before confirming.
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.secondaryBtn} onPress={handleGenerateDeliveryOTP} disabled={loading}>
              <Text style={styles.secondaryBtnText}>Send OTP to Customer</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.otpInput}
              placeholder="Enter 4-digit OTP"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              value={otp}
              onChangeText={setOtp}
              textAlign="center"
            />

            <TouchableOpacity
              style={[styles.primaryBtn, otp.length < 4 && styles.btnDisabled]}
              onPress={handleVerifyDeliveryOTP}
              disabled={otp.length < 4 || loading}
            >
              {loading ? <ActivityIndicator color={COLORS.white} /> : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                  <Text style={styles.primaryBtnText}>Confirm Delivery</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <RescheduleModal
        visible={showReschedule}
        orderId={trip.order_id}
        accent={COLORS.forestGreen}
        onClose={() => setShowReschedule(false)}
        onDone={() => { setShowReschedule(false); fetchWorklist(); Alert.alert("Rescheduled", "Pickup time updated."); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  rescheduleRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.white, marginHorizontal: SPACING.lg, marginBottom: SPACING.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  rescheduleRowText: { flex: 1, fontSize: 14, fontWeight: "600", color: COLORS.forestGreen },
  header: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.forestGreen,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg, gap: SPACING.md,
  },
  backBtn: { padding: SPACING.xs },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.white },
  headerOrder: { fontSize: 12, color: COLORS.mintGreen, marginTop: 1 },
  feeBadge: {
    backgroundColor: COLORS.gold, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs, borderRadius: RADIUS.full,
  },
  feeText: { color: COLORS.white, fontWeight: "800", fontSize: 14 },

  progressRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xl },
  stepItem: { alignItems: "center", width: 72 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.borderLight,
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  stepDone: { backgroundColor: COLORS.success },
  stepActive: { backgroundColor: COLORS.forestGreen },
  stepNum: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted },
  stepNumActive: { color: COLORS.white },
  stepLabel: { fontSize: 10, color: COLORS.textMuted, textAlign: "center", fontWeight: "600" },
  stepLabelActive: { color: COLORS.forestGreen, fontWeight: "700" },
  stepLine: { flex: 1, height: 2, backgroundColor: COLORS.border, marginBottom: 18 },
  stepLineDone: { backgroundColor: COLORS.success },

  addressSection: {
    backgroundColor: COLORS.white, marginHorizontal: SPACING.lg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, overflow: "hidden", marginBottom: SPACING.md,
  },
  addrCard: { flexDirection: "row", alignItems: "center", padding: SPACING.lg, gap: SPACING.md },
  addrDotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.success },
  addrDotBlue: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.riderBlue },
  addrDivider: { height: 1, backgroundColor: COLORS.borderLight },
  addrLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600", textTransform: "uppercase", marginBottom: 2 },
  addrText: { fontSize: 14, color: COLORS.text, fontWeight: "500" },

  customerCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg, padding: SPACING.lg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md,
  },
  customerName: { fontSize: 15, fontWeight: "700", color: COLORS.black },
  customerPhone: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  callBtn: {
    backgroundColor: COLORS.success, width: 40, height: 40,
    borderRadius: 20, justifyContent: "center", alignItems: "center",
  },

  actionCard: {
    backgroundColor: COLORS.white, marginHorizontal: SPACING.lg, padding: SPACING.xl,
    borderRadius: RADIUS.lg, alignItems: "center", borderWidth: 1, borderColor: COLORS.borderLight,
  },
  actionTitle: { fontSize: 18, fontWeight: "700", color: COLORS.black, marginTop: SPACING.md, marginBottom: SPACING.sm },
  actionDesc: { fontSize: 13, color: COLORS.textMuted, textAlign: "center", lineHeight: 20, marginBottom: SPACING.xl },
  cashBanner: {
    flexDirection: "row", alignItems: "center", alignSelf: "stretch",
    backgroundColor: COLORS.cream, borderWidth: 1, borderColor: COLORS.gold,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg, gap: SPACING.sm,
  },
  cashBannerText: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 18, fontWeight: "600" },

  primaryBtn: {
    flexDirection: "row", backgroundColor: COLORS.forestGreen,
    paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xxl,
    borderRadius: RADIUS.full, alignItems: "center", gap: SPACING.sm,
    width: "100%", justifyContent: "center", marginTop: SPACING.md,
  },
  primaryBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1.5, borderColor: COLORS.forestGreen,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxl,
    borderRadius: RADIUS.full, marginBottom: SPACING.md,
  },
  secondaryBtnText: { color: COLORS.forestGreen, fontWeight: "700", fontSize: 14 },
  btnDisabled: { opacity: 0.4 },

  photosGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.md, width: "100%" },
  photoThumb: { width: 80, height: 80, borderRadius: RADIUS.md, overflow: "visible" },
  photoImg: { width: 80, height: 80, borderRadius: RADIUS.md },
  photoRemove: { position: "absolute", top: -8, right: -8 },
  addPhotoBtn: {
    width: 80, height: 80, borderRadius: RADIUS.md, borderWidth: 1.5,
    borderColor: COLORS.border, borderStyle: "dashed",
    justifyContent: "center", alignItems: "center",
  },
  addPhotoText: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },

  otpInput: {
    width: "100%", backgroundColor: COLORS.background,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.lg, fontSize: 28, color: COLORS.black,
    letterSpacing: 12, marginBottom: SPACING.md,
  },

  // Store drop OTP — clearly separated from customer OTP
  storeDropDivider: {
    width: "100%", marginTop: SPACING.xl, paddingTop: SPACING.lg,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
    alignItems: "center",
  },
  storeDropDividerText: { fontSize: 11, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  storeDropHint: { fontSize: 12, color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.sm, marginBottom: SPACING.md, lineHeight: 18 },
  storeDropBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    borderWidth: 1.5, borderColor: COLORS.forestGreen,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
  },
  storeDropBtnText: { color: COLORS.forestGreen, fontWeight: "700", fontSize: 13 },
  otpDisplay: {
    backgroundColor: COLORS.mintGreen, padding: SPACING.lg, borderRadius: RADIUS.lg,
    alignItems: "center", width: "100%", marginTop: SPACING.md,
  },
  otpDisplayLabel: { fontSize: 12, color: COLORS.forestGreen, marginBottom: SPACING.sm, fontWeight: "600" },
  otpDisplayCode: { fontSize: 36, fontWeight: "900", color: COLORS.forestGreen, letterSpacing: 8 },
});
