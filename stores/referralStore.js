import { create } from "zustand";
import api from "../lib/api";

export const useReferralStore = create((set) => ({
  referralCode: "",
  referralUrl: "",
  totalReferred: 0,
  totalEarned: 0,
  isLoading: false,

  fetchReferralStats: async () => {
    try {
      set({ isLoading: true });
      const res = await api.get("/referrals/me");
      set({
        referralCode: res.data.referral_code,
        referralUrl: res.data.referral_url,
        totalReferred: res.data.total_referred,
        totalEarned: res.data.total_earned,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      console.log("Fetch referral error:", error.message);
    }
  },

  applyReferral: async (code) => {
    try {
      const res = await api.post("/referrals/apply", { code });
      return res.data; // { message, coupon_code }
    } catch (error) {
      throw error;
    }
  },
}));
