import { Stack } from "expo-router";
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="setup" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="complete-profile" />
    </Stack>
  );
}
