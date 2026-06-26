import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../../../constants/theme";
import { filtersFor, matches } from "../../../../constants/categories";
import { useCartStore } from "../../../../stores/cartStore";
import QuantityStepper from "../../../../components/common/QuantityStepper";
import Button from "../../../../components/common/Button";
import api from "../../../../lib/api";

export default function ServiceDetailScreen() {
  const { slug } = useLocalSearchParams();
  const router = useRouter();
  const { addItem, items: cartItems, totalItems } = useCartStore();

  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  // Local quantities keyed by item id
  const [quantities, setQuantities] = useState({});
  // Men/Women/Kids filter — "all" shows everything; a specific filter also
  // keeps unisex items visible so nothing is hidden.
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    loadService();
  }, [slug]);

  const loadService = async () => {
    try {
      const response = await api.get(`/services/${slug}`);
      setService(response.data);
    } catch (error) {
      Alert.alert("Error", "Failed to load service.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const getQty = (itemId) => quantities[itemId] || 0;

  const setQty = (itemId, qty) => {
    setQuantities((prev) => ({ ...prev, [itemId]: Math.max(0, qty) }));
  };

  const localTotal = () => {
    if (!service) return { items: 0, amount: 0 };
    let items = 0;
    let amount = 0;
    for (const item of service.items) {
      const q = getQty(item.id);
      items += q;
      amount += q * item.price;
    }
    return { items, amount };
  };

  // Chips + filter logic come from the centralized category list.
  const { chips: CATEGORY_FILTERS, hasCategories } = filtersFor(service?.items || []);

  const visibleItems = (service?.items || []).filter((item) =>
    matches(item.category, categoryFilter)
  );

  const handleAddToCart = async () => {
    const itemsToAdd = service.items.filter((item) => getQty(item.id) > 0);
    if (itemsToAdd.length === 0) {
      Alert.alert("No Items", "Please select at least one item.");
      return;
    }

    try {
      for (const item of itemsToAdd) {
        await addItem(service.id, item.id, getQty(item.id));
      }
      Alert.alert("Added to Basket", `${localTotal().items} item(s) added.`, [
        { text: "Continue Shopping", onPress: () => router.back() },
        { text: "View Basket", onPress: () => { router.back(); setTimeout(() => router.navigate("/(tabs)/basket"), 100); } },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to add items to cart.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const { items: localItems, amount: localAmount } = localTotal();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{service?.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      {service?.description ? (
        <Text style={styles.description}>{service.description}</Text>
      ) : null}

      {/* Category filter chips */}
      {hasCategories && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {CATEGORY_FILTERS.map((c) => {
            const active = categoryFilter === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCategoryFilter(c.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Items List */}
      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 120 }}
        renderItem={({ item }) => {
          const qty = getQty(item.id);
          return (
            <View style={styles.itemCard}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>₹{item.price}</Text>
              </View>

              {qty === 0 ? (
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => setQty(item.id, 1)}
                >
                  <Text style={styles.addBtnText}>ADD</Text>
                </TouchableOpacity>
              ) : (
                <QuantityStepper
                  quantity={qty}
                  onIncrement={() => setQty(item.id, qty + 1)}
                  onDecrement={() => setQty(item.id, qty - 1)}
                />
              )}
            </View>
          );
        }}
      />

      {/* Bottom Bar */}
      {localItems > 0 && (
        <View style={styles.bottomBar}>
          <View>
            <Text style={styles.bottomItems}>
              {localItems} item{localItems > 1 ? "s" : ""} selected
            </Text>
            <Text style={styles.bottomAmount}>₹{localAmount}</Text>
          </View>
          <Button
            title="Add to Basket"
            onPress={handleAddToCart}
            style={{ paddingHorizontal: 28 }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.black,
  },
  description: {
    fontSize: 13,
    color: COLORS.textLight,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  chipRow: {
    flexDirection: "row",
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chipActive: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.cream,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textLight,
  },
  chipTextActive: {
    color: COLORS.gold,
    fontWeight: "700",
  },
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
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  itemPrice: {
    fontSize: 14,
    color: COLORS.gold,
    fontWeight: "700",
    marginTop: 2,
  },
  addBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.sm,
    paddingVertical: 6,
    paddingHorizontal: 20,
  },
  addBtnText: {
    color: COLORS.gold,
    fontWeight: "700",
    fontSize: 13,
  },
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  bottomItems: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  bottomAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.black,
  },
});
