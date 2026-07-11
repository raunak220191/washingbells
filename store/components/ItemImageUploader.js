// ItemImageUploader — the ONE image slot for a catalog item (upgrade_last TASK 1).
// Duplicated verbatim in store/ and rider/ apps: there is no shared package in
// this repo (each app vendors its components — see RescheduleModal/HtmlText).
// Keep both copies in sync.
import React, { useState, useRef } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import api from "../lib/api";
import { COLORS, RADIUS } from "../constants/theme";

const API_ORIGIN = (api.defaults.baseURL || "").replace(/\/api\/v1\/?$/, "");

export default function ItemImageUploader({ itemId, imageUrl, size = 56, onChange }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState(null); // optimistic local uri
  const lastAssetRef = useRef(null); // kept for retry-on-failure

  const displayUri = preview || (imageUrl ? `${API_ORIGIN}${imageUrl}` : null);

  const pick = async (fromCamera) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        fromCamera
          ? "Camera access is required to take an item photo. You can enable it in Settings."
          : "Photo library access is required to choose an item photo. You can enable it in Settings."
      );
      return;
    }
    const opts = { mediaTypes: ["images"], quality: 1, allowsEditing: true, aspect: [1, 1] };
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.length) return;
    await upload(res.assets[0]);
  };

  const upload = async (asset) => {
    lastAssetRef.current = asset;
    setFailed(false);
    setBusy(true);
    setProgress(0);
    setPreview(asset.uri);
    try {
      // Compress client-side so uploads stay fast on poor networks
      const actions = asset.width > 1200 ? [{ resize: { width: 1200 } }] : [];
      const small = await ImageManipulator.manipulateAsync(asset.uri, actions, {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const form = new FormData();
      form.append("file", { uri: small.uri, name: "item.jpg", type: "image/jpeg" });
      const r = await api.post(`/items/${itemId}/image`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
        transformRequest: Platform.OS === "web" ? undefined : (d) => d,
        onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      setPreview(null); // reconcile with server truth
      onChange?.(r.data.image_url);
    } catch (e) {
      setFailed(true); // keep the optimistic preview + show retry overlay
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = () => {
    Alert.alert("Remove photo?", "The item will show a placeholder instead.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await api.delete(`/items/${itemId}/image`);
            setPreview(null);
            setFailed(false);
            onChange?.(null);
          } catch {
            Alert.alert("Error", "Could not remove the photo. Please try again.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const openSheet = () => {
    if (busy) return;
    if (failed && lastAssetRef.current) {
      Alert.alert("Upload failed", "Retry uploading this photo?", [
        { text: "Cancel", style: "cancel", onPress: () => { setFailed(false); setPreview(null); } },
        { text: "Retry", onPress: () => upload(lastAssetRef.current) },
      ]);
      return;
    }
    const buttons = [
      { text: "Take Photo", onPress: () => pick(true) },
      { text: "Choose from Gallery", onPress: () => pick(false) },
    ];
    if (displayUri) buttons.push({ text: "Remove Photo", style: "destructive", onPress: removePhoto });
    buttons.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Item photo", "One photo per item — uploading again replaces it.", buttons);
  };

  const dim = { width: size, height: size, borderRadius: RADIUS.md };
  return (
    <TouchableOpacity style={[styles.slot, dim]} onPress={openSheet} disabled={busy} activeOpacity={0.7}>
      {displayUri ? (
        <Image source={{ uri: displayUri }} style={[styles.img, dim]} resizeMode="cover" />
      ) : (
        <Ionicons name="camera-outline" size={size * 0.4} color={COLORS.textMuted} />
      )}
      {busy && (
        <View style={[styles.overlay, dim]}>
          <ActivityIndicator size="small" color={COLORS.white} />
          {progress > 0 && <Text style={styles.progressText}>{progress}%</Text>}
        </View>
      )}
      {failed && !busy && (
        <View style={[styles.overlay, dim]}>
          <Ionicons name="refresh-circle" size={size * 0.5} color={COLORS.white} />
        </View>
      )}
      {!displayUri && !busy && !failed && (
        <View style={styles.addBadge}>
          <Ionicons name="add" size={12} color={COLORS.white} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  slot: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  img: { position: "absolute", top: 0, left: 0 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  progressText: { color: COLORS.white, fontSize: 10, fontWeight: "700", marginTop: 2 },
  addBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.forestGreen,
    justifyContent: "center",
    alignItems: "center",
  },
});
