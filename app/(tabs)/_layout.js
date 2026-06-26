import { Tabs } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { COLORS } from "../../constants/theme";
import { useCartStore } from "../../stores/cartStore";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const totalItems = useCartStore((s) => s.totalItems);
  // Reserve the device's bottom safe-area inset (Android gesture/nav bar, iOS
  // home indicator) so tab labels never sit under or get clipped by it.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.gold,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarLabel: "Home",
          headerShown: false,
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="basket"
        options={{
          tabBarLabel: "Basket",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="basket-outline" size={22} color={color} />
              {totalItems > 0 && (
                <View style={{ position: "absolute", top: -4, right: -8, backgroundColor: COLORS.error, borderRadius: 8, minWidth: 16, height: 16, justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>{totalItems}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          tabBarLabel: "Orders",
          headerShown: false,
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="clipboard-text-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: "Profile",
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
