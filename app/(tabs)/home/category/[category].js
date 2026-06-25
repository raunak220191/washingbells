import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../../../constants/theme";
import { useCartStore } from "../../../../stores/cartStore";
import QuantityStepper from "../../../../components/common/QuantityStepper";
import Button from "../../../../components/common/Button";
import api from "../../../../lib/api";
import { categoryLabel } from "../../../../constants/categories";

export default function CategoryScreen() {
  const { category } = useLocalSearchParams();
  const router = useRouter();
  const { addItem } = useCartStore();

  const [rows, setRows] = useState([]); // flattened items across services
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState({}); // keyed by `${serviceId}:${itemId}`

  useEffect(() => {
    loadCatalog();
  }, [category]);

  const loadCatalog = async () => {
    try {
      const res = await api.get("/services");
      const services = (res.data || []).filter((s) => s.active !== false);
      const flat = [];
      for (const svc of services) {
        for (const item of svc.items || []) {
          if ((item.category || "unisex") === category) {
            flat.push({
              key: `${svc.id}:${item.id}`,
              service_id: svc.id,
              service_name: svc.name,
              item_id: item.id,
              name: item.name,
              price: item.price,
            });
          }
        }
      }
      setRows(flat);
    } catch (e) {
      Alert.alert("Error", "Failed to load items.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const getQty = (key) => quantities[key] || 0;
  const setQty = (key, qty) => setQuantities((p) => ({ ...p, [key]: Math.max(0, qty) }));

  const localTotal = () => {
    let items = 0;
    let amount = 0;
    for (const r of rows) {
      const q = getQty(r.key);
      items += q;
      amount += q * r.price;
    }
    return { items, amount };
  };

  const handleAddToCart = async () => {
    const toAdd = rows.filter((r) => getQty(r.key) > 0);
    if (toAdd.length === 0) {
      Alert.alert("No Items", "Please select at least one item.");
      return;
    }
    try {
      for (const r of toAdd) {
        await addItem(r.service_id, r.item_id, getQty(r.key));
      }
      Alert.alert("Added to Basket", `${localTotal().items} item(s) added.`, [
        { text: "Continue Shopping", onPress: () => router.back() },
        {
          text: "View Basket",
          onPress: () => {
            router.back();
            setTimeout(() => router.navigate("/(tabs)/basket"), 100);
          },
        },
      ]);
    } catch (e) {
      Alert.alert("Error", "Failed to add items to cart.");
    }
  };

  const { items: localItems, amount: localAmount } = localTotal();
  const title = categoryLabel(category);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="shirt-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No items in this category yet.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 120 }}
          renderItem={({ item }) => {
            const qty = getQty(item.key);
            return (
              <View style={styles.itemCard}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemService}>{item.service_name}</Text>
                  <Text style={styles.itemPrice}>₹{item.price}</Text>
                </View>
                {qty === 0 ? (
                  <TouchableOpacity style={styles.addBtn} onPress={() => setQty(item.key, 1)}>
                    <Text style={styles.addBtnText}>ADD</Text>
                  </TouchableOpacity>
                ) : (
                  <QuantityStepper
                    quantity={qty}
                    onIncrement={() => setQty(item.key, qty + 1)}
                    onDecrement={() => setQty(item.key, qty - 1)}
                  />
                )}
              </View>
            );
          }}
        />
      )}

      {localItems > 0 && (
        <View style={styles.bottomBar}>
          <View>
            <Text style={styles.bottomItems}>
              {localItems} item{localItems > 1 ? "s" : ""} selected
            </Text>
            <Text style={styles.bottomAmount}>₹{localAmount}</Text>
          </View>
          <Button title="Add to Basket" onPress={handleAddToCart} style={{ paddingHorizontal: 28 }} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: COLORS.black },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },
  itemCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  itemService: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  itemPrice: { fontSize: 14, color: COLORS.gold, fontWeight: "700", marginTop: 2 },
  addBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.sm,
    paddingVertical: 6,
    paddingHorizontal: 20,
  },
  addBtnText: { color: COLORS.gold, fontWeight: "700", fontSize: 13 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    elevation: 10,
  },
  bottomItems: { fontSize: 13, color: COLORS.textLight },
  bottomAmount: { fontSize: 20, fontWeight: "700", color: COLORS.black },
});
