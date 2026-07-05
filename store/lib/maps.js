/**
 * Google-Maps availability guard (B3).
 *
 * On Android, react-native-maps' default provider is Google Maps and a
 * missing com.google.android.geo.API_KEY crashes the app NATIVELY the moment
 * a <MapView> mounts. Expo Go ships its own key, which is why the map picker
 * worked in dev tests but crashed the distributed APK.
 *
 * Until a Maps key is added to app.json → android.config.googleMaps.apiKey
 * (client-side key, restrict by package name + SHA-1 in Google Cloud console),
 * screens must check this and fall back to the GPS-only flow.
 */
import Constants from "expo-constants";
import { Platform } from "react-native";

export const mapsConfigured =
  Platform.OS !== "android" ||
  Constants.appOwnership === "expo" || // Expo Go bundles its own Maps key
  !!Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
