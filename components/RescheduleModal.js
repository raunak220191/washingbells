/**
 * RescheduleModal — bottom sheet to move an order's pickup to a new date/slot.
 * Fetches slots for the order's store via /orders/{id}/slots and PUTs the
 * change to /orders/{id}/reschedule. Works for any role tied to the order.
 */
import React, { useEffect, useState } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet,
} from "react-native";
import { COLORS, SPACING, RADIUS } from "../constants/theme";
import api from "../lib/api";

const fmtLocalDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function nextDates(n = 6) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    out.push({
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow"
        : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
      value: fmtLocalDate(d),
    });
  }
  return out;
}

export default function RescheduleModal({ visible, orderId, target = "pickup", accent = COLORS.forestGreen, onClose, onDone }) {
  const dates = nextDates();
  const [date, setDate] = useState(dates[0].value);
  const [slotData, setSlotData] = useState(null);
  const [slot, setSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !orderId) return;
    setSlot(null);
    setSlotData(null);
    setLoading(true);
    api.get(`/orders/${orderId}/slots`, { params: { date } })
      .then((res) => setSlotData(res.data))
      .catch(() => setSlotData(null))
      .finally(() => setLoading(false));
  }, [visible, orderId, date]);

  const confirm = async () => {
    if (!slot) { Alert.alert("Pick a slot", "Please select a time slot."); return; }
    setSaving(true);
    try {
      const field = target === "delivery" ? "delivery_slot" : "pickup_slot";
      await api.put(`/orders/${orderId}/reschedule`, { [field]: { date, slot } });
      onDone?.();
    } catch (e) {
      Alert.alert("Couldn't reschedule", e?.response?.data?.detail || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{target === "delivery" ? "Edit Delivery Slot" : "Reschedule Pickup"}</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
            {dates.map((d) => (
              <TouchableOpacity
                key={d.value}
                style={[styles.pill, date === d.value && { backgroundColor: accent, borderColor: accent }]}
                onPress={() => setDate(d.value)}
              >
                <Text style={[styles.pillText, date === d.value && { color: "#fff" }]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loading ? (
            <ActivityIndicator color={accent} style={{ paddingVertical: SPACING.xl }} />
          ) : slotData?.closed ? (
            <Text style={styles.hint}>Store closed on this date. Pick another day.</Text>
          ) : !slotData?.slots?.length ? (
            <Text style={styles.hint}>No slots available for this date.</Text>
          ) : (
            <View style={styles.grid}>
              {slotData.slots.map((s) => {
                const disabled = !s.available;
                const sel = slot === s.slot;
                return (
                  <TouchableOpacity
                    key={s.slot}
                    disabled={disabled}
                    onPress={() => setSlot(s.slot)}
                    style={[styles.slot, sel && { backgroundColor: accent, borderColor: accent }, disabled && styles.slotDisabled]}
                  >
                    <Text style={[styles.slotText, sel && { color: "#fff" }, disabled && styles.slotTextDisabled]}>{s.slot}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: accent }, (!slot || saving) && { opacity: 0.5 }]}
              disabled={!slot || saving}
              onPress={confirm}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Confirm</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.background, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.xl, paddingBottom: SPACING.xxxl },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: SPACING.lg },
  title: { fontSize: 18, fontWeight: "800", color: COLORS.black, marginBottom: SPACING.lg },
  pill: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.full, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, marginRight: SPACING.sm },
  pillText: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  hint: { fontSize: 13, color: COLORS.textMuted, fontStyle: "italic", paddingVertical: SPACING.lg, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.md },
  slot: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.sm, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  slotDisabled: { backgroundColor: COLORS.borderLight, opacity: 0.6 },
  slotText: { fontSize: 12, color: COLORS.text, fontWeight: "500" },
  slotTextDisabled: { color: COLORS.textMuted, textDecorationLine: "line-through" },
  actions: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.md },
  cancelBtn: { flex: 1, paddingVertical: SPACING.lg, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, alignItems: "center" },
  cancelText: { fontSize: 15, fontWeight: "700", color: COLORS.textLight },
  confirmBtn: { flex: 2, paddingVertical: SPACING.lg, borderRadius: RADIUS.full, alignItems: "center" },
  confirmText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
