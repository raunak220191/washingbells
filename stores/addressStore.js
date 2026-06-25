import { create } from "zustand";
import api from "../lib/api";

export const useAddressStore = create((set, get) => ({
  // State
  addresses: [],
  selectedAddress: null,
  isLoading: false,

  // Fetch addresses
  fetchAddresses: async () => {
    try {
      set({ isLoading: true });
      const response = await api.get("/addresses");
      const addresses = response.data;
      const defaultAddr = addresses.find((a) => a.is_default) || addresses[0] || null;
      set({
        addresses,
        selectedAddress: get().selectedAddress || defaultAddr,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      console.log("Fetch addresses error:", error.message);
    }
  },

  // Add address
  addAddress: async (addressData) => {
    try {
      const response = await api.post("/addresses", addressData);
      set((state) => ({
        addresses: [...state.addresses, response.data],
        selectedAddress: response.data.is_default
          ? response.data
          : state.selectedAddress || response.data,
      }));
      return response.data;
    } catch (error) {
      console.log("Add address error:", error.message);
      throw error;
    }
  },

  // Update address
  updateAddress: async (addressId, data) => {
    try {
      const response = await api.put(`/addresses/${addressId}`, data);
      set((state) => ({
        addresses: state.addresses.map((a) =>
          a.id === addressId ? response.data : a
        ),
        selectedAddress:
          state.selectedAddress?.id === addressId
            ? response.data
            : state.selectedAddress,
      }));
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete address
  deleteAddress: async (addressId) => {
    try {
      await api.delete(`/addresses/${addressId}`);
      set((state) => ({
        addresses: state.addresses.filter((a) => a.id !== addressId),
        selectedAddress:
          state.selectedAddress?.id === addressId
            ? state.addresses[0] || null
            : state.selectedAddress,
      }));
    } catch (error) {
      throw error;
    }
  },

  // Select address (local only)
  selectAddress: (address) => set({ selectedAddress: address }),
}));
