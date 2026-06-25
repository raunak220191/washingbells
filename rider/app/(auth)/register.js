import { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Alert, ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";
import { useAuthStore } from "../../stores/authStore";

const VEHICLE_TYPES = [
  { value: "bike", label: "Bike 🏍️" },
  { value: "auto", label: "Auto 🛺" },
  { value: "van",  label: "Van 🚐" },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { registerRider, refreshProfile } = useAuthStore();

  const [name, setName] = useState("");
  const [vehicleType, setVehicleType] = useState("bike");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim()) { Alert.alert("Required", "Please enter your name."); return; }
    if (!vehicleNumber.trim()) { Alert.alert("Required", "Please enter your vehicle number."); return; }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert("Invalid Email", "Please enter a valid email address or leave it blank."); return;
    }
    setLoading(true);
    try {
      await registerRider({
        name: name.trim(),
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber.trim().toUpperCase(),
        email: email.trim() ? email.trim().toLowerCase() : undefined,
      });
      await refreshProfile();
      // Routing through T&C / documents is handled by the root layout
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rider Registration</Text>
        <Text style={styles.headerSub}>Tell us about yourself and your vehicle</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your full name"
          placeholderTextColor={COLORS.textMuted}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Vehicle Type *</Text>
        <View style={styles.vehicleRow}>
          {VEHICLE_TYPES.map(v => (
            <TouchableOpacity
              key={v.value}
              style={[styles.vehicleCard, vehicleType === v.value && styles.vehicleCardActive]}
              onPress={() => setVehicleType(v.value)}
            >
              <Text style={styles.vehicleIcon}>{v.label}</Text>
              <Text style={[styles.vehicleLabel, vehicleType === v.value && styles.vehicleLabelActive]}>{v.value.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Vehicle Number *</Text>
        <TextInput
          style={[styles.input, { textTransform: "uppercase" }]}
          placeholder="e.g. PB10AB1234"
          placeholderTextColor={COLORS.textMuted}
          value={vehicleNumber}
          onChangeText={setVehicleNumber}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Email (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="your@email.com — for important updates"
          placeholderTextColor={COLORS.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />

        <View style={styles.noteBox}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.riderBlue} />
          <Text style={styles.noteText}>
            After this step you'll review our Terms & Conditions and upload three documents
            (Driving License, Aadhaar, and a Selfie with Aadhaar) for verification.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (!name || !vehicleNumber || loading) && styles.submitBtnDisabled]}
          onPress={handleRegister}
          disabled={!name || !vehicleNumber || loading}
        >
          {loading
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.submitText}>Continue to Verification →</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.xl, backgroundColor: COLORS.forestGreen },
  headerTitle: { fontSize: 22, fontWeight: "800", color: COLORS.white },
  headerSub: { fontSize: 13, color: COLORS.mintGreen, marginTop: 4 },
  content: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.xl, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: "600", color: COLORS.textLight, marginBottom: SPACING.sm, marginTop: SPACING.lg },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.lg, fontSize: 16, color: COLORS.black,
  },
  vehicleRow: { flexDirection: "row", gap: SPACING.md },
  vehicleCard: {
    flex: 1, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: "center",
  },
  vehicleCardActive: { backgroundColor: COLORS.mintGreen, borderColor: COLORS.forestGreen },
  vehicleIcon: { fontSize: 24, marginBottom: 4 },
  vehicleLabel: { fontSize: 11, fontWeight: "700", color: COLORS.textMuted },
  vehicleLabelActive: { color: COLORS.forestGreen },
  noteBox: {
    flexDirection: "row", alignItems: "flex-start", backgroundColor: COLORS.riderBlueLight,
    padding: SPACING.md, borderRadius: RADIUS.md, gap: SPACING.sm, marginTop: SPACING.xl,
  },
  noteText: { flex: 1, fontSize: 12, color: COLORS.riderBlue, lineHeight: 18 },
  submitBtn: {
    backgroundColor: COLORS.forestGreen, paddingVertical: SPACING.lg,
    borderRadius: RADIUS.full, alignItems: "center", marginTop: SPACING.xl,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
});
