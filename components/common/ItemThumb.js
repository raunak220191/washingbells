// ItemThumb — display-only item image thumbnail (upgrade_last TASK 1.4).
// Fixed-size container either way (image or placeholder) so list layout never
// shifts; onError falls back to the placeholder so a broken URL never renders
// a broken image.
import React, { useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, ICON } from "../../constants/theme";
import api from "../../lib/api";

const API_ORIGIN = (api.defaults.baseURL || "").replace(/\/api\/v1\/?$/, "");

export default function ItemThumb({ imageUrl, size = 48, style }) {
  const [broken, setBroken] = useState(false);
  const showImage = imageUrl && !broken;
  const uri = showImage
    ? (imageUrl.startsWith("http") ? imageUrl : `${API_ORIGIN}${imageUrl}`)
    : null;
  return (
    <View style={[styles.box, { width: size, height: size }, style]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <Ionicons name="shirt-outline" size={ICON.sm} color={COLORS.textMuted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
});
