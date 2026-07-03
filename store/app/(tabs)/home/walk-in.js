import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { COLORS, SPACING, RADIUS, SHADOW } from "../../../constants/theme";
import { useOrderStore } from "../../../stores/orderStore";
import { useAuthStore } from "../../../stores/authStore";
import { printOrderInvoice, shareOrderInvoice } from "../../../lib/printTags";
import api from "../../../lib/api";

const PAYMENT_METHODS = [
  { key: "cash", label: "Cash", icon: "cash-outline" },
  { key: "upi", label: "UPI", icon: "qr-code-outline" },
  { key: "online", label: "Online", icon: "card-outline" },
];

export default function WalkInScreen() {
  const router = useRouter();
  const { store } = useAuthStore();
  const { lookupCustomer, createWalkInOrder } = useOrderStore();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  // customer
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);

  // cart keyed by `${serviceId}:${itemId}`
  const [cart, setCart] = useState({});

  // fulfillment + payment
  const [fulfillment, setFulfillment] = useState("counter_pickup");
  const [payment, setPayment] = useState("cash");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState(store?.city || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/services");
        setServices((res.data || []).filter((s) => s.active !== false));
      } catch (e) {
        Alert.alert("Error", "Failed to load catalog.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLookup = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { Alert.alert("Phone", "Enter a valid 10-digit phone number."); return; }
    setLookupBusy(true);
    try {
      const res = await lookupCustomer(phone);
      setLookupDone(true);
      if (res.found && res.name) setName(res.name);
      Alert.alert(res.found ? "Existing Customer" : "New Customer",
        res.found ? `Found: ${res.name || res.phone}` : "No record found — a new customer will be created.");
    } catch (e) {
      Alert.alert("Lookup failed", e?.response?.data?.detail || "Try again.");
    } finally {
      setLookupBusy(false);
    }
  };

  const itemKey = (sid, iid) => `${sid}:${iid}`;
  const getQty = (sid, iid) => cart[itemKey(sid, iid)]?.qty || 0;

  const setQty = (svc, item, qty) => {
    const key = itemKey(svc.id, item.id);
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) { delete next[key]; }
      else {
        next[key] = { service_id: svc.id, item_id: item.id, service_name: svc.name, name: item.name, price: item.price, qty };
      }
      return next;
    });
  };

  const cartItems = Object.values(cart);
  const subtotal = cartItems.reduce((s, c) => s + c.price * c.qty, 0);
  const totalQty = cartItems.reduce((s, c) => s + c.qty, 0);
  const deliveryFee = fulfillment === "rider_delivery" && subtotal < 299 ? 40 : 0;
  const total = subtotal + deliveryFee;

  const handleSubmit = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { Alert.alert("Phone", "Enter a valid 10-digit phone number."); return; }
    if (cartItems.length === 0) { Alert.alert("Items", "Add at least one item."); return; }
    if (fulfillment === "rider_delivery" && !address.trim()) {
      Alert.alert("Address", "Enter a delivery address for rider delivery."); return;
    }
    const payload = {
      customer_phone: phone,
      customer_name: name.trim(),
      items: cartItems.map((c) => ({ service_id: c.service_id, item_id: c.item_id, quantity: c.qty })),
      fulfillment_mode: fulfillment,
      payment_method: payment,
      special_instructions: null,
    };
    if (fulfillment === "rider_delivery") {
      // Geocode the typed address so the delivery rider routes to the CUSTOMER,
      // not the store. Fall back to the store's area if geocoding finds nothing.
      let lat = store?.latitude;
      let lng = store?.longitude;
      let located = false;
      try {
        const results = await Location.geocodeAsync(address.trim());
        if (results && results.length && results[0]?.latitude != null) {
          lat = results[0].latitude;
          lng = results[0].longitude;
          located = true;
        }
      } catch (e) {
        // ignore — fall back to store coords
      }
      if (!located) {
        const proceed = await new Promise((resolve) =>
          Alert.alert(
            "Couldn't pin the address",
            "We couldn't locate that address on the map, so the rider will be routed to your store area. Continue anyway?",
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Continue", onPress: () => resolve(true) },
            ]
          )
        );
        if (!proceed) return;
      }
      payload.address = {
        full_address: address.trim(),
        city: city.trim() || store?.city || "",
        latitude: lat,
        longitude: lng,
        label: "Delivery",
        geocoded: located,
      };
    }
    setSubmitting(true);
    try {
      const res = await createWalkInOrder(payload);
      Alert.alert(
        "Order Created",
        `${res.order_number} • ₹${Number(res.total_amount).toFixed(0)} (${res.payment_status})`,
        [
          {
            text: "Print Bill",
            onPress: async () => {
              try { await printOrderInvoice(res.id, res.order_number); }
              catch (e) {
                try { await shareOrderInvoice(res.id, res.order_number); }
                catch (e2) { Alert.alert("Bill", e?.message || e2?.message || "Could not open the bill — try again from the order screen."); }
              }
              router.replace(`/(tabs)/orders/${res.id}`);
            },
          },
          { text: "View Order", onPress: () => router.replace(`/(tabs)/orders/${res.id}`) },
        ]
      );
    } catch (e) {
      Alert.alert("Failed", e?.response?.data?.detail || "Could not create order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Walk-in Order</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
          {/* Customer */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Customer</Text>
            <View style={styles.phoneRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Phone number (10 digits)"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={13}
              />
              <TouchableOpacity style={styles.lookupBtn} onPress={handleLookup} disabled={lookupBusy}>
                {lookupBusy ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <Text style={styles.lookupBtnText}>Look up</Text>}
              </TouchableOpacity>
            </View>
            {lookupDone && (
              <TextInput
                style={styles.input}
                placeholder="Customer name"
                placeholderTextColor={COLORS.textMuted}
                value={name}
                onChangeText={setName}
              />
            )}
          </View>

          {/* Catalog */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Items</Text>
            {loading ? (
              <ActivityIndicator color={COLORS.storeOrange} style={{ marginVertical: 20 }} />
            ) : (
              services.map((svc) => {
                const open = expanded === svc.id;
                const count = (svc.items || []).reduce((s, it) => s + getQty(svc.id, it.id), 0);
                return (
                  <View key={svc.id} style={styles.svcBlock}>
                    <TouchableOpacity style={styles.svcHeader} onPress={() => setExpanded(open ? null : svc.id)}>
                      <Ionicons name={svc.icon || "shirt-outline"} size={18} color={COLORS.storeOrange} />
                      <Text style={styles.svcName}>{svc.name}</Text>
                      {count > 0 && <View style={styles.svcCount}><Text style={styles.svcCountText}>{count}</Text></View>}
                      <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={COLORS.textMuted} />
                    </TouchableOpacity>
                    {open && (svc.items || []).map((item) => {
                      const qty = getQty(svc.id, item.id);
                      return (
                        <View key={item.id} style={styles.itemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <Text style={styles.itemMeta}>
                              ₹{item.price}{item.category && item.category !== "unisex" ? ` · ${item.category}` : ""}
                            </Text>
                          </View>
                          {qty === 0 ? (
                            <TouchableOpacity style={styles.addBtn} onPress={() => setQty(svc, item, 1)}>
                              <Text style={styles.addBtnText}>ADD</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.stepper}>
                              <TouchableOpacity onPress={() => setQty(svc, item, qty - 1)} style={styles.stepBtn}>
                                <Ionicons name="remove" size={16} color={COLORS.storeOrange} />
                              </TouchableOpacity>
                              <Text style={styles.stepQty}>{qty}</Text>
                              <TouchableOpacity onPress={() => setQty(svc, item, qty + 1)} style={styles.stepBtn}>
                                <Ionicons name="add" size={16} color={COLORS.storeOrange} />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                );
              })
            )}
          </View>

          {/* Handoff */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Handoff of finished clothes</Text>
            <View style={styles.segRow}>
              {[
                { key: "counter_pickup", label: "Counter Pickup", icon: "storefront-outline" },
                { key: "rider_delivery", label: "Rider Delivery", icon: "bicycle-outline" },
              ].map((opt) => {
                const active = fulfillment === opt.key;
                return (
                  <TouchableOpacity key={opt.key} style={[styles.seg, active && styles.segActive]} onPress={() => setFulfillment(opt.key)}>
                    <Ionicons name={opt.icon} size={18} color={active ? COLORS.white : COLORS.textLight} />
                    <Text style={[styles.segText, active && styles.segTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {fulfillment === "rider_delivery" && (
              <>
                <TextInput
                  style={[styles.input, { marginTop: SPACING.md }]}
                  placeholder="Delivery address"
                  placeholderTextColor={COLORS.textMuted}
                  value={address}
                  onChangeText={setAddress}
                  multiline
                />
                <TextInput
                  style={styles.input}
                  placeholder="City"
                  placeholderTextColor={COLORS.textMuted}
                  value={city}
                  onChangeText={setCity}
                />
              </>
            )}
          </View>

          {/* Payment */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <View style={styles.segRow}>
              {PAYMENT_METHODS.map((pm) => {
                const active = payment === pm.key;
                return (
                  <TouchableOpacity key={pm.key} style={[styles.seg, active && styles.segActive]} onPress={() => setPayment(pm.key)}>
                    <Ionicons name={pm.icon} size={18} color={active ? COLORS.white : COLORS.textLight} />
                    <Text style={[styles.segText, active && styles.segTextActive]}>{pm.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.payHint}>
              {payment === "online" ? "Customer pays online — marked pending until paid." : "Collected at counter — marked paid on creation."}
            </Text>
          </View>
        </ScrollView>

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          <View>
            <Text style={styles.barItems}>{totalQty} item{totalQty !== 1 ? "s" : ""}{deliveryFee ? "  (+₹40 delivery)" : ""}</Text>
            <Text style={styles.barTotal}>₹{total.toFixed(0)}</Text>
          </View>
          <TouchableOpacity style={[styles.submitBtn, (submitting || totalQty === 0) && { opacity: 0.5 }]} onPress={handleSubmit} disabled={submitting || totalQty === 0}>
            {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitText}>Create & Bill</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 19, fontWeight: "700", color: COLORS.black },
  card: { backgroundColor: COLORS.white, marginHorizontal: SPACING.lg, marginTop: SPACING.md, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOW },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.black, marginBottom: SPACING.md },
  phoneRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.sm },
  input: { backgroundColor: COLORS.background, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm },
  lookupBtn: { backgroundColor: COLORS.storeOrange, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, justifyContent: "center", alignItems: "center" },
  lookupBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 13 },
  svcBlock: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, paddingVertical: SPACING.xs },
  svcHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.sm },
  svcName: { flex: 1, fontSize: 14, fontWeight: "600", color: COLORS.text },
  svcCount: { backgroundColor: COLORS.storeOrange, borderRadius: 10, minWidth: 20, height: 20, justifyContent: "center", alignItems: "center", paddingHorizontal: 5 },
  svcCountText: { color: COLORS.white, fontSize: 11, fontWeight: "700" },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.sm, paddingLeft: SPACING.lg },
  itemName: { fontSize: 14, color: COLORS.text },
  itemMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  addBtn: { borderWidth: 1.5, borderColor: COLORS.storeOrange, borderRadius: RADIUS.sm, paddingVertical: 5, paddingHorizontal: 18 },
  addBtnText: { color: COLORS.storeOrange, fontWeight: "700", fontSize: 12 },
  stepper: { flexDirection: "row", alignItems: "center", gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  stepBtn: { padding: 4 },
  stepQty: { fontSize: 14, fontWeight: "700", color: COLORS.text, minWidth: 18, textAlign: "center" },
  segRow: { flexDirection: "row", gap: SPACING.sm },
  seg: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  segActive: { backgroundColor: COLORS.storeOrange, borderColor: COLORS.storeOrange },
  segText: { fontSize: 13, fontWeight: "600", color: COLORS.textLight },
  segTextActive: { color: COLORS.white },
  payHint: { fontSize: 12, color: COLORS.textMuted, marginTop: SPACING.sm },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.white, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.border, ...SHADOW },
  barItems: { fontSize: 12, color: COLORS.textLight },
  barTotal: { fontSize: 22, fontWeight: "800", color: COLORS.black },
  submitBtn: { backgroundColor: COLORS.storeOrange, borderRadius: RADIUS.md, paddingHorizontal: 28, paddingVertical: 14, minWidth: 140, alignItems: "center" },
  submitText: { color: COLORS.white, fontWeight: "800", fontSize: 15 },
});
