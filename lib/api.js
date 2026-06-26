import axios from "axios";
import * as SecureStore from "./secureStore";
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

// Single-flight refresh: concurrent 401s share one /auth/refresh call.
let refreshPromise = null;
async function doRefresh() {
  const rt = await SecureStore.getItemAsync("refresh_token");
  if (!rt) throw new Error("no refresh token");
  // Bare axios (not `api`) so this request skips the interceptors below.
  const resp = await axios.post(`${getBaseURL()}/auth/refresh`, { refresh_token: rt }, { timeout: 15000 });
  const { access_token, refresh_token } = resp.data;
  await SecureStore.setItemAsync("auth_token", access_token);
  if (refresh_token) await SecureStore.setItemAsync("refresh_token", refresh_token);
  return access_token;
}
function getFreshToken() {
  if (!refreshPromise) {
    refreshPromise = doRefresh();
    refreshPromise.finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

// Handle 401 — try one silent refresh + retry, then fall back to logout.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isRefreshCall = original?.url?.includes("/auth/refresh");
    if (error.response?.status === 401 && original && !original._retry && !isRefreshCall) {
      original._retry = true;
      try {
        const newToken = await getFreshToken();
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original); // replay the original request with the new token
      } catch (e) {
        // Refresh failed — session is over.
        try { await SecureStore.deleteItemAsync("auth_token"); } catch {}
        try { await SecureStore.deleteItemAsync("refresh_token"); } catch {}
        const { useAuthStore } = await import("../stores/authStore");
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
