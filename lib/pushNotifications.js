/**
 * Push notification setup for the customer app.
 * Customers receive order-status updates (confirmed, picked-up, delivered…).
 */

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import api from "./api";

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
  await Notifications.setNotificationChannelAsync("order-updates", {
    name: "Order Updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250],
    lightColor: "#4A5D4E",
    sound: "default",
  });
  await Notifications.setNotificationChannelAsync("default", {
    name: "WashingBells",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
}

async function getExpoToken() {
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId;
  // Skip if EAS projectId placeholder hasn't been replaced
  if (projectId === "your-eas-project-id") {
    try {
      const t = await Notifications.getExpoPushTokenAsync();
      return t?.data;
    } catch { return null; }
  }
  const tokenResp = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();
  return tokenResp?.data;
}

export async function registerForPushNotifications() {
  if (!Device.isDevice) return null;
  await setupNotificationChannels();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  let token = null;
  try {
    token = await getExpoToken();
  } catch (e) {
    console.log("Push: failed to obtain token", e?.message);
    return null;
  }
  if (!token) return null;

  try {
    await api.post("/notifications/register-token", { token, platform: Platform.OS });
  } catch (e) {
    console.log("Push: backend registration failed", e?.message);
  }
  return token;
}

export async function unregisterPushNotifications() {
  try { await api.delete("/notifications/unregister-token"); } catch {}
}

export function addNotificationTapHandler(handler) {
  return Notifications.addNotificationResponseReceivedListener(response => {
    const data = response?.notification?.request?.content?.data || {};
    try { handler(data); } catch (e) { console.log("notification tap handler error", e); }
  });
}
