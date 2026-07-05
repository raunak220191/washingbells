"use client";
import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import api from "@/lib/api";
import { Save, RefreshCw, UserPlus, Store } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Billing / GST settings (separate endpoint + doc)
  const [billing, setBilling] = useState<Record<string, any>>({});
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingSaved, setBillingSaved] = useState(false);

  // Quick-create rider form
  const [riderForm, setRiderForm] = useState({ name: "", phone: "", vehicle_type: "bike", vehicle_number: "" });
  const [riderLoading, setRiderLoading] = useState(false);

  // Quick-create store form
  const [storeForm, setStoreForm] = useState({ name: "", owner_phone: "", owner_name: "", address: "", city: "Ludhiana", pincode: "", store_phone: "" });
  const [storeLoading, setStoreLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [res, bres] = await Promise.all([
        api.get("/admin/settings"),
        api.get("/admin/billing-settings"),
      ]);
      setSettings(res.data);
      setBilling(bres.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSaveBilling = async () => {
    setBillingSaving(true);
    try {
      await api.put("/admin/billing-settings", billing);
      setBillingSaved(true);
      setTimeout(() => setBillingSaved(false), 3000);
    } catch (e: any) { alert(e?.response?.data?.detail || "Save failed"); }
    finally { setBillingSaving(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/admin/settings", settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { alert(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  const handleCreateRider = async () => {
    if (!riderForm.phone || !riderForm.name) { alert("Name and phone required"); return; }
    setRiderLoading(true);
    try {
      const res = await api.post("/admin/riders/create", riderForm);
      alert(`✅ Rider created! Phone: ${riderForm.phone}\nThey can login with OTP 123456`);
      setRiderForm({ name: "", phone: "", vehicle_type: "bike", vehicle_number: "" });
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setRiderLoading(false); }
  };

  const handleCreateStore = async () => {
    if (!storeForm.name || !storeForm.owner_phone) { alert("Store name and owner phone required"); return; }
    setStoreLoading(true);
    try {
      const res = await api.post("/admin/stores/create", storeForm);
      alert(`✅ Store created!\nVendor Code: ${res.data.vendor_code}\nOwner can login with OTP 123456`);
      setStoreForm({ name: "", owner_phone: "", owner_name: "", address: "", city: "Ludhiana", pincode: "", store_phone: "" });
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setStoreLoading(false); }
  };

  const Field = ({ label, field, type = "number", suffix = "" }: { label: string; field: string; type?: string; suffix?: string }) => (
    <div>
      <label className="text-xs font-semibold text-gray-500 block mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type={type}
          value={settings[field] ?? ""}
          onChange={e => setSettings({...settings, [field]: type === "number" ? parseFloat(e.target.value) : e.target.value})}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
        />
        {suffix && <span className="text-sm text-gray-500 flex-shrink-0">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <PageLayout title="Platform Settings">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Platform Settings */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Pricing & Fees</h2>
              <button onClick={load} className="text-gray-400 hover:text-gray-600"><RefreshCw size={14} /></button>
            </div>
            {loading ? (
              <div className="p-6 text-center text-gray-400">Loading...</div>
            ) : (
              <div className="p-6 grid grid-cols-2 gap-4">
                <Field label="Delivery Fee (₹)" field="delivery_fee" suffix="₹" />
                <Field label="Free Delivery Threshold (₹)" field="free_delivery_threshold" suffix="₹" />
                <Field label="Platform Commission (%)" field="platform_commission_pct" suffix="%" />
                <Field label="Platform Fee (flat ₹ per order, 0 = none)" field="platform_fee" suffix="₹" />
                <Field label="Rider Pickup Fee (₹)" field="rider_pickup_fee" suffix="₹" />
                <Field label="Rider Delivery Fee (₹)" field="rider_delivery_fee" suffix="₹" />
                <Field label="Minimum Order Value (₹)" field="min_order_value" suffix="₹" />
                <Field label="Express Surcharge (%)" field="express_surcharge_pct" suffix="%" />
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Referral Rewards</h2>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <Field label="New User Discount (%)" field="referral_new_user_pct" suffix="%" />
              <Field label="Referrer Reward (%)" field="referral_referrer_pct" suffix="%" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Support Contact</h2>
            </div>
            <div className="p-6 grid grid-cols-1 gap-4">
              <Field label="Support Phone" field="support_phone" type="text" />
              <Field label="Support Email" field="support_email" type="text" />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors ${saved ? "bg-green-600 text-white" : "bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-50"}`}
          >
            <Save size={16} />
            {saved ? "✓ Saved!" : saving ? "Saving..." : "Save All Settings"}
          </button>

          {/* GST / Billing */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">GST / Billing</h2>
              <p className="text-xs text-gray-400 mt-0.5">Applied to invoices. GST is treated as inclusive of order totals.</p>
            </div>
            <div className="p-6 space-y-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={!!billing.gst_enabled}
                  onChange={e => setBilling({ ...billing, gst_enabled: e.target.checked })} className="accent-amber-500" />
                Enable GST on invoices
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">GST Rate (%)</label>
                  <input type="number" value={billing.gst_rate ?? ""}
                    onChange={e => setBilling({ ...billing, gst_rate: parseFloat(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Invoice Prefix</label>
                  <input type="text" value={billing.invoice_prefix ?? ""}
                    onChange={e => setBilling({ ...billing, invoice_prefix: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={!!billing.cgst_sgst_split}
                  onChange={e => setBilling({ ...billing, cgst_sgst_split: e.target.checked })} className="accent-amber-500" />
                Split into CGST + SGST on the invoice (intra-state)
              </label>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Legal Name</label>
                <input type="text" value={billing.legal_name ?? ""}
                  onChange={e => setBilling({ ...billing, legal_name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Invoice Footer</label>
                <input type="text" value={billing.invoice_footer ?? ""}
                  onChange={e => setBilling({ ...billing, invoice_footer: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <button
                onClick={handleSaveBilling}
                disabled={billingSaving}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-colors ${billingSaved ? "bg-green-600 text-white" : "bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-50"}`}
              >
                <Save size={15} />
                {billingSaved ? "✓ Saved!" : billingSaving ? "Saving..." : "Save Billing Settings"}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Create Rider & Store */}
        <div className="space-y-5">
          {/* Create Rider */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <UserPlus size={18} className="text-blue-600" />
              <h2 className="font-bold text-gray-900">Add Rider</h2>
              <span className="ml-auto text-xs text-gray-400">Pre-approved, login with OTP 123456</span>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Full Name *</label>
                  <input value={riderForm.name} onChange={e => setRiderForm({...riderForm, name: e.target.value})}
                    placeholder="Raj Kumar" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Phone (+91...) *</label>
                  <input value={riderForm.phone} onChange={e => setRiderForm({...riderForm, phone: e.target.value})}
                    placeholder="+919876543210" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Vehicle Type</label>
                  <select value={riderForm.vehicle_type} onChange={e => setRiderForm({...riderForm, vehicle_type: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="bike">Bike</option>
                    <option value="auto">Auto</option>
                    <option value="van">Van</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Vehicle Number</label>
                  <input value={riderForm.vehicle_number} onChange={e => setRiderForm({...riderForm, vehicle_number: e.target.value.toUpperCase()})}
                    placeholder="PB10AB1234" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <button onClick={handleCreateRider} disabled={riderLoading || !riderForm.name || !riderForm.phone}
                className="w-full bg-blue-600 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-500 transition-colors flex items-center justify-center gap-2">
                <UserPlus size={15} /> {riderLoading ? "Creating..." : "Create Rider Account"}
              </button>
            </div>
          </div>

          {/* Create Store */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Store size={18} className="text-orange-600" />
              <h2 className="font-bold text-gray-900">Add Store</h2>
              <span className="ml-auto text-xs text-gray-400">Auto-approved & active</span>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Store Name *</label>
                  <input value={storeForm.name} onChange={e => setStoreForm({...storeForm, name: e.target.value})}
                    placeholder="WB Ludhiana South" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Owner Phone (+91...) *</label>
                  <input value={storeForm.owner_phone} onChange={e => setStoreForm({...storeForm, owner_phone: e.target.value})}
                    placeholder="+919876500000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Owner Name</label>
                  <input value={storeForm.owner_name} onChange={e => setStoreForm({...storeForm, owner_name: e.target.value})}
                    placeholder="Suresh Gupta" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">City</label>
                  <input value={storeForm.city} onChange={e => setStoreForm({...storeForm, city: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Address</label>
                  <input value={storeForm.address} onChange={e => setStoreForm({...storeForm, address: e.target.value})}
                    placeholder="Shop 12, Main Market, Ludhiana" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                </div>
              </div>
              <button onClick={handleCreateStore} disabled={storeLoading || !storeForm.name || !storeForm.owner_phone}
                className="w-full bg-orange-600 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-500 transition-colors flex items-center justify-center gap-2">
                <Store size={15} /> {storeLoading ? "Creating..." : "Create Store Account"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
