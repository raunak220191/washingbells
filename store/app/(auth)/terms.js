import { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";
import { useAuthStore } from "../../stores/authStore";
import HtmlText from "../../components/HtmlText";

export default function TermsScreen() {
  const router = useRouter();
  const { fetchLatestTerms, acceptTerms, store } = useAuthStore();
  const scrollRef = useRef(null);
  const [terms, setTerms] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const t = await fetchLatestTerms();
        setTerms(t);
      } finally { setLoading(false); }
    })();
  }, []);

  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 40) {
      setScrolledToBottom(true);
    }
  };

  const handleAccept = async () => {
    if (!terms || !terms.version) return;
    setAccepting(true);
    try {
      await acceptTerms(terms.version);
      if (store && store.profile_complete === false) {
        router.replace("/(auth)/complete-profile");
      } else {
        router.replace("/(tabs)/home");
      }
    } catch (e) {
      Alert.alert("Could not accept", e?.response?.data?.detail || "Try again.");
    } finally { setAccepting(false); }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={COLORS.storeOrange} />
        </View>
      </SafeAreaView>
    );
  }

  const hasContent = terms?.content_html && terms.version > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="document-text" size={26} color={COLORS.white} />
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={styles.headerTitle}>Store Owner Terms</Text>
          {terms?.version > 0 && <Text style={styles.headerSub}>Version {terms.version}</Text>}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={200}
      >
        {hasContent ? (
          <HtmlText html={terms.content_html} color={COLORS.text} />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyTitle}>No T&C published yet</Text>
            <Text style={styles.emptySub}>The platform admin hasn't published store owner terms yet. You can proceed for now.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.acceptBar}>
        {hasContent && !scrolledToBottom && (
          <Text style={styles.scrollHint}>↓ Scroll to the bottom to accept</Text>
        )}
        <TouchableOpacity
          style={[styles.acceptBtn, (hasContent && !scrolledToBottom) || accepting ? styles.acceptBtnDisabled : null]}
          disabled={(hasContent && !scrolledToBottom) || accepting}
          onPress={hasContent ? handleAccept : () => router.replace(store?.profile_complete === false ? "/(auth)/complete-profile" : "/(tabs)/home")}
        >
          {accepting ? <ActivityIndicator color={COLORS.white} /> : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
              <Text style={styles.acceptBtnText}>{hasContent ? "I Accept" : "Continue"}</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.legalLine}>
          By tapping "I Accept", you agree to abide by the WashingBells store owner terms.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.storeOrange,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: COLORS.white },
  headerSub: { fontSize: 12, color: COLORS.storeOrangeLight, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.xl, paddingBottom: 32 },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginTop: SPACING.md },
  emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.sm, paddingHorizontal: SPACING.xl, lineHeight: 18 },
  acceptBar: {
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
  },
  scrollHint: { fontSize: 12, color: COLORS.warning, textAlign: "center", fontWeight: "600", marginBottom: SPACING.sm },
  acceptBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.storeOrange, paddingVertical: SPACING.lg, borderRadius: RADIUS.full,
  },
  acceptBtnDisabled: { opacity: 0.5 },
  acceptBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
  legalLine: { fontSize: 11, color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.md, lineHeight: 16 },
});
