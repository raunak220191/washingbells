"use client";
import { useEffect, useState, useCallback } from "react";
import PageLayout from "@/components/PageLayout";
import api from "@/lib/api";
import {
  RefreshCw, X, Search, Filter, ChevronLeft, ChevronRight,
  Image as ImageIcon, ExternalLink,
} from "lucide-react";

type PhotoItem = {
  id: string;
  url: string;
  context: string;
  size: number;
  filename: string;
  created_at: string;
  uploader: { id: string; name: string | null; phone: string; role: string } | null;
  order: { id: string; order_number: string; status: string; store_id: string | null } | null;
};

const PAGE_SIZE = 30;

const CONTEXT_OPTIONS = [
  { value: "pickup_proof", label: "Pickup Proof" },
  { value: "delivery_proof", label: "Delivery Proof" },
  { value: "general", label: "General Uploads" },
  { value: "", label: "All Contexts" },
];

// Lazy-loading photo thumbnail — fetches /upload/{id} once when scrolled near
function LazyThumb({ uploadId, onClick }: { uploadId: string; onClick: () => void }) {
  const [data, setData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/upload/${uploadId}`)
      .then(res => { if (!cancelled) setData(res.data?.data || null); })
      .catch(() => { if (!cancelled) setErrored(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uploadId]);

  return (
    <button
      onClick={onClick}
      disabled={!data}
      className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:ring-2 hover:ring-amber-400 transition disabled:cursor-default"
    >
      {data ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-300">
          {loading ? <span className="text-xs">…</span> : errored ? <span className="text-xs">!</span> : <ImageIcon size={24} />}
        </div>
      )}
    </button>
  );
}

function Lightbox({ uploadId, onClose }: { uploadId: string | null; onClose: () => void }) {
  const [data, setData] = useState<string | null>(null);
  useEffect(() => {
    if (!uploadId) { setData(null); return; }
    api.get(`/upload/${uploadId}`)
      .then(res => setData(res.data?.data || null))
      .catch(() => setData(null));
  }, [uploadId]);
  if (!uploadId) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-6 right-6 text-white p-2 hover:bg-white/10 rounded-full"><X size={24} /></button>
      {data ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data} alt="" className="max-w-[90vw] max-h-[90vh] object-contain" />
      ) : (
        <span className="text-white text-sm">Loading...</span>
      )}
    </div>
  );
}

export default function PhotoAuditPage() {
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Filters
  const [context, setContext] = useState("pickup_proof");
  const [orderNumber, setOrderNumber] = useState("");
  const [storeId, setStoreId] = useState("");
  const [riderId, setRiderId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Filter dropdown helpers — list stores/riders for selection
  const [stores, setStores] = useState<{ id: string; name: string; vendor_code: string }[]>([]);
  const [riders, setRiders] = useState<{ id: string; name: string | null; phone: string }[]>([]);

  const load = useCallback(async (newSkip = 0) => {
    setLoading(true);
    try {
      const params: any = { limit: PAGE_SIZE, skip: newSkip, context: context || undefined };
      if (orderNumber.trim()) params.order_number = orderNumber.trim();
      if (storeId) params.store_id = storeId;
      if (riderId) params.rider_id = riderId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get("/admin/photos", { params });
      setItems(res.data?.items || []);
      setTotal(res.data?.total || 0);
      setSkip(newSkip);
    } finally { setLoading(false); }
  }, [context, orderNumber, storeId, riderId, dateFrom, dateTo]);

  useEffect(() => { load(0); }, []); // initial

  // Load stores + riders once for the dropdowns
  useEffect(() => {
    api.get("/admin/stores").then(r => setStores(r.data || [])).catch(() => {});
    api.get("/admin/riders").then(r => setRiders(r.data || [])).catch(() => {});
  }, []);

  const apply = () => load(0);
  const reset = () => {
    setContext("pickup_proof"); setOrderNumber(""); setStoreId("");
    setRiderId(""); setDateFrom(""); setDateTo("");
    setTimeout(() => load(0), 0);
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const start = total === 0 ? 0 : skip + 1;
  const end = Math.min(skip + items.length, total);
  const hasPrev = skip > 0;
  const hasNext = skip + items.length < total;

  return (
    <PageLayout title="Photo Audit">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-gray-500" />
          <h3 className="text-sm font-bold text-gray-800">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <select
            value={context}
            onChange={e => setContext(e.target.value)}
            className="md:col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          >
            {CONTEXT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input
            value={orderNumber}
            onChange={e => setOrderNumber(e.target.value.toUpperCase())}
            placeholder="Order # (e.g. WB-2026-XXXX)"
            className="md:col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber-500"
          />
          <select
            value={storeId}
            onChange={e => setStoreId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">All stores</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.vendor_code} · {s.name}</option>)}
          </select>
          <select
            value={riderId}
            onChange={e => setRiderId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">All riders</option>
            {riders.map(r => <option key={r.id} value={r.id}>{r.name || "—"} ({r.phone})</option>)}
          </select>
          <div className="md:col-span-2 flex items-center gap-2">
            <input
              type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="md:col-span-2 flex gap-2 justify-end">
            <button onClick={reset} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Reset</button>
            <button onClick={apply} className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600">
              <Search size={13} /> Apply
            </button>
          </div>
        </div>
      </div>

      {/* Result bar */}
      <div className="flex items-center gap-3 mb-3">
        <button onClick={() => load(skip)} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw size={13} /> Refresh
        </button>
        <span className="text-sm text-gray-500">
          {total > 0 ? `Showing ${start}–${end} of ${total}` : "No photos match"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => load(Math.max(0, skip - PAGE_SIZE))}
            disabled={!hasPrev || loading}
            className="p-1.5 border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50"
          ><ChevronLeft size={16} /></button>
          <button
            onClick={() => load(skip + PAGE_SIZE)}
            disabled={!hasNext || loading}
            className="p-1.5 border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50"
          ><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Grid */}
      {loading && items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl py-20 text-center text-gray-400 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl py-20 text-center text-gray-400">
          <ImageIcon size={36} className="mx-auto text-gray-300" />
          <p className="text-sm font-semibold mt-3">No photos found</p>
          <p className="text-xs mt-1">Try widening your filters or check a different date range.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <LazyThumb uploadId={item.id} onClick={() => setLightbox(item.id)} />
              <div className="p-2.5 space-y-1">
                {item.order?.order_number ? (
                  <a
                    href={`/orders?order_id=${item.order.id}`}
                    className="text-xs font-mono font-bold text-amber-600 hover:underline flex items-center gap-1"
                  >
                    {item.order.order_number}
                    <ExternalLink size={9} />
                  </a>
                ) : (
                  <div className="text-xs font-mono text-gray-300">—</div>
                )}
                <div className="text-xs text-gray-600 truncate" title={item.uploader?.name || ""}>
                  {item.uploader?.name || <span className="italic text-gray-400">Unknown</span>}
                  {item.uploader?.role && <span className="ml-1 text-xs px-1 bg-gray-100 rounded text-gray-500">{item.uploader.role}</span>}
                </div>
                <div className="text-xs text-gray-400">{fmt(item.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Lightbox uploadId={lightbox} onClose={() => setLightbox(null)} />
    </PageLayout>
  );
}
