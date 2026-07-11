import { create } from "zustand";
import api from "../lib/api";

export const useOrderStore = create((set, get) => ({
  orders: [],
  currentOrder: null,
  isLoading: false,

  fetchOrders: async (statusFilter = null) => {
    try {
      set({ isLoading: true });
      const params = statusFilter ? `?status_filter=${statusFilter}` : "";
      const res = await api.get(`/store-ops/orders${params}`);
      set({ orders: res.data, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
    }
  },

  fetchOrderDetail: async (orderId) => {
    try {
      const res = await api.get(`/store-ops/orders/${orderId}`);
      set({ currentOrder: res.data });
      return res.data;
    } catch (e) { return null; }
  },

  acceptOrder: async (orderId) => {
    const res = await api.post(`/store-ops/orders/${orderId}/accept`);
    await get().fetchOrders();
    return res.data;
  },

  // Weight-based lines: confirm/correct a kg line on the store scale
  // (upgrade_last TASK 2.4) — same endpoint + audit trail as the rider flow.
  updateLineWeight: async (orderId, lineId, actualQty) => {
    const res = await api.patch(`/orders/${orderId}/items/${lineId}/weight`,
      { actual_qty: actualQty });
    await get().fetchOrderDetail(orderId);
    return res.data;
  },

  receiveClothes: async (orderId, otp) => {
    const res = await api.post(`/store-ops/orders/${orderId}/receive`, { otp });
    await get().fetchOrderDetail(orderId);
    return res.data;
  },

  startProcessing: async (orderId) => {
    const res = await api.post(`/store-ops/orders/${orderId}/start-processing`);
    await get().fetchOrderDetail(orderId);
    return res.data;
  },

  setDeliveryTime: async (orderId, expectedAt) => {
    const res = await api.put(`/store-ops/orders/${orderId}/delivery-time`, { expected_delivery_at: expectedAt });
    await get().fetchOrderDetail(orderId);
    return res.data;
  },

  markReady: async (orderId) => {
    const res = await api.post(`/store-ops/orders/${orderId}/mark-ready`);
    await get().fetchOrderDetail(orderId);
    return res.data;
  },

  rejectOrder: async (orderId, reason) => {
    const res = await api.post(`/store-ops/orders/${orderId}/reject`, { reason: reason || null });
    await get().fetchOrders();
    return res.data;
  },

  assignPickupRider: async (orderId, riderId) => {
    const res = await api.post(`/store-ops/orders/${orderId}/assign-pickup-rider`, { rider_id: riderId || null });
    await get().fetchOrderDetail(orderId);
    return res.data;
  },

  bookRider: async (orderId, riderId) => {
    const res = await api.post(`/store-ops/orders/${orderId}/book-rider`, { rider_id: riderId || null });
    await get().fetchOrderDetail(orderId);
    return res.data;
  },

  fetchNearbyRiders: async (radius = 10) => {
    const res = await api.get("/store-ops/riders/nearby", { params: { radius } });
    return res.data;
  },

  getEarnings: async () => {
    const res = await api.get("/store-ops/earnings");
    return res.data;
  },

  getPayouts: async () => {
    const res = await api.get("/store-ops/payouts");
    return res.data;
  },

  toggleStore: async (isOpen) => {
    const res = await api.put("/store-ops/toggle", { is_open: isOpen });
    return res.data;
  },

  // ── Walk-in / counter orders ──────────────────────────────
  lookupCustomer: async (phone) => {
    const res = await api.get("/store-ops/customers/lookup", { params: { phone } });
    return res.data;
  },

  createWalkInOrder: async (payload) => {
    const res = await api.post("/store-ops/orders/walk-in", payload);
    await get().fetchOrders();
    return res.data;
  },

  completeCounterOrder: async (orderId) => {
    const res = await api.post(`/store-ops/orders/${orderId}/complete-counter`);
    await get().fetchOrderDetail(orderId);
    return res.data;
  },

  // ── Store photo capture ───────────────────────────────────
  uploadOrderPhotos: async (orderId, photos, context = "store_intake") => {
    const res = await api.post(`/store-ops/orders/${orderId}/photos`, { photos, context });
    await get().fetchOrderDetail(orderId);
    return res.data;
  },
}));
