import axios from "axios";
import * as SecureStore from "expo-secure-store";
import DEV_BACKEND_URL from "../config/dev";

// ─────────────────────────────────────────────────────────────
// Backend URL is set in config/dev.js — ONE line to change:
//   LAN mode:    "http://192.168.1.41:8000"
//   Tunnel mode: "https://xxxx.loca.lt"
// ─────────────────────────────────────────────────────────────
const getBaseURL = () => {
  if (__DEV__) return `${DEV_BACKEND_URL}/api/v1`;
  return "https://api.washingbells.com/api/v1";
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach auth token to every request
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (e) {}
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 — clear stored token and reset auth state
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try { await SecureStore.deleteItemAsync("auth_token"); } catch {}
      const { useAuthStore } = await import("../stores/authStore");
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;
