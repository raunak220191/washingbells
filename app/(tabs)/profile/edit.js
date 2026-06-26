import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Image, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { COLORS, SPACING, RADIUS } from "../../../constants/theme";
import { useAuthStore } from "../../../stores/authStore";
import Screen from "../../../components/common/Screen";
import Header from "../../../components/common/Header";
import Button from "../../../components/common/Button";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateProfile } = useAuthStore();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profileImage, setProfileImage] = useState(user?.profile_image || null);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Needed", "Please allow photo library access to set a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const uri = asset.base64
        ? `data:image/jpeg;base64,${asset.base64}`
        : asset.uri;
      setProfileImage(uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Needed", "Please allow camera access to take a profile picture.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const uri = asset.base64
        ? `data:image/jpeg;base64,${asset.base64}`
        : asset.uri;
      setProfileImage(uri);
    }
  };

  const showImageOptions = () => {
    Alert.alert("Profile Photo", "Choose an option", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Library", onPress: pickImage },
      ...(profileImage ? [{ text: "Remove Photo", style: "destructive", onPress: () => setProfileImage(null) }] : []),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter your name.");
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    setSaving(true);
    try {
      const data = { name: name.trim() };
      if (email.trim()) data.email = email.trim().toLowerCase();
      if (profileImage) data.profile_image = profileImage;
      else if (user?.profile_image && !profileImage) data.profile_image = "";
      await updateProfile(data);
      Alert.alert("Saved ✓", "Your profile has been updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const initials = name ? name.charAt(0).toUpperCase() : "U";

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.headerPad}>
          <Header title="Edit Profile" onBack={() => router.back()} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Avatar */}
          <TouchableOpacity style={styles.avatarSection} onPress={showImageOptions} activeOpacity={0.7}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={14} color={COLORS.white} />
            </View>
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>

          {/* Form Fields */}
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your full name"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={[styles.input, styles.disabledInput]}>
                <Ionicons name="lock-closed-outline" size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                <Text style={styles.disabledText}>{user?.phone || "+91XXXXXXXXXX"}</Text>
              </View>
              <Text style={styles.hint}>Phone number cannot be changed</Text>
            </View>
          </View>

          {/* Single primary save action */}
          <Button
            title="Save Changes"
            variant="secondary"
            fullWidth
            loading={saving}
            onPress={handleSave}
            style={styles.saveButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: SPACING.lg },
  avatarSection: { alignItems: "center", paddingVertical: SPACING.xl },
  avatarImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.gold },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.mintGreen,
    justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: COLORS.gold,
  },
  avatarInitials: { fontSize: 40, fontWeight: "700", color: COLORS.forestGreen },
  cameraBadge: {
    position: "absolute", top: 80, right: "35%",
    backgroundColor: COLORS.forestGreen, width: 28, height: 28, borderRadius: 14,
    justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: COLORS.white,
  },
  changePhotoText: { fontSize: 13, color: COLORS.gold, fontWeight: "600", marginTop: SPACING.sm },
  form: { paddingHorizontal: SPACING.xl },
  fieldGroup: { marginBottom: SPACING.xl },
  label: { fontSize: 13, fontWeight: "600", color: COLORS.textLight, marginBottom: SPACING.sm },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.lg, fontSize: 16, color: COLORS.black,
  },
  disabledInput: {
    backgroundColor: COLORS.borderLight, flexDirection: "row", alignItems: "center",
  },
  disabledText: { fontSize: 16, color: COLORS.textMuted },
  hint: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  saveButton: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
  },
});
