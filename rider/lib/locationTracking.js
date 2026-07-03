/**
 * Background GPS tracking for the rider app.
 *
 * - When the rider toggles online, starts a background location task that
 *   PUTs /delivery/location every 30s (balanced accuracy).
 * - Survives the app being backgrounded; iOS requires the background-location
 *   capability (set in app.json).
 * - Stops cleanly when the rider toggles offline.
 *
 * Token persistence: the background task runs *outside* React, so we can't
 * use Zustand. We read the auth token from expo-secure-store on every batch.
 */

import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import DEV_BACKEND_URL from "../config/dev";

export const LOCATION_TASK_NAME = "washingbells-rider-location";

const BASE_URL = __DEV__ ? `${DEV_BACKEND_URL}/api/v1` : "https://api.washingbells.com/api/v1";

// Define the background task once on module load.
// TaskManager requires this to be defined at the JS bundle's top level so it
// can be re-registered when the OS wakes the app.
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.log("[bg-location] task error:", error.message);
    return;
  }
  if (!data) return;
  const { locations } = data;
  if (!locations || locations.length === 0) return;

  // Send the most recent location to avoid burst-PUTs
  const latest = locations[locations.length - 1];
  const { latitude, longitude } = latest.coords || {};
  if (latitude == null || longitude == null) return;

  let token = null;
  try {
    token = await SecureStore.getItemAsync("rider_auth_token");
  } catch {}
  if (!token) return;  // not logged in — nothing to do

  try {
    await fetch(`${BASE_URL}/delivery/location`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ latitude, longitude }),
    });
  } catch (e) {
    // Swallow — the next tick will retry
    console.log("[bg-location] PUT failed:", e?.message);
  }
});

/**
 * Request foreground + background location permission, then start the task.
 * Returns true if tracking started successfully.
 */
export async function startBackgroundTracking() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return false;

  // Background permission is asked separately (iOS shows the "Always" prompt
  // only after foreground has been granted)
  const bg = await Location.requestBackgroundPermissionsAsync();
  // Continue even if background was denied — foreground updates still help
  // while the app is open.
  const hasBackground = bg.status === "granted";

  // Don't restart if already running
  const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (already) return true;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 30000,        // 30 s
    distanceInterval: 25,       // or every 25 m, whichever comes first
    deferredUpdatesInterval: 30000,
    foregroundService: {
      notificationTitle: "WashingBells is tracking your location",
      notificationBody: "Tap to return to the app. Toggle Offline to stop tracking.",
      notificationColor: "#4A5D4E",
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: hasBackground,
    activityType: Location.ActivityType.AutomotiveNavigation,
  });

  return true;
}

/**
 * Stop the background task. Safe to call even if it's not running.
 */
export async function stopBackgroundTracking() {
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
    if (running) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch (e) {
    console.log("[bg-location] stop failed:", e?.message);
  }
}

/**
 * Returns true if the background task is currently running.
 */
export async function isTrackingActive() {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch {
    return false;
  }
}
