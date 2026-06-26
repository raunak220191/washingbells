import React from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";

const FALLBACK = [
  { id: "1", customer_name: "Ravi Kumar", text: "Best laundry service in Ludhiana! Super fast and reliable.", rating: 5, city: "Ludhiana" },
  { id: "2", customer_name: "Priya Sharma", text: "My clothes have never been cleaner. Love the steam iron quality!", rating: 5, city: "Chandigarh" },
  { id: "3", customer_name: "Anita Singh", text: "I love the convenience. Schedule from my phone, clothes come back fresh!", rating: 5, city: "Amritsar" },
];

const StarRow = ({ count }) => (
  <View style={styles.stars}>
    {Array.from({ length: count }).map((_, i) => (
      <Ionicons key={i} name="star" size={12} color={COLORS.gold} />
    ))}
  </View>
);

export default function Testimonials({ testimonials }) {
  const data = testimonials && testimonials.length > 0 ? testimonials : FALLBACK;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>What our customers say</Text>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SPACING.lg }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.customer_name?.charAt(0)}</Text>
              </View>
              <View style={{ marginLeft: SPACING.sm, flex: 1 }}>
                <Text style={styles.name}>{item.customer_name}</Text>
                {item.city ? <Text style={styles.city}>{item.city}</Text> : null}
              </View>
              <StarRow count={item.rating || 5} />
            </View>
            <Text style={styles.text}>"{item.text}"</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: SPACING.xl, marginBottom: SPACING.lg },
  header: { fontSize: 16, fontWeight: "700", marginBottom: SPACING.md, color: COLORS.forestGreen, paddingHorizontal: SPACING.lg },
  card: { backgroundColor: COLORS.white, padding: SPACING.lg, borderRadius: RADIUS.lg, marginRight: SPACING.md, width: 280, borderWidth: 1, borderColor: COLORS.borderLight },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: SPACING.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.mintGreen, justifyContent: "center", alignItems: "center" },
  avatarText: { fontWeight: "800", color: COLORS.forestGreen, fontSize: 16 },
  name: { fontWeight: "700", color: COLORS.black, fontSize: 13 },
  city: { fontSize: 11, color: COLORS.textMuted },
  stars: { flexDirection: "row" },
  text: { fontStyle: "italic", color: COLORS.textLight, fontSize: 13, lineHeight: 20 },
});
