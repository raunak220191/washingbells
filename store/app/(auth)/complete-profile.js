import { useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Image, TextInput, Modal, Linking, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import MapView, { PROVIDER_DEFAULT } from "react-native-maps";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";
import { mapsConfigured } from "../../lib/maps";
import { useAuthStore } from "../../stores/authStore";

const STEPS = [
  { key: "photos", title: "Store Photos",   icon: "camera" },
  { key: "gps",    title: "Store Location", icon: "location" },
  { key: "gst",    title: "GST Details",    icon: "document-text" },
  { key: "bank",   title: "Bank Details",   icon: "card" },
];

const DEFAULT_REGION = { latitude: 30.9010, longitude: 75.8573, latitudeDelta: 0.01, longitudeDelta: 0.01 };

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { store, completeStoreProfile } = useAuthStore();
  const mapRef = useRef(null);

  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState(store?.store_photos || []);
  const [coords, setCoords] = useState({
    latitude: store?.latitude || DEFAULT_REGION.latitude,
    longitude: store?.longitude || DEFAULT_REGION.longitude,
  });
  const [coordsPicked, setCoordsPicked] = useState(!!(store?.latitude && store?.longitude));
  const [mapVisible, setMapVisible] = useState(false);
  const [draftRegion, setDraftRegion] = useState(DEFAULT_REGION);
  const [locating, setLocating] = useState(false);
  const [gst, setGst] = useState(store?.gst_number || "");
  const [bank, setBank] = useState({
    holder: store?.bank_account_holder || "",
    account: store?.bank_account_number || "",
    ifsc: store?.bank_ifsc || "",
  });
  const [saving, setSaving] = useState(false);

  const current = STEPS[step];

  const addPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (lib.status !== "granted") {
        Alert.alert("Permission required", "Enable camera or photo library access in Settings.",
          [{ text: "Cancel", style: "cancel" }, { text: "Open Settings", onPress: () => Linking.openSettings() }]);
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.5, base64: true });
      if (!r.canceled && r.assets?.[0]) {
        setPhotos(p => [...p, `data:image/jpeg;base64,${r.assets[0].base64}`]);
      }
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true });
    if (!r.canceled && r.assets?.[0]) {
      setPhotos(p => [...p, `data:image/jpeg;base64,${r.assets[0].base64}`]);
    }
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
      const region = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
      setDraftRegion(region);
      mapRef.current?.animateToRegion(region, 600);
    } catch {
      Alert.alert("Error", "Could not get your location.");
    } finally { setLocating(false); }
  };

  const openMap = () => {
    if (!mapsConfigured) {
      // No Google Maps key in this Android build — mounting MapView would
      // crash natively (B3). Grab the pin from device GPS instead.
      Alert.alert(
        "Pin via GPS",
        "Stand at the store entrance and we'll capture its exact location from your phone's GPS.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Use My Location",
            onPress: async () => {
              setLocating(true);
              try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== "granted") {
                  Alert.alert("Permission Denied", "Allow location access to use this feature.");
                  return;
                }
                const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                setCoordsPicked(true);
              } catch {
                Alert.alert("Error", "Could not get your location. Check that GPS is on and try again.");
              } finally { setLocating(false); }
            },
          },
        ],
      );
      return;
    }
    setDraftRegion({
      latitude: coords.latitude, longitude: coords.longitude,
      latitudeDelta: 0.01, longitudeDelta: 0.01,
    });
    setMapVisible(true);
  };

  const confirmLocation = () => {
    setCoords({ latitude: draftRegion.latitude, longitude: draftRegion.longitude });
    setCoordsPicked(true);
    setMapVisible(false);
  };

  // Validation per step
  const canProceed = () => {
    if (current.key === "photos") return photos.length >= 1;
    if (current.key === "gps")    return coordsPicked;
    if (current.key === "gst")    return gst.trim().length >= 10;
    if (current.key === "bank")   return bank.holder && bank.account.length >= 8 && bank.ifsc.length === 11;
    return false;
  };

  const handleNext = async () => {
    if (!canProceed()) {
      Alert.alert("Required", validationMessage(current.key));
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      await submitAll();
    }
  };

  const submitAll = async () => {
    setSaving(true);
    try {
      await completeStoreProfile({
        store_photos: photos,
        latitude: coords.latitude,
        longitude: coords.longitude,
        gst_number: gst.trim().toUpperCase(),
        bank_account_holder: bank.holder.trim(),
        bank_account_number: bank.account.trim(),
        bank_ifsc: bank.ifsc.trim().toUpperCase(),
      });
      Alert.alert(
        "Profile Complete ✅",
        "Your store profile is complete. You can now start accepting orders.",
        [{ text: "OK", onPress: () => router.replace("/(tabs)/home") }]
      );
    } catch (e) {
      Alert.alert("Save Failed", e?.response?.data?.detail || "Try again.");
    } finally { setSaving(false); }
  };

  const skipForNow = () => {
    Alert.alert(
      "Profile Incomplete",
      "Your store cannot accept orders until photos, GPS, GST, and bank details are submitted. You may continue later.",
      [
        { text: "Continue Setup", style: "cancel" },
        { text: "Skip for Now", style: "destructive", onPress: () => router.replace("/(tabs)/home") },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="storefront" size={26} color={COLORS.white} />
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={styles.headerTitle}>Complete Store Profile</Text>
          <Text style={styles.headerSub}>Step {step + 1} of {STEPS.length} — {current.title}</Text>
        </View>
        <TouchableOpacity onPress={skipForNow}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        {STEPS.map((s, i) => (
          <View key={s.key} style={[styles.progressDot, i < step && styles.progressDotDone, i === step && styles.progressDotActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {current.key === "photos" && <PhotosStep photos={photos} setPhotos={setPhotos} addPhoto={addPhoto} />}
        {current.key === "gps"    && <GpsStep coords={coords} coordsPicked={coordsPicked} openMap={openMap} />}
        {current.key === "gst"    && <GstStep gst={gst} setGst={setGst} />}
        {current.key === "bank"   && <BankStep bank={bank} setBank={setBank} />}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerBtnRow}>
          {step > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)} disabled={saving}>
              <Ionicons name="arrow-back" size={18} color={COLORS.storeOrange} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
            disabled={!canProceed() || saving}
            onPress={handleNext}
          >
            {saving ? <ActivityIndicator color={COLORS.white} /> : (
              <>
                <Text style={styles.nextBtnText}>{step === STEPS.length - 1 ? "Finish & Submit" : "Next"}</Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Map Picker Modal */}
      <Modal visible={mapVisible && mapsConfigured} animationType="slide" statusBarTranslucent>
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_DEFAULT}
            initialRegion={draftRegion}
            onRegionChangeComplete={r => setDraftRegion(r)}
            showsUserLocation
          />
          <View pointerEvents="none" style={styles.crosshairWrapper}>
            <Ionicons name="location" size={44} color={COLORS.storeOrange} style={styles.crosshairIcon} />
          </View>
          <SafeAreaView style={styles.mapTopBar}>
            <TouchableOpacity style={styles.mapCloseBtn} onPress={() => setMapVisible(false)}>
              <Ionicons name="close" size={22} color={COLORS.black} />
            </TouchableOpacity>
            <Text style={styles.mapTitle}>Drag map to place your store</Text>
          </SafeAreaView>
          <TouchableOpacity style={styles.myLocBtn} onPress={useMyLocation} disabled={locating}>
            {locating ? <ActivityIndicator size="small" color={COLORS.storeOrange} /> : <Ionicons name="navigate" size={22} color={COLORS.storeOrange} />}
          </TouchableOpacity>
          <View style={styles.mapBottomBar}>
            <Text style={styles.coordsLabel}>SELECTED LOCATION</Text>
            <Text style={styles.coordsText}>{draftRegion.latitude.toFixed(6)}, {draftRegion.longitude.toFixed(6)}</Text>
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

function validationMessage(key) {
  if (key === "photos") return "Add at least 1 store photo (exterior or interior).";
  if (key === "gps")    return "Pick your store location on the map.";
  if (key === "gst")    return "Enter a valid GST number (15 characters).";
  if (key === "bank")   return "Enter account holder name, account number, and a valid 11-character IFSC.";
  return "";
}

// ── STEPS ─────────────────────────────────────────────

function PhotosStep({ photos, setPhotos, addPhoto }) {
  return (
    <View>
      <SectionHeader icon="camera" title="Store Photos" hint="Add photos of your store (exterior, counter, signage). Minimum 1 photo." />
      <View style={styles.photosGrid}>
        {photos.map((p, i) => (
          <View key={i} style={styles.photoThumb}>
            <Image source={{ uri: p }} style={styles.photoImg} />
            <TouchableOpacity style={styles.photoRemove} onPress={() => setPhotos(prev => prev.filter((_, j) => j !== i))}>
              <Ionicons name="close-circle" size={22} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addPhotoBtn} onPress={addPhoto}>
          <Ionicons name="camera-outline" size={28} color={COLORS.textMuted} />
          <Text style={styles.addPhotoText}>Add Photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function GpsStep({ coords, coordsPicked, openMap }) {
  return (
    <View>
      <SectionHeader icon="location" title="Store Location" hint="Pin your store's exact location on the map. Customers' delivery distance is measured from here." />
      <TouchableOpacity style={[styles.mapBtn, coordsPicked && styles.mapBtnPicked]} onPress={openMap}>
        <Ionicons name={coordsPicked ? "location" : "location-outline"} size={20} color={coordsPicked ? COLORS.storeOrange : COLORS.textLight} />
        <Text style={[styles.mapBtnText, coordsPicked && styles.mapBtnTextPicked]}>
          {coordsPicked ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : "Tap to pick location on the map"}
        </Text>
        {coordsPicked && <Ionicons name="checkmark-circle" size={18} color={COLORS.storeOrange} />}
      </TouchableOpacity>
    </View>
  );
}

function GstStep({ gst, setGst }) {
  return (
    <View>
      <SectionHeader icon="document-text" title="GST Number" hint="Your store's 15-character GST registration number." />
      <TextInput
        style={[styles.input, { textTransform: "uppercase", letterSpacing: 1 }]}
        placeholder="e.g. 22AAAAA0000A1Z5"
        placeholderTextColor={COLORS.textMuted}
        value={gst}
        onChangeText={setGst}
        autoCapitalize="characters"
        maxLength={15}
      />
    </View>
  );
}

function BankStep({ bank, setBank }) {
  return (
    <View>
      <SectionHeader icon="card" title="Bank Account" hint="Where WashingBells will send your earnings payouts." />
      <Text style={styles.label}>Account Holder Name</Text>
      <TextInput
        style={styles.input}
        placeholder="As per bank records"
        placeholderTextColor={COLORS.textMuted}
        value={bank.holder}
        onChangeText={v => setBank(b => ({ ...b, holder: v }))}
      />
      <Text style={styles.label}>Account Number</Text>
      <TextInput
        style={styles.input}
        placeholder="0000 0000 0000 0000"
        placeholderTextColor={COLORS.textMuted}
        value={bank.account}
        onChangeText={v => setBank(b => ({ ...b, account: v.replace(/[^0-9]/g, "") }))}
        keyboardType="number-pad"
        maxLength={20}
      />
      <Text style={styles.label}>IFSC Code</Text>
      <TextInput
        style={[styles.input, { textTransform: "uppercase", letterSpacing: 1 }]}
        placeholder="e.g. HDFC0001234"
        placeholderTextColor={COLORS.textMuted}
        value={bank.ifsc}
        onChangeText={v => setBank(b => ({ ...b, ifsc: v.toUpperCase() }))}
        autoCapitalize="characters"
        maxLength={11}
      />
    </View>
  );
}

function SectionHeader({ icon, title, hint }) {
  return (
    <View style={{ alignItems: "center", marginBottom: SPACING.xl }}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={36} color={COLORS.storeOrange} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionHint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.storeOrange,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: COLORS.white },
  headerSub: { fontSize: 12, color: COLORS.storeOrangeLight, marginTop: 2 },
  skipText: { fontSize: 13, color: COLORS.storeOrangeLight, fontWeight: "600" },

  progressRow: {
    flexDirection: "row", justifyContent: "center", gap: SPACING.sm,
    paddingVertical: SPACING.lg, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  progressDot: { width: 60, height: 4, borderRadius: 2, backgroundColor: COLORS.borderLight },
  progressDotActive: { backgroundColor: COLORS.storeOrange },
  progressDotDone: { backgroundColor: COLORS.success },

  content: { padding: SPACING.xl, paddingBottom: SPACING.xxxl },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.storeOrangeLight,
    justifyContent: "center", alignItems: "center",
    marginBottom: SPACING.md,
  },
  sectionTitle: { fontSize: 22, fontWeight: "800", color: COLORS.black, marginBottom: SPACING.sm },
  sectionHint: { fontSize: 13, color: COLORS.textLight, textAlign: "center", lineHeight: 18, paddingHorizontal: SPACING.lg },

  label: { fontSize: 13, fontWeight: "600", color: COLORS.textLight, marginBottom: SPACING.sm, marginTop: SPACING.md },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.lg, fontSize: 15, color: COLORS.black,
  },

  photosGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md },
  photoThumb: { width: 100, height: 100, borderRadius: RADIUS.md, overflow: "visible" },
  photoImg: { width: 100, height: 100, borderRadius: RADIUS.md },
  photoRemove: { position: "absolute", top: -8, right: -8 },
  addPhotoBtn: {
    width: 100, height: 100, borderRadius: RADIUS.md,
    borderWidth: 2, borderColor: COLORS.border, borderStyle: "dashed",
    justifyContent: "center", alignItems: "center",
  },
  addPhotoText: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },

  mapBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.lg, borderStyle: "dashed",
  },
  mapBtnPicked: { borderColor: COLORS.storeOrange, borderStyle: "solid", backgroundColor: COLORS.storeOrangeLight },
  mapBtnText: { flex: 1, fontSize: 14, color: COLORS.textMuted },
  mapBtnTextPicked: { color: COLORS.black, fontWeight: "600" },

  footer: {
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
  },
  footerBtnRow: { flexDirection: "row", gap: SPACING.md },
  backBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.storeOrange,
  },
  backBtnText: { fontSize: 14, fontWeight: "700", color: COLORS.storeOrange },
  nextBtn: {
    flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.storeOrange, paddingVertical: SPACING.md, borderRadius: RADIUS.full,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: COLORS.white, fontSize: 15, fontWeight: "700" },

  // Map modal
  mapContainer: { flex: 1, backgroundColor: "#000" },
  crosshairWrapper: { position: "absolute", top: "50%", left: "50%", marginLeft: -22, marginTop: -44, zIndex: 10 },
  crosshairIcon: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4 },
  mapTopBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  mapCloseBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.white,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  mapTitle: { flex: 1, fontSize: 14, fontWeight: "600", color: COLORS.black },
  myLocBtn: {
    position: "absolute", right: 16, bottom: 200,
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.white,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },
  mapBottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, padding: SPACING.xl,
    paddingBottom: Platform.OS === "ios" ? 36 : SPACING.xl,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 10,
  },
  coordsLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600", letterSpacing: 0.5 },
  coordsText: { fontSize: 15, fontWeight: "700", color: COLORS.black, marginTop: 2, marginBottom: SPACING.md },
  confirmBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    backgroundColor: COLORS.storeOrange, paddingVertical: SPACING.lg, borderRadius: RADIUS.full,
  },
  confirmBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
});
