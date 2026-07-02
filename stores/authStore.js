import { create } from "zustand";
import * as SecureStore from "../lib/secureStore";
import api from "../lib/api";
import { registerForPushNotifications, unregisterPushNotifications } from "../lib/pushNotifications";

export const useAuthStore = create((set, get) => ({
  // State
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true, // true while we check stored token on app boot
  isNewUser: false,
  // T&C gate — kept in the store so accepting clears it immediately
  needsTerms: false,
  termsChecked: false,

  // Initialize — silently restore the session on app launch (persistent login).
  initialize: async () => {
    try {
      let token = await SecureStore.getItemAsync("auth_token");
      // No access token but maybe a valid refresh token (e.g. the access token
      // expired while the app was closed) — mint a fresh one before giving up.
      if (!token) {
        token = await get().refreshSession().catch(() => null);
      }
      if (!token) {
        set({ isLoading: false });
        return;
      }
      // Validate by fetching the profile. If the access token expires mid-flight,
      // the api 401 interceptor refreshes and retries transparently.
      const response = await api.get("/users/me");
      const current = await SecureStore.getItemAsync("auth_token");
      set({
        user: response.data,
        token: current || token,
        isAuthenticated: true,
        isLoading: false,
      });
      registerForPushNotifications().catch(() => {});
    } catch (error) {
      // Session unrecoverable — clear both tokens and fall back to login.
      await SecureStore.deleteItemAsync("auth_token").catch(() => {});
      await SecureStore.deleteItemAsync("refresh_token").catch(() => {});
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  // Exchange the stored refresh token for a fresh access+refresh pair.
  // Returns the new access token, or null when there is no refresh token.
  refreshSession: async () => {
    const rt = await SecureStore.getItemAsync("refresh_token");
    if (!rt) return null;
    const response = await api.post("/auth/refresh", { refresh_token: rt });
    const { access_token, refresh_token } = response.data;
    await SecureStore.setItemAsync("auth_token", access_token);
    if (refresh_token) await SecureStore.setItemAsync("refresh_token", refresh_token);
    set({ token: access_token });
    return access_token;
  },

  // Send OTP
  sendOTP: async (phone) => {
    const response = await api.post("/auth/send-otp", { phone });
    return response.data;
  },

  // Verify OTP and log in
  verifyOTP: async (phone, code) => {
    const response = await api.post("/auth/verify-otp", { phone, code });
    const { access_token, refresh_token, is_new_user, user } = response.data;

    await SecureStore.setItemAsync("auth_token", access_token);
    if (refresh_token) await SecureStore.setItemAsync("refresh_token", refresh_token);
    set({
      user,
      token: access_token,
      isAuthenticated: true,
      isNewUser: is_new_user,
    });
    registerForPushNotifications().catch(() => {});

    return response.data;
  },

  // Log in with phone + password (OTP bypass)
  loginWithPassword: async (phone, password) => {
    const response = await api.post("/auth/login-password", { phone, password });
    const { access_token, refresh_token, is_new_user, user } = response.data;

    await SecureStore.setItemAsync("auth_token", access_token);
    if (refresh_token) await SecureStore.setItemAsync("refresh_token", refresh_token);
    set({
      user,
      token: access_token,
      isAuthenticated: true,
      isNewUser: is_new_user,
    });
    registerForPushNotifications().catch(() => {});

    return response.data;
  },

  // Update profile
  updateProfile: async (data) => {
    const response = await api.put("/users/me", data);
    set({ user: response.data, isNewUser: false });
    return response.data;
  },

  // T&C — check, fetch, accept
  // Reads /terms/me/status and stores the gate flags so the layout reacts.
  refreshTermsStatus: async () => {
    try {
      const res = await api.get("/terms/me/status");
      set({ needsTerms: !!res.data?.needs_acceptance, termsChecked: true });
      return res.data;
    } catch {
      // On error, don't trap the user out of the app
      set({ needsTerms: false, termsChecked: true });
      return { needs_acceptance: false };
    }
  },

  // Clear the gate (used on logout / when unauthenticated)
  resetTerms: () => set({ needsTerms: false, termsChecked: false }),

  // Back-compat alias for screens that just read status
  checkTermsStatus: async () => get().refreshTermsStatus(),

  fetchLatestTerms: async () => {
    const res = await api.get("/terms/customer");
    return res.data;
  },

  acceptTerms: async (version) => {
    const res = await api.post("/terms/accept", { version });
    // Accepted the latest version — clear the gate so the app opens
    set({ needsTerms: false, termsChecked: true });
    return res.data;
  },

  // Logout
  logout: async () => {
    await unregisterPushNotifications().catch(() => {});
    await SecureStore.deleteItemAsync("auth_token").catch(() => {});
    await SecureStore.deleteItemAsync("refresh_token").catch(() => {});
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isNewUser: false,
      needsTerms: false,
      termsChecked: false,
    });
  },
}));
