import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import api from "../lib/api";
import { registerForPushNotifications, unregisterPushNotifications } from "../lib/pushNotifications";

export const useAuthStore = create((set, get) => ({
  user: null,
  store: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  // T&C gate — kept in the store so accepting clears it immediately
  needsTerms: false,
  termsChecked: false,

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync("store_auth_token");
      if (token) {
        const res = await api.get("/store-ops/my-store");
        const userRes = await api.get("/users/me");
        set({ user: userRes.data, store: res.data, token, isAuthenticated: true, isLoading: false });
        registerForPushNotifications().catch(() => {});
      } else {
        set({ isLoading: false });
      }
    } catch {
      await SecureStore.deleteItemAsync("store_auth_token").catch(() => {});
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  sendOTP: async (phone) => (await api.post("/auth/send-otp", { phone })).data,

  verifyOTP: async (phone, code) => {
    const res = await api.post("/auth/verify-otp", { phone, code });
    const { access_token, refresh_token, user } = res.data;
    await SecureStore.setItemAsync("store_auth_token", access_token);
    if (refresh_token) await SecureStore.setItemAsync("store_refresh_token", refresh_token);
    set({ user, token: access_token, isAuthenticated: true });
    registerForPushNotifications().catch(() => {});
    return res.data;
  },

  // Log in with phone + password (OTP bypass)
  loginWithPassword: async (phone, password) => {
    const res = await api.post("/auth/login-password", { phone, password });
    const { access_token, refresh_token, user } = res.data;
    await SecureStore.setItemAsync("store_auth_token", access_token);
    if (refresh_token) await SecureStore.setItemAsync("store_refresh_token", refresh_token);
    set({ user, token: access_token, isAuthenticated: true });
    // Load store profile so profile-completion gates resolve correctly
    try {
      const storeRes = await api.get("/store-ops/my-store");
      set({ store: storeRes.data });
    } catch {}
    registerForPushNotifications().catch(() => {});
    return res.data;
  },

  registerStore: async (data) => {
    const res = await api.post("/auth/register-store", data);
    const { access_token } = res.data;
    await SecureStore.setItemAsync("store_auth_token", access_token);
    set({ token: access_token });
    return res.data;
  },

  refreshStore: async () => {
    try {
      const res = await api.get("/store-ops/my-store");
      set({ store: res.data });
      return res.data;
    } catch { return null; }
  },

  refreshTermsStatus: async () => {
    try {
      const res = await api.get("/terms/me/status");
      set({ needsTerms: !!res.data?.needs_acceptance, termsChecked: true });
      return res.data;
    } catch {
      set({ needsTerms: false, termsChecked: true });
      return { needs_acceptance: false };
    }
  },

  resetTerms: () => set({ needsTerms: false, termsChecked: false }),

  checkTermsStatus: async () => get().refreshTermsStatus(),

  fetchLatestTerms: async () => {
    const res = await api.get("/terms/store");
    return res.data;
  },

  acceptTerms: async (version) => {
    const res = await api.post("/terms/accept", { version });
    set({ needsTerms: false, termsChecked: true });
    return res.data;
  },

  completeStoreProfile: async (payload) => {
    const res = await api.post("/store-ops/complete-profile", payload);
    // Refresh store data so profile_complete flag flows through
    const storeRes = await api.get("/store-ops/my-store");
    set({ store: storeRes.data });
    return res.data;
  },

  logout: async () => {
    await unregisterPushNotifications().catch(() => {});
    await SecureStore.deleteItemAsync("store_auth_token").catch(() => {});
    set({ user: null, store: null, token: null, isAuthenticated: false, needsTerms: false, termsChecked: false });
  },
}));
