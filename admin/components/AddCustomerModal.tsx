"use client";
import { useState } from "react";
import { X, UserPlus } from "lucide-react";
import api from "@/lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: { id: string; name: string | null; phone: string }) => void;
};

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500";

export default function AddCustomerModal({ open, onClose, onCreated }: Props) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const reset = () => {
    setPhone(""); setName(""); setEmail(""); setPassword(""); setError("");
  };

  const close = () => { if (!saving) { reset(); onClose(); } };

  const submit = async () => {
    if (phone.replace(/\D/g, "").length < 10) { setError("Enter a valid 10-digit phone"); return; }
    setSaving(true); setError("");
    try {
      const res = await api.post("/admin/customers", {
        phone, name: name.trim() || undefined,
        email: email.trim() || undefined,
        password: password.trim() || undefined,
      });
      onCreated({ id: res.data.id, name: res.data.name, phone: res.data.phone });
      reset();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to create customer");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <UserPlus size={18} className="text-amber-600" /> Add Customer
          </h2>
          <button onClick={close} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Creates a customer profile without an order. They can be selected later when placing an order.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Phone *</label>
            <input className={inputCls} placeholder="10-digit number" inputMode="numeric"
              value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d+]/g, ""))} autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Name</label>
            <input className={inputCls} placeholder="Customer name"
              value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Email</label>
            <input className={inputCls} placeholder="email@example.com" type="email"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">App password (optional)</label>
            <input className={inputCls} placeholder="Lets them log in to the app"
              value={password} onChange={e => setPassword(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={close} disabled={saving}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-sm font-semibold text-white disabled:opacity-40">
            {saving ? "Creating…" : "Create Customer"}
          </button>
        </div>
      </div>
    </div>
  );
}
