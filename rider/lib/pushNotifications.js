/**
 * Push notification setup for the rider app.
 *
 * - Configures the Android notification channels (high-importance for new
 *   trip assignments so the alert pierces Do Not Disturb when allowed).
 * - Requests permission, obtains the Expo Push token, registers it with
 *   the backend.
 * - Sets the foreground handler so notifications still play sound when the
 *   app is open.
 */

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import api from "./api";

// Foreground handler — play sound + show banner even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function setupNotificationChannels() {
  if (Platform.OS !== "android") return;
  // High-importance channel for new trip assignments — loud, vibrates, lights
  await Notifications.setNotificationChannelAsync("new-trips", {
    name: "New Trip Assignments",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 200, 300, 200, 300],
    lightColor: "#4A5D4E",
    sound: "default",
    enableVibrate: true,
    enableLights: true,
    bypassDnd: false,
    showBadge: true,
  });
  // Standard channel for everything else
  await Notifications.setNotificationChannelAsync("default", {
    name: "WashingBells",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250],
    lightColor: "#4A5D4E",
    sound: "default",
  });
}

async function getExpoToken() {
  // Need an EAS projectId for production push; falls back gracefully in Expo Go dev
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId;
  const tokenResp = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();
  return tokenResp?.data;
}

/**
 * Register the device for push notifications and send the token to the
 * backend. Safe to call multiple times — idempotent on the backend.
 * Returns the token on success, null otherwise.
 */
export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log("Push: must use a physical device");
    return null;
  }

  await setupNotificationChannels();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.log("Push: permission denied");
    return null;
  }

  let token = null;
  try {
    token = await getExpoToken();
  } catch (e) {
    console.log("Push: failed to obtain token", e?.message);
    return null;
  }
  if (!token) return null;

  try {
    await api.post("/notifications/register-token", {
      token,
      platform: Platform.OS,
    });
    console.log("Push: token registered");
  } catch (e) {
    console.log("Push: backend registration failed", e?.message);
  }
  return token;
}

/**
 * Clear the push token from the backend (on logout).
 */
export async function unregisterPushNotifications() {
  try {
    await api.delete("/notifications/unregister-token");
  } catch (e) {
    // Ignore — token may already be invalid
  }
}

/**
 * Add a tap handler that runs when the user taps a notification.
 * Returns the subscription so the caller can clean it up.
 */
export function addNotificationTapHandler(handler) {
  return Notifications.addNotificationResponseReceivedListener(response => {
    const data = response?.notification?.request?.content?.data || {};
    try { handler(data); } catch (e) { console.log("notification tap handler error", e); }
  });
}
