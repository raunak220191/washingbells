"use client";
import { useEffect, useMemo, useState } from "react";
import PageLayout from "@/components/PageLayout";
import Badge from "@/components/Badge";
import api from "@/lib/api";
import {
  RefreshCw, X, Eye, Phone, Mail, MapPin, Wallet, ShoppingBag,
  Gift, Users as UsersIcon, FileCheck, Truck, History,
} from "lucide-react";

type UserRow = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: string;
  rider_approved?: boolean | null;
  rider_status?: string | null;
  vehicle_type?: string | null;
  store_id?: string | null;
  referral_code?: string | null;
  wallet_balance: number;
  order_count: number;
  total_spend: number;
  last_order_at: string | null;
  created_at: string;
};

type UserDetail = {
  id: string; phone: string; name: string | null; email: string | null;
  role: string; profile_image: string | null;
  referral_code: string | null; referred_by: string | null; referrals_made: number;
  terms_accepted_version: number; terms_accepted_at: string | null;
  created_at: string; updated_at: string | null;
  wallet: {
    balance: number;
    txns: { id: string; type: string; amount: number; reason: string; description: string; created_at: string }[];
  };
  orders: {
    id: string; order_number: string; status: string;
    total_amount: number; items_count: number; payment_method: string; created_at: string;
  }[];
  delivered_count: number;
  total_spend: number;
  addresses: { id: string; label: string; full_address: string; city: string; pincode: string; is_default: boolean }[];
  rider: {
    approved: boolean; status: string | null;
    vehicle_type: string | null; vehicle_number: string | null;
    documents_uploaded: boolean;
    has_dl: boolean; has_aadhaar: boolean; has_selfie: boolean;
    total_trips: number; total_earnings: number;
    current_location: { lat: number; lng: number } | null;
  } | null;
  store_id: string | null;
};

const ROLE_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "customer", label: "Customer" },
  { value: "rider", label: "Rider" },
  { value: "store_owner", label: "Store Owner" },
  { value: "admin", label: "Admin" },
];

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export default function CustomersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const url = roleFilter ? `/admin/users?role=${roleFilter}&limit=200` : "/admin/users?limit=200";
      const res = await api.get(url);
      setUsers(res.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [roleFilter]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.get(`/admin/users/${id}`);
      setDetail(res.data);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Failed to load user detail");
      setSelectedId(null);
    } finally { setDetailLoading(false); }
  };

  const filtered = useMemo(() => users.filter(u =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.referral_code?.toLowerCase().includes(search.toLowerCase())
  ), [users, search]);

  const stats = useMemo(() => {
    const customers = users.filter(u => u.role === "customer").length;
    const withEmail = users.filter(u => !!u.email).length;
    const active = users.filter(u => u.order_count > 0).length;
    return { total: users.length, customers, withEmail, active };
  }, [users]);

  return (
    <PageLayout title="Users">
      {/* Stats */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-gray-50 border-gray-200 text-gray-800">
          <span className="text-xl font-bold">{stats.total}</span>
          <span className="text-xs font-medium">Total Users</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-blue-50 border-blue-200 text-blue-800">
          <span className="text-xl font-bold">{stats.customers}</span>
          <span className="text-xs font-medium">Customers</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-green-50 border-green-200 text-green-800">
          <span className="text-xl font-bold">{stats.active}</span>
          <span className="text-xs font-medium">With Orders</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-amber-50 border-amber-200 text-amber-800">
          <span className="text-xl font-bold">{stats.withEmail}</span>
          <span className="text-xs font-medium">With Email</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <input
          placeholder="Search name, phone, email, referral code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:border-amber-500"
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
        >
          {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw size={13} /> Refresh
        </button>
        <span className="ml-auto text-sm text-gray-500">{filtered.length} shown</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              {["Name", "Phone", "Email", "Role", "Orders", "Spend", "Wallet", "Last Order", "Joined", "Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-400">No users match.</td></tr>
            ) : filtered.map(user => (
              <tr key={user.id} className="hover:bg-amber-50/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{user.name || <span className="text-gray-400 italic">No name</span>}</div>
                  <div className="text-xs text-gray-400 font-mono">{user.id.slice(-8)}</div>
                </td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">{user.phone}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{user.email || <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3"><Badge value={user.role} /></td>
                <td className="px-4 py-3 font-bold text-gray-700">{user.order_count}</td>
                <td className="px-4 py-3 font-bold text-green-600">₹{user.total_spend.toFixed(0)}</td>
                <td className="px-4 py-3 font-semibold text-purple-600">₹{user.wallet_balance.toFixed(0)}</td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(user.last_order_at)}</td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(user.created_at)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => openDetail(user.id)}
                    className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg font-semibold transition-colors"
                  >
                    <Eye size={11} /> Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── User Detail Drawer ── */}
      {selectedId && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setSelectedId(null)} />
          <div className="w-[540px] bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{detail?.name || "User Details"}</h2>
                {detail && <div className="flex gap-2 mt-1"><Badge value={detail.role} /></div>}
              </div>
              <button onClick={() => setSelectedId(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>

            {detailLoading || !detail ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">Loading user…</div>
            ) : (
              <div className="flex-1 p-5 space-y-5">
                {/* Identity */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Profile</div>
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-2xl font-bold text-amber-700 overflow-hidden">
                      {detail.profile_image
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={detail.profile_image} alt="" className="w-full h-full object-cover" />
                        : detail.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div className="flex-1">
                      <div className="text-base font-bold text-gray-900">{detail.name || <span className="italic text-gray-400">No name</span>}</div>
                      <div className="text-xs text-gray-500 font-mono mt-1 flex items-center gap-1"><Phone size={11} /> {detail.phone}</div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Mail size={11} />
                        {detail.email || <span className="italic text-gray-400">Not set</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        Joined {formatDate(detail.created_at)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-50 rounded-xl p-4">
                    <div className="text-xs text-green-600 font-semibold mb-1">Total Spend</div>
                    <div className="text-2xl font-black text-green-700">₹{detail.total_spend.toFixed(0)}</div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4">
                    <div className="text-xs text-blue-600 font-semibold mb-1">Delivered</div>
                    <div className="text-2xl font-black text-blue-700">{detail.delivered_count}</div>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4">
                    <div className="text-xs text-purple-600 font-semibold mb-1">Wallet</div>
                    <div className="text-2xl font-black text-purple-700">₹{detail.wallet.balance.toFixed(0)}</div>
                  </div>
                </div>

                {/* Referrals + T&C */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Trust & Loyalty</div>
                  <div className="flex items-center gap-2 text-sm">
                    <Gift size={14} className="text-amber-500" />
                    <span className="text-gray-700">Referral code:</span>
                    {detail.referral_code
                      ? <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{detail.referral_code}</span>
                      : <span className="text-xs text-gray-400 italic">none</span>}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <UsersIcon size={14} className="text-blue-500" />
                    <span className="text-gray-700">Referrals made:</span>
                    <span className="font-bold text-gray-900">{detail.referrals_made}</span>
                    {detail.referred_by && <span className="text-xs text-gray-400">· referred by <span className="font-mono">{detail.referred_by}</span></span>}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileCheck size={14} className="text-green-500" />
                    <span className="text-gray-700">T&C accepted:</span>
                    {detail.terms_accepted_version > 0
                      ? <span className="text-xs font-bold text-green-700">v{detail.terms_accepted_version} on {formatDate(detail.terms_accepted_at)}</span>
                      : <span className="text-xs text-orange-500 font-bold">Not accepted</span>}
                  </div>
                </div>

                {/* Rider details */}
                {detail.rider && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <div className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
                      <Truck size={11} /> Rider Profile
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-gray-500">Approval</div>
                        <div className="font-bold">
                          {detail.rider.approved
                            ? <span className="text-green-700">Approved</span>
                            : <span className="text-orange-600">Pending</span>}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Status</div>
                        <div className="font-bold capitalize">{detail.rider.status || "offline"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Vehicle</div>
                        <div className="font-bold uppercase">{detail.rider.vehicle_type || "—"} · <span className="font-mono">{detail.rider.vehicle_number || "—"}</span></div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Total Trips</div>
                        <div className="font-bold">{detail.rider.total_trips}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-gray-500 mb-1">Documents</div>
                        <div className="flex gap-2 text-xs">
                          <span className={`px-2 py-0.5 rounded ${detail.rider.has_dl ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>DL {detail.rider.has_dl ? "✓" : "✗"}</span>
                          <span className={`px-2 py-0.5 rounded ${detail.rider.has_aadhaar ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>Aadhaar {detail.rider.has_aadhaar ? "✓" : "✗"}</span>
                          <span className={`px-2 py-0.5 rounded ${detail.rider.has_selfie ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>Selfie {detail.rider.has_selfie ? "✓" : "✗"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Addresses */}
                {detail.addresses && detail.addresses.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <MapPin size={11} /> Addresses ({detail.addresses.length})
                    </div>
                    <div className="space-y-2">
                      {detail.addresses.map(a => (
                        <div key={a.id} className="text-sm bg-white border border-gray-100 rounded-lg p-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{a.label}</span>
                            {a.is_default && <span className="text-xs font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">Default</span>}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">{a.full_address}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{a.city} {a.pincode}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Orders */}
                {detail.orders && detail.orders.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <ShoppingBag size={11} /> Recent Orders
                    </div>
                    <div className="space-y-1.5">
                      {detail.orders.map(o => (
                        <div key={o.id} className="bg-white border border-gray-100 rounded-lg p-2.5 flex items-center justify-between">
                          <div>
                            <div className="text-xs font-mono font-bold text-gray-700">{o.order_number}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{o.items_count} items · {formatDateTime(o.created_at)}</div>
                          </div>
                          <div className="text-right">
                            <Badge value={o.status} />
                            <div className="text-xs font-bold text-gray-700 mt-1">₹{o.total_amount.toFixed(0)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Wallet Transactions */}
                {detail.wallet.txns && detail.wallet.txns.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Wallet size={11} /> Recent Wallet Activity
                    </div>
                    <div className="space-y-1">
                      {detail.wallet.txns.map(t => (
                        <div key={t.id} className="flex items-center justify-between text-xs bg-white border border-gray-100 rounded p-2">
                          <div>
                            <span className={t.type === "credit" ? "text-green-700 font-bold" : "text-red-600 font-bold"}>
                              {t.type === "credit" ? "+" : "−"}₹{t.amount.toFixed(0)}
                            </span>
                            <span className="text-gray-500 ml-2">{t.description || t.reason}</span>
                          </div>
                          <span className="text-gray-400">{formatDateTime(t.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent activity */}
                <div className="text-xs text-gray-400 flex items-center gap-1.5">
                  <History size={11} />
                  User ID: <span className="font-mono">{detail.id}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
