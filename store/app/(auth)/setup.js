import { useState, useRef } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Alert, ScrollView, ActivityIndicator, Modal, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";
import { useAuthStore } from "../../stores/authStore";

const DEFAULT_REGION = {
  latitude: 30.9010,
  longitude: 75.8573,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function StoreSetupScreen() {
  const router = useRouter();
  const { registerStore, refreshStore } = useAuthStore();
  const mapRef = useRef(null);

  const [form, setForm] = useState({
    store_name: "", address: "", city: "Ludhiana", pincode: "",
    phone: "", opening_time: "09:00", closing_time: "21:00",
  });
  const [coords, setCoords] = useState({ latitude: 30.9010, longitude: 75.8573 });
  const [coordsPicked, setCoordsPicked] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [draftRegion, setDraftRegion] = useState(DEFAULT_REGION);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const openMapPicker = async () => {
    setDraftRegion({
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setMapVisible(true);
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Allow location access to use this feature.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const region = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      setDraftRegion(region);
      mapRef.current?.animateToRegion(region, 600);
    } catch {
      Alert.alert("Error", "Could not get your location.");
    } finally {
      setLocating(false);
    }
  };

  const confirmLocation = () => {
    setCoords({ latitude: draftRegion.latitude, longitude: draftRegion.longitude });
    setCoordsPicked(true);
    setMapVisible(false);
  };

  const handleSubmit = async () => {
    if (!form.store_name || !form.address || !form.phone || !form.pincode) {
      Alert.alert("Required", "Please fill all required fields.");
      return;
    }
    if (!coordsPicked) {
      Alert.alert("Location Required", "Please pick your store location on the map.");
      return;
    }
    setLoading(true);
    try {
      await registerStore({
        ...form,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      await refreshStore();
      Alert.alert(
        "Store Registered!",
        "Your store is under review. You can start managing orders once approved by admin.",
        [{ text: "OK", onPress: () => router.replace("/(tabs)/home") }],
      );
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: "store_name", label: "Store Name *", placeholder: "e.g. WashingBells Ludhiana Central" },
    { key: "address", label: "Full Address *", placeholder: "Shop no., street, area" },
    { key: "city", label: "City *", placeholder: "Ludhiana" },
    { key: "pincode", label: "Pincode *", placeholder: "141001", keyboardType: "numeric" },
    { key: "phone", label: "Store Phone *", placeholder: "+91XXXXXXXXXX", keyboardType: "phone-pad" },
    { key: "opening_time", label: "Opening Time", placeholder: "09:00" },
    { key: "closing_time", label: "Closing Time", placeholder: "21:00" },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Register Your Store</Text>
        <Text style={styles.headerSub}>Fill in your store details to get started</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {fields.map(field => (
          <View key={field.key} style={styles.fieldGroup}>
            <Text style={styles.label}>{field.label}</Text>
            <TextInput
              style={styles.input}
              placeholder={field.placeholder}
              placeholderTextColor={COLORS.textMuted}
              value={form[field.key]}
              onChangeText={v => update(field.key, v)}
              keyboardType={field.keyboardType || "default"}
            />
          </View>
        ))}

        {/* Map location picker */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Store Location on Map *</Text>
          <TouchableOpacity style={[styles.mapBtn, coordsPicked && styles.mapBtnPicked]} onPress={openMapPicker}>
            <Ionicons
              name={coordsPicked ? "location" : "location-outline"}
              size={20}
              color={coordsPicked ? COLORS.storeOrange : COLORS.textLight}
            />
            <Text style={[styles.mapBtnText, coordsPicked && styles.mapBtnTextPicked]}>
              {coordsPicked
                ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
                : "Tap to pick location on Google Maps"}
            </Text>
            {coordsPicked && (
              <Ionicons name="checkmark-circle" size={18} color={COLORS.storeOrange} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.noteBox}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
          <Text style={styles.noteText}>
            Your store will be reviewed within 24 hours. You'll be able to accept orders once approved by admin.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.btnText}>Submit Store Registration</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Full-screen map modal */}
      <Modal visible={mapVisible} animationType="slide" statusBarTranslucent>
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_DEFAULT}
            initialRegion={draftRegion}
            onRegionChangeComplete={r => setDraftRegion(r)}
            showsUserLocation
            showsMyLocationButton={false}
          />

          {/* Fixed crosshair pin */}
          <View pointerEvents="none" style={styles.crosshairWrapper}>
            <Ionicons name="location" size={44} color={COLORS.storeOrange} style={styles.crosshairIcon} />
          </View>

          {/* Top bar */}
          <SafeAreaView style={styles.mapTopBar}>
            <TouchableOpacity style={styles.mapCloseBtn} onPress={() => setMapVisible(false)}>
              <Ionicons name="close" size={22} color={COLORS.black} />
            </TouchableOpacity>
            <Text style={styles.mapTitle}>Drag map to place your store</Text>
          </SafeAreaView>

          {/* My location button */}
          <TouchableOpacity style={styles.myLocBtn} onPress={useMyLocation} disabled={locating}>
            {locating
              ? <ActivityIndicator size="small" color={COLORS.storeOrange} />
              : <Ionicons name="navigate" size={22} color={COLORS.storeOrange} />}
          </TouchableOpacity>

          {/* Confirm button */}
          <View style={styles.mapBottomBar}>
            <View style={styles.coordsPreview}>
              <Text style={styles.coordsLabel}>Selected Location</Text>
              <Text style={styles.coordsText}>
                {draftRegion.latitude.toFixed(6)}, {draftRegion.longitude.toFixed(6)}
              </Text>
            </View>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmLocation}>
              <Ionicons name="checkmark" size={20} color={COLORS.white} />
              <Text style={styles.confirmBtnText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.xl, backgroundColor: COLORS.storeOrange },
  headerTitle: { fontSize: 22, fontWeight: "800", color: COLORS.white },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 4 },
  content: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.xl, paddingBottom: 40 },
  fieldGroup: { marginBottom: SPACING.lg },
  label: { fontSize: 13, fontWeight: "600", color: COLORS.textLight, marginBottom: SPACING.sm },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.lg, fontSize: 15, color: COLORS.black,
  },
  mapBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.lg, borderStyle: "dashed",
  },
  mapBtnPicked: { borderColor: COLORS.storeOrange, borderStyle: "solid" },
  mapBtnText: { flex: 1, fontSize: 14, color: COLORS.textMuted },
  mapBtnTextPicked: { color: COLORS.black, fontWeight: "600" },
  noteBox: {
    flexDirection: "row", gap: SPACING.sm, backgroundColor: "#E3F2FD",
    padding: SPACING.md, borderRadius: RADIUS.md, marginVertical: SPACING.xl,
  },
  noteText: { flex: 1, fontSize: 12, color: "#1565C0", lineHeight: 18 },
  btn: { backgroundColor: COLORS.storeOrange, paddingVertical: SPACING.lg, borderRadius: RADIUS.full, alignItems: "center" },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },

  // Map modal
  mapContainer: { flex: 1, backgroundColor: "#000" },
  crosshairWrapper: {
    position: "absolute", top: "50%", left: "50%",
    marginLeft: -22, marginTop: -44,
    zIndex: 10, pointerEvents: "none",
  },
  crosshairIcon: {
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4,
  },
  mapTopBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  mapCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  mapTitle: { flex: 1, fontSize: 14, fontWeight: "600", color: COLORS.black },
  myLocBtn: {
    position: "absolute", right: 16, bottom: 160,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },
  mapBottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, padding: SPACING.xl,
    paddingBottom: Platform.OS === "ios" ? 36 : SPACING.xl,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 10,
  },
  coordsPreview: { marginBottom: SPACING.md },
  coordsLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  coordsText: { fontSize: 15, fontWeight: "700", color: COLORS.black, marginTop: 2 },
  confirmBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.sm, backgroundColor: COLORS.storeOrange,
    paddingVertical: SPACING.lg, borderRadius: RADIUS.full,
  },
  confirmBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
});
