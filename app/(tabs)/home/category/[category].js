import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS, TYPE, ICON } from "../../../../constants/theme";
import { useCartStore } from "../../../../stores/cartStore";
import QuantityStepper from "../../../../components/common/QuantityStepper";
import Button from "../../../../components/common/Button";
import Screen from "../../../../components/common/Screen";
import Header from "../../../../components/common/Header";
import BottomBar from "../../../../components/common/BottomBar";
import ItemThumb from "../../../../components/common/ItemThumb";
import api from "../../../../lib/api";
import { matches } from "../../../../constants/categories";
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
          // Shared semantics: apparel categories (Men/Women/Kids) include
          // unisex items, same as the service-screen filter chips.
          if (matches(item.category, category)) {
            flat.push({
              key: `${svc.id}:${item.id}`,
              service_id: svc.id,
              service_name: svc.name,
              item_id: item.id,
              name: item.name,
              price: item.price,
              image_url: item.image_url,
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

  // TASK 4.1: alphabetical within the category — memoized, never mutates the
  // fetched array in place.
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })),
    [rows]
  );

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
      <Screen>
        <Header title="" onBack={() => router.back()} />
        <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 100 }} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.headerPad}>
        <Header title={title} onBack={() => router.back()} />
      </View>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="shirt-outline" size={ICON.hero} color={COLORS.mintGreen} />
          <Text style={styles.emptyText}>No items in this category yet.</Text>
        </View>
      ) : (
        <FlatList
          data={sortedRows}
          keyExtractor={(r) => r.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const qty = getQty(item.key);
            return (
              <View style={styles.itemCard}>
                <ItemThumb imageUrl={item.image_url} style={styles.itemThumb} />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemService}>{item.service_name}</Text>
                  <Text style={styles.itemPrice}>₹{item.price}</Text>
                </View>
                {qty === 0 ? (
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => setQty(item.key, 1)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
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
        <BottomBar style={styles.bottomBarRow}>
          <View>
            <Text style={styles.bottomItems}>
              {localItems} item{localItems > 1 ? "s" : ""} selected
            </Text>
            <Text style={styles.bottomAmount}>₹{localAmount}</Text>
          </View>
          <Button title="Add to Basket" onPress={handleAddToCart} style={{ paddingHorizontal: 28 }} />
        </BottomBar>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: SPACING.lg },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.md },
  emptyText: { ...TYPE.body, color: COLORS.textMuted },
  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: 120 },
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
  itemThumb: { marginRight: SPACING.md },
  itemInfo: { flex: 1 },
  itemName: { ...TYPE.body, fontWeight: "600", color: COLORS.text },
  itemService: { ...TYPE.caption, color: COLORS.textMuted, marginTop: 1 },
  itemPrice: { ...TYPE.price, color: COLORS.gold, fontWeight: "700", marginTop: 2 },
  addBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.sm,
    paddingVertical: 6,
    paddingHorizontal: 20,
  },
  addBtnText: { ...TYPE.label, color: COLORS.gold, fontWeight: "700" },
  bottomBarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomItems: { ...TYPE.bodySm, color: COLORS.textLight },
  bottomAmount: { ...TYPE.h2, color: COLORS.black },
});
