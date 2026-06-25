import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Image, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";
import { useAuthStore } from "../../stores/authStore";

const STEPS = [
  {
    key: "dl_image",
    title: "Driving License",
    icon: "card-outline",
    hint: "Upload a clear photo of your Driving License (front side).",
    type: "library", // OK to pick from library
  },
  {
    key: "aadhaar_image",
    title: "Aadhaar Card",
    icon: "id-card-outline",
    hint: "Upload a clear photo of your Aadhaar card (front side).",
    type: "library",
  },
  {
    key: "selfie_image",
    title: "Selfie with Aadhaar",
    icon: "person-circle-outline",
    hint: "Take a selfie holding your Aadhaar card next to your face. This is for identity verification.",
    type: "camera", // Selfie must use camera, not gallery
  },
];

export default function DocumentsScreen() {
  const router = useRouter();
  const { user, uploadRiderDocuments } = useAuthStore();
  const [step, setStep] = useState(0);
  const [images, setImages] = useState({
    dl_image: user?.has_dl ? "existing" : null,
    aadhaar_image: user?.has_aadhaar ? "existing" : null,
    selfie_image: user?.has_selfie ? "existing" : null,
  });
  const [loading, setLoading] = useState(false);

  const current = STEPS[step];
  const hasImage = !!images[current.key];

  const pickImage = async () => {
    const isCamera = current.type === "camera";
    const perm = isCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (perm.status !== "granted") {
      Alert.alert(
        isCamera ? "Camera Required" : "Photos Required",
        `Please enable ${isCamera ? "camera" : "photo library"} access in Settings.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    const launch = isCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await launch({
      mediaTypes: ["images"], allowsEditing: !isCamera,
      aspect: isCamera ? undefined : [4, 3],
      quality: 0.5, base64: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      setImages(prev => ({ ...prev, [current.key]: `data:image/jpeg;base64,${result.assets[0].base64}` }));
    }
  };

  const handleNext = async () => {
    // If current step image is fresh (not "existing"), upload it now
    const value = images[current.key];
    if (value && value !== "existing") {
      setLoading(true);
      try {
        await uploadRiderDocuments({ [current.key]: value });
      } catch (e) {
        Alert.alert("Upload Failed", e?.response?.data?.detail || "Try again.");
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      // All steps done
      Alert.alert(
        "Documents Submitted ✅",
        "All your documents are uploaded. Your account is now under admin review. You'll be notified once approved.",
        [{ text: "OK", onPress: () => router.replace("/(tabs)/home") }]
      );
    }
  };

  const skipForNow = () => {
    Alert.alert(
      "Verification Required",
      "All three documents (Driving License, Aadhaar, and Selfie) are required before you can start taking trips. You can continue later but won't be able to accept assignments until verification is complete.",
      [
        { text: "Continue Verification", style: "cancel" },
        { text: "Skip for Now", style: "destructive", onPress: () => router.replace("/(tabs)/home") },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={26} color={COLORS.white} />
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={styles.headerTitle}>Verify Your Identity</Text>
          <Text style={styles.headerSub}>Step {step + 1} of {STEPS.length}</Text>
        </View>
        <TouchableOpacity onPress={skipForNow}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Progress dots */}
      <View style={styles.progressRow}>
        {STEPS.map((s, i) => (
          <View
            key={s.key}
            style={[
              styles.progressDot,
              i < step && styles.progressDotDone,
              i === step && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name={current.icon} size={36} color={COLORS.forestGreen} />
        </View>
        <Text style={styles.stepTitle}>{current.title}</Text>
        <Text style={styles.stepHint}>{current.hint}</Text>

        {hasImage ? (
          <View style={styles.previewWrap}>
            {images[current.key] === "existing" ? (
              <View style={styles.existingBox}>
                <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
                <Text style={styles.existingText}>Already uploaded</Text>
                <Text style={styles.existingSub}>Tap below to replace</Text>
              </View>
            ) : (
              <Image source={{ uri: images[current.key] }} style={styles.preview} />
            )}
            <TouchableOpacity style={styles.replaceBtn} onPress={pickImage}>
              <Ionicons name="refresh" size={16} color={COLORS.forestGreen} />
              <Text style={styles.replaceBtnText}>{current.type === "camera" ? "Retake" : "Replace"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
            <Ionicons name={current.type === "camera" ? "camera" : "cloud-upload-outline"} size={42} color={COLORS.textMuted} />
            <Text style={styles.uploadText}>
              {current.type === "camera" ? "Tap to take selfie" : "Tap to upload photo"}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.noteBox}>
          <Ionicons name="lock-closed-outline" size={14} color={COLORS.riderBlue} />
          <Text style={styles.noteText}>
            Your documents are encrypted and used only for verification by the WashingBells admin team.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerBtnRow}>
          {step > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)} disabled={loading}>
              <Ionicons name="arrow-back" size={18} color={COLORS.forestGreen} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, !hasImage && styles.nextBtnDisabled]}
            disabled={!hasImage || loading}
            onPress={handleNext}
          >
            {loading ? <ActivityIndicator color={COLORS.white} /> : (
              <>
                <Text style={styles.nextBtnText}>
                  {step === STEPS.length - 1 ? "Submit All" : "Next"}
                </Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: COLORS.white },
  headerSub: { fontSize: 12, color: COLORS.mintGreen, marginTop: 2 },
  skipText: { fontSize: 13, color: COLORS.mintGreen, fontWeight: "600" },

  progressRow: {
    flexDirection: "row", justifyContent: "center", gap: SPACING.sm,
    paddingVertical: SPACING.lg, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  progressDot: {
    width: 60, height: 4, borderRadius: 2,
    backgroundColor: COLORS.borderLight,
  },
  progressDotActive: { backgroundColor: COLORS.forestGreen },
  progressDotDone: { backgroundColor: COLORS.success },

  content: { padding: SPACING.xl, paddingBottom: SPACING.xxxl, alignItems: "center" },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.mintGreen,
    justifyContent: "center", alignItems: "center",
    marginVertical: SPACING.xl,
  },
  stepTitle: { fontSize: 22, fontWeight: "800", color: COLORS.black, marginBottom: SPACING.md },
  stepHint: { fontSize: 14, color: COLORS.textLight, textAlign: "center", marginBottom: SPACING.xl, lineHeight: 20, paddingHorizontal: SPACING.lg },

  uploadBox: {
    width: "100%", aspectRatio: 4/3,
    backgroundColor: COLORS.white, borderWidth: 2, borderColor: COLORS.border,
    borderStyle: "dashed", borderRadius: RADIUS.lg,
    justifyContent: "center", alignItems: "center", gap: SPACING.md,
  },
  uploadText: { fontSize: 14, color: COLORS.textMuted, fontWeight: "600" },

  previewWrap: { width: "100%", alignItems: "center" },
  preview: { width: "100%", aspectRatio: 4/3, borderRadius: RADIUS.lg, backgroundColor: COLORS.borderLight },
  existingBox: {
    width: "100%", aspectRatio: 4/3, backgroundColor: COLORS.mintGreen,
    borderRadius: RADIUS.lg, justifyContent: "center", alignItems: "center", gap: SPACING.sm,
  },
  existingText: { fontSize: 16, fontWeight: "700", color: COLORS.forestGreen, marginTop: SPACING.sm },
  existingSub: { fontSize: 12, color: COLORS.forestGreen, opacity: 0.7 },
  replaceBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.forestGreen,
    marginTop: SPACING.md,
  },
  replaceBtnText: { fontSize: 13, fontWeight: "700", color: COLORS.forestGreen },

  noteBox: {
    flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.xl,
    backgroundColor: COLORS.riderBlueLight, padding: SPACING.md, borderRadius: RADIUS.md,
  },
  noteText: { flex: 1, fontSize: 12, color: COLORS.riderBlue, lineHeight: 17 },

  footer: {
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
  },
  footerBtnRow: { flexDirection: "row", gap: SPACING.md },
  backBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.forestGreen,
  },
  backBtnText: { fontSize: 14, fontWeight: "700", color: COLORS.forestGreen },
  nextBtn: {
    flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.forestGreen, paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: COLORS.white, fontSize: 15, fontWeight: "700" },
});
