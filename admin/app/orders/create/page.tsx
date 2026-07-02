"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  UserSearch, Plus, Trash2, ShoppingBag, Receipt, Tags, CheckCircle2,
  Loader2, PackagePlus,
} from "lucide-react";
import PageLayout from "@/components/PageLayout";
import api from "@/lib/api";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type CatalogItem = { id: string; name: string; price: number; category?: string };
type Service = { id: string; name: string; slug: string; pricing_unit?: string; items: CatalogItem[] };
type Store = { id: string; name: string; vendor_code: string; status: string };
type Line = {
  service_id: string; item_id: string;
  service_name: string; item_name: string;
  price: number; quantity: number;
  unit: string; // "piece" | "kg" | ...
};

// Display helper: 2.5 → "2.5 kg", 2 → "2 kg"
const fmtKg = (q: number) => `${Number(q.toFixed(3))} kg`;
type Coupon = {
  id: string; code: string; name: string; type: "percent" | "flat";
  value: number; min_order: number; max_discount: number | null;
  usage_limit: number | null; used_count: number; valid_to: string | null; active: boolean;
};
type CreateResult = {
  id: string; order_number: string; total_amount: number; subtotal: number;
  delivery_fee: number; discount: number; payment_status: string;
  coupon_code?: string | null; coupon_discount?: number;
  customer_name: string | null; customer_has_login: boolean;
  store_name: string | null; tag_count: number;
};

const FREE_DELIVERY_THRESHOLD = 299;
const DELIVERY_FEE = 40;
const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500";

export default function CreateOrderPage() {
  // customer
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lookup, setLookup] = useState<{ found: boolean; name?: string | null; has_login?: boolean } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // catalog + cart
  const [services, setServices] = useState<Service[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [svcId, setSvcId] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1"); // string so the field can be cleared while typing
  const [wKg, setWKg] = useState("1"); // weight entry for kg-priced services
  const [wG, setWG] = useState("0");  // grams part (0-999)
  const [lines, setLines] = useState<Line[]>([]);

  // options
  const [fulfillment, setFulfillment] = useState<"counter_pickup" | "rider_delivery">("counter_pickup");
  const [payment, setPayment] = useState<"cash" | "upi" | "card" | "online">("cash");
  const [paymentTiming, setPaymentTiming] = useState<"pay_now" | "pay_on_delivery">("pay_now");
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState("");
  const [instructions, setInstructions] = useState("");
  const [addr, setAddr] = useState({ full_address: "", city: "" });

  // submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CreateResult | null>(null);

  useEffect(() => {
    api.get("/admin/services").then((r) => setServices(r.data || [])).catch(() => {});
    api.get("/admin/stores").then((r) => setStores(r.data || [])).catch(() => {});
    api.get("/admin/coupons").then((r) => setCoupons(r.data || [])).catch(() => {});
  }, []);

  const activeService = useMemo(() => services.find((s) => s.id === svcId), [services, svcId]);

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
    [lines],
  );
  const deliveryFee = fulfillment === "rider_delivery" && subtotal < FREE_DELIVERY_THRESHOLD ? DELIVERY_FEE : 0;

  // Only offer coupons that are active, not expired, and not fully used.
  const now = Date.now();
  const selectableCoupons = useMemo(() => coupons.filter((c) =>
    c.active &&
    (!c.valid_to || new Date(c.valid_to).getTime() >= now) &&
    (!c.usage_limit || c.used_count < c.usage_limit)
  ), [coupons, now]);
  const selectedCoupon = useMemo(() => selectableCoupons.find((c) => c.code === couponCode) || null, [selectableCoupons, couponCode]);

  // Client-side PREVIEW of the coupon discount; the backend recomputes the
  // authoritative amount and enforces all rules at create time.
  const couponEligible = selectedCoupon ? subtotal >= (selectedCoupon.min_order || 0) : false;
  const couponDiscount = useMemo(() => {
    if (!selectedCoupon || !couponEligible) return 0;
    if (selectedCoupon.type === "percent") {
      const raw = subtotal * (selectedCoupon.value / 100);
      const cap = selectedCoupon.max_discount;
      return Math.round(cap && cap > 0 ? Math.min(raw, cap) : raw);
    }
    return Math.round(Math.min(selectedCoupon.value, subtotal));
  }, [selectedCoupon, couponEligible, subtotal]);

  const manualDiscount = Math.max(0, Number(discount) || 0);
  const discountNum = Math.min(couponDiscount + manualDiscount, subtotal);
  const total = Math.max(0, Math.round(subtotal + deliveryFee - discountNum));
  const totalGarments = lines.filter((l) => l.unit !== "kg").reduce((n, l) => n + l.quantity, 0);
  const totalWeight = lines.filter((l) => l.unit === "kg").reduce((n, l) => n + l.quantity, 0);
  const subtotalLabel = [
    totalGarments ? `${totalGarments} garment${totalGarments === 1 ? "" : "s"}` : "",
    totalWeight ? fmtKg(totalWeight) : "",
  ].filter(Boolean).join(" + ") || "empty";

  const doLookup = async () => {
    if (phone.replace(/\D/g, "").length < 10) { setError("Enter a valid 10-digit phone"); return; }
    setError(""); setLookingUp(true);
    try {
      const r = await api.get(`/admin/customers/lookup?phone=${encodeURIComponent(phone)}`);
      setLookup(r.data);
      if (r.data?.found && r.data?.name) setName(r.data.name);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Lookup failed");
    } finally { setLookingUp(false); }
  };

  const isKgService = activeService?.pricing_unit === "kg";

  const addLine = () => {
    if (!activeService || !itemId) return;
    const it = activeService.items.find((i) => i.id === itemId);
    if (!it) return;
    const unit = activeService.pricing_unit === "kg" ? "kg" : "piece";
    let q: number;
    if (unit === "kg") {
      // kg + grams → fractional quantity (min 100 g)
      q = Math.max(0.1, (parseInt(wKg, 10) || 0) + (parseInt(wG, 10) || 0) / 1000);
      q = Number(q.toFixed(3));
    } else {
      q = Math.max(1, parseInt(qty, 10) || 1);
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.service_id === svcId && l.item_id === itemId);
      if (existing) {
        return prev.map((l) =>
          l.service_id === svcId && l.item_id === itemId
            ? { ...l, quantity: Number((l.quantity + q).toFixed(3)) } : l,
        );
      }
      return [...prev, {
        service_id: svcId, item_id: itemId,
        service_name: activeService.name, item_name: it.name,
        price: it.price, quantity: q, unit,
      }];
    });
    setItemId(""); setQty("1"); setWKg("1"); setWG("0");
  };

  // Accept the raw input so the field can be emptied mid-edit; 0 means "being
  // cleared" and renders blank. clampLineQty (onBlur) restores the minimum.
  const setLineQty = (i: number, raw: string) =>
    setLines((prev) => prev.map((l, idx) => {
      if (idx !== i) return l;
      if (raw === "") return { ...l, quantity: 0 };
      const n = Number(raw) || 0;
      return { ...l, quantity: l.unit === "kg" ? Math.max(0, n) : Math.max(0, Math.floor(n)) };
    }));
  const clampLineQty = (i: number) =>
    setLines((prev) => prev.map((l, idx) => (idx === i
      ? { ...l, quantity: l.unit === "kg" ? Math.max(0.1, Number(l.quantity.toFixed(3))) : Math.max(1, l.quantity) }
      : l)));
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    setError("");
    if (phone.replace(/\D/g, "").length < 10) { setError("Enter a valid 10-digit customer phone"); return; }
    if (lines.length === 0) { setError("Add at least one item"); return; }
    if (fulfillment === "rider_delivery" && !addr.full_address.trim()) {
      setError("Home delivery needs a delivery address");
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        customer_phone: phone,
        customer_name: name || undefined,
        customer_password: password || undefined,
        customer_email: email || undefined,
        items: lines.map((l) => ({ service_id: l.service_id, item_id: l.item_id, quantity: l.quantity })),
        fulfillment_mode: fulfillment,
        payment_method: payment,
        payment_timing: paymentTiming,
        store_id: storeId || undefined,
        special_instructions: instructions || undefined,
        coupon_code: couponCode || undefined,
        discount: manualDiscount || undefined,
      };
      if (fulfillment === "rider_delivery") {
        // No coordinates — riders navigate by the address text; the backend
        // falls back to the store's location for the map pin.
        payload.address = { full_address: addr.full_address.trim(), city: addr.city, label: "Delivery" };
      }
      const r = await api.post("/admin/orders/create", payload);
      setResult(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to create order");
    } finally { setSubmitting(false); }
  };

  const openPdf = async (path: string) => {
    const token = localStorage.getItem("admin_token");
    const res = await fetch(`${BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) { alert("Failed to load PDF"); return; }
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
  };

  const resetAll = () => {
    setPhone(""); setName(""); setEmail(""); setPassword(""); setLookup(null);
    setLines([]); setSvcId(""); setItemId(""); setQty("1"); setStoreId("");
    setFulfillment("counter_pickup"); setPayment("cash"); setPaymentTiming("pay_now");
    setCouponCode(""); setDiscount(""); setInstructions("");
    setAddr({ full_address: "", city: "" });
    setWKg("1"); setWG("0");
    setResult(null); setError("");
  };

  // ---------- success screen ----------
  if (result) {
    return (
      <PageLayout title="New Order">
        <div className="max-w-xl">
          <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm text-center">
            <div className="inline-flex w-14 h-14 rounded-full bg-amber-500/15 text-amber-600 items-center justify-center mb-4">
              <CheckCircle2 size={30} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Order created</h2>
            <p className="text-3xl font-extrabold text-forest mt-2">{result.order_number}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Stat label="Total" value={`₹${result.total_amount}`} />
              <Stat label="Garment tags" value={String(result.tag_count)} />
              <Stat label="Customer" value={result.customer_name || "—"} />
              <Stat label="Payment" value={result.payment_status} />
            </div>
            <p className="mt-3 text-xs text-gray-500">
              {result.customer_has_login
                ? "Customer can sign in to the app with their phone + password."
                : "No app login set for this customer (counter-only)."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button onClick={() => openPdf(`/orders/${result.id}/tags/pdf`)}
                className="inline-flex items-center gap-2 bg-amber-500 text-forest px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-amber-400">
                <Tags size={16} /> Print tags
              </button>
              <button onClick={() => openPdf(`/orders/${result.id}/invoice/pdf`)}
                className="inline-flex items-center gap-2 bg-forest text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90">
                <Receipt size={16} /> Print invoice
              </button>
              <Link href="/orders"
                className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                <ShoppingBag size={16} /> View orders
              </Link>
            </div>
            <button onClick={resetAll} className="mt-4 text-sm font-semibold text-amber-600 hover:underline">
              + Create another order
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // ---------- form ----------
  return (
    <PageLayout title="New Order">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 max-w-5xl">
        <div className="space-y-5">
          {/* Customer */}
          <Section icon={<UserSearch size={14} />} title="Customer">
            <div className="flex gap-2">
              <input className={inputCls} placeholder="Customer phone (10-digit)" inputMode="numeric"
                value={phone} maxLength={13}
                onChange={(e) => { setPhone(e.target.value); setLookup(null); }} />
              <button onClick={doLookup} disabled={lookingUp}
                className="shrink-0 inline-flex items-center gap-1.5 border border-gray-200 px-3 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                {lookingUp ? <Loader2 size={15} className="animate-spin" /> : <UserSearch size={15} />} Look up
              </button>
            </div>
            {lookup && (
              <p className={`mt-2 text-xs font-medium ${lookup.found ? "text-emerald-700" : "text-amber-600"}`}>
                {lookup.found
                  ? `Existing customer${lookup.has_login ? " · has app login" : " · no login yet"}`
                  : "New customer — fill the details below to create them"}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input className={inputCls} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className={inputCls} placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {!lookup?.has_login && (
              <input className={`${inputCls} mt-2`} placeholder="Set app password (optional — gives them a login)"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
          </Section>

          {/* Items */}
          <Section icon={<PackagePlus size={14} />} title="Items">
            <div className={`grid grid-cols-1 gap-2 ${isKgService ? "sm:grid-cols-[1fr_1fr_150px_auto]" : "sm:grid-cols-[1fr_1fr_70px_auto]"}`}>
              <select className={inputCls} value={svcId} onChange={(e) => { setSvcId(e.target.value); setItemId(""); }}>
                <option value="">Service…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.pricing_unit === "kg" ? " (per kg)" : ""}</option>
                ))}
              </select>
              <select className={inputCls} value={itemId} onChange={(e) => setItemId(e.target.value)} disabled={!activeService}>
                <option value="">Item…</option>
                {activeService?.items.map((it) => (
                  <option key={it.id} value={it.id}>{it.name} — ₹{it.price}{isKgService ? "/kg" : ""}</option>
                ))}
              </select>
              {isKgService ? (
                <div className="grid grid-cols-2 gap-1">
                  <div className="relative">
                    <input type="number" min={0} className={`${inputCls} pr-7`} value={wKg}
                      onChange={(e) => setWKg(e.target.value.replace(/[^\d]/g, ""))} />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">kg</span>
                  </div>
                  <div className="relative">
                    <input type="number" min={0} max={999} step={50} className={`${inputCls} pr-5`} value={wG}
                      onChange={(e) => setWG(e.target.value.replace(/[^\d]/g, "").slice(0, 3))} />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">g</span>
                  </div>
                </div>
              ) : (
                <input type="number" min={1} className={inputCls} value={qty}
                  onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ""))}
                  onBlur={() => setQty((q) => String(Math.max(1, parseInt(q, 10) || 1)))} />
              )}
              <button onClick={addLine} disabled={!itemId}
                className="inline-flex items-center justify-center gap-1 bg-amber-500 text-forest px-3 rounded-lg text-sm font-semibold hover:bg-amber-400 disabled:opacity-40">
                <Plus size={15} /> Add
              </button>
            </div>
            {isKgService && (
              <p className="mt-1.5 text-[11px] text-gray-400">Weight-priced service — enter kg and grams; the price is per kilogram.</p>
            )}

            {lines.length === 0 ? (
              <p className="text-sm text-gray-400 mt-3">No items yet. Pick a service & item above.</p>
            ) : (
              <div className="mt-3 divide-y divide-gray-100">
                {lines.map((l, i) => (
                  <div key={`${l.service_id}-${l.item_id}`} className="flex items-center gap-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-gray-400 uppercase">{l.service_name}</div>
                      <div className="text-sm text-gray-800 truncate">
                        {l.item_name} · ₹{l.price}{l.unit === "kg" ? "/kg" : ""}
                      </div>
                    </div>
                    <div className="relative">
                      <input type="number" min={l.unit === "kg" ? 0.1 : 1} step={l.unit === "kg" ? 0.1 : 1}
                        value={l.quantity === 0 ? "" : l.quantity}
                        onChange={(e) => setLineQty(i, e.target.value)}
                        onBlur={() => clampLineQty(i)}
                        className={`${l.unit === "kg" ? "w-20 pr-7" : "w-14"} border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-amber-500`} />
                      {l.unit === "kg" && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">kg</span>
                      )}
                    </div>
                    <div className="w-16 text-right text-sm font-semibold text-gray-700">₹{Math.round(l.price * l.quantity)}</div>
                    <button onClick={() => removeLine(i)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Options */}
          <Section icon={<ShoppingBag size={14} />} title="Store, fulfillment & payment">
            <div className="mb-3">
              <Label>Store</Label>
              <select className={inputCls} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                <option value="">Auto — default store</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.vendor_code}){s.status !== "active" ? " · inactive" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fulfillment</Label>
                <select className={inputCls} value={fulfillment} onChange={(e) => setFulfillment(e.target.value as any)}>
                  <option value="counter_pickup">Counter pickup</option>
                  <option value="rider_delivery">Home delivery</option>
                </select>
              </div>
              <div>
                <Label>Payment method</Label>
                <select className={inputCls} value={payment} onChange={(e) => setPayment(e.target.value as any)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="online">Online link</option>
                </select>
              </div>
            </div>
            <div className="mt-3">
              <Label>Payment timing</Label>
              <div className="grid grid-cols-2 gap-2">
                {([["pay_now", "Pay now", "Marks the order paid"],
                   ["pay_on_delivery", "Pay on delivery", "Collected later — stays pending"]] as const).map(([val, title, sub]) => (
                  <button key={val} type="button" onClick={() => setPaymentTiming(val)}
                    className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                      paymentTiming === val ? "border-amber-500 bg-amber-50" : "border-gray-200 hover:bg-gray-50"}`}>
                    <div className="text-sm font-semibold text-gray-800">{title}</div>
                    <div className="text-[11px] text-gray-500">{sub}</div>
                  </button>
                ))}
              </div>
            </div>
            {fulfillment === "rider_delivery" && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <input className={`${inputCls} col-span-2`} placeholder="Full delivery address (house, street, landmark)"
                  value={addr.full_address} onChange={(e) => setAddr({ ...addr, full_address: e.target.value })} />
                <input className={inputCls} placeholder="City" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
              </div>
            )}
            <div className="mt-3">
              <Label>Special instructions</Label>
              <textarea className={`${inputCls} resize-none`} rows={2} value={instructions}
                onChange={(e) => setInstructions(e.target.value)} placeholder="Optional notes for the order" />
            </div>
          </Section>
        </div>

        {/* Bill summary */}
        <div className="lg:sticky lg:top-6 h-fit">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Receipt size={13} /> Bill
            </div>
            <Row label={`Subtotal (${subtotalLabel})`} value={`₹${Math.round(subtotal)}`} />
            <Row label="Delivery fee" value={deliveryFee ? `₹${deliveryFee}` : "Free"} />

            {/* Coupon */}
            <div className="py-1.5">
              <span className="text-sm text-gray-500">Coupon</span>
              <select className={`${inputCls} mt-1`} value={couponCode} onChange={(e) => setCouponCode(e.target.value)}>
                <option value="">No coupon</option>
                {selectableCoupons.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.code} — {c.type === "percent" ? `${c.value}% off` : `₹${c.value} off`}
                    {c.min_order ? ` (min ₹${c.min_order})` : ""}
                  </option>
                ))}
              </select>
              {selectedCoupon && !couponEligible && (
                <p className="text-[11px] text-amber-600 mt-1">Min order ₹{selectedCoupon.min_order} not met — coupon won&apos;t apply.</p>
              )}
              {selectedCoupon && couponEligible && (
                <p className="text-[11px] text-emerald-600 mt-1">−₹{couponDiscount} from {selectedCoupon.code}</p>
              )}
            </div>
            {couponDiscount > 0 && <Row label="Coupon discount" value={`−₹${couponDiscount}`} />}

            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-500">Manual discount ₹</span>
              <input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)}
                placeholder="0" className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:border-amber-500" />
            </div>
            <div className="flex justify-between items-center border-t border-gray-200 mt-2 pt-3">
              <span className="font-bold text-gray-900">Total</span>
              <span className="text-2xl font-extrabold text-forest">₹{total}</span>
            </div>

            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

            <button onClick={submit} disabled={submitting}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-amber-500 text-forest font-bold py-3 rounded-xl text-sm hover:bg-amber-400 disabled:opacity-40">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {submitting ? "Creating…" : "Create order"}
            </button>
            <p className="mt-2 text-[11px] text-gray-400 text-center">
              Generates garment tags + a GST invoice. Customer & store are notified.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}
const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] font-semibold text-gray-400 uppercase mb-1">{children}</div>
);
const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-500">{label}</span><span className="text-gray-800 font-medium">{value}</span></div>
);
const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-gray-50 rounded-xl p-3 text-left">
    <div className="text-[11px] text-gray-400 uppercase">{label}</div>
    <div className="text-sm font-bold text-gray-800 truncate">{value}</div>
  </div>
);
