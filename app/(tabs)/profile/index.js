import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS } from "../../../constants/theme";
import { useAuthStore } from "../../../stores/authStore";
import { useWalletStore } from "../../../stores/walletStore";
import ReferEarn from "../../../components/home/ReferEarn";

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const { balance, fetchWallet } = useWalletStore();
  const router = useRouter();
  const [showReferral, setShowReferral] = useState(false);

  useEffect(() => { fetchWallet(); }, []);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => { await logout(); router.replace("/(authenticate)/login"); } },
    ]);
  };

  const menuItems = [
    { icon: "wallet-outline", label: "WB Wallet", sub: "Balance: \u20B9" + balance.toFixed(0), onPress: () => router.push("/(tabs)/profile/wallet") },
    { icon: "location-outline", label: "My Addresses", onPress: () => router.push("/(tabs)/home/address") },
    { icon: "gift-outline", label: "Refer & Earn", sub: "Earn 20% off per referral", onPress: () => setShowReferral(true) },
    { icon: "help-circle-outline", label: "Help & Support", onPress: () => router.push("/(tabs)/profile/help") },
    { icon: "document-text-outline", label: "Terms & Conditions", onPress: () => router.push("/(tabs)/profile/terms") },
    { icon: "shield-checkmark-outline", label: "Privacy Policy", onPress: () => router.push("/(tabs)/profile/privacy") },
  ];

  const initials = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}><Text style={styles.headerTitle}>Profile</Text></View>

        {/* User Card — tappable to edit */}
        <TouchableOpacity
          style={styles.userCard}
          onPress={() => router.push("/(tabs)/profile/edit")}
          activeOpacity={0.7}
        >
          {user?.profile_image ? (
            <Image source={{ uri: user.profile_image }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || "Set up your profile"}</Text>
            <Text style={styles.userPhone}>{user?.phone}</Text>
            {user?.email ? <Text style={styles.userEmail}>{user.email}</Text> : null}
          </View>
          <Ionicons name="create-outline" size={20} color={COLORS.gold} />
        </TouchableOpacity>

        {/* Email Prompt — shown only when email is missing */}
        {user && !user.email && (
          <TouchableOpacity
            style={styles.emailPrompt}
            onPress={() => router.push("/(tabs)/profile/edit")}
            activeOpacity={0.7}
          >
            <View style={styles.emailPromptIcon}>
              <Ionicons name="mail-outline" size={18} color={COLORS.forestGreen} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emailPromptTitle}>Add your email for order updates</Text>
              <Text style={styles.emailPromptSub}>Get receipts, status updates and offers in your inbox.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.forestGreen} />
          </TouchableOpacity>
        )}

        {/* Wallet Quick Card */}
        <TouchableOpacity style={styles.walletCard} onPress={() => router.push("/(tabs)/profile/wallet")}>
          <View style={styles.walletLeft}>
            <Ionicons name="wallet" size={24} color={COLORS.white} />
            <View style={{ marginLeft: SPACING.md }}>
              <Text style={styles.walletLabel}>WB Wallet</Text>
              <Text style={styles.walletBalance}>{"\u20B9"}{balance.toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.walletBtn}><Text style={styles.walletBtnText}>Top Up</Text></View>
        </TouchableOpacity>

        {/* Menu */}
        <View style={styles.menuSection}>
          {menuItems.map((item, i) => (
            <TouchableOpacity key={i} style={[styles.menuItem, i === menuItems.length - 1 && { borderBottomWidth: 0 }]} onPress={item.onPress}>
              <View style={styles.menuLeft}>
                <Ionicons name={item.icon} size={22} color={COLORS.forestGreen} />
                <View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  {item.sub ? <Text style={styles.menuSub}>{item.sub}</Text> : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        <Text style={styles.version}>WashingBells v1.0.0</Text>
      </ScrollView>

      {showReferral && <ReferEarn visible={showReferral} onClose={() => setShowReferral(false)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg },
  headerTitle: { fontSize: 24, fontWeight: "700", color: COLORS.black },
  userCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, marginHorizontal: SPACING.lg, padding: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.mintGreen, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: COLORS.gold },
  avatarImage: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: COLORS.gold },
  avatarText: { fontSize: 24, fontWeight: "700", color: COLORS.forestGreen },
  userInfo: { flex: 1, marginLeft: SPACING.md },
  userName: { fontSize: 18, fontWeight: "700", color: COLORS.black },
  userPhone: { fontSize: 14, color: COLORS.textLight, marginTop: 2 },
  userEmail: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  emailPrompt: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.mintGreen, marginHorizontal: SPACING.lg, marginTop: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.forestGreen + "30",
  },
  emailPromptIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
  },
  emailPromptTitle: { fontSize: 13, fontWeight: "700", color: COLORS.forestGreen },
  emailPromptSub: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  walletCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.forestGreen, marginHorizontal: SPACING.lg, marginTop: SPACING.lg, padding: SPACING.lg, borderRadius: RADIUS.lg },
  walletLeft: { flexDirection: "row", alignItems: "center" },
  walletLabel: { fontSize: 12, color: COLORS.mintGreen, fontWeight: "600" },
  walletBalance: { fontSize: 20, fontWeight: "800", color: COLORS.white },
  walletBtn: { backgroundColor: COLORS.gold, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.full },
  walletBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 13 },
  menuSection: { backgroundColor: COLORS.white, marginHorizontal: SPACING.lg, marginTop: SPACING.xl, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  menuItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: SPACING.lg, paddingHorizontal: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  menuLeft: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  menuLabel: { fontSize: 15, color: COLORS.text, fontWeight: "500" },
  menuSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, marginTop: 40, paddingVertical: SPACING.lg },
  logoutText: { fontSize: 16, fontWeight: "600", color: COLORS.error },
  version: { textAlign: "center", fontSize: 12, color: COLORS.textMuted, marginTop: SPACING.md, marginBottom: 40 },
});
