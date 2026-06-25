import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text } from "react-native";
import { COLORS } from "../../constants/theme";
import { useTripStore } from "../../stores/tripStore";

export default function TabLayout() {
  const worklist = useTripStore((s) => s.worklist);
  const pendingCount = worklist.filter(t => t.status === "assigned").length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.gold,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarLabel: "Home",
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          tabBarLabel: "Tasks",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="list-outline" size={22} color={color} />
              {pendingCount > 0 && (
                <View style={{ position: "absolute", top: -4, right: -8, backgroundColor: COLORS.error, borderRadius: 8, minWidth: 16, height: 16, justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>{pendingCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          tabBarLabel: "Earnings",
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="wallet-outline" size={22} color={color} />,
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
