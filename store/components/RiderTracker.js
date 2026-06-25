/**
 * RiderTracker — shows the live location of the rider currently assigned to
 * this order's active trip. Polls every 10 s; quietly disappears when no
 * active trip exists.
 */

import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../constants/theme";
import api from "../lib/api";

const POLL_INTERVAL_MS = 10_000;

const TRIP_TYPE_LABEL = {
  pickup: "Pickup",
  delivery: "Delivery",
};

const TRIP_STATUS_COPY = {
  assigned: "Waiting to accept",
  accepted: "Heading to pickup",
  started: "Trip in progress",
};

function formatRelative(timestamp) {
  if (!timestamp) return "—";
  const ms = Date.now() - new Date(timestamp).getTime();
  if (ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 30) return "just now";
  if (sec < 90) return "1 min ago";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)} hr ago`;
}

export default function RiderTracker({ orderId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await api.get(`/store-ops/orders/${orderId}/rider-location`);
        if (!cancelled) {
          setData(res.data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.detail || "Failed to fetch rider");
      }
    };
    fetchOnce();
    const id = setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [orderId]);

  // No active trip → render nothing
  if (!data || !data.rider_id) return null;

  const loc = data.location;
  const hasLocation = loc && loc.lat != null && loc.lng != null;
  const tripLabel = TRIP_TYPE_LABEL[data.trip_type] || "Trip";
  const statusCopy = TRIP_STATUS_COPY[data.trip_status] || data.trip_status;

  const openMaps = () => {
    if (!hasLocation) return;
    const q = `${loc.lat},${loc.lng}`;
    Linking.openURL(`https://maps.google.com/?q=${q}`).catch(() => {});
  };

  const callRider = () => {
    if (data.rider_phone) Linking.openURL(`tel:${data.rider_phone}`).catch(() => {});
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.dotLive}>
          <View style={styles.dotInner} />
        </View>
        <Text style={styles.title}>{tripLabel} Rider — Live</Text>
        <Text style={styles.status}>{statusCopy}</Text>
      </View>

      <View style={styles.row}>
        <Ionicons name="person-circle" size={36} color={COLORS.storeOrange} />
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={styles.name}>{data.rider_name || "Rider"}</Text>
          <Text style={styles.vehicle}>
            {(data.vehicle_type || "").toUpperCase()} · {data.vehicle_number || "—"}
          </Text>
        </View>
        <TouchableOpacity style={styles.callBtn} onPress={callRider}>
          <Ionicons name="call" size={16} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.locationRow} onPress={openMaps} disabled={!hasLocation}>
        <Ionicons name="navigate" size={14} color={COLORS.storeOrange} />
        <Text style={styles.locationText} numberOfLines={1}>
          {hasLocation
            ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`
            : "Waiting for first GPS update..."}
        </Text>
        <Text style={styles.locationMeta}>{formatRelative(data.last_updated)}</Text>
      </TouchableOpacity>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.storeOrangeLight,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  dotLive: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: "rgba(230,81,0,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  dotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.storeOrange },
  title: { flex: 1, fontSize: 13, fontWeight: "800", color: COLORS.storeOrange, textTransform: "uppercase", letterSpacing: 0.5 },
  status: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },

  row: { flexDirection: "row", alignItems: "center", marginBottom: SPACING.md },
  name: { fontSize: 15, fontWeight: "700", color: COLORS.black },
  vehicle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  callBtn: {
    backgroundColor: COLORS.success, width: 36, height: 36, borderRadius: 18,
    justifyContent: "center", alignItems: "center",
  },

  locationRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.storeOrangeLight,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
  },
  locationText: { flex: 1, fontSize: 12, color: COLORS.text, fontFamily: "monospace" },
  locationMeta: { fontSize: 10, color: COLORS.textMuted },

  error: { fontSize: 11, color: COLORS.error, marginTop: SPACING.sm },
});
