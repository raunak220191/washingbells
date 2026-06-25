import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { useAuthStore } from "../stores/authStore";
import { StatusBar } from "expo-status-bar";
import { addNotificationTapHandler, setupNotificationChannels } from "../lib/pushNotifications";

export default function RootLayout() {
  const { isAuthenticated, isLoading, initialize, user, refreshTermsStatus, resetTerms, needsTerms, termsChecked } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initialize();
    setupNotificationChannels();
    // Route to the Tasks tab when the rider taps a "New Trip" push
    const sub = addNotificationTapHandler((data) => {
      if (data?.type === "trip_assigned") {
        router.push("/(tabs)/tasks");
      }
    });
    return () => sub?.remove?.();
  }, []);

  // After login, check T&C status once per session
  useEffect(() => {
    if (!isAuthenticated || !user?.vehicle_type) {
      resetTerms();
      return;
    }
    refreshTermsStatus();
  }, [isAuthenticated, user?.vehicle_type]);

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === "(auth)";
    const route = segments.join("/");

    if (!isAuthenticated) {
      if (!inAuth) router.replace("/(auth)/login");
      return;
    }

    // Authenticated: route through the gates
    // 1) Must have registered as a rider
    if (!user?.vehicle_type) {
      if (route !== "(auth)/register") router.replace("/(auth)/register");
      return;
    }
    // 2) Wait until T&C status is checked
    if (!termsChecked) return;
    // 3) Must accept latest T&C
    if (needsTerms) {
      if (route !== "(auth)/terms") router.replace("/(auth)/terms");
      return;
    }
    // 4) Must complete document upload (unapproved + missing docs)
    if (!user?.rider_approved && !user?.documents_uploaded) {
      if (route !== "(auth)/documents") router.replace("/(auth)/documents");
      return;
    }
    // 5) All gates clear → app
    if (inAuth) router.replace("/(tabs)/home");
  }, [isAuthenticated, isLoading, user, termsChecked, needsTerms, segments]);

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
