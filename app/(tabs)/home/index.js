import React, { useState, useEffect } from "react";
import { StyleSheet, View, ScrollView, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { COLORS, SPACING } from "../../../constants/theme";
import { useAuthStore } from "../../../stores/authStore";
import { useCartStore } from "../../../stores/cartStore";
import { useAddressStore } from "../../../stores/addressStore";
import { useBannerStore } from "../../../stores/bannerStore";
import HomeHeader from "../../../components/home/HomeHeader";
import LocationBar from "../../../components/home/LocationBar";
import PromoBanner from "../../../components/home/PromoBanner";
import ServiceGrid from "../../../components/home/ServiceGrid";
import ReferEarn from "../../../components/home/ReferEarn";
import Testimonials from "../../../components/home/Testimonials";

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const fetchCart = useCartStore((s) => s.fetchCart);
  const { selectedAddress, fetchAddresses } = useAddressStore();
  const { banners, testimonials, fetchBanners, fetchTestimonials } = useBannerStore();
  const [gpsAddress, setGpsAddress] = useState("Fetching location...");

  useEffect(() => {
    fetchAddresses();
    fetchCart();
    fetchBanners();
    fetchTestimonials();
  }, []);

  useEffect(() => {
    if (selectedAddress) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") { setGpsAddress("Set your delivery address"); return; }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (geo) setGpsAddress(`${geo.name || geo.street || ""}, ${geo.city || geo.subregion || ""}`);
      } catch (error) {
        console.log("Location error:", error);
        setGpsAddress("Ludhiana, Punjab");
      }
    })();
  }, [selectedAddress]);

  const displayAddress = selectedAddress ? selectedAddress.full_address : gpsAddress;

  const handleServicePress = (slug) => router.push(`/(tabs)/home/service/${slug}`);

  const handleBannerPress = (b) => {
    if (b.link_type === "service" && b.link_target) {
      router.push(`/(tabs)/home/service/${b.link_target}`);
    } else if (b.link_type === "category" && b.link_target) {
      router.push(`/(tabs)/home/category/${b.link_target}`);
    } else if (b.link_type === "external" && b.link_target === "referral") {
      router.push("/(tabs)/profile");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <HomeHeader />
        <LocationBar
          address={displayAddress}
          addressLabel={selectedAddress?.label}
          userName={user?.name}
          onLocationPress={() => router.push("/(tabs)/home/address")}
          onProfilePress={() => router.push("/(tabs)/profile")}
        />
        <PromoBanner banners={banners} onBannerPress={handleBannerPress} onOrderNow={() => {}} />
        <ReferEarn />
        <ServiceGrid onServicePress={handleServicePress} />
        <Testimonials testimonials={testimonials} />
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
});
