// MapPinPicker — full-screen map with a fixed center pin (upgrade_last TASK 3.1).
// The map pans under the pin; Confirm returns the center. Pre-centers from the
// typed address via the backend geocode proxy (key never ships in the bundle),
// with "Use current location" as a GPS shortcut. Native only — the Expo web
// target resolves MapPinPicker.web.js instead (no react-native-maps on web).
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { COLORS, SPACING, RADIUS, TYPE, SHADOWS } from "../../constants/theme";
import Button from "./Button";
import api from "../../lib/api";

// Zirakpur / Tricity — the service area's center, used only when neither the
// typed address nor GPS yields a starting point.
const FALLBACK_REGION = { latitude: 30.6425, longitude: 76.8173 };
const DELTA = { latitudeDelta: 0.01, longitudeDelta: 0.01 };

export default function MapPinPicker({ visible, initial, addressText, onConfirm, onClose }) {
  const mapRef = useRef(null);
  const [center, setCenter] = useState(initial || FALLBACK_REGION);
  const [source, setSource] = useState(initial ? "map_pin" : null);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locError, setLocError] = useState(null);

  // Pre-center: existing pin > forward geocode of the typed address > fallback
  useEffect(() => {
    if (!visible) return;
    if (initial?.latitude && initial?.longitude) {
      setCenter(initial);
      setSource("map_pin");
      return;
    }
    if (!addressText?.trim()) return;
    setGeocoding(true);
    api.get("/geo/forward", { params: { q: addressText } })
      .then((r) => {
        if (r.data?.found) {
          const c = { latitude: r.data.latitude, longitude: r.data.longitude };
          setCenter(c);
          setSource("geocode");
          mapRef.current?.animateToRegion({ ...c, ...DELTA }, 400);
        }
      })
      .catch(() => {}) // proxy unavailable → user pins manually
      .finally(() => setGeocoding(false));
  }, [visible]);

  const useCurrentLocation = async () => {
    setLocating(true);
    setLocError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocError("Location permission denied — pan the map to your address instead.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setCenter(c);
      setSource("gps");
      mapRef.current?.animateToRegion({ ...c, ...DELTA }, 400);
    } catch {
      setLocError("Couldn't get a GPS fix — pan the map to your address instead.");
    } finally {
      setLocating(false);
    }
  };

  const onRegionChangeComplete = (region, details) => {
    setCenter({ latitude: region.latitude, longitude: region.longitude });
    // Only a user gesture counts as manual pinning; programmatic animates keep
    // their origin (geocode/gps) as the recorded source.
    if (details?.isGesture !== false) setSource("map_pin");
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          initialRegion={{ ...center, ...DELTA }}
          onRegionChangeComplete={onRegionChangeComplete}
          showsUserLocation
          showsMyLocationButton={false}
        >
        </MapView>

        {/* Fixed center pin (map pans underneath) */}
        <View pointerEvents="none" style={styles.pinWrap}>
          <Ionicons name="location" size={44} color={COLORS.forestGreen} style={styles.pinShadow} />
        </View>

        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}
            accessibilityLabel="Close map">
            <Ionicons name="close" size={22} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Pin your exact location</Text>
          <View style={styles.closeBtn} />
        </View>
        {geocoding && (
          <View style={styles.geocodingBadge}>
            <ActivityIndicator size="small" color={COLORS.forestGreen} />
            <Text style={styles.geocodingText}>Locating typed address…</Text>
          </View>
        )}

        <View style={styles.bottomPanel}>
          <TouchableOpacity style={styles.gpsBtn} onPress={useCurrentLocation} disabled={locating}>
            {locating ? (
              <ActivityIndicator size="small" color={COLORS.forestGreen} />
            ) : (
              <MaterialCommunityIcons name="crosshairs-gps" size={18} color={COLORS.forestGreen} />
            )}
            <Text style={styles.gpsBtnText}>Use current location</Text>
          </TouchableOpacity>
          {locError && <Text style={styles.locError}>{locError}</Text>}
          <Text style={styles.coords}>
            {center.latitude.toFixed(5)}°, {center.longitude.toFixed(5)}°
          </Text>
          <Button
            title="Confirm location"
            fullWidth
            onPress={() => onConfirm({ ...center, source: source || "map_pin" })}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  pinWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 44, // pin tip sits on the map center
  },
  pinShadow: { textShadowColor: "rgba(0,0,0,0.25)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  closeBtn: {
    width: 44, height: 44, borderRadius: RADIUS.full, backgroundColor: COLORS.white,
    justifyContent: "center", alignItems: "center", ...SHADOWS.card,
  },
  topTitle: { ...TYPE.h3, color: COLORS.black, backgroundColor: COLORS.white, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full, overflow: "hidden", ...SHADOWS.card },
  geocodingBadge: {
    position: "absolute", top: Platform.OS === "ios" ? 116 : 100, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.white, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: 6, ...SHADOWS.card,
  },
  geocodingText: { ...TYPE.caption, color: COLORS.textLight },
  bottomPanel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md, ...SHADOWS.bar,
  },
  gpsBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    borderWidth: 1.5, borderColor: COLORS.forestGreen, borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
  },
  gpsBtnText: { ...TYPE.label, color: COLORS.forestGreen, fontWeight: "700" },
  coords: { ...TYPE.caption, color: COLORS.textMuted, textAlign: "center" },
  locError: { ...TYPE.caption, color: COLORS.error, textAlign: "center" },
});
