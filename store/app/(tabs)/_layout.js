import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text } from "react-native";
import { COLORS } from "../../constants/theme";
import { useOrderStore } from "../../stores/orderStore";

export default function TabLayout() {
  const orders = useOrderStore((s) => s.orders);
  const newCount = orders.filter(o => o.status === "placed").length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.storeOrange,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: { backgroundColor: COLORS.white, borderTopColor: COLORS.border, height: 60, paddingBottom: 8, paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="home" options={{
        tabBarLabel: "Dashboard", headerShown: false,
        tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} />,
      }} />
      <Tabs.Screen name="orders" options={{
        tabBarLabel: "Orders", headerShown: false,
        tabBarIcon: ({ color }) => (
          <View>
            <Ionicons name="receipt-outline" size={22} color={color} />
            {newCount > 0 && (
              <View style={{ position: "absolute", top: -4, right: -8, backgroundColor: COLORS.error, borderRadius: 8, minWidth: 16, height: 16, justifyContent: "center", alignItems: "center" }}>
                <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>{newCount}</Text>
              </View>
            )}
          </View>
        ),
      }} />
      <Tabs.Screen name="earnings" options={{
        tabBarLabel: "Earnings", headerShown: false,
        tabBarIcon: ({ color }) => <Ionicons name="wallet-outline" size={22} color={color} />,
      }} />
      <Tabs.Screen name="settings" options={{
        tabBarLabel: "Settings", headerShown: false,
        tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={22} color={color} />,
      }} />
    </Tabs>
  );
}
