import { create } from "zustand";
import api from "../lib/api";

export const useCartStore = create((set, get) => ({
  // State
  items: [],
  totalItems: 0,
  totalAmount: 0,
  isLoading: false,

  // Fetch cart from backend
  fetchCart: async () => {
    try {
      set({ isLoading: true });
      const response = await api.get("/cart");
      const data = response.data;
      set({
        items: data.items,
        totalItems: data.total_items,
        totalAmount: data.total_amount,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      console.log("Fetch cart error:", error.message);
    }
  },

  // Add item to cart
  addItem: async (serviceId, itemId, quantity = 1) => {
    try {
      const response = await api.post("/cart/items", {
        service_id: serviceId,
        item_id: itemId,
        quantity,
      });
      const data = response.data;
      set({
        items: data.items,
        totalItems: data.total_items,
        totalAmount: data.total_amount,
      });
    } catch (error) {
      console.log("Add to cart error:", error.message);
      throw error;
    }
  },

  // Update item quantity
  updateItem: async (serviceId, itemId, quantity) => {
    try {
      const response = await api.put(
        `/cart/items/${serviceId}/${itemId}`,
        { quantity }
      );
      const data = response.data;
      set({
        items: data.items,
        totalItems: data.total_items,
        totalAmount: data.total_amount,
      });
    } catch (error) {
      console.log("Update cart error:", error.message);
      throw error;
    }
  },

  // Remove item (set quantity to 0)
  removeItem: async (serviceId, itemId) => {
    return get().updateItem(serviceId, itemId, 0);
  },

  // Clear cart
  clearCart: async () => {
    try {
      await api.delete("/cart");
      set({ items: [], totalItems: 0, totalAmount: 0 });
    } catch (error) {
      console.log("Clear cart error:", error.message);
    }
  },
}));
