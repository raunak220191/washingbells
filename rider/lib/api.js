import axios from "axios";
import * as SecureStore from "expo-secure-store";
import DEV_BACKEND_URL from "../config/dev";

const getBaseURL = () => {
  if (__DEV__) return `${DEV_BACKEND_URL}/api/v1`;
  return "https://api.washingbells.com/api/v1";
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Attach auth token
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync("rider_auth_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (e) {}
  return config;
}, (error) => Promise.reject(error));

// Handle 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try { await SecureStore.deleteItemAsync("rider_auth_token"); } catch {}
      const { useAuthStore } = await import("../stores/authStore");
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;
