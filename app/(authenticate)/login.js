import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";
import { useAuthStore } from "../../stores/authStore";
import Button from "../../components/common/Button";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const sendOTP = useAuthStore((s) => s.sendOTP);
  const loginWithPassword = useAuthStore((s) => s.loginWithPassword);

  const handleSendOTP = async () => {
    const cleaned = phone.replace(/\s/g, "");
    if (cleaned.length !== 10) {
      Alert.alert("Invalid Number", "Please enter a valid 10-digit phone number.");
      return;
    }

    const fullPhone = `+91${cleaned}`;
    setLoading(true);
    try {
      await sendOTP(fullPhone);
      router.push({ pathname: "/(authenticate)/otp-verify", params: { phone: fullPhone } });
    } catch (error) {
      Alert.alert("Error", error?.response?.data?.detail || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    const cleaned = phone.replace(/\s/g, "");
    if (cleaned.length !== 10) {
      Alert.alert("Invalid Number", "Please enter a valid 10-digit phone number.");
      return;
    }
    if (!password) {
      Alert.alert("Password Required", "Please enter your password.");
      return;
    }
    const fullPhone = `+91${cleaned}`;
    setLoading(true);
    try {
      const result = await loginWithPassword(fullPhone, password);
      if (result.is_new_user) {
        router.replace("/(authenticate)/onboarding");
      } else {
        router.replace("/(tabs)/home");
      }
    } catch (error) {
      Alert.alert("Login Failed", error?.response?.data?.detail || "Invalid phone number or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.content}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/logo1.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>WASHING</Text>
          <View style={styles.subtitleRow}>
            <View style={styles.line} />
            <Text style={styles.brandSub}>BELLS</Text>
            <View style={styles.line} />
          </View>
        </View>

        {/* Welcome Text */}
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.subtitle}>
          Enter your phone number to get started
        </Text>

        {/* Phone Input */}
        <View style={styles.phoneRow}>
          <View style={styles.countryCode}>
            <Text style={styles.countryText}>🇮🇳 +91</Text>
          </View>
          <TextInput
            style={styles.phoneInput}
            placeholder="Enter mobile number"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        {/* Password */}
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {/* Primary: password login (OTP bypass) */}
        <Button
          title="Login with Password"
          onPress={handlePasswordLogin}
          loading={loading}
          disabled={phone.replace(/\s/g, "").length !== 10 || !password}
          style={{ marginTop: SPACING.xl }}
        />

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Secondary: OTP login */}
        <TouchableOpacity
          onPress={handleSendOTP}
          disabled={phone.replace(/\s/g, "").length !== 10 || loading}
          style={styles.otpBtn}
        >
          <Text style={styles.otpBtnText}>Get OTP instead</Text>
        </TouchableOpacity>

        {/* Terms */}
        <Text style={styles.terms}>
          By continuing, you agree to our{" "}
          <Text style={styles.link}>Terms of Service</Text> and{" "}
          <Text style={styles.link}>Privacy Policy</Text>
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: SPACING.xxxl,
  },
  logo: {
    width: 80,
    height: 80,
  },
  brandName: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.forestGreen,
    letterSpacing: 1,
    marginTop: SPACING.sm,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: -2,
  },
  line: {
    height: 2,
    width: 30,
    backgroundColor: COLORS.gold,
  },
  brandSub: {
    fontSize: 24,
    fontWeight: "400",
    color: COLORS.gold,
    marginHorizontal: 6,
    letterSpacing: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.black,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textLight,
    marginBottom: SPACING.xxl,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  countryCode: {
    backgroundColor: COLORS.white,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  countryText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 16,
    color: COLORS.text,
    letterSpacing: 1,
  },
  passwordInput: {
    backgroundColor: COLORS.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 16,
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  otpBtn: {
    alignItems: "center",
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
  },
  otpBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.forestGreen,
  },
  terms: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: SPACING.xl,
    lineHeight: 18,
  },
  link: {
    color: COLORS.gold,
    fontWeight: "600",
  },
});
