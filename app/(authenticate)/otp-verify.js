import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";
import { useAuthStore } from "../../stores/authStore";
import Button from "../../components/common/Button";

const OTP_LENGTH = 6;

export default function OTPVerifyScreen() {
  const { phone } = useLocalSearchParams();
  const router = useRouter();
  const { verifyOTP, sendOTP } = useAuthStore();

  const [code, setCode] = useState(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const inputs = useRef([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleChange = (text, index) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-advance to next input
    if (text && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otp = code.join("");
    if (otp.length !== OTP_LENGTH) {
      Alert.alert("Invalid OTP", "Please enter the full OTP.");
      return;
    }

    setLoading(true);
    try {
      const result = await verifyOTP(phone, otp);
      if (result.is_new_user) {
        router.replace("/(authenticate)/onboarding");
      } else {
        router.replace("/(tabs)/home");
      }
    } catch (error) {
      Alert.alert("Invalid OTP", error?.response?.data?.detail || "The code you entered is incorrect.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await sendOTP(phone);
      setResendTimer(30);
      setCode(Array(OTP_LENGTH).fill(""));
      inputs.current[0]?.focus();
      Alert.alert("OTP Sent", "A new OTP has been sent to your phone.");
    } catch (error) {
      Alert.alert("Error", "Failed to resend OTP.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.content}
      >
        {/* Back Button */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>

        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to{"\n"}
          <Text style={styles.phone}>{phone}</Text>
        </Text>

        {/* OTP Inputs */}
        <View style={styles.otpRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => (inputs.current[i] = ref)}
              style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(text) => handleChange(text, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              autoFocus={i === 0}
            />
          ))}
        </View>

        {/* Verify Button */}
        <Button
          title="Verify & Continue"
          onPress={handleVerify}
          loading={loading}
          disabled={code.join("").length !== OTP_LENGTH}
          style={{ marginTop: SPACING.xxl }}
        />

        {/* Resend */}
        <View style={styles.resendRow}>
          {resendTimer > 0 ? (
            <Text style={styles.resendText}>
              Resend OTP in <Text style={styles.timer}>{resendTimer}s</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendLink}>Resend OTP</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Dev hint */}
        {__DEV__ && (
          <Text style={styles.devHint}>Dev mode: use code 123456</Text>
        )}
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
    paddingTop: SPACING.xl,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    marginBottom: SPACING.xxl,
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
    lineHeight: 22,
    marginBottom: SPACING.xxxl,
  },
  phone: {
    fontWeight: "700",
    color: COLORS.text,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  otpInput: {
    flex: 1,
    height: 56,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.black,
  },
  otpInputFilled: {
    borderColor: COLORS.gold,
    backgroundColor: "#FDF9F0",
  },
  resendRow: {
    alignItems: "center",
    marginTop: SPACING.xl,
  },
  resendText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  timer: {
    fontWeight: "700",
    color: COLORS.forestGreen,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.gold,
  },
  devHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: SPACING.xl,
    fontStyle: "italic",
  },
});
