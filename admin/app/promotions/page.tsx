"use client";
import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import api from "@/lib/api";
import { Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw, Tag } from "lucide-react";

export default function PromotionsPage() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", type: "percent", value: "", min_order: "0", max_discount: "", usage_limit: "", valid_days: "30" });

  const load = async () => {
    setLoading(true);
    try { const res = await api.get("/admin/coupons"); setCoupons(res.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.code || !form.value) { alert("Code and value are required"); return; }
    try {
      // Max discount is an optional cap that only applies to percent coupons.
      const maxDiscount = form.type === "percent" && form.max_discount.trim() !== ""
        ? parseFloat(form.max_discount) : null;
      await api.post("/admin/coupons", { ...form, value: parseFloat(form.value), min_order: parseFloat(form.min_order), max_discount: maxDiscount, usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null, valid_days: parseInt(form.valid_days) });
      setShowForm(false);
      setForm({ code: "", name: "", type: "percent", value: "", min_order: "0", max_discount: "", usage_limit: "", valid_days: "30" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try { await api.put(`/admin/coupons/${id}`, { active: !active }); load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete coupon "${code}"?`)) return;
    try { await api.delete(`/admin/coupons/${id}`); load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const activeCoupons = coupons.filter(c => c.active && !c.is_referral);
  const referralCoupons = coupons.filter(c => c.is_referral);
  const expiredCoupons = coupons.filter(c => !c.active && !c.is_referral);

  return (
    <PageLayout title="Promotions & Coupons">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Active Coupons", count: activeCoupons.length, color: "bg-green-600" },
          { label: "Referral Coupons", count: referralCoupons.length, color: "bg-purple-600" },
          { label: "Inactive/Expired", count: expiredCoupons.length, color: "bg-gray-500" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm">
            <div className={`${s.color} w-10 h-10 rounded-lg flex items-center justify-center`}>
              <Tag size={18} className="text-white" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">{s.count}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-gray-900">All Coupons</h2>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw size={13} />
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-400 transition-colors">
            <Plus size={15} /> Create Coupon
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-5">
          <h3 className="font-bold text-amber-900 mb-4">New Coupon</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Code *</label>
              <input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})}
                placeholder="SAVE20" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase font-mono focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Name</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                placeholder="Summer Special" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                <option value="percent">Percent (%)</option>
                <option value="flat">Flat (₹)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Value *</label>
              <input type="number" value={form.value} onChange={e => setForm({...form, value: e.target.value})}
                placeholder={form.type === "percent" ? "20" : "100"} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Min Order (₹)</label>
              <input type="number" value={form.min_order} onChange={e => setForm({...form, min_order: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            {form.type === "percent" ? (
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Max Discount (₹) <span className="font-normal text-gray-400">— optional</span></label>
                <input type="number" value={form.max_discount} onChange={e => setForm({...form, max_discount: e.target.value})}
                  placeholder="No cap" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">Max Discount (₹)</label>
                <div className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-400">N/A for flat</div>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Usage Limit</label>
              <input type="number" value={form.usage_limit} onChange={e => setForm({...form, usage_limit: e.target.value})}
                placeholder="Unlimited" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Valid for (days)</label>
              <input type="number" value={form.valid_days} onChange={e => setForm({...form, valid_days: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-400 transition-colors">Create Coupon</button>
            <button onClick={() => setShowForm(false)} className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              {["Code", "Name", "Type", "Value", "Min Order", "Used / Limit", "Expires", "Status", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={9} className="px-6 py-12 text-center text-gray-400">Loading...</td></tr>
            ) : coupons.length === 0 ? (
              <tr><td colSpan={9} className="px-6 py-12 text-center text-gray-400">No coupons yet</td></tr>
            ) : coupons.map(c => (
              <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${!c.active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 font-mono font-bold text-amber-600">{c.code}</td>
                <td className="px-4 py-3 text-gray-700">{c.name}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.type === "percent" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                    {c.type}
                  </span>
                </td>
                <td className="px-4 py-3 font-bold text-gray-900">{c.type === "percent" ? `${c.value}%` : `₹${c.value}`}</td>
                <td className="px-4 py-3 text-gray-500">₹{c.min_order}</td>
                <td className="px-4 py-3 text-gray-500">{c.used_count} / {c.usage_limit ?? "∞"}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {c.valid_to ? new Date(c.valid_to).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </td>
                <td className="px-4 py-3">
                  {c.is_referral ? (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">Referral</span>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!c.is_referral && (
                    <div className="flex gap-1.5">
                      <button onClick={() => handleToggle(c.id, c.active)}
                        className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 px-2.5 py-1 rounded font-semibold transition-colors">
                        {c.active ? "Disable" : "Enable"}
                      </button>
                      <button onClick={() => handleDelete(c.id, c.code)}
                        className="text-xs bg-red-100 text-red-700 hover:bg-red-200 px-2.5 py-1 rounded font-semibold transition-colors">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageLayout>
  );
}
