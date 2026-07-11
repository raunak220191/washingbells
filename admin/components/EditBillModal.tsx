"use client";
import { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2, Receipt } from "lucide-react";
import api from "@/lib/api";

// Extra weight-flow fields (line_id/tentative_qty/actual_qty/weighed_*) ride
// along untyped so an admin bill edit round-trips them instead of wiping them.
type Line = { service_name: string; item_name: string; price: number; quantity: number; unit?: string } & Record<string, unknown>;
type Coupon = { id: string; code: string; type: "percent" | "flat"; value: number; min_order: number; max_discount: number | null; usage_limit: number | null; used_count: number; valid_to: string | null; active: boolean };

type Props = {
  orderId: string;
  initialItems: Line[];
  initialDiscount: number;
  initialCoupon: string | null;
  onClose: () => void;
  onSaved: () => void;
};

const cls = "border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-500";

export default function EditBillModal({ orderId, initialItems, initialDiscount, initialCoupon, onClose, onSaved }: Props) {
  const [lines, setLines] = useState<Line[]>(initialItems.map((l) => ({ ...l })));
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponCode, setCouponCode] = useState(initialCoupon ?? "");
  const [manual, setManual] = useState(String(initialDiscount || ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.get("/admin/coupons").then((r) => setCoupons(r.data || [])).catch(() => {}); }, []);

  const setLine = (i: number, patch: Partial<Line>) => setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((p) => [...p, { service_name: "Service", item_name: "", price: 0, quantity: 1 }]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));

  const subtotal = useMemo(() => lines.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.quantity) || 0), 0), [lines]);
  const now = Date.now();
  const selectable = useMemo(() => coupons.filter((c) => c.active && (!c.valid_to || new Date(c.valid_to).getTime() >= now) && (!c.usage_limit || c.used_count < c.usage_limit)), [coupons, now]);
  const coupon = selectable.find((c) => c.code === couponCode) || (couponCode ? coupons.find((c) => c.code === couponCode) : null);
  const couponOk = coupon ? subtotal >= (coupon.min_order || 0) : false;
  const couponDisc = useMemo(() => {
    if (!coupon || !couponOk) return 0;
    if (coupon.type === "percent") { const raw = subtotal * (coupon.value / 100); const cap = coupon.max_discount; return Math.round(cap && cap > 0 ? Math.min(raw, cap) : raw); }
    return Math.round(Math.min(coupon.value, subtotal));
  }, [coupon, couponOk, subtotal]);
  const manualDisc = Math.max(0, Number(manual) || 0);
  const discount = Math.min(couponDisc + manualDisc, subtotal);
  const total = Math.max(0, Math.round(subtotal - discount));

  const save = async () => {
    const items = lines.filter((l) => l.item_name.trim() && Number(l.quantity) > 0).map((l) => ({ ...l, service_name: l.service_name, item_name: l.item_name, price: Number(l.price) || 0, quantity: Number(l.quantity) || 0, unit: l.unit || "piece" }));
    if (items.length === 0) { setError("A bill needs at least one item"); return; }
    setSaving(true); setError("");
    try {
      const r = await api.put(`/admin/orders/${orderId}/bill`, { items, coupon_code: couponCode || undefined, discount: manualDisc || undefined });
      if (r.data?.warning) alert(r.data.warning);
      onSaved(); onClose();
    } catch (e: any) { setError(e?.response?.data?.detail || "Failed to update bill"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !saving && onClose()} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Receipt size={18} className="text-amber-600" /> Edit Bill</h2>
          <button onClick={() => !saving && onClose()} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_56px_auto] gap-2 items-center">
              <input className={cls} placeholder="Item name" value={l.item_name} onChange={(e) => setLine(i, { item_name: e.target.value })} />
              <input className={`${cls} text-right`} type="number" min={0} placeholder="₹" value={l.price} onChange={(e) => setLine(i, { price: Number(e.target.value) })} />
              <div className="relative">
                <input className={`${cls} w-full text-center ${l.unit === "kg" ? "pr-6" : ""}`} type="number"
                  min={l.unit === "kg" ? 0.1 : 1} step={l.unit === "kg" ? 0.1 : 1} value={l.quantity}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const n = raw === "" ? 0 : Math.max(0, Number(raw) || 0);
                    setLine(i, { quantity: l.unit === "kg" ? n : Math.floor(n) });
                  }}
                  onBlur={() => setLine(i, { quantity: l.unit === "kg" ? Math.max(0.1, l.quantity) : Math.max(1, l.quantity) })} />
                {l.unit === "kg" && <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">kg</span>}
              </div>
              <button onClick={() => removeLine(i)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <button onClick={addLine} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-600 hover:underline"><Plus size={14} /> Add item</button>

        <div className="mt-4 border-t border-gray-100 pt-3 space-y-2">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Coupon</label>
            <select className={`${cls} w-full`} value={couponCode} onChange={(e) => setCouponCode(e.target.value)}>
              <option value="">No coupon</option>
              {selectable.map((c) => <option key={c.id} value={c.code}>{c.code} — {c.type === "percent" ? `${c.value}%` : `₹${c.value}`} off{c.min_order ? ` (min ₹${c.min_order})` : ""}</option>)}
            </select>
            {coupon && !couponOk && <p className="text-[11px] text-amber-600 mt-1">Min order ₹{coupon.min_order} not met — won&apos;t apply.</p>}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Manual discount ₹</span>
            <input className={`${cls} w-24 text-right`} type="number" min={0} value={manual} onChange={(e) => setManual(e.target.value)} placeholder="0" />
          </div>
        </div>

        <div className="mt-4 bg-gray-50 rounded-xl p-3 text-sm space-y-1">
          <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>₹{Math.round(subtotal)}</span></div>
          {discount > 0 && <div className="flex justify-between text-green-700"><span>Discount{coupon && couponOk ? ` (${coupon.code})` : ""}</span><span>−₹{Math.round(discount)}</span></div>}
          <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1"><span>Total</span><span>₹{total}</span></div>
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={() => !saving && onClose()} disabled={saving} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-sm font-semibold text-white disabled:opacity-40">{saving ? "Saving…" : "Save bill"}</button>
        </div>
      </div>
    </div>
  );
}
