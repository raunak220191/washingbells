import React, { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../../constants/theme";
import { useTripStore } from "../../../stores/tripStore";

export default function EarningsScreen() {
  const { earnings, history, fetchEarnings, fetchHistory, isLoading } = useTripStore();

  useEffect(() => {
    fetchEarnings();
    fetchHistory();
  }, []);

  const completedTrips = history.filter(t => t.status === "completed");
  const totalEarned = completedTrips.reduce((sum, t) => sum + (t.fee || 40), 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Earnings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { fetchEarnings(); fetchHistory(); }} tintColor={COLORS.forestGreen} />}
      >
        {/* Total Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Earnings</Text>
          <Text style={styles.balanceAmount}>₹{earnings?.total_earnings?.toFixed(2) || "0.00"}</Text>
          <Text style={styles.balanceSub}>Lifetime earnings from all trips</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="today-outline" size={22} color={COLORS.riderBlue} />
            <Text style={styles.statNum}>₹{earnings?.today_earnings || 0}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="car-outline" size={22} color={COLORS.forestGreen} />
            <Text style={styles.statNum}>{earnings?.today_trips || 0}</Text>
            <Text style={styles.statLabel}>Today's Trips</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trophy-outline" size={22} color={COLORS.gold} />
            <Text style={styles.statNum}>{earnings?.total_trips || 0}</Text>
            <Text style={styles.statLabel}>All Trips</Text>
          </View>
        </View>

        {/* Per Trip Rate */}
        <View style={styles.rateCard}>
          <View style={styles.rateLeft}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.riderBlue} />
            <Text style={styles.rateText}>Per trip rate: <Text style={styles.rateBold}>₹{earnings?.per_trip_fee || 40}</Text></Text>
          </View>
          <Text style={styles.rateSub}>Paid per completed pickup or delivery</Text>
        </View>

        {/* Trip History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trip History</Text>
          {completedTrips.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={40} color={COLORS.border} />
              <Text style={styles.emptyText}>No completed trips yet</Text>
            </View>
          ) : (
            completedTrips.map((trip, i) => (
              <View key={trip.id || i} style={styles.tripRow}>
                <View style={[styles.tripIcon, { backgroundColor: trip.trip_type === "pickup" ? COLORS.riderBlueLight : COLORS.mintGreen }]}>
                  <Ionicons
                    name={trip.trip_type === "pickup" ? "arrow-up" : "arrow-down"}
                    size={16}
                    color={trip.trip_type === "pickup" ? COLORS.riderBlue : COLORS.forestGreen}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.tripType}>{trip.trip_type === "pickup" ? "Pickup" : "Delivery"}</Text>
                  <Text style={styles.tripDate}>
                    {trip.completed_at
                      ? new Date(trip.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </Text>
                </View>
                <Text style={styles.tripAmount}>+₹{trip.fee || 40}</Text>
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
  header: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg },
  headerTitle: { fontSize: 24, fontWeight: "700", color: COLORS.black },
  balanceCard: {
    margin: SPACING.lg, backgroundColor: COLORS.forestGreen, borderRadius: RADIUS.xl,
    padding: SPACING.xl, alignItems: "center",
  },
  balanceLabel: { fontSize: 13, color: COLORS.mintGreen, fontWeight: "600" },
  balanceAmount: { fontSize: 40, fontWeight: "900", color: COLORS.white, marginVertical: SPACING.sm },
  balanceSub: { fontSize: 12, color: COLORS.mintGreen, opacity: 0.8 },
  statsRow: { flexDirection: "row", paddingHorizontal: SPACING.lg, gap: SPACING.sm, marginBottom: SPACING.md },
  statCard: {
    flex: 1, backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.lg,
    alignItems: "center", borderWidth: 1, borderColor: COLORS.borderLight,
  },
  statNum: { fontSize: 18, fontWeight: "800", color: COLORS.black, marginTop: SPACING.sm },
  statLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 2, textAlign: "center" },
  rateCard: {
    backgroundColor: COLORS.riderBlueLight, marginHorizontal: SPACING.lg, marginBottom: SPACING.md,
    padding: SPACING.lg, borderRadius: RADIUS.lg,
  },
  rateLeft: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: 4 },
  rateText: { fontSize: 14, color: COLORS.text },
  rateBold: { fontWeight: "800", color: COLORS.forestGreen },
  rateSub: { fontSize: 11, color: COLORS.textMuted, marginLeft: 28 },
  section: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black, marginBottom: SPACING.md },
  empty: { alignItems: "center", paddingVertical: SPACING.xl },
  emptyText: { color: COLORS.textMuted, marginTop: SPACING.sm },
  tripRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white,
    padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  tripIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  tripType: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  tripDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  tripAmount: { fontSize: 16, fontWeight: "800", color: COLORS.success },
});
