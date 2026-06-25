import { create } from "zustand";
import api from "../lib/api";

export const useBannerStore = create((set) => ({
  banners: [],
  testimonials: [],
  stores: [],
  isLoading: false,

  fetchBanners: async () => {
    try {
      const res = await api.get("/banners");
      set({ banners: res.data });
    } catch (error) {
      console.log("Fetch banners error:", error.message);
    }
  },

  fetchTestimonials: async () => {
    try {
      const res = await api.get("/testimonials");
      set({ testimonials: res.data });
    } catch (error) {
      console.log("Fetch testimonials error:", error.message);
    }
  },

  fetchStores: async () => {
    try {
      const res = await api.get("/stores");
      set({ stores: res.data });
    } catch (error) {
      console.log("Fetch stores error:", error.message);
    }
  },
}));
