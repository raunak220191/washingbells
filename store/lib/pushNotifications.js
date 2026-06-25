/**
 * Push notification setup for the store app.
 *
 * Store owners get loud, high-priority alerts on new orders — they need to
 * hear it across a busy laundry counter.
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
  // MAX importance for new orders so the alert bypasses DND when allowed
  await Notifications.setNotificationChannelAsync("new-orders", {
    name: "New Orders",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400, 200, 400],
    lightColor: "#E65100",
    sound: "default",
    enableVibrate: true,
    enableLights: true,
    bypassDnd: false,
    showBadge: true,
  });
  await Notifications.setNotificationChannelAsync("default", {
    name: "WashingBells Store",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250],
    lightColor: "#E65100",
    sound: "default",
  });
}

async function getExpoToken() {
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId;
  const tokenResp = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();
  return tokenResp?.data;
}

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
    console.log("Push: token registered");
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
