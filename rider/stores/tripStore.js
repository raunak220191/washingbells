import { create } from "zustand";
import { Alert } from "react-native";
import api from "../lib/api";
import { startBackgroundTracking, stopBackgroundTracking } from "../lib/locationTracking";

export const useTripStore = create((set, get) => ({
  worklist: [],
  history: [],
  activeTrip: null,
  earnings: null,
  isLoading: false,

  fetchWorklist: async () => {
    try {
      set({ isLoading: true });
      const res = await api.get("/delivery/worklist");
      const trips = res.data;
      set({ worklist: trips, activeTrip: trips.find(t => ["accepted","started"].includes(t.status)) || null, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      console.log("Fetch worklist error:", e.message);
    }
  },

  fetchHistory: async () => {
    try {
      const res = await api.get("/delivery/history");
      set({ history: res.data });
    } catch (e) {
      console.log("Fetch history error:", e.message);
    }
  },

  fetchEarnings: async () => {
    try {
      const res = await api.get("/delivery/earnings");
      set({ earnings: res.data });
    } catch (e) {
      console.log("Fetch earnings error:", e.message);
    }
  },

  acceptTrip: async (tripId) => {
    const res = await api.post(`/delivery/${tripId}/accept`);
    await get().fetchWorklist();
    return res.data;
  },

  startTrip: async (tripId) => {
    const res = await api.post(`/delivery/${tripId}/start`);
    await get().fetchWorklist();
    return res.data;
  },

  uploadPhotos: async (tripId, photos) => {
    const res = await api.post(`/delivery/${tripId}/upload-photos`, { photos });
    // Refresh worklist so photos_uploaded flag is synced (allows step restore on re-entry)
    await get().fetchWorklist();
    return res.data;
  },

  generatePickupOTP: async (tripId) => {
    const res = await api.post(`/delivery/${tripId}/generate-pickup-otp`);
    return res.data;
  },

  verifyPickupOTP: async (tripId, otp) => {
    const res = await api.post(`/delivery/${tripId}/verify-pickup-otp`, { otp });
    await get().fetchWorklist();
    await get().fetchEarnings();
    return res.data;
  },

  generateStoreDropOTP: async (tripId) => {
    const res = await api.post(`/delivery/${tripId}/generate-store-drop-otp`);
    return res.data;
  },

  generateDeliveryOTP: async (tripId) => {
    const res = await api.post(`/delivery/${tripId}/generate-delivery-otp`);
    return res.data;
  },

  verifyDeliveryOTP: async (tripId, otp) => {
    const res = await api.post(`/delivery/${tripId}/verify-delivery-otp`, { otp });
    await get().fetchWorklist();
    await get().fetchEarnings();
    return res.data;
  },

  setOnline: async (status) => {
    // The status PUT is the source of truth — it must succeed/fail on its own.
    const res = await api.put("/delivery/status", { status });
    // GPS tracking is best-effort: a failure to start/stop it (e.g. on a
    // simulator, in Expo Go, or when permission is denied) must NEVER prevent
    // the rider from going online/offline.
    try {
      if (status === "online") {
        const started = await startBackgroundTracking();
        if (!started) {
          Alert.alert(
            "Location Permission Needed",
            "You're online, but trips assigned by distance need location access. Enable it in Settings to receive nearby trips."
          );
        }
      } else {
        await stopBackgroundTracking();
      }
    } catch (e) {
      console.log("[setOnline] background tracking issue:", e?.message);
    }
    return res.data;
  },

  updateLocation: async (latitude, longitude) => {
    try {
      await api.put("/delivery/location", { latitude, longitude });
    } catch (e) {}
  },
}));
