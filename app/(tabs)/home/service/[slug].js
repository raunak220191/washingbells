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
import { useLocalSearchParams, useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS, TYPE } from "../../../../constants/theme";
import { filtersFor, matches } from "../../../../constants/categories";
import { useCartStore } from "../../../../stores/cartStore";
import QuantityStepper from "../../../../components/common/QuantityStepper";
import Button from "../../../../components/common/Button";
import Screen from "../../../../components/common/Screen";
import Header from "../../../../components/common/Header";
import Chip, { ChipRow } from "../../../../components/common/Chip";
import BottomBar from "../../../../components/common/BottomBar";
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
      <Screen>
        <Header title="" onBack={() => router.back()} />
        <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 100 }} />
      </Screen>
    );
  }

  const { items: localItems, amount: localAmount } = localTotal();

  return (
    <Screen padded={false}>
      <View style={styles.headerPad}>
        <Header title={service?.name} onBack={() => router.back()} />
        {service?.description ? (
          <Text style={styles.description}>{service.description}</Text>
        ) : null}
        {hasCategories && (
          <ChipRow style={styles.chips}>
            {CATEGORY_FILTERS.map((c) => (
              <Chip
                key={c.key}
                label={c.label}
                active={categoryFilter === c.key}
                onPress={() => setCategoryFilter(c.key)}
              />
            ))}
          </ChipRow>
        )}
      </View>

      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const qty = getQty(item.id);
          return (
            <View style={styles.itemCard}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>
                  ₹{item.price}
                  {service?.pricing_unit === "kg" ? "/kg" : service?.pricing_unit === "pair" ? "/pair" : ""}
                </Text>
              </View>

              {qty === 0 ? (
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => setQty(item.id, 1)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
  headerPad: {
    paddingHorizontal: SPACING.lg,
  },
  description: {
    ...TYPE.bodySm,
    color: COLORS.textLight,
    marginBottom: SPACING.md,
  },
  chips: {
    marginBottom: SPACING.md,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
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
    ...TYPE.body,
    fontWeight: "600",
    color: COLORS.text,
  },
  itemPrice: {
    ...TYPE.price,
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
    ...TYPE.label,
    color: COLORS.gold,
    fontWeight: "700",
  },
  bottomBarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomItems: {
    ...TYPE.bodySm,
    color: COLORS.textLight,
  },
  bottomAmount: {
    ...TYPE.h2,
    color: COLORS.black,
  },
});
