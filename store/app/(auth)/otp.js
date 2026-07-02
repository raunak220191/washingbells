import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";
import { useAuthStore } from "../../stores/authStore";

export default function OTPScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams();
  const { verifyOTP, sendOTP } = useAuthStore();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(30);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const handleResend = async () => {
    try {
      await sendOTP(phone);
      setResendIn(30);
      setOtp("");
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to resend OTP. Try again.");
    }
  };

  const handleVerify = async () => {
    if (otp.length < 4) { Alert.alert("Invalid OTP"); return; }
    setLoading(true);
    try {
      const res = await verifyOTP(phone, otp);
      const role = res.user?.role;
      if (role === "store_owner") {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/(auth)/setup");
      }
    } catch {
      Alert.alert("Invalid OTP", "Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"))} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.emoji}>📱</Text>
        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.sub}>Sent to <Text style={styles.phone}>{phone}</Text></Text>
        {__DEV__ && <Text style={styles.devHint}>DEV: Use OTP 123456</Text>}
        <TextInput style={styles.otpInput} placeholder="OTP" placeholderTextColor={COLORS.textMuted} keyboardType="number-pad" maxLength={6} value={otp} onChangeText={setOtp} autoFocus textAlign="center" />
        <TouchableOpacity style={[styles.btn, (otp.length < 4 || loading) && styles.btnDisabled]} onPress={handleVerify} disabled={otp.length < 4 || loading}>
          {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Verify & Continue</Text>}
        </TouchableOpacity>

        {resendIn > 0 ? (
          <Text style={styles.resendWait}>Resend OTP in {resendIn}s</Text>
        ) : (
          <TouchableOpacity onPress={handleResend} disabled={loading} style={styles.resendBtn}>
            <Text style={styles.resendText}>Resend OTP</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: SPACING.xl, justifyContent: "center" },
  backBtn: { position: "absolute", top: SPACING.lg, left: SPACING.lg },
  emoji: { fontSize: 48, textAlign: "center", marginBottom: SPACING.md },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.black, textAlign: "center" },
  sub: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", marginBottom: SPACING.sm },
  phone: { fontWeight: "700", color: COLORS.storeOrange },
  devHint: { fontSize: 11, color: COLORS.gold, textAlign: "center", marginBottom: SPACING.xl, backgroundColor: COLORS.cream, padding: SPACING.sm, borderRadius: RADIUS.sm },
  otpInput: { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.lg, fontSize: 28, color: COLORS.black, letterSpacing: 12, marginBottom: SPACING.xl },
  btn: { backgroundColor: COLORS.storeOrange, paddingVertical: SPACING.lg, borderRadius: RADIUS.full, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
  resendWait: { textAlign: "center", color: COLORS.textMuted, fontSize: 13, marginTop: SPACING.xl },
  resendBtn: { alignItems: "center", paddingVertical: SPACING.md, marginTop: SPACING.lg },
  resendText: { color: COLORS.storeOrange, fontSize: 15, fontWeight: "600" },
});
