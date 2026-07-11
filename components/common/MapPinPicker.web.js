// MapPinPicker (web fallback) — the Expo web target can't render
// react-native-maps, so Metro resolves this file instead. It offers the two
// non-map ways to set coordinates: backend forward-geocode of the typed
// address, or browser GPS. Native builds use MapPinPicker.js (real map).
import React, { useEffect, useState } from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { COLORS, SPACING, RADIUS, TYPE, SHADOWS } from "../../constants/theme";
import Button from "./Button";
import api from "../../lib/api";

export default function MapPinPicker({ visible, initial, addressText, onConfirm, onClose }) {
  const [coords, setCoords] = useState(initial || null);
  const [source, setSource] = useState(initial ? "map_pin" : null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible || coords || !addressText?.trim()) return;
    setBusy(true);
    api.get("/geo/forward", { params: { q: addressText } })
      .then((r) => {
        if (r.data?.found) {
          setCoords({ latitude: r.data.latitude, longitude: r.data.longitude });
          setSource("geocode");
        }
      })
      .catch(() => {})
      .finally(() => setBusy(false));
  }, [visible]);

  const useCurrentLocation = async () => {
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setSource("gps");
    } catch {
      // no GPS in this browser — geocode remains the only path
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headRow}>
            <Text style={styles.title}>Set location</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={COLORS.black} />
            </TouchableOpacity>
          </View>
          <Text style={styles.note}>
            The interactive map is available in the mobile app. Here you can use
            the typed address or your browser location.
          </Text>
          {busy ? (
            <ActivityIndicator color={COLORS.forestGreen} style={{ marginVertical: SPACING.lg }} />
          ) : coords ? (
            <View style={styles.coordsRow}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.forestGreen} />
              <Text style={styles.coordsText}>
                {coords.latitude.toFixed(5)}°, {coords.longitude.toFixed(5)}° ({source})
              </Text>
            </View>
          ) : (
            <Text style={styles.coordsText}>No location yet — try the button below.</Text>
          )}
          <TouchableOpacity style={styles.gpsBtn} onPress={useCurrentLocation} disabled={busy}>
            <MaterialCommunityIcons name="crosshairs-gps" size={18} color={COLORS.forestGreen} />
            <Text style={styles.gpsBtnText}>Use current location</Text>
          </TouchableOpacity>
          <Button
            title="Confirm location"
            fullWidth
            disabled={!coords}
            onPress={() => coords && onConfirm({ ...coords, source: source || "map_pin" })}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: SPACING.lg },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xl, width: "100%", maxWidth: 420, gap: SPACING.md, ...SHADOWS.raised },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { ...TYPE.h3, color: COLORS.black },
  note: { ...TYPE.bodySm, color: COLORS.textLight },
  coordsRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  coordsText: { ...TYPE.caption, color: COLORS.textMuted },
  gpsBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    borderWidth: 1.5, borderColor: COLORS.forestGreen, borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
  },
  gpsBtnText: { ...TYPE.label, color: COLORS.forestGreen, fontWeight: "700" },
});
