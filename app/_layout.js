import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthStore } from "../stores/authStore";
import LoadingScreen from "../components/common/LoadingScreen";
import { setupNotificationChannels, addNotificationTapHandler } from "../lib/pushNotifications";

export default function RootLayout() {
  const { isAuthenticated, isLoading, initialize, refreshTermsStatus, resetTerms, needsTerms, termsChecked } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // On app boot, check for stored auth token + set up push channels
  useEffect(() => {
    initialize();
    setupNotificationChannels();
    // Tap order-update push → route to orders tab
    const sub = addNotificationTapHandler((data) => {
      if (data?.type === "order_update") {
        router.push("/(tabs)/orders");
      }
    });
    return () => sub?.remove?.();
  }, []);

  // After login, check T&C status once per session
  useEffect(() => {
    if (!isAuthenticated) {
      resetTerms();
      return;
    }
    refreshTermsStatus();
  }, [isAuthenticated]);

  // Auth guard + T&C gate
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(authenticate)";
    const route = segments.join("/");

    if (!isAuthenticated) {
      if (!inAuthGroup) router.replace("/(authenticate)/login");
      return;
    }
    // Wait until T&C status is checked
    if (!termsChecked) return;
    // T&C gate
    if (needsTerms) {
      if (route !== "(authenticate)/terms") router.replace("/(authenticate)/terms");
      return;
    }
    // All clear → into the app. Onboarding is exempt: it runs AFTER auth for
    // new users, and this guard used to yank them straight to home before
    // they could enter their name/email (C2 — registration never completed).
    if (inAuthGroup && route !== "(authenticate)/onboarding") {
      router.replace("/(tabs)/home");
    }
  }, [isAuthenticated, isLoading, segments, termsChecked, needsTerms]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(authenticate)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
  );
}
