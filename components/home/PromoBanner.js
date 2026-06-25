import React, { useRef, useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, Image, Dimensions, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";

const { width } = Dimensions.get("window");
const BANNER_WIDTH = width - SPACING.lg * 2;

const DEFAULT_BANNERS = [
  { id: "1", title: "Fast & Premium Laundry", subtitle: "Pickup in 60 minutes", cta: "Order Now", color: COLORS.mintGreen, icon: "washing-machine" },
  { id: "2", title: "Flat ₹50 Off", subtitle: "On your first order", cta: "Claim Now", color: "#F0E6D3", icon: "tag-outline" },
  { id: "3", title: "Refer & Earn", subtitle: "Get 20% off for every referral", cta: "Share Now", color: "#E6D9F0", icon: "gift-outline" },
];

const BANNER_IMAGES = {
  "/assets/Banner_add_1.png": require("../../assets/Banner_add_1.png"),
  "/assets/Banner_add_2.png": require("../../assets/Banner_add_2.png"),
  "/assets/Banner_add_3.png": require("../../assets/Banner_add_3.png"),
  "/assets/Banner_add_4.png": require("../../assets/Banner_add_4.png"),
};

export default function PromoBanner({ banners: apiBanners, onBannerPress, onOrderNow }) {
  const flatListRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const hasImages = apiBanners && apiBanners.length > 0;
  const displayBanners = hasImages ? apiBanners : DEFAULT_BANNERS;

  useEffect(() => {
    if (displayBanners.length <= 1) return;
    const timer = setInterval(() => {
      const next = (activeIndex + 1) % displayBanners.length;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIndex(next);
    }, 4000);
    return () => clearInterval(timer);
  }, [activeIndex, displayBanners.length]);

  const onScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / BANNER_WIDTH);
    setActiveIndex(idx);
  };

  const renderImageBanner = ({ item }) => (
    <TouchableOpacity activeOpacity={0.9} style={styles.imgWrap} onPress={() => onBannerPress?.(item)}>
      <Image source={BANNER_IMAGES[item.image_url] || { uri: item.image_url }} style={styles.img} resizeMode="cover" />
    </TouchableOpacity>
  );

  const renderCardBanner = ({ item }) => (
    <TouchableOpacity activeOpacity={0.9} style={[styles.card, { backgroundColor: item.color }]} onPress={() => onOrderNow?.(item)}>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSub}>{item.subtitle}</Text>
        <View style={styles.cta}><Text style={styles.ctaText}>{item.cta}</Text></View>
      </View>
      <MaterialCommunityIcons name={item.icon || "washing-machine"} size={64} color={COLORS.forestGreen} style={{ opacity: 0.2 }} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList ref={flatListRef} data={displayBanners} keyExtractor={(item, i) => item.id || String(i)}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        snapToInterval={BANNER_WIDTH + SPACING.md} decelerationRate="fast"
        onScroll={onScroll} contentContainerStyle={{ paddingHorizontal: SPACING.lg }}
        renderItem={hasImages ? renderImageBanner : renderCardBanner}
      />
      <View style={styles.dots}>
        {displayBanners.map((_, i) => (<View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: SPACING.lg },
  card: { width: BANNER_WIDTH, borderRadius: RADIUS.xl, padding: SPACING.xl, marginRight: SPACING.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 140 },
  cardContent: { flex: 1, marginRight: SPACING.md },
  cardTitle: { fontSize: 18, fontWeight: "800", color: COLORS.forestGreen, marginBottom: 4 },
  cardSub: { fontSize: 13, color: COLORS.textLight, marginBottom: SPACING.md },
  cta: { backgroundColor: COLORS.forestGreen, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, alignSelf: "flex-start" },
  ctaText: { color: COLORS.white, fontWeight: "700", fontSize: 13 },
  imgWrap: { width: BANNER_WIDTH, marginRight: SPACING.md, borderRadius: RADIUS.xl, overflow: "hidden" },
  img: { width: "100%", height: 160, borderRadius: RADIUS.xl },
  dots: { flexDirection: "row", justifyContent: "center", marginTop: SPACING.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border, marginHorizontal: 3 },
  dotActive: { backgroundColor: COLORS.forestGreen, width: 20 },
});
