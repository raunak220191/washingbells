"use client";
import { useEffect, useMemo, useState } from "react";
import PageLayout from "@/components/PageLayout";
import Badge from "@/components/Badge";
import EditBillModal from "@/components/EditBillModal";
import api from "@/lib/api";
import {
  Search, RefreshCw, X, Printer, MapPin, Phone, Truck,
  Tag as TagIcon, Image as ImageIcon, History, Package, Store as StoreIcon, Pencil,
} from "lucide-react";

const STATUSES = [
  "", "placed", "confirmed", "picked_up", "at_store", "processing",
  "ready_for_delivery", "out_for_delivery", "delivered", "cancelled",
];

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type OrderRow = {
  id: string; order_number: string; status: string;
  total_amount: number; payment_method: string; payment_status: string;
  store_id: string | null; pickup_rider_id: string | null; delivery_rider_id: string | null;
  customer_name: string; customer_phone: string;
  items_count: number; created_at: string;
};

type GarmentTag = { tag_code: string; item_name: string; service_name: string; status?: string };

type PhotoRef = { url: string; upload_id?: string | null; size?: number; uploaded_at?: string };

type OrderDetail = {
  id: string; order_number: string; status: string;
  payment_method: string; payment_status: string;
  items: { service_name: string; item_name: string; price: number; quantity: number; subtotal: number }[];
  subtotal: number; delivery_fee: number; discount: number; wallet_applied: number;
  total_amount: number; coupon_code: string | null;
  address: { full_address: string; city: string } | null;
  pickup_slot: { date: string; slot: string } | null;
  delivery_slot: { date: string; slot: string } | null;
  special_instructions: string | null;
  status_timeline: { status: string; timestamp: string; note?: string }[];
  garment_tags: GarmentTag[];
  pickup_proof_photos: PhotoRef[];
  pickup_photos_at: string | null;
  store_photos: PhotoRef[];
  order_source: string;
  fulfillment_mode: string;
  customer: { id: string; name: string | null; phone: string; email: string | null } | null;
  store: { id: string; name: string; vendor_code: string; phone: string } | null;
  pickup_rider: { id: string; name: string | null; phone: string; vehicle_type: string | null; vehicle_number: string | null } | null;
  delivery_rider: { id: string; name: string | null; phone: string; vehicle_type: string | null; vehicle_number: string | null } | null;
  created_at: string; updated_at: string | null; delivered_at: string | null;
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ── Lazy photo thumb: fetches base64 once from /upload/{id} ──
function PhotoThumb({ photo, onClick }: { photo: PhotoRef; onClick: () => void }) {
  const [data, setData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (photo.url?.startsWith("data:")) { setData(photo.url); return; }
    if (!photo.upload_id) return;
    setLoading(true);
    api.get(`/upload/${photo.upload_id}`)
      .then(res => setData(res.data?.data || null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [photo.upload_id, photo.url]);

  return (
    <button
      onClick={onClick}
      disabled={!data}
      className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100 disabled:opacity-60 hover:ring-2 hover:ring-amber-400 transition"
    >
      {data ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data} alt="pickup proof" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {loading ? <span className="text-xs text-gray-400">…</span> : <ImageIcon size={20} className="text-gray-300" />}
        </div>
      )}
    </button>
  );
}

function PhotoLightbox({ photo, onClose }: { photo: PhotoRef | null; onClose: () => void }) {
  const [data, setData] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) return;
    if (photo.url?.startsWith("data:")) { setData(photo.url); return; }
    if (!photo.upload_id) return;
    api.get(`/upload/${photo.upload_id}`)
      .then(res => setData(res.data?.data || null))
      .catch(() => setData(null));
  }, [photo]);
  if (!photo) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-6 right-6 text-white p-2 rounded-full hover:bg-white/10">
        <X size={24} />
      </button>
      {data
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={data} alt="pickup proof" className="max-w-[90vw] max-h-[90vh] object-contain" />
        : <span className="text-white text-sm">Loading...</span>}
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideNote, setOverrideNote] = useState("");
  const [riders, setRiders] = useState<any[]>([]);
  const [lightbox, setLightbox] = useState<PhotoRef | null>(null);
  const [editingBill, setEditingBill] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const url = statusFilter ? `/admin/orders?status_filter=${statusFilter}&limit=100` : "/admin/orders?limit=100";
      const res = await api.get(url);
      setOrders(res.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setOverrideStatus(""); setOverrideNote("");
    try {
      const res = await api.get(`/admin/orders/${id}`);
      setDetail(res.data);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Failed to load order");
      setSelectedId(null);
    } finally { setDetailLoading(false); }
  };

  const filtered = useMemo(() => orders.filter(o =>
    !search || o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_phone?.includes(search)
  ), [orders, search]);

  const handleOverride = async () => {
    if (!overrideStatus || !selectedId) return;
    try {
      await api.put(`/admin/orders/${selectedId}/override-status`, { status: overrideStatus, note: overrideNote || undefined });
      await openDetail(selectedId);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Failed");
    }
  };

  const loadRiders = async () => {
    const res = await api.get("/admin/riders");
    setRiders(res.data);
  };

  const handleAssignRider = async (riderId: string, tripType: string) => {
    if (!selectedId) return;
    try {
      await api.post(`/admin/orders/${selectedId}/assign-rider`, { rider_id: riderId, trip_type: tripType });
      await openDetail(selectedId);
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const handlePrintTags = async () => {
    if (!selectedId || !detail) return;
    // Fetch the PDF with auth header, then open as blob URL — avoids leaking the token in the URL bar.
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const res = await fetch(`${BASE_URL}/orders/${selectedId}/tags/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      // Revoke after a delay so the new tab has time to render
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      alert(`Failed to fetch tag PDF: ${e?.message}`);
    }
  };

  const handleViewInvoice = async () => {
    if (!selectedId) return;
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const res = await fetch(`${BASE_URL}/orders/${selectedId}/invoice/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      alert(`Failed to fetch invoice: ${e?.message}`);
    }
  };

  return (
    <PageLayout title="Orders">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search order # or customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:border-amber-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-amber-500"
        >
          {STATUSES.map(s => <option key={s} value={s}>{s ? s.replace(/_/g, " ").toUpperCase() : "All Statuses"}</option>)}
        </select>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw size={13} /> Refresh
        </button>
        <span className="ml-auto text-sm text-gray-500 self-center">{filtered.length} orders</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                {["Order #", "Customer", "Store", "Rider", "Total", "Status", "Payment", "Date", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-gray-400">No orders found</td></tr>
              ) : filtered.map(order => (
                <tr key={order.id} className="hover:bg-amber-50/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-amber-600 whitespace-nowrap">{order.order_number}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{order.customer_name || "—"}</div>
                    <div className="text-xs text-gray-400">{order.customer_phone}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{order.store_id ? order.store_id.slice(-6) : <span className="text-red-400">Unassigned</span>}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{order.pickup_rider_id ? "✓" : "—"}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">₹{order.total_amount?.toFixed(0)}</td>
                  <td className="px-4 py-3"><Badge value={order.status} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs uppercase">{order.payment_method}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {order.created_at ? new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openDetail(order.id)}
                      className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 px-2.5 py-1 rounded-lg font-semibold transition-colors"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Order Detail Drawer ── */}
      {selectedId && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setSelectedId(null)} />
          <div className="w-[560px] bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900 font-mono">{detail?.order_number || "Loading…"}</h2>
                {detail && (
                  <div className="flex gap-2 mt-1.5 items-center flex-wrap">
                    <Badge value={detail.status} />
                    {detail.order_source === "walk_in" && (
                      <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                        WALK-IN · {detail.fulfillment_mode === "counter_pickup" ? "COUNTER" : "RIDER"}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">₹{detail.total_amount?.toFixed(0)} · {detail.payment_method?.toUpperCase()} ({detail.payment_status})</span>
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedId(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>

            {detailLoading || !detail ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">Loading order…</div>
            ) : (
              <div className="flex-1 p-5 space-y-5">
                {/* Customer */}
                {detail.customer && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Customer</div>
                    <div className="text-sm font-semibold text-gray-900">{detail.customer.name || "—"}</div>
                    <div className="text-xs text-gray-600 font-mono flex items-center gap-1.5 mt-1">
                      <Phone size={11} /> {detail.customer.phone}
                    </div>
                    {detail.customer.email && (
                      <div className="text-xs text-gray-500 mt-1">{detail.customer.email}</div>
                    )}
                  </div>
                )}

                {/* Address & Slots */}
                {detail.address && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Delivery</div>
                    <div className="flex items-start gap-2 text-sm text-gray-800">
                      <MapPin size={14} className="text-amber-500 shrink-0 mt-0.5" />
                      <span>{detail.address.full_address}</span>
                    </div>
                    {detail.pickup_slot && (
                      <div className="text-xs text-gray-500 mt-2">
                        Pickup: {detail.pickup_slot.date} · {detail.pickup_slot.slot}
                      </div>
                    )}
                    {detail.delivery_slot && (
                      <div className="text-xs text-gray-500">
                        Delivery: {detail.delivery_slot.date} · {detail.delivery_slot.slot}
                      </div>
                    )}
                    {detail.special_instructions && (
                      <div className="mt-2 text-xs italic text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-2 py-1.5">
                        “{detail.special_instructions}”
                      </div>
                    )}
                  </div>
                )}

                {/* Store & Riders */}
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <StoreIcon size={11} /> Store
                    </div>
                    {detail.store ? (
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{detail.store.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                          <span className="font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">{detail.store.vendor_code}</span>
                          <span>{detail.store.phone}</span>
                        </div>
                      </div>
                    ) : <span className="text-xs text-red-500 font-semibold">Not assigned</span>}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Truck size={11} /> Riders
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-xs text-blue-700 font-semibold">PICKUP</span>
                        {detail.pickup_rider
                          ? <span className="text-gray-800">{detail.pickup_rider.name} · {detail.pickup_rider.phone}</span>
                          : <span className="text-xs text-gray-400">Not assigned</span>}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-xs text-green-700 font-semibold">DELIVERY</span>
                        {detail.delivery_rider
                          ? <span className="text-gray-800">{detail.delivery_rider.name} · {detail.delivery_rider.phone}</span>
                          : <span className="text-xs text-gray-400">Not assigned</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Package size={11} /> Items ({detail.items?.length || 0})
                  </div>
                  <div className="divide-y divide-gray-200">
                    {(detail.items || []).map((item, i) => (
                      <div key={i} className="flex justify-between py-2 text-sm">
                        <div>
                          <div className="text-xs text-gray-400 uppercase">{item.service_name}</div>
                          <div className="text-gray-800">{item.item_name} × {item.quantity}</div>
                        </div>
                        <div className="font-semibold text-gray-700">₹{item.subtotal?.toFixed(0)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-200 mt-2 pt-2 text-xs text-gray-500 space-y-1">
                    <div className="flex justify-between"><span>Subtotal</span><span>₹{detail.subtotal?.toFixed(0)}</span></div>
                    <div className="flex justify-between"><span>Delivery fee</span><span>₹{detail.delivery_fee?.toFixed(0)}</span></div>
                    {detail.discount > 0 && <div className="flex justify-between text-green-700"><span>Discount {detail.coupon_code && `(${detail.coupon_code})`}</span><span>−₹{detail.discount?.toFixed(0)}</span></div>}
                    {detail.wallet_applied > 0 && <div className="flex justify-between text-purple-700"><span>Wallet</span><span>−₹{detail.wallet_applied?.toFixed(0)}</span></div>}
                    <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200"><span>Total</span><span>₹{detail.total_amount?.toFixed(0)}</span></div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setEditingBill(true)}
                      className="flex items-center justify-center gap-1.5 bg-amber-100 text-amber-700 text-sm font-semibold px-3 py-2 rounded-lg hover:bg-amber-200 transition-colors"
                    >
                      <Pencil size={13} /> Edit Bill
                    </button>
                    <button
                      onClick={handleViewInvoice}
                      className="flex items-center justify-center gap-1.5 bg-green-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Printer size={13} /> GST Invoice
                    </button>
                  </div>
                </div>

                {/* Garment Tags */}
                {detail.garment_tags && detail.garment_tags.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <TagIcon size={11} /> Garment Tags ({detail.garment_tags.length})
                      </div>
                      <button
                        onClick={handlePrintTags}
                        className="flex items-center gap-1.5 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-amber-600"
                      >
                        <Printer size={12} /> Print PDF
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.garment_tags.slice(0, 12).map((tag, i) => (
                        <span key={i} className="font-mono text-xs bg-white border border-gray-200 text-gray-700 px-2 py-1 rounded">
                          {tag.tag_code}
                        </span>
                      ))}
                      {detail.garment_tags.length > 12 && (
                        <span className="text-xs text-gray-400 self-center">+{detail.garment_tags.length - 12} more</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Pickup Photos */}
                {detail.pickup_proof_photos && detail.pickup_proof_photos.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon size={11} /> Pickup Photos ({detail.pickup_proof_photos.length})
                      </div>
                      {detail.pickup_photos_at && (
                        <span className="text-xs text-gray-400">{formatDateTime(detail.pickup_photos_at)}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {detail.pickup_proof_photos.map((photo, i) => (
                        <PhotoThumb key={photo.upload_id || i} photo={photo} onClick={() => setLightbox(photo)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Store Photos */}
                {detail.store_photos && detail.store_photos.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <ImageIcon size={11} /> Store Photos ({detail.store_photos.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {detail.store_photos.map((photo, i) => (
                        <PhotoThumb key={photo.upload_id || i} photo={photo} onClick={() => setLightbox(photo)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Status Timeline */}
                {detail.status_timeline && detail.status_timeline.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <History size={11} /> Status Timeline
                    </div>
                    <div className="space-y-2.5 max-h-64 overflow-y-auto">
                      {detail.status_timeline.map((t, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                          <div className="flex-1">
                            <div className="text-xs font-bold text-gray-800 uppercase">{t.status?.replace(/_/g, " ")}</div>
                            {t.note && <div className="text-xs text-gray-600 mt-0.5">{t.note}</div>}
                            <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(t.timestamp)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin Actions */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-4">
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Override Status</div>
                    <div className="flex gap-2">
                      <select
                        value={overrideStatus}
                        onChange={e => setOverrideStatus(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                      >
                        <option value="">Select new status…</option>
                        {STATUSES.filter(s => s).map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                      </select>
                      <button
                        onClick={handleOverride}
                        disabled={!overrideStatus}
                        className="bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-400 transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                    <input
                      placeholder="Override note (optional)"
                      value={overrideNote}
                      onChange={e => setOverrideNote(e.target.value)}
                      className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Assign Rider</div>
                    {riders.length === 0 ? (
                      <button onClick={loadRiders} className="text-sm text-amber-600 hover:text-amber-700 font-medium">Load riders →</button>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {riders.filter(r => r.rider_approved).map(rider => (
                          <div key={rider.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{rider.name}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${rider.rider_status === "online" ? "bg-green-100 text-green-700" : rider.rider_status === "on_trip" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                                {rider.rider_status}
                              </span>
                            </div>
                            <div className="flex gap-1.5">
                              <button onClick={() => handleAssignRider(rider.id, "pickup")} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold hover:bg-blue-200 transition-colors">Pickup</button>
                              <button onClick={() => handleAssignRider(rider.id, "delivery")} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-semibold hover:bg-green-200 transition-colors">Delivery</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-xs text-gray-400">
                  Order ID: <span className="font-mono">{detail.id}</span> · Placed {formatDateTime(detail.created_at)}
                  {detail.delivered_at && ` · Delivered ${formatDateTime(detail.delivered_at)}`}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <PhotoLightbox photo={lightbox} onClose={() => setLightbox(null)} />

      {editingBill && detail && (
        <EditBillModal
          key={detail.id}
          orderId={detail.id}
          initialItems={(detail.items || []).map((it) => ({
            service_name: it.service_name, item_name: it.item_name, price: it.price, quantity: it.quantity,
          }))}
          initialDiscount={detail.discount || 0}
          initialCoupon={detail.coupon_code}
          onClose={() => setEditingBill(false)}
          onSaved={() => { if (selectedId) openDetail(selectedId); load(); }}
        />
      )}
    </PageLayout>
  );
}
