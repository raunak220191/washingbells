import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";
import { useAuthStore } from "../../stores/authStore";
import Button from "../../components/common/Button";
import Screen from "../../components/common/Screen";

export default function OnboardingScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const handleContinue = async () => {
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter your name.");
      return;
    }

    setLoading(true);
    try {
      const data = { name: name.trim() };
      if (email.trim()) {
        data.email = email.trim().toLowerCase();
      }
      await updateProfile(data);
      router.replace("/(tabs)/home");
    } catch (error) {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.content}
      >
        <Text style={styles.emoji}>👋</Text>
        <Text style={styles.title}>Almost there!</Text>
        <Text style={styles.subtitle}>
          Tell us a bit about yourself so we can personalize your experience.
        </Text>

        {/* Name */}
        <Text style={styles.label}>Your Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Raunak Pandey"
          placeholderTextColor={COLORS.textMuted}
          value={name}
          onChangeText={setName}
          autoFocus
        />

        {/* Email (optional) */}
        <Text style={styles.label}>Email (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="your@email.com"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Button
          title="Get Started"
          onPress={handleContinue}
          loading={loading}
          disabled={!name.trim()}
          style={{ marginTop: SPACING.xxxl }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    justifyContent: "center",
  },
  emoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
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
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textLight,
    marginBottom: SPACING.xs,
    marginTop: SPACING.lg,
  },
  input: {
    backgroundColor: COLORS.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 16,
    color: COLORS.text,
  },
});
