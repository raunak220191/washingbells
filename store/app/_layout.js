import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "../stores/authStore";
import { setupNotificationChannels, addNotificationTapHandler } from "../lib/pushNotifications";

export default function RootLayout() {
  const { isAuthenticated, isLoading, initialize, store, refreshTermsStatus, resetTerms, needsTerms, termsChecked } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initialize();
    setupNotificationChannels();
    // Route to the Orders tab on new-order push tap
    const sub = addNotificationTapHandler((data) => {
      if (data?.type === "new_order") {
        router.push("/(tabs)/orders");
      }
    });
    return () => sub?.remove?.();
  }, []);

  // Check T&C status once we have a registered store
  useEffect(() => {
    if (!isAuthenticated || !store) {
      resetTerms();
      return;
    }
    refreshTermsStatus();
  }, [isAuthenticated, store?.id]);

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === "(auth)";
    const route = segments.join("/");

    if (!isAuthenticated) {
      if (!inAuth) router.replace("/(auth)/login");
      return;
    }
    // 1) Must have a store linked
    if (!store) {
      if (route !== "(auth)/setup") router.replace("/(auth)/setup");
      return;
    }
    // 2) Wait for T&C status check
    if (!termsChecked) return;
    // 3) T&C gate
    if (needsTerms) {
      if (route !== "(auth)/terms") router.replace("/(auth)/terms");
      return;
    }
    // 4) Profile completion gate (only for admin-created stores)
    if (store.profile_complete === false) {
      if (route !== "(auth)/complete-profile") router.replace("/(auth)/complete-profile");
      return;
    }
    // 5) All gates clear → app
    if (inAuth) router.replace("/(tabs)/home");
  }, [isAuthenticated, isLoading, store, termsChecked, needsTerms, segments]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
