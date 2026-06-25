import React, { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { COLORS, SPACING, RADIUS, SHADOW } from "../../../constants/theme";
import { useAuthStore } from "../../../stores/authStore";
import { useTripStore } from "../../../stores/tripStore";

export default function HomeScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuthStore();
  const { worklist, earnings, activeTrip, fetchWorklist, fetchEarnings, setOnline, updateLocation } = useTripStore();

  useEffect(() => {
    fetchWorklist();
    fetchEarnings();
    // Poll every 30s for new trips
    const interval = setInterval(fetchWorklist, 30000);
    return () => clearInterval(interval);
  }, []);

  // Foreground location updates → keep the admin live map populated even when
  // background tracking isn't available (Expo Go, simulators, background
  // permission denied). Runs while online and this screen is open.
  useEffect(() => {
    const online = user?.rider_status === "online" || user?.rider_status === "on_trip";
    if (!online) return;
    let cancelled = false;
    const ping = async () => {
      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") {
          status = (await Location.requestForegroundPermissionsAsync()).status;
        }
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) await updateLocation(pos.coords.latitude, pos.coords.longitude);
      } catch {}
    };
    ping(); // immediate fix so the rider appears on the map right away
    const id = setInterval(ping, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user?.rider_status]);

  const handleToggleOnline = async (value) => {
    try {
      await setOnline(value ? "online" : "offline");
    } catch (e) {
      Alert.alert("Error", "Could not update status. Try again.");
    } finally {
      // Always re-sync the toggle with the backend's actual rider_status,
      // even if background tracking had an issue.
      await refreshProfile().catch(() => {});
    }
  };

  const isOnline = user?.rider_status === "online" || user?.rider_status === "on_trip";
  const isApproved = user?.rider_approved;
  const pendingTrips = worklist.filter(t => t.status === "assigned");

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name?.split(" ")[0] || "Rider"} 👋</Text>
            <Text style={styles.subGreeting}>{user?.vehicle_type} • {user?.vehicle_number}</Text>
          </View>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? COLORS.success : COLORS.textMuted }]} />
            <Text style={styles.statusText}>{user?.rider_status || "offline"}</Text>
          </View>
        </View>

        {/* Approval Banner */}
        {!isApproved && (
          <View style={styles.pendingBanner}>
            <Ionicons name="time-outline" size={20} color={COLORS.warning} />
            <Text style={styles.pendingText}>Your account is pending admin approval. You'll be notified once approved.</Text>
          </View>
        )}

        {/* Online Toggle */}
        {isApproved && (
          <View style={styles.toggleCard}>
            <View>
              <Text style={styles.toggleTitle}>{isOnline ? "You're Online" : "You're Offline"}</Text>
              <Text style={styles.toggleSub}>{isOnline ? "Receiving new trip assignments" : "Toggle ON to receive trips"}</Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              trackColor={{ false: COLORS.border, true: COLORS.mintGreen }}
              thumbColor={isOnline ? COLORS.forestGreen : COLORS.textMuted}
            />
          </View>
        )}

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{earnings?.today_trips || 0}</Text>
            <Text style={styles.statLabel}>Today's Trips</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>₹{earnings?.today_earnings || 0}</Text>
            <Text style={styles.statLabel}>Today's Earnings</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{earnings?.total_trips || 0}</Text>
            <Text style={styles.statLabel}>Total Trips</Text>
          </View>
        </View>

        {/* Active Trip */}
        {activeTrip && (
          <TouchableOpacity style={styles.activeTripCard} onPress={() => router.push(`/(tabs)/tasks`)}>
            <View style={styles.activeTripHeader}>
              <View style={styles.activePulse} />
              <Text style={styles.activeTripTitle}>Active Trip</Text>
            </View>
            <Text style={styles.activeTripOrder}>{activeTrip.order_number}</Text>
            <Text style={styles.activeTripType}>{activeTrip.trip_type === "pickup" ? "🏠 Pickup from customer" : "🏪 Deliver to customer"}</Text>
            <Text style={styles.activeTripAddr} numberOfLines={1}>{activeTrip.pickup_address}</Text>
            <View style={styles.activeTripBtn}>
              <Text style={styles.activeTripBtnText}>View Task →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Pending Assignments */}
        {pendingTrips.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>New Assignments ({pendingTrips.length})</Text>
            {pendingTrips.map((trip) => (
              <TouchableOpacity key={trip.id} style={styles.tripCard} onPress={() => router.push("/(tabs)/tasks")}>
                <View style={styles.tripLeft}>
                  <View style={[styles.tripTypeBadge, { backgroundColor: trip.trip_type === "pickup" ? COLORS.riderBlueLight : COLORS.mintGreen }]}>
                    <Text style={[styles.tripTypeText, { color: trip.trip_type === "pickup" ? COLORS.riderBlue : COLORS.forestGreen }]}>
                      {trip.trip_type === "pickup" ? "PICKUP" : "DELIVERY"}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.tripOrder}>{trip.order_number}</Text>
                    <Text style={styles.tripAddr} numberOfLines={1}>{trip.pickup_address}</Text>
                  </View>
                </View>
                <View style={styles.tripRight}>
                  <Text style={styles.tripFee}>₹{trip.fee}</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty State */}
        {isApproved && isOnline && pendingTrips.length === 0 && !activeTrip && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🛵</Text>
            <Text style={styles.emptyTitle}>Ready for trips!</Text>
            <Text style={styles.emptySub}>You'll be notified when a new trip is assigned to you.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    backgroundColor: COLORS.forestGreen,
  },
  greeting: { fontSize: 20, fontWeight: "700", color: COLORS.white },
  subGreeting: { fontSize: 12, color: COLORS.mintGreen, marginTop: 2, textTransform: "uppercase" },
  statusBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: SPACING.sm },
  statusText: { color: COLORS.white, fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  pendingBanner: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: "#FFF3E0", padding: SPACING.lg, margin: SPACING.lg, borderRadius: RADIUS.md },
  pendingText: { flex: 1, fontSize: 13, color: "#E65100", lineHeight: 18 },
  toggleCard: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.white, margin: SPACING.lg, padding: SPACING.lg,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOW,
  },
  toggleTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  toggleSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  statsRow: { flexDirection: "row", paddingHorizontal: SPACING.lg, gap: SPACING.sm, marginBottom: SPACING.lg },
  statCard: {
    flex: 1, backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.lg,
    alignItems: "center", borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOW,
  },
  statNum: { fontSize: 20, fontWeight: "800", color: COLORS.forestGreen },
  statLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 2, textAlign: "center" },
  activeTripCard: {
    backgroundColor: COLORS.forestGreen, marginHorizontal: SPACING.lg, marginBottom: SPACING.lg,
    padding: SPACING.lg, borderRadius: RADIUS.lg,
    ...SHADOW, shadowColor: COLORS.forestGreen, shadowOpacity: 0.3,
  },
  activeTripHeader: { flexDirection: "row", alignItems: "center", marginBottom: SPACING.sm },
  activePulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.gold, marginRight: SPACING.sm },
  activeTripTitle: { color: COLORS.mintGreen, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  activeTripOrder: { color: COLORS.white, fontSize: 18, fontWeight: "800" },
  activeTripType: { color: COLORS.mintGreen, fontSize: 13, marginTop: 4 },
  activeTripAddr: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 },
  activeTripBtn: { backgroundColor: COLORS.gold, alignSelf: "flex-start", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, marginTop: SPACING.md },
  activeTripBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 13 },
  section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.xl },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black, marginBottom: SPACING.md },
  tripCard: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.white, padding: SPACING.lg, borderRadius: RADIUS.md,
    marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOW,
  },
  tripLeft: { flexDirection: "row", alignItems: "center", gap: SPACING.md, flex: 1 },
  tripTypeBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.sm },
  tripTypeText: { fontSize: 10, fontWeight: "800" },
  tripOrder: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  tripAddr: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  tripRight: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  tripFee: { fontSize: 15, fontWeight: "700", color: COLORS.forestGreen },
  emptyState: { alignItems: "center", paddingVertical: 60, paddingHorizontal: SPACING.xl },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  emptySub: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.sm, lineHeight: 20 },
});
