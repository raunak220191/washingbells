import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS } from "../../../constants/theme";
import { useWalletStore } from "../../../stores/walletStore";

export default function WalletScreen() {
  const router = useRouter();
  const { balance, transactions, isLoading, fetchWallet, topup, verifyTopup } = useWalletStore();
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const QUICK_AMOUNTS = [100, 200, 500, 1000];

  useEffect(() => { fetchWallet(); }, []);

  const handleTopup = async (amount) => {
    const amt = amount || parseFloat(topupAmount);
    if (!amt || amt <= 0) { Alert.alert("Invalid", "Enter a valid amount"); return; }
    setTopupLoading(true);
    try {
      // DEV: simulate payment and directly credit
      await verifyTopup({ amount: amt, razorpay_order_id: "dev", razorpay_payment_id: "dev", razorpay_signature: "dev" });
      Alert.alert("Success! 🎉", `₹${amt} added to your WB Wallet`);
      setTopupAmount("");
      fetchWallet();
    } catch (e) {
      Alert.alert("Error", "Top-up failed. Try again.");
    } finally { setTopupLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>WB Wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>₹{balance.toFixed(2)}</Text>
          <Text style={styles.balanceSub}>1 WB = ₹1</Text>
        </View>

        {/* Top-up Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Money</Text>
          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map((amt) => (
              <TouchableOpacity key={amt} style={styles.quickBtn} onPress={() => handleTopup(amt)} disabled={topupLoading}>
                <Text style={styles.quickText}>₹{amt}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.customRow}>
            <TextInput
              style={styles.customInput}
              placeholder="Enter custom amount"
              placeholderTextColor={COLORS.textMuted}
              value={topupAmount}
              onChangeText={setTopupAmount}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.addBtn} onPress={() => handleTopup()} disabled={topupLoading}>
              {topupLoading ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.addBtnText}>Add</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Transaction History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          {isLoading ? (
            <ActivityIndicator color={COLORS.forestGreen} />
          ) : transactions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="wallet-outline" size={40} color={COLORS.border} />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            transactions.map((txn, i) => (
              <View key={txn.id || i} style={styles.txnRow}>
                <View style={[styles.txnIcon, { backgroundColor: txn.type === "credit" ? "#E8F5E9" : "#FFEBEE" }]}>
                  <Ionicons name={txn.type === "credit" ? "arrow-down" : "arrow-up"} size={16} color={txn.type === "credit" ? COLORS.success : COLORS.error} />
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.txnDesc}>{txn.description}</Text>
                  <Text style={styles.txnDate}>{new Date(txn.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
                <Text style={[styles.txnAmount, { color: txn.type === "credit" ? COLORS.success : COLORS.error }]}>
                  {txn.type === "credit" ? "+" : "-"}₹{txn.amount.toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: COLORS.black },
  balanceCard: { margin: SPACING.lg, backgroundColor: COLORS.forestGreen, borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: "center" },
  balanceLabel: { fontSize: 13, color: COLORS.mintGreen, fontWeight: "600" },
  balanceAmount: { fontSize: 36, fontWeight: "800", color: COLORS.white, marginVertical: 4 },
  balanceSub: { fontSize: 12, color: COLORS.mintGreen, opacity: 0.8 },
  section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.xl },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black, marginBottom: SPACING.md },
  quickRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md },
  quickBtn: { flex: 1, backgroundColor: COLORS.mintGreen, paddingVertical: SPACING.md, borderRadius: RADIUS.md, alignItems: "center" },
  quickText: { fontWeight: "700", color: COLORS.forestGreen, fontSize: 15 },
  customRow: { flexDirection: "row", gap: SPACING.sm },
  customInput: { flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 15 },
  addBtn: { backgroundColor: COLORS.forestGreen, paddingHorizontal: SPACING.xl, borderRadius: RADIUS.md, justifyContent: "center" },
  addBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },
  emptyBox: { alignItems: "center", paddingVertical: SPACING.xl },
  emptyText: { color: COLORS.textMuted, marginTop: SPACING.sm },
  txnRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderLight },
  txnIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  txnDesc: { fontSize: 13, fontWeight: "600", color: COLORS.textDark },
  txnDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: "700" },
});
