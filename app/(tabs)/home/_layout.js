import { Stack } from "expo-router";

export default function HomeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="address" />
      <Stack.Screen
        name="service/[slug]"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen name="category/[category]" />
    </Stack>
  );
}