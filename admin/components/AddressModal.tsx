"use client";
import { useState } from "react";
import { X, MapPin } from "lucide-react";
import api from "@/lib/api";

export type EditableAddress = {
  id: string;
  label: string | null;
  full_address: string | null;
  city: string | null;
  pincode: string | null;
  is_default: boolean;
};

type Props = {
  userId: string;
  address: EditableAddress | null; // null → add mode
  onClose: () => void;
  onSaved: () => void;
};

// D2: admin adds / edits a customer's address. Coordinates are intentionally
// not asked for — the backend geocodes the address text when configured.
export default function AddressModal({ userId, address, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    label: address?.label ?? "home",
    full_address: address?.full_address ?? "",
    city: address?.city ?? "",
    state: "",
    pincode: address?.pincode ?? "",
    landmark: "",
    is_default: address?.is_default ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.full_address.trim() || !form.city.trim()) {
      setError("Full address and city are required"); return;
    }
    setSaving(true); setError("");
    try {
      const body: Record<string, any> = {
        label: form.label.trim() || "home",
        full_address: form.full_address.trim(),
        city: form.city.trim(),
        pincode: form.pincode.trim(),
        is_default: form.is_default,
      };
      // Optional text fields: only send when filled so an edit doesn't blank
      // values we never loaded (the detail API doesn't return state/landmark).
      if (form.state.trim()) body.state = form.state.trim();
      if (form.landmark.trim()) body.landmark = form.landmark.trim();
      if (address) await api.put(`/admin/users/${userId}/addresses/${address.id}`, body);
      else await api.post(`/admin/users/${userId}/addresses`, body);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to save address");
    } finally { setSaving(false); }
  };

  const cls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !saving && onClose()} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MapPin size={18} className="text-amber-600" /> {address ? "Edit Address" : "Add Address"}
          </h2>
          <button onClick={() => !saving && onClose()} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Label</label>
            <select className={cls} value={form.label} onChange={(e) => set("label", e.target.value)}>
              <option value="home">Home</option>
              <option value="work">Work</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Pincode</label>
            <input className={`${cls} font-mono`} value={form.pincode} onChange={(e) => set("pincode", e.target.value)} placeholder="140603" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Full address *</label>
            <input className={cls} value={form.full_address} onChange={(e) => set("full_address", e.target.value)} placeholder="House, street, area" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Landmark</label>
            <input className={cls} value={form.landmark} onChange={(e) => set("landmark", e.target.value)} placeholder="Optional landmark" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">City *</label>
            <input className={cls} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Zirakpur" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">State</label>
            <input className={cls} value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="Punjab" />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.is_default} onChange={(e) => set("is_default", e.target.checked)} className="accent-amber-500" />
            Set as default address
          </label>
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={() => !saving && onClose()} disabled={saving}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-sm font-semibold text-white disabled:opacity-40">
            {saving ? "Saving…" : address ? "Save changes" : "Add address"}
          </button>
        </div>
      </div>
    </div>
  );
}
