import { Stack } from "expo-router";

export default function BasketLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="checkout" />
    </Stack>
  );
}