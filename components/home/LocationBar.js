import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";

export default function LocationBar({ address, addressLabel, userName, onLocationPress, onProfilePress }) {
  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <View>
      {/* Location + Profile row */}
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.locationSelector} onPress={onLocationPress}>
          <Ionicons name="location-sharp" size={22} color={COLORS.gold} />
          <View style={styles.locationTextWrapper}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.homeLabel}>{addressLabel || "Home"}</Text>
              <Ionicons name="chevron-down" size={14} color={COLORS.text} />
            </View>
            <Text style={styles.addressText} numberOfLines={1}>
              {address || "Set your address"}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.profileCircle} onPress={onProfilePress}>
          <Text style={styles.profileInitial}>
            {userName ? userName.charAt(0).toUpperCase() : "U"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Greeting */}
      <Text style={styles.welcomeText}>
        {greeting()}, {userName || "there"}!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.sm,
    marginBottom: 4,
  },
  locationSelector: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  locationTextWrapper: {
    marginLeft: SPACING.sm,
  },
  homeLabel: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.black,
    marginRight: 4,
  },
  addressText: {
    fontSize: 12,
    color: COLORS.textLight,
    width: 200,
  },
  profileCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.mintGreen,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  profileInitial: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.forestGreen,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: -2,
    marginBottom: SPACING.sm,
    color: COLORS.text,
    marginHorizontal: SPACING.xl,
  },
});
