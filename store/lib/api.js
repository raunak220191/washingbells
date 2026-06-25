import axios from "axios";
import * as SecureStore from "expo-secure-store";
import DEV_BACKEND_URL from "../config/dev";

const api = axios.create({
  baseURL: __DEV__ ? `${DEV_BACKEND_URL}/api/v1` : "https://api.washingbells.com/api/v1",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync("store_auth_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (e) {}
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401) {
      try { await SecureStore.deleteItemAsync("store_auth_token"); } catch {}
      // Lazy import avoids circular dependency with authStore
      const { useAuthStore } = await import("../stores/authStore");
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;
