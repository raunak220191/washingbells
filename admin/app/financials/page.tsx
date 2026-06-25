"use client";
import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import api from "@/lib/api";
import { IndianRupee, TrendingUp, Store, Bike, RefreshCw, PieChart } from "lucide-react";

export default function FinancialsPage() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [dashRes, storeRes, riderRes] = await Promise.all([
        api.get("/admin/dashboard"),
        api.get("/admin/stores"),
        api.get("/admin/riders"),
      ]);
      setDashboard(dashRes.data);
      setStores(storeRes.data);
      setRiders(riderRes.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const totalStorePayout = stores.reduce((s, st) => s + (st.pending_payout || 0), 0);
  const totalRiderEarnings = riders.reduce((s, r) => s + (r.total_earnings || 0), 0);
  const platformNet = (dashboard?.platform_earnings || 0);

  return (
    <PageLayout title="Financials">
      <div className="flex justify-between items-center mb-5">
        <p className="text-sm text-gray-500">Platform financial overview</p>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
              <IndianRupee size={18} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-500">Total Revenue</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">₹{(dashboard?.total_revenue || 0).toFixed(0)}</div>
          <div className="text-xs text-gray-400 mt-1">₹{(dashboard?.revenue_today || 0).toFixed(0)} today</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
              <TrendingUp size={18} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-500">Platform Earnings</span>
          </div>
          <div className="text-2xl font-bold text-purple-700">₹{platformNet.toFixed(0)}</div>
          <div className="text-xs text-gray-400 mt-1">20% of all delivered orders</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <Store size={18} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-500">Store Payouts Due</span>
          </div>
          <div className="text-2xl font-bold text-orange-600">₹{totalStorePayout.toFixed(0)}</div>
          <div className="text-xs text-gray-400 mt-1">{stores.length} stores</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <Bike size={18} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-500">Rider Earnings</span>
          </div>
          <div className="text-2xl font-bold text-blue-700">₹{totalRiderEarnings.toFixed(0)}</div>
          <div className="text-xs text-gray-400 mt-1">₹40/trip · {riders.length} riders</div>
        </div>
      </div>

      {/* Revenue Split Visual */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-8">
        <h3 className="font-bold text-gray-900 mb-4">Revenue Distribution</h3>
        <div className="space-y-3">
          {[
            { label: "Store Owners (80%)", value: (dashboard?.total_revenue || 0) * 0.8, color: "bg-orange-400", pct: 80 },
            { label: "Platform (20%)", value: platformNet, color: "bg-purple-500", pct: 20 },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-4">
              <span className="w-40 text-sm text-gray-600 flex-shrink-0">{item.label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                <div className={`${item.color} h-3 rounded-full transition-all`} style={{ width: `${item.pct}%` }} />
              </div>
              <span className="w-24 text-right text-sm font-bold text-gray-800">₹{item.value.toFixed(0)}</span>
              <span className="text-xs text-gray-400">{item.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Store Payouts Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Store Earnings Breakdown</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              {["Store", "Vendor Code", "City", "Total Earned", "Pending Payout", "Status"].map(h => (
                <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : stores.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No stores yet</td></tr>
            ) : stores.map(store => (
              <tr key={store.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-900">{store.name}</td>
                <td className="px-5 py-3 font-mono text-amber-600 text-xs font-semibold">{store.vendor_code}</td>
                <td className="px-5 py-3 text-gray-500">{store.city}</td>
                <td className="px-5 py-3 font-bold text-green-600">₹{(store.total_earnings || 0).toFixed(0)}</td>
                <td className="px-5 py-3">
                  <span className={`font-semibold ${(store.pending_payout || 0) > 0 ? "text-orange-600" : "text-gray-400"}`}>
                    ₹{(store.pending_payout || 0).toFixed(0)}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${store.approved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {store.approved ? "Active" : "Pending"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rider Earnings Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Rider Earnings Breakdown</h3>
          <p className="text-xs text-gray-400 mt-0.5">₹40 per trip (pickup or delivery)</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              {["Rider", "Phone", "Vehicle", "Total Trips", "Total Earned", "Status"].map(h => (
                <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : riders.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No riders yet</td></tr>
            ) : riders.map(rider => (
              <tr key={rider.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-900">{rider.name || "—"}</td>
                <td className="px-5 py-3 text-gray-500 font-mono text-xs">{rider.phone}</td>
                <td className="px-5 py-3 text-gray-500 uppercase text-xs">{rider.vehicle_type || "—"} · {rider.vehicle_number || "—"}</td>
                <td className="px-5 py-3 font-bold text-gray-700">{rider.total_trips || 0}</td>
                <td className="px-5 py-3 font-bold text-blue-600">₹{(rider.total_earnings || 0).toFixed(0)}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    rider.rider_status === "online" ? "bg-green-100 text-green-700" :
                    rider.rider_status === "on_trip" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {rider.rider_status || "offline"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageLayout>
  );
}
