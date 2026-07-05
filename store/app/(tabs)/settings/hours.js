import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Alert, ActivityIndicator, Modal, Platform, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { COLORS, SPACING, RADIUS } from "../../../constants/theme";
import api from "../../../lib/api";

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

const DEFAULT_DAY = { open: "09:00", close: "21:00", closed: false };

function parseTimeToDate(s) {
  // "HH:MM" -> Date (today, that time)
  const [h, m] = (s || "09:00").split(":").map(n => parseInt(n, 10));
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function dateToTime(d) {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isoToFriendly(iso) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

export default function HoursScreen() {
  const router = useRouter();
  const [hours, setHours] = useState(null);
  const [capacity, setCapacity] = useState(6);
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickingFor, setPickingFor] = useState(null);
  // closure modal
  const [showClosure, setShowClosure] = useState(false);
  const [closureDate, setClosureDate] = useState(todayISO());
  const [closureReason, setClosureReason] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/store-ops/hours");
      const h = {};
      for (const d of DAYS) {
        h[d.key] = { ...DEFAULT_DAY, ...(res.data.operating_hours?.[d.key] || {}) };
      }
      setHours(h);
      setCapacity(res.data.slot_capacity_per_hour || 6);
      setClosures(res.data.closures || []);
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to load hours.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/store-ops/hours", {
        operating_hours: hours,
        slot_capacity_per_hour: capacity,
      });
      Alert.alert("Saved", "Your store hours are updated.");
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Save failed.");
    } finally { setSaving(false); }
  };

  const handleAddClosure = async () => {
    if (!closureDate) { Alert.alert("Pick a date"); return; }
    try {
      await api.post("/store-ops/closures", { date: closureDate, reason: closureReason || "Closed" });
      setShowClosure(false);
      setClosureReason("");
      await load();
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to add closure.");
    }
  };

  const handleRemoveClosure = async (id) => {
    try {
      await api.delete(`/store-ops/closures/${id}`);
      await load();
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to remove.");
    }
  };

  if (loading || !hours) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerNav}>
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/settings"))} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Hours</Text>
          <View style={{ width: 32 }} />
        </View>
        <ActivityIndicator color={COLORS.storeOrange} size="large" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerNav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Hours</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>{saving ? "..." : "Save"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Weekly Schedule */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Schedule</Text>
          <Text style={styles.sectionHint}>These hours decide which pickup and delivery slots customers can pick.</Text>
          <View style={styles.card}>
            {DAYS.map((d, i) => {
              const v = hours[d.key];
              return (
                <View key={d.key} style={[styles.dayRow, i === DAYS.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={styles.dayLabel}>{d.label}</Text>
                  {v.closed ? (
                    <Text style={styles.dayClosed}>Closed</Text>
                  ) : (
                    <View style={styles.timeRow}>
                      <TouchableOpacity style={styles.timePill} onPress={() => setPickingFor({ day: d.key, which: "open" })}>
                        <Text style={styles.timeText}>{v.open}</Text>
                      </TouchableOpacity>
                      <Text style={styles.timeSep}>–</Text>
                      <TouchableOpacity style={styles.timePill} onPress={() => setPickingFor({ day: d.key, which: "close" })}>
                        <Text style={styles.timeText}>{v.close}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <Switch
                    value={!v.closed}
                    onValueChange={val => setHours(prev => ({ ...prev, [d.key]: { ...prev[d.key], closed: !val } }))}
                    trackColor={{ false: COLORS.border, true: "#FFE0B2" }}
                    thumbColor={!v.closed ? COLORS.storeOrange : COLORS.textMuted}
                  />
                </View>
              );
            })}
          </View>
        </View>

        {/* Capacity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Orders per hour</Text>
          <Text style={styles.sectionHint}>How many orders can you handle in one slot? Slots that hit this cap will be hidden from customers.</Text>
          <View style={styles.capacityRow}>
            {[2, 4, 6, 8, 10, 15].map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.capacityPill, capacity === n && styles.capacityPillActive]}
                onPress={() => setCapacity(n)}
              >
                <Text style={[styles.capacityText, capacity === n && styles.capacityTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Holiday Closures */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Upcoming Closures</Text>
            <TouchableOpacity style={styles.addClosureBtn} onPress={() => { setClosureDate(todayISO()); setClosureReason(""); setShowClosure(true); }}>
              <Ionicons name="add" size={14} color={COLORS.white} />
              <Text style={styles.addClosureText}>Add</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionHint}>Block specific dates (holidays, events). Customers can&apos;t book slots on those dates.</Text>
          {closures.length === 0 ? (
            <View style={styles.emptyClosures}>
              <Ionicons name="calendar-outline" size={28} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No upcoming closures</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {closures.map((c, i) => (
                <View key={c.id} style={[styles.closureRow, i === closures.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.closureDate}>{isoToFriendly(c.date)}</Text>
                    {!!c.reason && <Text style={styles.closureReason}>{c.reason}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveClosure(c.id)}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Time Picker */}
      {pickingFor && (
        <DateTimePicker
          value={parseTimeToDate(hours[pickingFor.day][pickingFor.which])}
          mode="time"
          is24Hour
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            if (Platform.OS === "android") setPickingFor(null);
            if (event.type === "dismissed") { setPickingFor(null); return; }
            if (selectedDate) {
              const newTime = dateToTime(selectedDate);
              setHours(prev => ({
                ...prev,
                [pickingFor.day]: { ...prev[pickingFor.day], [pickingFor.which]: newTime },
              }));
              if (Platform.OS === "ios") setPickingFor(null);
            }
          }}
        />
      )}

      {/* Closure Modal */}
      <Modal visible={showClosure} transparent animationType="fade" onRequestClose={() => setShowClosure(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Closure</Text>
            <TouchableOpacity style={styles.modalDateBtn} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.storeOrange} />
              <Text style={styles.modalDateText}>{isoToFriendly(closureDate)}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={new Date(closureDate + "T00:00:00")}
                mode="date"
                minimumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setClosureDate(selectedDate.toISOString().slice(0, 10));
                }}
              />
            )}
            <Text style={styles.modalLabel}>Reason (optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={closureReason}
              onChangeText={setClosureReason}
              placeholder="e.g. Diwali, Maintenance"
              placeholderTextColor={COLORS.textMuted}
              maxLength={120}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setShowClosure(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddClosure}>
                <Text style={styles.modalConfirm}>Add Closure</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  saveBtn: { fontSize: 14, fontWeight: "700", color: COLORS.storeOrange, paddingHorizontal: SPACING.sm, paddingVertical: 4 },

  section: { marginTop: SPACING.lg, marginHorizontal: SPACING.lg },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.xs },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: COLORS.textLight, textTransform: "uppercase", letterSpacing: 0.5 },
  sectionHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, marginBottom: SPACING.sm, lineHeight: 17 },

  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  dayRow: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  dayLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: COLORS.black },
  dayClosed: { fontSize: 12, color: COLORS.textMuted, fontWeight: "600", marginRight: SPACING.md, fontStyle: "italic" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: SPACING.xs, marginRight: SPACING.md },
  timePill: { backgroundColor: COLORS.background, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.border },
  timeText: { fontSize: 13, fontWeight: "700", color: COLORS.black },
  timeSep: { color: COLORS.textMuted },

  capacityRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  capacityPill: { backgroundColor: COLORS.white, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, minWidth: 50, alignItems: "center" },
  capacityPillActive: { backgroundColor: COLORS.storeOrange, borderColor: COLORS.storeOrange },
  capacityText: { fontSize: 14, fontWeight: "700", color: COLORS.textLight },
  capacityTextActive: { color: COLORS.white },

  addClosureBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.storeOrange, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full },
  addClosureText: { color: COLORS.white, fontSize: 12, fontWeight: "700" },
  emptyClosures: { alignItems: "center", paddingVertical: SPACING.lg, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed" },
  emptyText: { fontSize: 12, color: COLORS.textMuted, marginTop: SPACING.sm },
  closureRow: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  closureDate: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  closureReason: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: SPACING.lg },
  modalCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg },
  modalTitle: { fontSize: 16, fontWeight: "800", color: COLORS.black, marginBottom: SPACING.md },
  modalDateBtn: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.background, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  modalDateText: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  modalLabel: { fontSize: 12, color: COLORS.textLight, marginTop: SPACING.md, marginBottom: 4 },
  modalInput: { backgroundColor: COLORS.background, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, color: COLORS.text },
  modalBtnRow: { flexDirection: "row", justifyContent: "flex-end", gap: SPACING.lg, marginTop: SPACING.lg },
  modalCancel: { fontSize: 14, fontWeight: "600", color: COLORS.textMuted },
  modalConfirm: { fontSize: 14, fontWeight: "800", color: COLORS.storeOrange },
});
