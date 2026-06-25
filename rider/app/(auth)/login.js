import React, { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS, SHADOW } from "../../constants/theme";
import { useAuthStore } from "../../stores/authStore";

export default function LoginScreen() {
  const router = useRouter();
  const { sendOTP, loginWithPassword } = useAuthStore();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (phone.length < 10) {
      Alert.alert("Invalid Number", "Please enter a valid 10-digit mobile number.");
      return;
    }
    const fullPhone = phone.startsWith("+91") ? phone : `+91${phone}`;
    setLoading(true);
    try {
      await sendOTP(fullPhone);
      router.push({ pathname: "/(auth)/otp", params: { phone: fullPhone } });
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to send OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (phone.length < 10) {
      Alert.alert("Invalid Number", "Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!password) {
      Alert.alert("Password Required", "Please enter your password.");
      return;
    }
    const fullPhone = phone.startsWith("+91") ? phone : `+91${phone}`;
    setLoading(true);
    try {
      await loginWithPassword(fullPhone, password);
      // Root layout handles registration / approval gating from here.
    } catch (e) {
      Alert.alert("Login Failed", e?.response?.data?.detail || "Invalid phone number or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
        <View style={styles.logoSection}>
          <Image
            source={require("../../assets/V_icon_only.png")}
            style={styles.logoImg}
            resizeMode="contain"
          />
          <Text style={styles.title}>WashingBells Rider</Text>
          <Text style={styles.subtitle}>Your delivery partner app</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Mobile Number</Text>
          <View style={styles.phoneRow}>
            <View style={styles.countryCode}><Text style={styles.countryText}>🇮🇳 +91</Text></View>
            <TextInput
              style={styles.input}
              placeholder="Enter your mobile number"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={setPhone}
              autoFocus
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordField}
              placeholder="Enter your password"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handlePasswordLogin}
              returnKeyType="go"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, (phone.length < 10 || !password || loading) && styles.btnDisabled]}
            onPress={handlePasswordLogin}
            disabled={phone.length < 10 || !password || loading}
          >
            {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Login with Password</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.otpBtn}
            onPress={handleSendOTP}
            disabled={phone.length < 10 || loading}
          >
            <Text style={styles.otpBtnText}>Get OTP instead</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            New rider? You'll be asked to register after logging in.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: SPACING.xl, justifyContent: "center" },
  logoSection: { alignItems: "center", marginBottom: SPACING.xxxl * 2 },
  logoImg: { width: 104, height: 104, marginBottom: SPACING.md },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.black, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textMuted },
  form: { width: "100%" },
  label: { fontSize: 13, fontWeight: "600", color: COLORS.textLight, marginBottom: SPACING.sm },
  phoneRow: { flexDirection: "row", marginBottom: SPACING.xl },
  countryCode: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, justifyContent: "center",
    marginRight: SPACING.sm,
  },
  countryText: { fontSize: 15, color: COLORS.text },
  input: {
    flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.lg, fontSize: 18, color: COLORS.black, letterSpacing: 1,
  },
  passwordRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingRight: SPACING.md, marginBottom: SPACING.xl,
  },
  passwordField: { flex: 1, padding: SPACING.lg, fontSize: 16, color: COLORS.black },
  eyeBtn: { padding: SPACING.xs },
  btn: {
    backgroundColor: COLORS.forestGreen, paddingVertical: SPACING.lg,
    borderRadius: RADIUS.full, alignItems: "center",
    ...SHADOW, shadowColor: COLORS.forestGreen, shadowOpacity: 0.25,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
  otpBtn: { alignItems: "center", paddingVertical: SPACING.md, marginTop: SPACING.md },
  otpBtnText: { color: COLORS.forestGreen, fontSize: 15, fontWeight: "600" },
  hint: { textAlign: "center", color: COLORS.textMuted, fontSize: 12, marginTop: SPACING.xl, lineHeight: 18 },
});
