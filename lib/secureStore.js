// Cross-platform secure storage shim.
//
// expo-secure-store has no web implementation — its methods throw on web,
// which breaks the auth flow when the app is run via `expo start --web`
// (used by the run-washingbells driver). On native we re-export the real
// SecureStore verbatim, so native behaviour is unchanged. On web we fall
// back to localStorage (dev/testing only — not a secure store).
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const web = {
  async getItemAsync(key) {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  },
  async setItemAsync(key, value) {
    try { globalThis.localStorage?.setItem(key, value); } catch {}
  },
  async deleteItemAsync(key) {
    try { globalThis.localStorage?.removeItem(key); } catch {}
  },
};

const impl = Platform.OS === "web" ? web : SecureStore;

export const getItemAsync = (...a) => impl.getItemAsync(...a);
export const setItemAsync = (...a) => impl.setItemAsync(...a);
export const deleteItemAsync = (...a) => impl.deleteItemAsync(...a);
