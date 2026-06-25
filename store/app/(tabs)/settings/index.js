import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../../constants/theme";
import { useAuthStore } from "../../../stores/authStore";
import { useOrderStore } from "../../../stores/orderStore";
import { useRouter } from "expo-router";
import api from "../../../lib/api";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, store, refreshStore, logout } = useAuthStore();
  const { toggleStore } = useOrderStore();
  const [toggling, setToggling] = useState(false);
  const [editEmail, setEditEmail] = useState(false);
  const [emailValue, setEmailValue] = useState(user?.email || "");
  const [savingEmail, setSavingEmail] = useState(false);
  const isOpen = store?.is_open || false;

  const handleSaveEmail = async () => {
    const trimmed = (emailValue || "").trim().toLowerCase();
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert("Invalid Email", "Please enter a valid email address."); return;
    }
    setSavingEmail(true);
    try {
      await api.put("/users/me", { email: trimmed || null });
      // Update local user object via authStore initialize fetch
      const { initialize } = useAuthStore.getState();
      await initialize();
      setEditEmail(false);
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to update email.");
    } finally {
      setSavingEmail(false);
    }
  };

  const handleToggle = async (val) => {
    setToggling(true);
    try {
      await toggleStore(val);
      await refreshStore();
    } catch (e) {
      Alert.alert("Error", "Could not update store status.");
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/login"); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Store Status Toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Store Status</Text>
          <View style={styles.toggleCard}>
            <View style={styles.toggleLeft}>
              <View style={[styles.statusDot, { backgroundColor: isOpen ? COLORS.success : COLORS.error }]} />
              <View>
                <Text style={styles.toggleTitle}>{isOpen ? "Store is OPEN" : "Store is CLOSED"}</Text>
                <Text style={styles.toggleSub}>{isOpen ? "Accepting new orders" : "Not accepting orders"}</Text>
              </View>
            </View>
            {toggling ? (
              <ActivityIndicator color={COLORS.storeOrange} />
            ) : (
              <Switch
                value={isOpen}
                onValueChange={handleToggle}
                trackColor={{ false: COLORS.border, true: "#FFE0B2" }}
                thumbColor={isOpen ? COLORS.storeOrange : COLORS.textMuted}
              />
            )}
          </View>
        </View>

        {/* Store Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Store Information</Text>
          <View style={styles.infoCard}>
            {[
              { icon: "storefront-outline", label: "Store Name", value: store?.name },
              { icon: "barcode-outline", label: "Vendor Code", value: store?.vendor_code },
              { icon: "location-outline", label: "Address", value: store?.address },
              { icon: "call-outline", label: "Phone", value: store?.phone },
              { icon: "time-outline", label: "Hours", value: `${store?.opening_time || "09:00"} – ${store?.closing_time || "21:00"}` },
            ].map((item, i, arr) => (
              <View key={i} style={[styles.infoRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                <Ionicons name={item.icon} size={18} color={COLORS.storeOrange} />
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value || "—"}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Owner Email — used for notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Owner Email</Text>
          <View style={styles.emailCard}>
            <Ionicons name="mail-outline" size={20} color={COLORS.storeOrange} />
            {editEmail ? (
              <View style={{ flex: 1, marginLeft: SPACING.md }}>
                <TextInput
                  style={styles.emailInput}
                  value={emailValue}
                  onChangeText={setEmailValue}
                  placeholder="your@email.com"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  autoFocus
                />
                <View style={styles.emailBtnRow}>
                  <TouchableOpacity onPress={() => { setEditEmail(false); setEmailValue(user?.email || ""); }}>
                    <Text style={styles.emailCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveEmail} disabled={savingEmail}>
                    <Text style={[styles.emailSave, savingEmail && { opacity: 0.5 }]}>{savingEmail ? "Saving..." : "Save"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  {user?.email ? (
                    <>
                      <Text style={styles.emailValue}>{user.email}</Text>
                      <Text style={styles.emailMeta}>New orders and payouts will email here</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.emailValueMuted}>Not set</Text>
                      <Text style={styles.emailMeta}>Add an email to receive new-order alerts and payout receipts.</Text>
                    </>
                  )}
                </View>
                <TouchableOpacity onPress={() => { setEmailValue(user?.email || ""); setEditEmail(true); }}>
                  <Text style={styles.emailEdit}>{user?.email ? "Edit" : "Add"}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Approval Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Status</Text>
          <View style={styles.approvalCard}>
            <Ionicons
              name={store?.approved ? "checkmark-circle" : "time-outline"}
              size={24}
              color={store?.approved ? COLORS.success : COLORS.warning}
            />
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={styles.approvalTitle}>
                {store?.approved ? "Store Approved ✅" : "Pending Admin Approval ⏳"}
              </Text>
              <Text style={styles.approvalSub}>
                {store?.approved
                  ? "Your store is verified and active."
                  : "Your store is under review. You'll be notified once approved."}
              </Text>
            </View>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.section}>
          <View style={styles.menuCard}>
            {[
              { icon: "time-outline", label: "My Hours & Closures", onPress: () => router.push("/(tabs)/settings/hours") },
              { icon: "help-circle-outline", label: "Help & Support", onPress: () => {} },
              { icon: "document-text-outline", label: "Terms & Conditions", onPress: () => {} },
              { icon: "shield-checkmark-outline", label: "Privacy Policy", onPress: () => {} },
            ].map((item, i, arr) => (
              <TouchableOpacity key={i} style={[styles.menuItem, i === arr.length - 1 && { borderBottomWidth: 0 }]} onPress={item.onPress}>
                <Ionicons name={item.icon} size={20} color={COLORS.storeOrange} />
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        <Text style={styles.version}>WashingBells Store v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg },
  headerTitle: { fontSize: 24, fontWeight: "700", color: COLORS.black },
  section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.xl },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.black, marginBottom: SPACING.md },
  toggleCard: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.white, padding: SPACING.lg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: SPACING.md, flex: 1 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  toggleTitle: { fontSize: 15, fontWeight: "700", color: COLORS.black },
  toggleSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  infoCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  infoLabel: { fontSize: 11, color: COLORS.textMuted },
  infoValue: { fontSize: 14, color: COLORS.text, fontWeight: "500", marginTop: 2 },
  approvalCard: { flexDirection: "row", alignItems: "flex-start", backgroundColor: COLORS.white, padding: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  emailCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, padding: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  emailValue: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  emailValueMuted: { fontSize: 14, fontWeight: "600", color: COLORS.textMuted, fontStyle: "italic" },
  emailMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  emailEdit: { fontSize: 13, fontWeight: "700", color: COLORS.storeOrange, paddingHorizontal: SPACING.sm },
  emailInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 6, fontSize: 14, color: COLORS.black },
  emailBtnRow: { flexDirection: "row", justifyContent: "flex-end", gap: SPACING.md, marginTop: SPACING.sm },
  emailCancel: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
  emailSave: { fontSize: 13, fontWeight: "700", color: COLORS.storeOrange },
  approvalTitle: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  approvalSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, lineHeight: 18 },
  menuCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  menuLabel: { fontSize: 15, color: COLORS.text, fontWeight: "500" },
  logoutBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.md, paddingVertical: SPACING.lg },
  logoutText: { fontSize: 16, fontWeight: "600", color: COLORS.error },
  version: { textAlign: "center", fontSize: 12, color: COLORS.textMuted, marginTop: SPACING.sm, marginBottom: 40 },
});
