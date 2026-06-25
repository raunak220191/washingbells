import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Share, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";
import { useReferralStore } from "../../stores/referralStore";

export default function ReferEarn({ visible, onClose }) {
  const [modalVisible, setModalVisible] = useState(false);
  const { referralCode, referralUrl, totalReferred, totalEarned, fetchReferralStats } = useReferralStore();

  // Support external control from Profile screen
  useEffect(() => {
    if (visible) {
      fetchReferralStats();
      setModalVisible(true);
    }
  }, [visible]);

  const openModal = async () => {
    await fetchReferralStats();
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    if (onClose) onClose();
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: "Join WashingBells for premium laundry services! Use my referral code " + referralCode + " to get 10% off your first order. " + referralUrl,
      });
    } catch (e) {
      console.log("Share error:", e);
    }
  };

  const handleCopy = async () => {
    try {
      if (Clipboard.setStringAsync) {
        await Clipboard.setStringAsync(referralCode);
      }
      Alert.alert("Copied!", "Referral code copied to clipboard");
    } catch (e) {
      Alert.alert("Code", referralCode);
    }
  };

  // If externally controlled, don't render the banner
  if (visible !== undefined) {
    return (
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Refer & Earn</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.rulesBox}>
              <Text style={styles.ruleTitle}>How it works</Text>
              <Text style={styles.rule}>{"🎁"} Share your code with a friend</Text>
              <Text style={styles.rule}>{"✅"} Friend signs up & gets <Text style={styles.bold}>10% off</Text></Text>
              <Text style={styles.rule}>{"🏆"} You get <Text style={styles.bold}>20% off</Text> coupon!</Text>
            </View>
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Your Referral Code</Text>
              <View style={styles.codeRow}>
                <Text style={styles.code}>{referralCode || "Loading..."}</Text>
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
                  <Ionicons name="copy-outline" size={18} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{totalReferred}</Text>
                <Text style={styles.statLabel}>Friends Referred</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{totalReferred}</Text>
                <Text style={styles.statLabel}>Coupons Earned</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={20} color={COLORS.white} />
              <Text style={styles.shareBtnText}>Share with Friends</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <>
      <TouchableOpacity style={styles.banner} onPress={openModal} activeOpacity={0.8}>
        <View style={styles.bannerLeft}>
          <Ionicons name="gift-outline" size={24} color={COLORS.gold} />
          <View style={{ marginLeft: SPACING.md }}>
            <Text style={styles.bannerTitle}>Refer & Earn</Text>
            <Text style={styles.bannerSub}>Invite friends, get 20% off each!</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.forestGreen} />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Refer & Earn</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.rulesBox}>
              <Text style={styles.ruleTitle}>How it works</Text>
              <Text style={styles.rule}>{"🎁"} Share your code with a friend</Text>
              <Text style={styles.rule}>{"✅"} Friend signs up & gets <Text style={styles.bold}>10% off</Text></Text>
              <Text style={styles.rule}>{"🏆"} You get <Text style={styles.bold}>20% off</Text> coupon!</Text>
            </View>
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Your Referral Code</Text>
              <View style={styles.codeRow}>
                <Text style={styles.code}>{referralCode || "Loading..."}</Text>
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
                  <Ionicons name="copy-outline" size={18} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{totalReferred}</Text>
                <Text style={styles.statLabel}>Friends Referred</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{totalReferred}</Text>
                <Text style={styles.statLabel}>Coupons Earned</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={20} color={COLORS.white} />
              <Text style={styles.shareBtnText}>Share with Friends</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: COLORS.cream, padding: SPACING.lg, borderRadius: RADIUS.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: SPACING.lg, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  bannerLeft: { flexDirection: "row", alignItems: "center" },
  bannerTitle: { fontWeight: "700", color: COLORS.forestGreen, fontSize: 15 },
  bannerSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.xl, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.xl },
  modalTitle: { fontSize: 20, fontWeight: "800", color: COLORS.forestGreen },
  rulesBox: { backgroundColor: COLORS.mintGreen, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.xl },
  ruleTitle: { fontWeight: "700", color: COLORS.forestGreen, fontSize: 14, marginBottom: SPACING.sm },
  rule: { fontSize: 13, color: COLORS.text, marginBottom: 4, lineHeight: 20 },
  bold: { fontWeight: "700" },
  codeBox: { alignItems: "center", marginBottom: SPACING.xl },
  codeLabel: { fontSize: 12, color: COLORS.textMuted, marginBottom: SPACING.sm },
  codeRow: { flexDirection: "row", alignItems: "center" },
  code: { fontSize: 22, fontWeight: "800", color: COLORS.forestGreen, letterSpacing: 2, marginRight: SPACING.md },
  copyBtn: { backgroundColor: COLORS.forestGreen, padding: 8, borderRadius: RADIUS.md },
  statsRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: SPACING.xl },
  statItem: { alignItems: "center" },
  statNum: { fontSize: 24, fontWeight: "800", color: COLORS.gold },
  statLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  shareBtn: { backgroundColor: COLORS.forestGreen, flexDirection: "row", justifyContent: "center", alignItems: "center", padding: SPACING.lg, borderRadius: RADIUS.full },
  shareBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 16, marginLeft: SPACING.sm },
});
