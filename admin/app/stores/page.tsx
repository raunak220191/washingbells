"use client";
import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import Badge from "@/components/Badge";
import EditEntityModal from "@/components/EditEntityModal";
import api from "@/lib/api";
import {
  CheckCircle, XCircle, RefreshCw, MapPin, Phone,
  Plus, X, Eye, ToggleLeft, ToggleRight, ShoppingBag, Clock, Pencil,
} from "lucide-react";

type Store = {
  id: string; vendor_code: string; name: string;
  address: string; city: string; phone: string;
  status: string; is_open: boolean; approved: boolean;
  total_earnings: number; pending_payout: number;
  owner_user_id: string | null; owner_name: string | null; owner_phone: string | null;
  order_count: number; opening_time: string; closing_time: string;
  latitude: number | null; longitude: number | null;
  created_at: string | null;
};

type StoreOrder = {
  id: string; order_number: string; status: string;
  total_amount: number; items_count: number;
  customer_name: string; payment_method: string; created_at: string;
};

type StoreDetail = Store & {
  state: string | null; pincode: string | null; whatsapp: string | null;
  geo_radius_km: number; active_orders: number;
  owner_email: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-700 bg-green-100 border-green-200",
  pending: "text-orange-700 bg-orange-100 border-orange-200",
  rejected: "text-red-700 bg-red-100 border-red-200",
};

function StatChip({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${color}`}>
      <span className="text-xl font-bold">{value}</span>
      <span className="text-xs font-medium opacity-80">{label}</span>
    </div>
  );
}

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedStore, setSelectedStore] = useState<StoreDetail | null>(null);
  const [storeOrders, setStoreOrders] = useState<StoreOrder[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "", owner_phone: "", owner_name: "", address: "",
    city: "Ludhiana", pincode: "", store_phone: "",
    opening_time: "09:00", closing_time: "21:00",
  });
  const [addLoading, setAddLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/stores");
      setStores(res.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setSelectedStore(null);
    setStoreOrders([]);
    try {
      const [detailRes, ordersRes] = await Promise.all([
        api.get(`/admin/stores/${id}`),
        api.get(`/admin/stores/${id}/orders`),
      ]);
      setSelectedStore(detailRes.data);
      setStoreOrders(ordersRes.data);
    } catch { setSelectedStore(null); }
    finally { setDetailLoading(false); }
  };

  const handleApprove = async (id: string, approved: boolean) => {
    try {
      await api.put(`/admin/stores/${id}/approve`, { approved });
      load();
      if (selectedStore?.id === id) openDetail(id);
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const handleToggleOpen = async (id: string) => {
    try {
      await api.put(`/admin/stores/${id}/toggle-open`);
      load();
      if (selectedStore?.id === id) openDetail(id);
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const handleAdd = async () => {
    if (!addForm.name || !addForm.owner_phone) {
      alert("Store name and owner phone are required."); return;
    }
    setAddLoading(true);
    try {
      await api.post("/admin/stores/create", addForm);
      setShowAddModal(false);
      setAddForm({ name: "", owner_phone: "", owner_name: "", address: "", city: "Ludhiana", pincode: "", store_phone: "", opening_time: "09:00", closing_time: "21:00" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed to create store"); }
    finally { setAddLoading(false); }
  };

  const filtered = stores.filter(s => {
    if (filter === "pending" && s.approved) return false;
    if (filter === "active" && (!s.approved || s.status !== "active")) return false;
    if (filter === "open" && !s.is_open) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q) || s.vendor_code.toLowerCase().includes(q) || s.phone.includes(q);
    }
    return true;
  });

  const stats = {
    total: stores.length,
    active: stores.filter(s => s.approved && s.status === "active").length,
    pending: stores.filter(s => !s.approved).length,
    open: stores.filter(s => s.is_open).length,
  };

  return (
    <PageLayout title="Store Management">
      {/* Stats */}
      <div className="flex flex-wrap gap-3 mb-6">
        <StatChip label="Total Stores" value={stats.total} color="bg-gray-50 border-gray-200 text-gray-800" />
        <StatChip label="Active" value={stats.active} color="bg-green-50 border-green-200 text-green-800" />
        <StatChip label="Pending Approval" value={stats.pending} color="bg-orange-50 border-orange-200 text-orange-800" />
        <StatChip label="Currently Open" value={stats.open} color="bg-teal-50 border-teal-200 text-teal-800" />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        {/* Filter Tabs */}
        <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
          {[
            { key: "all", label: "All" },
            { key: "pending", label: "Pending" },
            { key: "active", label: "Active" },
            { key: "open", label: "Open Now" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${filter === tab.key ? "bg-amber-500 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              {tab.label}
              {tab.key === "pending" && stats.pending > 0 && (
                <span className="ml-1.5 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">{stats.pending}</span>
              )}
            </button>
          ))}
        </div>

        <input
          placeholder="Search name, city, vendor code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-60 focus:outline-none focus:border-amber-500"
        />
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw size={13} /> Refresh
        </button>
        <button
          onClick={() => setShowAddModal(true)}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
        >
          <Plus size={15} /> Add Store
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              {["Store", "City", "Vendor Code", "Owner", "Hours", "Status", "Open", "Orders", "Earnings", "Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-400">Loading...</td></tr>
            ) : filtered.map(store => (
              <tr key={store.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900">{store.name}</div>
                  <div className="text-xs text-gray-400 truncate max-w-[160px]">{store.address}</div>
                </td>
                <td className="px-4 py-3 text-gray-600 text-sm">{store.city}</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold">{store.vendor_code}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs text-gray-700 font-medium">{store.owner_name || "—"}</div>
                  <div className="text-xs text-gray-400 font-mono">{store.owner_phone || "—"}</div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {store.opening_time} – {store.closing_time}
                </td>
                <td className="px-4 py-3"><Badge value={store.status} /></td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggleOpen(store.id)}
                    title="Toggle open/closed"
                    className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border transition-colors ${store.is_open ? "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}
                  >
                    {store.is_open ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    {store.is_open ? "Open" : "Closed"}
                  </button>
                </td>
                <td className="px-4 py-3 font-bold text-gray-700">{store.order_count}</td>
                <td className="px-4 py-3 font-bold text-green-600">₹{store.total_earnings?.toFixed(0)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openDetail(store.id)}
                      className="flex items-center gap-1 bg-blue-50 text-blue-600 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-blue-100"
                    >
                      <Eye size={11} /> Details
                    </button>
                    {!store.approved ? (
                      <button
                        onClick={() => handleApprove(store.id, true)}
                        className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-green-200"
                      >
                        <CheckCircle size={11} /> Approve
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApprove(store.id, false)}
                        className="flex items-center gap-1 bg-red-50 text-red-600 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-100"
                      >
                        <XCircle size={11} /> Revoke
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-400">No stores match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Store Detail Drawer ── */}
      {(selectedStore || detailLoading) && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setSelectedStore(null)} />
          <div className="w-[500px] bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">Store Details</h2>
              <div className="flex items-center gap-2">
                {selectedStore && (
                  <button onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1.5 rounded-lg font-semibold">
                    <Pencil size={12} /> Edit
                  </button>
                )}
                <button onClick={() => setSelectedStore(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
              </div>
            </div>

            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">Loading...</div>
            ) : selectedStore && (
              <div className="flex-1 p-5 space-y-5">
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{selectedStore.name}</h3>
                      <span className="font-mono text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold">{selectedStore.vendor_code}</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge value={selectedStore.status} />
                      {selectedStore.is_open && <Badge value="open" />}
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleOpen(selectedStore.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm border transition-colors ${selectedStore.is_open ? "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200" : "bg-teal-600 text-white border-teal-600 hover:bg-teal-500"}`}
                  >
                    {selectedStore.is_open ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                    {selectedStore.is_open ? "Mark Closed" : "Mark Open"}
                  </button>
                  {!selectedStore.approved ? (
                    <button
                      onClick={() => handleApprove(selectedStore.id, true)}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-green-500"
                    >
                      <CheckCircle size={16} /> Approve
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApprove(selectedStore.id, false)}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-100 text-red-700 py-2.5 rounded-lg font-semibold text-sm hover:bg-red-200"
                    >
                      <XCircle size={16} /> Revoke
                    </button>
                  )}
                </div>

                {/* Earnings */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-xl p-4">
                    <div className="text-xs text-green-600 font-semibold mb-1">Total Earnings</div>
                    <div className="text-2xl font-black text-green-700">₹{selectedStore.total_earnings?.toFixed(0)}</div>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-4">
                    <div className="text-xs text-orange-600 font-semibold mb-1">Pending Payout</div>
                    <div className="text-2xl font-black text-orange-700">₹{selectedStore.pending_payout?.toFixed(0)}</div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4">
                    <div className="text-xs text-blue-600 font-semibold mb-1">Total Orders</div>
                    <div className="text-2xl font-black text-blue-700">{selectedStore.order_count}</div>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4">
                    <div className="text-xs text-purple-600 font-semibold mb-1">Active Orders</div>
                    <div className="text-2xl font-black text-purple-700">{selectedStore.active_orders}</div>
                  </div>
                </div>

                {/* Contact & Location */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contact & Location</div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <MapPin size={14} className="text-amber-500 shrink-0" />
                    {selectedStore.address}, {selectedStore.city}, {selectedStore.state} {selectedStore.pincode}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Phone size={14} className="text-gray-400 shrink-0" />
                    {selectedStore.phone || "—"}
                  </div>
                  {selectedStore.latitude && selectedStore.longitude && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <MapPin size={12} className="text-gray-400 shrink-0" />
                      GPS: {selectedStore.latitude.toFixed(5)}, {selectedStore.longitude.toFixed(5)}
                      <span className="text-gray-400">· radius {selectedStore.geo_radius_km}km</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Clock size={14} className="text-gray-400 shrink-0" />
                    {selectedStore.opening_time} – {selectedStore.closing_time}
                  </div>
                </div>

                {/* Owner */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Store Owner</div>
                  <div className="text-sm font-semibold text-gray-800">{selectedStore.owner_name || "—"}</div>
                  <div className="text-sm text-gray-500 font-mono">{selectedStore.owner_phone || "—"}</div>
                  <div className="text-xs text-gray-500">
                    {selectedStore.owner_email
                      ? <a href={`mailto:${selectedStore.owner_email}`} className="text-amber-700 hover:underline">{selectedStore.owner_email}</a>
                      : <span className="italic text-gray-400">No email on file</span>}
                  </div>
                </div>

                {/* Recent Orders */}
                {storeOrders.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <ShoppingBag size={12} /> Recent Orders
                    </div>
                    <div className="space-y-2">
                      {storeOrders.map(order => (
                        <div key={order.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-gray-700 font-mono">{order.order_number}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {order.customer_name} · {order.items_count} items · {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge value={order.status} />
                            <div className="text-xs font-bold text-gray-700 mt-1">₹{order.total_amount}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div className="text-xs text-gray-400">
                  Store ID: <span className="font-mono">{selectedStore.id}</span>
                  {selectedStore.created_at && ` · Created ${new Date(selectedStore.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Store Modal ── */}
      {editing && selectedStore && (
        <EditEntityModal
          key={selectedStore.id}
          title="Edit Store"
          endpoint={`/admin/stores/${selectedStore.id}`}
          fields={[
            { key: "name", label: "Store name", colSpan: 2 },
            { key: "address", label: "Address", colSpan: 2 },
            { key: "city", label: "City" },
            { key: "state", label: "State" },
            { key: "pincode", label: "Pincode" },
            { key: "phone", label: "Phone", type: "tel" },
            { key: "opening_time", label: "Opening time" },
            { key: "closing_time", label: "Closing time" },
            { key: "geo_radius_km", label: "Service radius (km)" },
            { key: "status", label: "Status", type: "select",
              options: [
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
                { value: "suspended", label: "Suspended" },
              ] },
          ]}
          initial={{
            name: selectedStore.name ?? "", address: selectedStore.address ?? "",
            city: selectedStore.city ?? "", state: selectedStore.state ?? "",
            pincode: selectedStore.pincode ?? "", phone: selectedStore.phone ?? "",
            opening_time: selectedStore.opening_time ?? "", closing_time: selectedStore.closing_time ?? "",
            geo_radius_km: String(selectedStore.geo_radius_km ?? ""),
            status: selectedStore.status ?? "active",
          }}
          onClose={() => setEditing(false)}
          onSaved={() => { openDetail(selectedStore.id); load(); }}
        />
      )}

      {/* ── Add Store Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Add New Store</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>

            <p className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg p-3 mb-5">
              The owner will receive an SMS to login and complete their store profile (GPS coordinates, photos, and bank details).
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Store Name *</label>
                  <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. WashingBells Ludhiana" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Owner Phone *</label>
                  <input value={addForm.owner_phone} onChange={e => setAddForm(f => ({ ...f, owner_phone: e.target.value }))} placeholder="+919876543210" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Owner Name</label>
                  <input value={addForm.owner_name} onChange={e => setAddForm(f => ({ ...f, owner_name: e.target.value }))} placeholder="Owner's name" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Store Address</label>
                  <input value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">City</label>
                  <input value={addForm.city} onChange={e => setAddForm(f => ({ ...f, city: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Pincode</label>
                  <input value={addForm.pincode} onChange={e => setAddForm(f => ({ ...f, pincode: e.target.value }))} placeholder="141001" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Store Phone</label>
                  <input value={addForm.store_phone} onChange={e => setAddForm(f => ({ ...f, store_phone: e.target.value }))} placeholder="Store contact number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Operating Hours</label>
                  <div className="flex items-center gap-2">
                    <input type="time" value={addForm.opening_time} onChange={e => setAddForm(f => ({ ...f, opening_time: e.target.value }))} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                    <span className="text-gray-400 text-xs">to</span>
                    <input type="time" value={addForm.closing_time} onChange={e => setAddForm(f => ({ ...f, closing_time: e.target.value }))} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdd} disabled={addLoading} className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50">
                {addLoading ? "Creating..." : "Create Store"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
