import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { COLORS, SPACING } from "../../../constants/theme";
import Screen from "../../../components/common/Screen";
import Header from "../../../components/common/Header";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: "By downloading, installing, or using the WashingBells mobile application, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the app.",
  },
  {
    title: "2. Services",
    body: "WashingBells provides on-demand laundry and dry cleaning services including pickup, wash, iron, dry clean, shoe cleaning, sofa cleaning, and delivery. Services are available in select cities across India.",
  },
  {
    title: "3. User Accounts",
    body: "You must provide a valid Indian mobile number (+91) to create an account. You are responsible for maintaining the confidentiality of your account. Each phone number may only be associated with one account.",
  },
  {
    title: "4. Orders & Pricing",
    body: "Prices are displayed per item or per kilogram as applicable. Total order amount is calculated at checkout. WashingBells reserves the right to modify pricing with prior notice. Minimum order values may apply.",
  },
  {
    title: "5. Pickup & Delivery",
    body: "Pickup and delivery are scheduled during the time slots you select. Our delivery partners will attempt to reach you during the selected window. Two failed attempts may result in order cancellation.",
  },
  {
    title: "6. Payments",
    body: "We accept payments via Razorpay (UPI, credit/debit cards, net banking), WB Wallet balance, and Cash on Delivery (COD). All online transactions are processed securely through Razorpay.",
  },
  {
    title: "7. Cancellation & Refunds",
    body: "Orders can be cancelled free of charge before pickup. Once picked up, cancellation may incur processing charges. Refunds for prepaid orders are credited to your WB Wallet within 24 hours.",
  },
  {
    title: "8. Garment Care",
    body: "While we take utmost care, WashingBells is not liable for damage to garments that are fragile, unlabeled, or have pre-existing defects. Each garment is tagged and photographed at pickup for verification. Maximum liability per garment is 10x the service charge.",
  },
  {
    title: "9. Wallet & Coupons",
    body: "WB Wallet credits are non-transferable and non-refundable. Promotional coupons have expiry dates and usage limits. WashingBells reserves the right to modify or cancel promotional offers.",
  },
  {
    title: "10. Referral Program",
    body: "Users may refer friends using their unique referral code. Referred users receive a 10% discount coupon, and referrers receive a 20% discount coupon. Referral rewards are subject to fair usage limits.",
  },
  {
    title: "11. Intellectual Property",
    body: "All content, branding, logos, and software in the WashingBells app are the property of WashingBells Private Limited and are protected under Indian intellectual property laws.",
  },
  {
    title: "12. Governing Law",
    body: "These Terms shall be governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Ludhiana, Punjab.",
  },
  {
    title: "13. Contact",
    body: "For questions regarding these terms, contact us at support@washingbells.in or call our helpline.",
  },
];

export default function TermsScreen() {
  const router = useRouter();
  return (
    <Screen padded={false}>
      <View style={styles.headerPad}>
        <Header title="Terms & Conditions" onBack={() => router.back()} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated: May 2026</Text>
        {SECTIONS.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}
        <Text style={styles.footer}>© 2026 WashingBells Private Limited. All rights reserved.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: SPACING.lg },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },
  updated: { fontSize: 12, color: COLORS.textMuted, marginBottom: SPACING.lg },
  section: { marginBottom: SPACING.xl },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.forestGreen, marginBottom: SPACING.sm },
  sectionBody: { fontSize: 14, color: COLORS.textLight, lineHeight: 22 },
  footer: { fontSize: 12, color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.xl },
});
