import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING } from "../../constants/theme";

export default function HomeHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Image
          source={require("../../assets/V_app_tile.png")}
          style={styles.logoIcon}
        />
        <View style={styles.logoTextWrapper}>
          <Text style={styles.logoTextMain}>WASHING</Text>
          <View style={styles.logoSubtitleRow}>
            <View style={styles.tabLine} />
            <Text style={styles.logoTextSub}>BELLS</Text>
            <View style={styles.tabLine} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoIcon: {
    width: 46,
    height: 46,
    resizeMode: "contain",
  },
  logoTextWrapper: {
    marginLeft: 8,
    alignItems: "center",
  },
  logoTextMain: {
    fontSize: 30,
    fontWeight: "700",
    color: COLORS.forestGreen,
    letterSpacing: 1,
    marginBottom: -4,
  },
  logoSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: -4,
  },
  logoTextSub: {
    fontSize: 22,
    fontWeight: "400",
    color: COLORS.gold,
    marginHorizontal: 5,
    letterSpacing: 4,
  },
  tabLine: {
    height: 2,
    width: 24,
    backgroundColor: COLORS.gold,
  },
});
