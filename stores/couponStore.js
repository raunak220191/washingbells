import { create } from "zustand";
import api from "../lib/api";

export const useCouponStore = create((set) => ({
  myCoupons: [],
  isLoading: false,
  validationResult: null, // { valid, code, discount_amount, message }

  fetchMyCoupons: async () => {
    try {
      set({ isLoading: true });
      const res = await api.get("/coupons/me");
      set({ myCoupons: res.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.log("Fetch coupons error:", error.message);
    }
  },

  validateCoupon: async (code, cartTotal) => {
    try {
      const res = await api.post("/coupons/validate", { code, cart_total: cartTotal });
      set({ validationResult: res.data });
      return res.data;
    } catch (error) {
      const result = { valid: false, code, discount_amount: 0, message: "Failed to validate" };
      set({ validationResult: result });
      return result;
    }
  },

  clearValidation: () => set({ validationResult: null }),
}));
