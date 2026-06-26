import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS } from "../../../constants/theme";

const SECTIONS = [
  {
    title: "1. Information We Collect",
    body: "We collect your phone number, name, email address, delivery addresses, location data (for pickup/delivery), order history, payment information (processed via Razorpay), and device identifiers for push notifications.",
  },
  {
    title: "2. How We Use Your Information",
    body: "Your information is used to: provide laundry services, process and deliver orders, send order updates via SMS/push notifications, improve our services, provide customer support, and prevent fraud. We may also use anonymized data for analytics.",
  },
  {
    title: "3. Data Sharing",
    body: "We share your data only with: delivery partners (limited to name, phone, address for pickup/delivery), payment processors (Razorpay for secure transactions), and cloud service providers (for app hosting). We do NOT sell your personal data to third parties.",
  },
  {
    title: "4. Data Storage & Security",
    body: "Your data is stored on secure cloud servers with encryption at rest and in transit. We follow industry-standard security practices including JWT token authentication, HTTPS communication, and regular security audits.",
  },
  {
    title: "5. Location Data",
    body: "We request location access to auto-detect your address for pickup scheduling. Location data is used only during active app sessions and is not tracked in the background. You can revoke location access at any time from your device settings.",
  },
  {
    title: "6. Wallet & Payment Data",
    body: "WB Wallet transactions are stored securely. Credit/debit card details are never stored on our servers — all payment processing is handled by Razorpay's PCI-DSS compliant infrastructure.",
  },
  {
    title: "7. Cookies & Tracking",
    body: "The mobile app uses device identifiers for push notifications and session management. We do not use third-party advertising trackers in the app.",
  },
  {
    title: "8. Data Retention",
    body: "We retain your account data as long as your account is active. Order history is retained for 2 years for quality assurance and dispute resolution. You can request data deletion by contacting support.",
  },
  {
    title: "9. Your Rights",
    body: "You have the right to: access your personal data, correct inaccurate data, request deletion of your data, opt out of promotional communications, and download your data. Contact support@washingbells.in to exercise these rights.",
  },
  {
    title: "10. Children's Privacy",
    body: "WashingBells is not intended for users under 18 years of age. We do not knowingly collect data from minors.",
  },
  {
    title: "11. Changes to This Policy",
    body: "We may update this privacy policy from time to time. Significant changes will be notified via the app. Continued use of the app after changes constitutes acceptance.",
  },
  {
    title: "12. Contact Us",
    body: "For privacy-related inquiries:\n\nEmail: privacy@washingbells.in\nPhone: +91 12345 67890\nAddress: WashingBells Pvt. Ltd., Ludhiana, Punjab, India",
  },
];

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated: May 2026</Text>
        <Text style={styles.intro}>
          WashingBells ("we", "our", "us") is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your personal information.
        </Text>
        {SECTIONS.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}
        <Text style={styles.footer}>© 2026 WashingBells Private Limited. All rights reserved.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: COLORS.black },
  content: { paddingHorizontal: SPACING.xl, paddingBottom: 40 },
  updated: { fontSize: 12, color: COLORS.textMuted, marginBottom: SPACING.md },
  intro: { fontSize: 14, color: COLORS.textLight, lineHeight: 22, marginBottom: SPACING.xl },
  section: { marginBottom: SPACING.xl },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.forestGreen, marginBottom: SPACING.sm },
  sectionBody: { fontSize: 14, color: COLORS.textLight, lineHeight: 22 },
  footer: { fontSize: 12, color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.xl },
});
