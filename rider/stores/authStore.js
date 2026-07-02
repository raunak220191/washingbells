import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import api from "../lib/api";
import { registerForPushNotifications, unregisterPushNotifications } from "../lib/pushNotifications";
import { stopBackgroundTracking } from "../lib/locationTracking";

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  // T&C gate — kept in the store so accepting clears it immediately
  needsTerms: false,
  termsChecked: false,

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync("rider_auth_token");
      if (token) {
        const response = await api.get("/delivery/me");
        set({ user: response.data, token, isAuthenticated: true, isLoading: false });
        // Fire-and-forget: register push token on every app boot when logged in
        registerForPushNotifications().catch(() => {});
      } else {
        set({ isLoading: false });
      }
    } catch {
      await SecureStore.deleteItemAsync("rider_auth_token").catch(() => {});
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  sendOTP: async (phone) => {
    const res = await api.post("/auth/send-otp", { phone });
    return res.data;
  },

  verifyOTP: async (phone, code) => {
    const res = await api.post("/auth/verify-otp", { phone, code });
    const { access_token, refresh_token, user } = res.data;
    await SecureStore.setItemAsync("rider_auth_token", access_token);
    if (refresh_token) await SecureStore.setItemAsync("rider_refresh_token", refresh_token);
    set({ user, token: access_token, isAuthenticated: true });
    registerForPushNotifications().catch(() => {});
    return res.data;
  },

  // Log in with phone + password (OTP bypass)
  loginWithPassword: async (phone, password) => {
    const res = await api.post("/auth/login-password", { phone, password });
    const { access_token, refresh_token, user } = res.data;
    await SecureStore.setItemAsync("rider_auth_token", access_token);
    if (refresh_token) await SecureStore.setItemAsync("rider_refresh_token", refresh_token);
    set({ token: access_token, isAuthenticated: true });
    // Load full rider profile so registration/approval gates resolve correctly
    try {
      const profile = await api.get("/delivery/me");
      set({ user: profile.data });
    } catch {
      set({ user });
    }
    registerForPushNotifications().catch(() => {});
    return res.data;
  },

  registerRider: async (data) => {
    const res = await api.post("/auth/register-rider", data);
    const { access_token } = res.data;
    await SecureStore.setItemAsync("rider_auth_token", access_token);
    // Refresh profile
    const profile = await api.get("/delivery/me");
    set({ user: profile.data });
    return res.data;
  },

  refreshProfile: async () => {
    const res = await api.get("/delivery/me");
    set({ user: res.data });
    return res.data;
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
    const res = await api.get("/terms/rider");
    return res.data;
  },

  acceptTerms: async (version) => {
    const res = await api.post("/terms/accept", { version });
    set({ needsTerms: false, termsChecked: true });
    return res.data;
  },

  uploadRiderDocuments: async ({ dl_image, aadhaar_image, selfie_image }) => {
    const res = await api.post("/delivery/upload-documents", { dl_image, aadhaar_image, selfie_image });
    // Refresh profile so has_dl/has_aadhaar/has_selfie/documents_uploaded flow through
    const profile = await api.get("/delivery/me");
    set({ user: profile.data });
    return res.data;
  },

  logout: async () => {
    // Stop background tracking and clear push token before destroying auth
    await stopBackgroundTracking().catch(() => {});
    await unregisterPushNotifications().catch(() => {});
    await SecureStore.deleteItemAsync("rider_auth_token").catch(() => {});
    await SecureStore.deleteItemAsync("rider_refresh_token").catch(() => {});
    set({ user: null, token: null, isAuthenticated: false, needsTerms: false, termsChecked: false });
  },
}));
