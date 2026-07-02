import { create } from "zustand";
import api from "../lib/api";

export const useOrderStore = create((set, get) => ({
  // State
  orders: [],
  currentOrder: null,
  isLoading: false,
  // Set when the last fetch failed, so screens can show "retry" instead of a
  // misleading "No orders yet" empty state.
  fetchError: false,

  // Fetch all orders
  fetchOrders: async () => {
    try {
      set({ isLoading: true });
      const response = await api.get("/orders");
      set({ orders: response.data, isLoading: false, fetchError: false });
    } catch (error) {
      set({ isLoading: false, fetchError: true });
      console.log("Fetch orders error:", error.message);
    }
  },

  // Get single order
  fetchOrder: async (orderId) => {
    try {
      set({ isLoading: true });
      const response = await api.get(`/orders/${orderId}`);
      set({ currentOrder: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // Create order from cart
  createOrder: async (orderData) => {
    try {
      const response = await api.post("/orders", orderData);
      const newOrder = response.data;
      set((state) => ({
        orders: [newOrder, ...state.orders],
        currentOrder: newOrder,
      }));
      return newOrder;
    } catch (error) {
      console.log("Create order error:", error.message);
      throw error;
    }
  },

  // Cancel order
  cancelOrder: async (orderId) => {
    try {
      const response = await api.put(`/orders/${orderId}/cancel`);
      set((state) => ({
        orders: state.orders.map((o) =>
          o.id === orderId ? response.data : o
        ),
        currentOrder:
          state.currentOrder?.id === orderId
            ? response.data
            : state.currentOrder,
      }));
      return response.data;
    } catch (error) {
      console.log("Cancel order error:", error.message);
      throw error;
    }
  },
}));
