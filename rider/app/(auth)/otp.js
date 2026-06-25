import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";
import { useAuthStore } from "../../stores/authStore";

export default function OTPScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams();
  const { verifyOTP } = useAuthStore();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (otp.length < 4) { Alert.alert("Invalid OTP", "Please enter the 4-6 digit OTP."); return; }
    setLoading(true);
    try {
      const res = await verifyOTP(phone, otp);
      const role = res.user?.role;
      if (role === "rider") {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/(auth)/register");
      }
    } catch (e) {
      Alert.alert("Invalid OTP", "The OTP you entered is incorrect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>

        <Text style={styles.emoji}>📱</Text>
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>
          OTP sent to <Text style={styles.phone}>{phone}</Text>
        </Text>
        <Text style={styles.devHint}>DEV: Use OTP 123456</Text>

        <TextInput
          style={styles.otpInput}
          placeholder="Enter OTP"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="number-pad"
          maxLength={6}
          value={otp}
          onChangeText={setOtp}
          autoFocus
          textAlign="center"
        />

        <TouchableOpacity
          style={[styles.btn, (otp.length < 4 || loading) && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={otp.length < 4 || loading}
        >
          {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Verify & Continue</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: SPACING.xl, justifyContent: "center" },
  backBtn: { position: "absolute", top: SPACING.lg, left: SPACING.lg, padding: SPACING.sm },
  emoji: { fontSize: 48, marginBottom: SPACING.md, textAlign: "center" },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.black, textAlign: "center", marginBottom: SPACING.sm },
  subtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", marginBottom: SPACING.sm },
  phone: { fontWeight: "700", color: COLORS.forestGreen },
  devHint: { fontSize: 11, color: COLORS.gold, textAlign: "center", marginBottom: SPACING.xl, backgroundColor: COLORS.cream, padding: SPACING.sm, borderRadius: RADIUS.sm },
  otpInput: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.lg, fontSize: 28, color: COLORS.black,
    letterSpacing: 12, marginBottom: SPACING.xl,
  },
  btn: { backgroundColor: COLORS.forestGreen, paddingVertical: SPACING.lg, borderRadius: RADIUS.full, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
});
