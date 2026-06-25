import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";
import api from "../../lib/api";

// Fallback shown while loading or if the API is unreachable, so the home
// screen never renders an empty services section.
const FALLBACK_SERVICES = [
  { slug: "dry-clean", name: "Dry Clean", icon: "shirt-outline", service_type: "pickup_drop" },
  { slug: "wash-steam-iron", name: "Wash & Steam Iron", icon: "water-outline", service_type: "pickup_drop" },
  { slug: "wash-fold", name: "Wash & Fold", icon: "layers-outline", service_type: "pickup_drop" },
  { slug: "shoe-cleaning", name: "Shoe Cleaning", icon: "footsteps-outline", service_type: "pickup_drop" },
  { slug: "steam-iron", name: "Steam Iron", icon: "thermometer-outline", service_type: "pickup_drop" },
  { slug: "premium-laundry", name: "Premium Laundry", icon: "diamond-outline", service_type: "pickup_drop" },
];

export default function ServiceGrid({ onServicePress }) {
  const [services, setServices] = useState(FALLBACK_SERVICES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/services");
        const list = (res.data || []).filter((s) => s.active !== false);
        if (mounted && list.length) setServices(list);
      } catch (e) {
        // keep fallback
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Pickup/drop services go in the grid; at-home services render as featured banners.
  const gridServices = services.filter((s) => (s.service_type || "pickup_drop") !== "at_home");
  const featured = services.filter((s) => s.service_type === "at_home");

  return (
    <View>
      {/* Section Divider */}
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.sectionTitle}>Our Services</Text>
        <View style={styles.line} />
      </View>

      {/* Grid — 3 columns */}
      <View style={styles.grid}>
        {gridServices.map((service) => (
          <TouchableOpacity
            key={service.slug}
            style={styles.card}
            onPress={() => onServicePress(service.slug)}
            activeOpacity={0.7}
          >
            <View style={styles.iconBox}>
              <Ionicons name={service.icon || "shirt-outline"} size={24} color={COLORS.gold} />
            </View>
            <Text style={styles.label} numberOfLines={2}>{service.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && (
        <ActivityIndicator size="small" color={COLORS.gold} style={{ marginBottom: SPACING.md }} />
      )}

      {/* At-home services — Featured Banners */}
      {featured.map((service) => (
        <TouchableOpacity
          key={service.slug}
          style={styles.featureBanner}
          onPress={() => onServicePress(service.slug)}
          activeOpacity={0.7}
        >
          <View style={styles.featureLeft}>
            <View style={styles.featureIcon}>
              <Ionicons name={service.icon || "tv-outline"} size={28} color={COLORS.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>{service.name}</Text>
              {service.description ? (
                <Text style={styles.featureSub} numberOfLines={1}>{service.description}</Text>
              ) : (
                <Text style={styles.featureSub}>At-home service</Text>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.gold} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  sectionTitle: {
    paddingHorizontal: SPACING.sm,
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: "bold",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.white,
    width: "31%",
    height: 100,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.cream,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
    paddingHorizontal: 2,
    lineHeight: 14,
  },
  featureBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.forestGreen,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
  },
  featureLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.md,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.white,
  },
  featureSub: {
    fontSize: 12,
    color: COLORS.mintGreen,
    marginTop: 2,
  },
});
