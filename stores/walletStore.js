import { create } from "zustand";
import api from "../lib/api";

export const useWalletStore = create((set, get) => ({
  balance: 0,
  transactions: [],
  isLoading: false,

  fetchWallet: async () => {
    try {
      set({ isLoading: true });
      const res = await api.get("/wallet");
      set({ balance: res.data.balance, transactions: res.data.transactions, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.log("Fetch wallet error:", error.message);
    }
  },

  topup: async (amount) => {
    try {
      const res = await api.post("/wallet/topup", { amount });
      return res.data; // { razorpay_order_id, amount, ... }
    } catch (error) {
      console.log("Topup error:", error.message);
      throw error;
    }
  },

  verifyTopup: async (paymentData) => {
    try {
      const res = await api.post("/wallet/topup/verify", paymentData);
      set({ balance: res.data.balance });
      return res.data;
    } catch (error) {
      console.log("Verify topup error:", error.message);
      throw error;
    }
  },
}));
