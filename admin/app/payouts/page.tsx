"use client";
import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import api from "@/lib/api";
import { RefreshCw, Banknote, X } from "lucide-react";

type StoreRow = {
  store_id: string; vendor_code: string; name: string;
  pending_payout: number; total_earnings: number;
  bank_account_number: string | null; bank_ifsc: string | null; bank_account_holder: string | null;
};
type PayoutRow = {
  id: string; store_id: string; store_name: string; vendor_code: string;
  amount: number; reference: string; note: string; status: string; created_at: string;
};

function fmtDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PayoutsPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [history, setHistory] = useState<PayoutRow[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [loading, setLoading] = useState(true);

  const [settleStore, setSettleStore] = useState<StoreRow | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/payouts");
      setStores(res.data.stores || []);
      setHistory(res.data.history || []);
      setTotalPending(res.data.total_pending || 0);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openSettle = (s: StoreRow) => {
    setSettleStore(s);
    setAmount(String(s.pending_payout || 0));
    setReference("");
    setNote("");
  };

  const handleSettle = async () => {
    if (!settleStore) return;
    setSubmitting(true);
    try {
      await api.post(`/admin/payouts/${settleStore.store_id}/settle`, {
        amount: parseFloat(amount), reference, note,
      });
      setSettleStore(null);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Failed to settle payout");
    } finally { setSubmitting(false); }
  };

  return (
    <PageLayout title="Payouts">
      <div className="flex justify-between items-center mb-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
          <div className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Total Pending Payouts</div>
          <div className="text-2xl font-extrabold text-amber-900">₹{totalPending.toFixed(2)}</div>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Stores with pending payouts */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100 font-bold text-gray-900">Store Balances</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                {["Store", "Vendor", "Bank", "Lifetime Earned", "Pending", "Action"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">Loading...</td></tr>
              ) : stores.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">No stores found</td></tr>
              ) : stores.map(s => (
                <tr key={s.store_id} className="hover:bg-amber-50/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-xs font-mono text-amber-700">{s.vendor_code}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {s.bank_account_number ? (
                      <div>
                        <div>{s.bank_account_holder || "—"}</div>
                        <div className="font-mono">{s.bank_account_number} · {s.bank_ifsc}</div>
                      </div>
                    ) : <span className="text-red-400">No bank details</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">₹{s.total_earnings.toFixed(0)}</td>
                  <td className="px-4 py-3 font-bold text-amber-700">₹{s.pending_payout.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openSettle(s)}
                      disabled={s.pending_payout <= 0}
                      className="flex items-center gap-1.5 text-xs bg-green-600 disabled:opacity-30 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                    >
                      <Banknote size={12} /> Settle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payout history */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 font-bold text-gray-900">Settlement History</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                {["Date", "Store", "Amount", "Reference", "Note"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">No payouts settled yet</td></tr>
              ) : history.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(p.created_at)}</td>
                  <td className="px-4 py-3 text-gray-800">{p.store_name} <span className="text-xs font-mono text-amber-700">({p.vendor_code})</span></td>
                  <td className="px-4 py-3 font-semibold text-green-700">₹{p.amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{p.reference || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settle modal */}
      {settleStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSettleStore(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Settle Payout</h3>
              <button onClick={() => setSettleStore(null)} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="text-sm text-gray-600 mb-4">
              {settleStore.name} <span className="font-mono text-amber-700">({settleStore.vendor_code})</span>
              <div className="text-xs text-gray-400 mt-0.5">Pending: ₹{settleStore.pending_payout.toFixed(2)}</div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Amount (₹)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Bank Reference / UTR</label>
                <input type="text" value={reference} onChange={e => setReference(e.target.value)}
                  placeholder="e.g. UTR123456789" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Note (optional)</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setSettleStore(null)} className="flex-1 border border-gray-200 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSettle} disabled={submitting || !amount}
                className="flex-1 bg-green-600 disabled:opacity-40 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">
                {submitting ? "Settling..." : "Record Payout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
