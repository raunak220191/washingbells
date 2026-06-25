import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS, SHADOW } from "../../../constants/theme";
import { useTripStore } from "../../../stores/tripStore";

const TRIP_TYPE_CONFIG = {
  pickup: { label: "PICKUP", bg: COLORS.riderBlueLight, color: COLORS.riderBlue, icon: "arrow-up-circle" },
  delivery: { label: "DELIVERY", bg: COLORS.mintGreen, color: COLORS.forestGreen, icon: "arrow-down-circle" },
};

const STATUS_CONFIG = {
  assigned: { label: "New", color: COLORS.warning },
  accepted: { label: "Accepted", color: COLORS.info },
  started: { label: "In Progress", color: COLORS.success },
  completed: { label: "Done", color: COLORS.textMuted },
};

export default function TasksScreen() {
  const router = useRouter();
  const { worklist, history, isLoading, fetchWorklist, fetchHistory, acceptTrip } = useTripStore();
  const [tab, setTab] = useState("active"); // active | history
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchWorklist();
    fetchHistory();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWorklist();
    await fetchHistory();
    setRefreshing(false);
  };

  const handleAccept = async (tripId, orderNum) => {
    Alert.alert(
      "Accept Trip",
      `Accept pickup/delivery for order ${orderNum}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept", onPress: async () => {
            try {
              await acceptTrip(tripId);
              router.push(`/(tabs)/tasks/${tripId}`);
            } catch (e) {
              Alert.alert("Error", "Could not accept trip. Try again.");
            }
          },
        },
      ]
    );
  };

  const activeList = worklist;
  const historyList = history;

  const renderActiveTrip = ({ item: trip }) => {
    const typeConfig = TRIP_TYPE_CONFIG[trip.trip_type] || TRIP_TYPE_CONFIG.pickup;
    const statusConfig = STATUS_CONFIG[trip.status] || STATUS_CONFIG.assigned;

    return (
      <View style={styles.tripCard}>
        {/* Header Row */}
        <View style={styles.tripHeader}>
          <View style={[styles.typeBadge, { backgroundColor: typeConfig.bg }]}>
            <Ionicons name={typeConfig.icon} size={12} color={typeConfig.color} />
            <Text style={[styles.typeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: statusConfig.color }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
          <Text style={styles.tripFee}>₹{trip.fee}</Text>
        </View>

        {/* Order Info */}
        <Text style={styles.orderNum}>{trip.order_number}</Text>

        {/* Route */}
        <View style={styles.routeBox}>
          <View style={styles.routeRow}>
            <View style={styles.routeDotGreen} />
            <Text style={styles.routeText} numberOfLines={1}>{trip.pickup_address}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={styles.routeDotBlue} />
            <Text style={styles.routeText} numberOfLines={1}>{trip.drop_address}</Text>
          </View>
        </View>

        {/* Customer */}
        {trip.customer_name && (
          <View style={styles.customerRow}>
            <Ionicons name="person-circle-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.customerText}>{trip.customer_name} • {trip.customer_phone}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionRow}>
          {trip.status === "assigned" ? (
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => handleAccept(trip.id, trip.order_number)}
            >
              <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
              <Text style={styles.acceptText}>Accept Trip</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.viewBtn}
              onPress={() => router.push(`/(tabs)/tasks/${trip.id}`)}
            >
              <Ionicons name="navigate" size={18} color={COLORS.white} />
              <Text style={styles.viewText}>Continue Task</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderHistoryTrip = ({ item: trip }) => (
    <View style={styles.historyCard}>
      <View style={[styles.typeBadge, { backgroundColor: trip.trip_type === "pickup" ? COLORS.riderBlueLight : COLORS.mintGreen }]}>
        <Text style={[styles.typeText, { color: trip.trip_type === "pickup" ? COLORS.riderBlue : COLORS.forestGreen }]}>
          {trip.trip_type.toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, marginLeft: SPACING.md }}>
        <Text style={styles.historyOrder}>{trip.order_number || trip.order_id?.slice(-8).toUpperCase()}</Text>
        <Text style={styles.historyDate}>
          {trip.completed_at
            ? new Date(trip.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
            : new Date(trip.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </Text>
      </View>
      <Text style={[styles.tripFee, { color: trip.status === "completed" ? COLORS.success : COLORS.error }]}>
        {trip.status === "completed" ? `+₹${trip.fee}` : "Cancelled"}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Tasks</Text>
      </View>

      {/* Tab Toggle */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "active" && styles.tabBtnActive]}
          onPress={() => setTab("active")}
        >
          <Text style={[styles.tabText, tab === "active" && styles.tabTextActive]}>Active ({worklist.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "history" && styles.tabBtnActive]}
          onPress={() => setTab("history")}
        >
          <Text style={[styles.tabText, tab === "history" && styles.tabTextActive]}>History ({history.length})</Text>
        </TouchableOpacity>
      </View>

      {isLoading && !refreshing ? (
        <ActivityIndicator color={COLORS.forestGreen} style={{ marginTop: 60 }} />
      ) : tab === "active" ? (
        <FlatList
          data={activeList}
          keyExtractor={(t) => t.id}
          renderItem={renderActiveTrip}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.forestGreen} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No active tasks</Text>
              <Text style={styles.emptySub}>Pull down to refresh. New assignments will appear here.</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={historyList}
          keyExtractor={(t) => t.id}
          renderItem={renderHistoryTrip}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.forestGreen} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🏁</Text>
              <Text style={styles.emptyTitle}>No completed trips yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg },
  headerTitle: { fontSize: 24, fontWeight: "700", color: COLORS.black },
  tabRow: { flexDirection: "row", paddingHorizontal: SPACING.lg, marginBottom: SPACING.md, gap: SPACING.sm },
  tabBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, backgroundColor: COLORS.white, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  tabBtnActive: { backgroundColor: COLORS.forestGreen, borderColor: COLORS.forestGreen },
  tabText: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
  tabTextActive: { color: COLORS.white },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },
  tripCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOW,
  },
  tripHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm },
  typeBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.sm, gap: 3 },
  typeText: { fontSize: 10, fontWeight: "800" },
  statusBadge: { borderWidth: 1, paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.sm },
  statusText: { fontSize: 10, fontWeight: "700" },
  tripFee: { marginLeft: "auto", fontSize: 16, fontWeight: "800", color: COLORS.forestGreen },
  orderNum: { fontSize: 17, fontWeight: "700", color: COLORS.black, marginBottom: SPACING.md },
  routeBox: { marginBottom: SPACING.md },
  routeRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  routeDotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success },
  routeDotBlue: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.riderBlue },
  routeLine: { width: 1.5, height: 14, backgroundColor: COLORS.border, marginLeft: 4, marginVertical: 2 },
  routeText: { flex: 1, fontSize: 13, color: COLORS.textLight },
  customerRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.md },
  customerText: { fontSize: 12, color: COLORS.textMuted },
  actionRow: { flexDirection: "row", gap: SPACING.sm },
  acceptBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.forestGreen, paddingVertical: SPACING.md, borderRadius: RADIUS.full },
  acceptText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  viewBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.riderBlue, paddingVertical: SPACING.md, borderRadius: RADIUS.full },
  viewText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  historyCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOW },
  historyOrder: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  historyDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  emptySub: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.sm, paddingHorizontal: SPACING.xl },
});
