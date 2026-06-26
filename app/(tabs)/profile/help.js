import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS, TINTS } from "../../../constants/theme";
import Screen from "../../../components/common/Screen";
import Header from "../../../components/common/Header";

const SUPPORT_PHONE = "+911234567890";
const SUPPORT_WHATSAPP = "+911234567890";
const SUPPORT_EMAIL = "support@washingbells.in";

const FAQ = [
  { q: "How does pickup work?", a: "Our delivery partner will arrive at your doorstep during the selected time slot. They'll weigh your clothes, click photos, and verify pickup with your OTP." },
  { q: "How long does it take?", a: "Standard turnaround is 48 hours from pickup. Express service is available for 24-hour delivery." },
  { q: "What if my clothes are damaged?", a: "We have a comprehensive garment protection policy. Each item is tagged with a unique code and photographed on pickup for your safety." },
  { q: "How do I cancel an order?", a: "Go to Orders tab → tap your order → Cancel Order. Cancellation is free before pickup." },
  { q: "What payment methods are accepted?", a: "We accept UPI, credit/debit cards via Razorpay, WB Wallet balance, and Cash on Delivery." },
];

export default function HelpScreen() {
  const router = useRouter();

  const openWhatsApp = () => {
    const url = `whatsapp://send?phone=${SUPPORT_WHATSAPP}&text=Hi, I need help with WashingBells`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) Linking.openURL(url);
      else Alert.alert("WhatsApp not installed", "Please install WhatsApp to chat with us.");
    });
  };

  const callSupport = () => Linking.openURL(`tel:${SUPPORT_PHONE}`);
  const emailSupport = () => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=WashingBells Support`);

  return (
    <Screen padded={false}>
      <View style={styles.headerPad}>
        <Header title="Help & Support" onBack={() => router.back()} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Contact Cards */}
        <View style={styles.contactRow}>
          <TouchableOpacity style={[styles.contactCard, { backgroundColor: TINTS.successBg }]} onPress={openWhatsApp}>
            <Ionicons name="logo-whatsapp" size={28} color={TINTS.whatsapp} />
            <Text style={styles.contactLabel}>WhatsApp</Text>
            <Text style={styles.contactSub}>Chat with us</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.contactCard, { backgroundColor: TINTS.infoBg }]} onPress={callSupport}>
            <Ionicons name="call" size={28} color={TINTS.infoText} />
            <Text style={styles.contactLabel}>Call Us</Text>
            <Text style={styles.contactSub}>Talk to support</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.contactCard, { backgroundColor: TINTS.warningBg }]} onPress={emailSupport}>
            <Ionicons name="mail" size={28} color={TINTS.warningText} />
            <Text style={styles.contactLabel}>Email</Text>
            <Text style={styles.contactSub}>Write to us</Text>
          </TouchableOpacity>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {FAQ.map((item, i) => (
            <View key={i} style={styles.faqCard}>
              <Text style={styles.faqQ}>{item.q}</Text>
              <Text style={styles.faqA}>{item.a}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: SPACING.lg },
  contactRow: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, marginBottom: SPACING.xl },
  contactCard: { flex: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: "center" },
  contactLabel: { fontWeight: "700", fontSize: 13, color: COLORS.black, marginTop: SPACING.sm },
  contactSub: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  section: { paddingHorizontal: SPACING.lg },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black, marginBottom: SPACING.md },
  faqCard: { backgroundColor: COLORS.white, padding: SPACING.lg, borderRadius: RADIUS.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderLight },
  faqQ: { fontWeight: "700", fontSize: 14, color: COLORS.forestGreen, marginBottom: 4 },
  faqA: { fontSize: 13, color: COLORS.textLight, lineHeight: 20 },
});
