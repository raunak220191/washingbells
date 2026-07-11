// Item Images — store-side management of catalog item photos (upgrade_last TASK 1.2).
// The store app has no item CRUD (catalog is admin-owned), so this dedicated
// screen is the store's item view: every catalog item with its single photo slot.
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, SectionList, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS } from "../../../constants/theme";
import api from "../../../lib/api";
import ItemImageUploader from "../../../components/ItemImageUploader";
import TabletContainer from "../../../components/TabletContainer";

export default function ItemImagesScreen() {
  const router = useRouter();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/services");
      setSections(
        r.data
          .filter((s) => s.items?.length)
          .map((s) => ({ title: s.name, pricing_unit: s.pricing_unit, data: s.items }))
      );
    } catch {
      // pull-to-refresh remains available on failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const setItemImage = (itemId, url) => {
    setSections((prev) =>
      prev.map((sec) => ({
        ...sec,
        data: sec.data.map((it) => (it.id === itemId ? { ...it, image_url: url } : it)),
      }))
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <TabletContainer>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.title}>Item Photos</Text>
          <View style={styles.backBtn} />
        </View>
        <Text style={styles.hint}>
          One photo per item. Customers see these in the app — tap a slot to add or replace.
        </Text>
        {loading ? (
          <ActivityIndicator style={{ marginTop: SPACING.xxxl }} color={COLORS.storeOrange} />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            stickySectionHeadersEnabled={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.storeOrange} />
            }
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            )}
            renderItem={({ item, section }) => (
              <View style={styles.row}>
                <ItemImageUploader
                  itemId={item.id}
                  imageUrl={item.image_url}
                  onChange={(url) => setItemImage(item.id, url)}
                />
                <View style={styles.rowInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    ₹{item.price}
                    {section.pricing_unit === "kg" ? "/kg" : section.pricing_unit === "pair" ? "/pair" : ""}
                    {"  ·  "}{item.category}
                  </Text>
                </View>
                {item.image_url ? (
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                ) : (
                  <Text style={styles.noPhoto}>No photo</Text>
                )}
              </View>
            )}
            contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 40 }}
          />
        )}
      </TabletContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", color: COLORS.black },
  hint: { fontSize: 12, color: COLORS.textMuted, paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: COLORS.forestGreen, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderLight },
  rowInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  itemMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  noPhoto: { fontSize: 11, color: COLORS.textMuted },
});
