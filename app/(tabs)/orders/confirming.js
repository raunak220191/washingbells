import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS } from "../../../constants/theme";
import Screen from "../../../components/common/Screen";
import api from "../../../lib/api";

const POLL_INTERVAL_MS = 5000;

export default function ConfirmingScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams();

  const [phase, setPhase] = useState("polling"); // polling | confirmed | rejected
  const [orderNumber, setOrderNumber] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  // Dot-bounce animation for the waiting state
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -8, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      );
    bounce(dot1, 0).start();
    bounce(dot2, 200).start();
    bounce(dot3, 400).start();
  }, []);

  const intervalRef = useRef(null);

  useEffect(() => {
    if (!orderId) return;

    const poll = async () => {
      try {
        const res = await api.get(`/orders/${orderId}`);
        const order = res.data;
        setOrderNumber(order.order_number);

        if (order.status === "confirmed") {
          clearInterval(intervalRef.current);
          setPhase("confirmed");
          // Auto-navigate to orders list after 2.5 s
          setTimeout(() => router.replace("/(tabs)/orders"), 2500);
        } else if (order.status === "rejected" || order.status === "cancelled") {
          clearInterval(intervalRef.current);
          const tl = order.status_timeline || [];
          const entry = [...tl].reverse().find((e) => e.status === "rejected");
          setRejectNote(entry?.note || "Store could not accept your order.");
          setPhase("rejected");
        }
      } catch {
        // network hiccup — keep polling
      }
    };

    poll(); // immediate first check
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [orderId]);

  if (phase === "confirmed") {
    return (
      <Screen padded={false} contentContainerStyle={styles.center}>
        <Ionicons name="checkmark-circle" size={80} color={COLORS.success} />
        <Text style={styles.bigTitle}>Order Confirmed!</Text>
        <Text style={styles.sub}>
          {orderNumber ? `Order ${orderNumber} accepted by the store.` : "Your order has been accepted."}
        </Text>
        <Text style={styles.subMuted}>Taking you to your orders…</Text>
      </Screen>
    );
  }

  if (phase === "rejected") {
    return (
      <Screen padded={false} contentContainerStyle={styles.center}>
        <Ionicons name="close-circle" size={80} color={COLORS.error} />
        <Text style={styles.bigTitle}>Order Not Accepted</Text>
        <Text style={styles.sub}>{rejectNote}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => router.replace("/(tabs)/basket/checkout")}
        >
          <Text style={styles.retryBtnText}>Choose a Different Store</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ordersLink}
          onPress={() => router.replace("/(tabs)/orders")}
        >
          <Text style={styles.ordersLinkText}>View My Orders</Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  // polling
  return (
    <Screen padded={false} contentContainerStyle={styles.center}>
      <View style={styles.iconRing}>
        <Ionicons name="storefront" size={40} color={COLORS.gold} />
      </View>
      <Text style={styles.bigTitle}>Waiting for Store</Text>
      <Text style={styles.sub}>
        {orderNumber
          ? `Order ${orderNumber} sent to the store.`
          : "Your order has been placed."}
      </Text>
      <Text style={styles.subMuted}>The store is reviewing your order…</Text>
      <View style={styles.dots}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { transform: [{ translateY: dot }] }]}
          />
        ))}
      </View>
      <TouchableOpacity
        style={styles.ordersLink}
        onPress={() => router.replace("/(tabs)/orders")}
      >
        <Text style={styles.ordersLinkText}>View My Orders</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.xxxl },
  iconRing: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.cream, justifyContent: "center", alignItems: "center", marginBottom: SPACING.xl },
  bigTitle: { fontSize: 24, fontWeight: "700", color: COLORS.black, marginBottom: SPACING.md, textAlign: "center" },
  sub: { fontSize: 15, color: COLORS.text, textAlign: "center", marginBottom: SPACING.sm },
  subMuted: { fontSize: 13, color: COLORS.textMuted, textAlign: "center", marginBottom: SPACING.xxl },
  dots: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.xxxl },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.gold },
  retryBtn: { backgroundColor: COLORS.forestGreen, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxxl, borderRadius: RADIUS.full, marginBottom: SPACING.md },
  retryBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },
  ordersLink: { paddingVertical: SPACING.sm },
  ordersLinkText: { fontSize: 14, color: COLORS.gold, fontWeight: "600" },
});
