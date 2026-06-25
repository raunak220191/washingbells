import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS } from "../../../constants/theme";
import { useAuthStore } from "../../../stores/authStore";
import { useTripStore } from "../../../stores/tripStore";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshProfile } = useAuthStore();
  const { setOnline } = useTripStore();

  const isOnline = user?.rider_status === "online" || user?.rider_status === "on_trip";

  const handleToggleStatus = async (value) => {
    if (!user?.rider_approved) {
      Alert.alert("Not Approved", "Your account is pending admin approval.");
      return;
    }
    try {
      await setOnline(value ? "online" : "offline");
      await refreshProfile();
    } catch {
      Alert.alert("Error", "Could not update status.");
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/login"); } },
    ]);
  };

  const initials = user?.name ? user.name.charAt(0).toUpperCase() : "R";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}><Text style={styles.headerTitle}>Profile</Text></View>

        {/* Avatar + Info */}
        <View style={styles.profileCard}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{user?.name || "Rider"}</Text>
            <Text style={styles.phone}>{user?.phone}</Text>
            <View style={styles.approvalRow}>
              {user?.rider_approved ? (
                <View style={styles.approvedBadge}>
                  <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
                  <Text style={styles.approvedText}>Approved</Text>
                </View>
              ) : (
                <View style={styles.pendingBadge}>
                  <Ionicons name="time-outline" size={12} color={COLORS.warning} />
                  <Text style={styles.pendingText}>Pending Approval</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Online Toggle */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleLeft}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? COLORS.success : COLORS.textMuted }]} />
            <View>
              <Text style={styles.toggleTitle}>{isOnline ? "Online" : "Offline"}</Text>
              <Text style={styles.toggleSub}>{isOnline ? "Receiving new trips" : "Not receiving trips"}</Text>
            </View>
          </View>
          <Switch
            value={isOnline}
            onValueChange={handleToggleStatus}
            trackColor={{ false: COLORS.border, true: COLORS.mintGreen }}
            thumbColor={isOnline ? COLORS.forestGreen : COLORS.textMuted}
          />
        </View>

        {/* Vehicle Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Details</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="bicycle-outline" size={18} color={COLORS.forestGreen} />
              <Text style={styles.infoLabel}>Vehicle Type</Text>
              <Text style={styles.infoValue}>{user?.vehicle_type?.toUpperCase() || "—"}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Ionicons name="car-outline" size={18} color={COLORS.forestGreen} />
              <Text style={styles.infoLabel}>Vehicle Number</Text>
              <Text style={styles.infoValue}>{user?.vehicle_number || "—"}</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{user?.total_trips || 0}</Text>
              <Text style={styles.statLabel}>Total Trips</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>₹{user?.total_earnings?.toFixed(0) || 0}</Text>
              <Text style={styles.statLabel}>Total Earned</Text>
            </View>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.section}>
          <View style={styles.menuCard}>
            {[
              { icon: "help-circle-outline", label: "Help & Support", onPress: () => {} },
              { icon: "document-text-outline", label: "Terms & Conditions", onPress: () => {} },
              { icon: "shield-checkmark-outline", label: "Privacy Policy", onPress: () => {} },
            ].map((item, i, arr) => (
              <TouchableOpacity
                key={i}
                style={[styles.menuItem, i === arr.length - 1 && { borderBottomWidth: 0 }]}
                onPress={item.onPress}
              >
                <Ionicons name={item.icon} size={20} color={COLORS.forestGreen} />
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
        <Text style={styles.version}>WashingBells Rider v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg },
  headerTitle: { fontSize: 24, fontWeight: "700", color: COLORS.black },
  profileCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg, padding: SPACING.lg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  avatarBox: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.forestGreen,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 28, fontWeight: "700", color: COLORS.white },
  profileInfo: { flex: 1, marginLeft: SPACING.md },
  name: { fontSize: 18, fontWeight: "700", color: COLORS.black },
  phone: { fontSize: 14, color: COLORS.textLight, marginTop: 2 },
  approvalRow: { marginTop: SPACING.sm },
  approvedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E8F5E9", paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full, alignSelf: "flex-start" },
  approvedText: { fontSize: 11, color: COLORS.success, fontWeight: "700" },
  pendingBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF3E0", paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full, alignSelf: "flex-start" },
  pendingText: { fontSize: 11, color: COLORS.warning, fontWeight: "700" },
  toggleCard: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.white, marginHorizontal: SPACING.lg, marginTop: SPACING.md,
    padding: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
  },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  toggleTitle: { fontSize: 15, fontWeight: "700", color: COLORS.black },
  toggleSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  section: { paddingHorizontal: SPACING.lg, marginTop: SPACING.xl },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.black, marginBottom: SPACING.md },
  infoCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  infoLabel: { flex: 1, fontSize: 14, color: COLORS.textLight },
  infoValue: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  statsRow: { flexDirection: "row", gap: SPACING.md },
  statBox: { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: "center", borderWidth: 1, borderColor: COLORS.borderLight },
  statNum: { fontSize: 22, fontWeight: "800", color: COLORS.forestGreen },
  statLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  menuCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  menuLabel: { fontSize: 15, color: COLORS.text, fontWeight: "500" },
  logoutBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.xxl, paddingVertical: SPACING.lg },
  logoutText: { fontSize: 16, fontWeight: "600", color: COLORS.error },
  version: { textAlign: "center", fontSize: 12, color: COLORS.textMuted, marginTop: SPACING.sm, marginBottom: 40 },
});
