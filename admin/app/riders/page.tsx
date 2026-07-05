"use client";
import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import Badge from "@/components/Badge";
import EditEntityModal from "@/components/EditEntityModal";
import ResetPasswordModal from "@/components/ResetPasswordModal";
import api from "@/lib/api";
import {
  CheckCircle, XCircle, RefreshCw, MapPin, FileText,
  Phone, Truck, Plus, X, Eye, Clock, TrendingUp, Pencil, KeyRound,
} from "lucide-react";

type Rider = {
  id: string; phone: string; name: string | null;
  vehicle_type: string | null; vehicle_number: string | null;
  rider_status: string; rider_approved: boolean;
  documents_uploaded: boolean; has_dl: boolean; has_id_proof: boolean;
  total_trips: number; total_earnings: number;
  current_location: { lat: number; lng: number } | null;
  last_seen: string | null; created_at: string;
};

type RiderDetail = Rider & {
  email: string | null;
  dl_image: string | null; id_proof_image: string | null;
  recent_trips: { id: string; trip_type: string; status: string; fee: number; completed_at: string | null; created_at: string }[];
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending Approval" },
  { key: "online", label: "Online" },
  { key: "offline", label: "Offline" },
];

const VEHICLE_TYPES = ["bike", "auto", "van"];

function StatChip({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${color}`}>
      <span className="text-xl font-bold">{value}</span>
      <span className="text-xs font-medium opacity-80">{label}</span>
    </div>
  );
}

function DocStatus({ has_dl, has_id_proof }: { has_dl: boolean; has_id_proof: boolean }) {
  if (has_dl && has_id_proof)
    return <span className="inline-flex items-center gap-1 text-green-600 text-xs font-semibold"><CheckCircle size={12} /> Complete</span>;
  if (!has_dl && !has_id_proof)
    return <span className="inline-flex items-center gap-1 text-red-500 text-xs font-semibold"><XCircle size={12} /> None</span>;
  return <span className="inline-flex items-center gap-1 text-orange-500 text-xs font-semibold"><Clock size={12} /> Partial</span>;
}

export default function RidersPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedRider, setSelectedRider] = useState<RiderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", phone: "", vehicle_type: "bike", vehicle_number: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [resettingPw, setResettingPw] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/riders");
      setRiders(res.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setSelectedRider(null);
    try {
      const res = await api.get(`/admin/riders/${id}`);
      setSelectedRider(res.data);
    } catch { setSelectedRider(null); }
    finally { setDetailLoading(false); }
  };

  const handleApprove = async (id: string, approved: boolean) => {
    try {
      await api.put(`/admin/riders/${id}/approve`, { approved });
      load();
      if (selectedRider?.id === id) openDetail(id);
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const handleAdd = async () => {
    if (!addForm.name || !addForm.phone || !addForm.vehicle_number) {
      alert("Name, phone, and vehicle number are required."); return;
    }
    setAddLoading(true);
    try {
      await api.post("/admin/riders/create", addForm);
      setShowAddModal(false);
      setAddForm({ name: "", phone: "", vehicle_type: "bike", vehicle_number: "" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed to create rider"); }
    finally { setAddLoading(false); }
  };

  const filtered = riders.filter(r => {
    if (filter === "pending" && r.rider_approved) return false;
    if (filter === "online" && r.rider_status !== "online") return false;
    if (filter === "offline" && r.rider_status !== "offline") return false;
    if (search) {
      const q = search.toLowerCase();
      return r.name?.toLowerCase().includes(q) || r.phone.includes(q) || r.vehicle_number?.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: riders.length,
    online: riders.filter(r => r.rider_status === "online" || r.rider_status === "on_trip").length,
    pending: riders.filter(r => !r.rider_approved).length,
    offline: riders.filter(r => r.rider_status === "offline").length,
  };

  return (
    <PageLayout title="Rider Management">
      {/* Stats */}
      <div className="flex flex-wrap gap-3 mb-6">
        <StatChip label="Total Riders" value={stats.total} color="bg-gray-50 border-gray-200 text-gray-800" />
        <StatChip label="Online" value={stats.online} color="bg-green-50 border-green-200 text-green-800" />
        <StatChip label="Pending Approval" value={stats.pending} color="bg-orange-50 border-orange-200 text-orange-800" />
        <StatChip label="Offline" value={stats.offline} color="bg-gray-50 border-gray-200 text-gray-600" />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        {/* Filter Tabs */}
        <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
          {FILTER_TABS.map(tab => (
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
          placeholder="Search name, phone, vehicle..."
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
          <Plus size={15} /> Add Rider
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              {["Rider", "Phone", "Vehicle", "Joined", "Status", "Approved", "Docs", "Trips", "Earnings", "Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-400">Loading...</td></tr>
            ) : filtered.map(rider => (
              <tr key={rider.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900">{rider.name || <span className="text-gray-400 italic">No name</span>}</div>
                  <div className="text-xs text-gray-400 font-mono">{rider.id.slice(-8)}</div>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs font-mono">{rider.phone}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800 uppercase text-xs">{rider.vehicle_type || "—"}</div>
                  <div className="text-xs text-gray-400">{rider.vehicle_number || "—"}</div>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {rider.created_at ? new Date(rider.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </td>
                <td className="px-4 py-3"><Badge value={rider.rider_status || "offline"} /></td>
                <td className="px-4 py-3">
                  {rider.rider_approved
                    ? <span className="inline-flex items-center gap-1 text-green-600 text-xs font-bold"><CheckCircle size={12} /> Approved</span>
                    : <span className="inline-flex items-center gap-1 text-orange-500 text-xs font-bold"><Clock size={12} /> Pending</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <DocStatus has_dl={rider.has_dl} has_id_proof={rider.has_id_proof} />
                </td>
                <td className="px-4 py-3 font-bold text-gray-700">{rider.total_trips}</td>
                <td className="px-4 py-3 font-bold text-green-600">₹{rider.total_earnings?.toFixed(0)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openDetail(rider.id)}
                      className="flex items-center gap-1 bg-blue-50 text-blue-600 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-blue-100"
                    >
                      <Eye size={11} /> Details
                    </button>
                    {!rider.rider_approved ? (
                      <button
                        onClick={() => handleApprove(rider.id, true)}
                        className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-green-200"
                      >
                        <CheckCircle size={11} /> Approve
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApprove(rider.id, false)}
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
              <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-400">No riders match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Rider Detail Drawer ── */}
      {(selectedRider || detailLoading) && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setSelectedRider(null)} />
          <div className="w-[480px] bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">Rider Details</h2>
              <div className="flex items-center gap-2">
                {selectedRider && (
                  <button onClick={() => setResettingPw(true)}
                    className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-semibold">
                    <KeyRound size={12} /> Reset Password
                  </button>
                )}
                {selectedRider && (
                  <button onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1.5 rounded-lg font-semibold">
                    <Pencil size={12} /> Edit
                  </button>
                )}
                <button onClick={() => setSelectedRider(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
              </div>
            </div>

            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">Loading...</div>
            ) : selectedRider && (
              <div className="flex-1 p-5 space-y-5">
                {/* Identity */}
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-2xl font-bold text-amber-700">
                    {selectedRider.name?.charAt(0)?.toUpperCase() || "R"}
                  </div>
                  <div>
                    <div className="text-xl font-bold text-gray-900">{selectedRider.name || "No Name"}</div>
                    <div className="text-sm text-gray-500 font-mono mt-0.5">{selectedRider.phone}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {selectedRider.email || <span className="italic text-gray-400">No email on file</span>}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Badge value={selectedRider.rider_status || "offline"} />
                      {selectedRider.rider_approved
                        ? <Badge value="approved" />
                        : <Badge value="pending_approval" />
                      }
                    </div>
                  </div>
                </div>

                {/* Approval Action */}
                <div className="flex gap-2">
                  {!selectedRider.rider_approved ? (
                    <button
                      onClick={() => handleApprove(selectedRider.id, true)}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-2.5 rounded-lg hover:bg-green-500"
                    >
                      <CheckCircle size={16} /> Approve Rider
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApprove(selectedRider.id, false)}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-100 text-red-700 font-semibold py-2.5 rounded-lg hover:bg-red-200"
                    >
                      <XCircle size={16} /> Revoke Approval
                    </button>
                  )}
                </div>

                {/* Vehicle */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Vehicle</div>
                  <div className="flex items-center gap-3">
                    <Truck size={16} className="text-gray-400" />
                    <span className="font-medium text-gray-800 uppercase">{selectedRider.vehicle_type || "—"}</span>
                    <span className="text-gray-500 font-mono">{selectedRider.vehicle_number || "—"}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-xl p-4">
                    <div className="text-xs text-green-600 font-semibold mb-1">Total Earnings</div>
                    <div className="text-2xl font-black text-green-700">₹{selectedRider.total_earnings?.toFixed(0)}</div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4">
                    <div className="text-xs text-blue-600 font-semibold mb-1">Total Trips</div>
                    <div className="text-2xl font-black text-blue-700">{selectedRider.total_trips}</div>
                  </div>
                </div>

                {/* Documents */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Documents</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 flex items-center gap-2"><FileText size={14} /> Driving License</span>
                      {selectedRider.has_dl
                        ? <span className="text-xs text-green-600 font-semibold">✓ Uploaded</span>
                        : <span className="text-xs text-red-500 font-semibold">✗ Missing</span>
                      }
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 flex items-center gap-2"><FileText size={14} /> Aadhaar / ID Proof</span>
                      {selectedRider.has_id_proof
                        ? <span className="text-xs text-green-600 font-semibold">✓ Uploaded</span>
                        : <span className="text-xs text-red-500 font-semibold">✗ Missing</span>
                      }
                    </div>
                  </div>
                  {selectedRider.dl_image && (
                    <img src={selectedRider.dl_image} alt="DL" className="mt-3 rounded-lg w-full object-cover max-h-40" />
                  )}
                  {selectedRider.id_proof_image && (
                    <img src={selectedRider.id_proof_image} alt="ID" className="mt-2 rounded-lg w-full object-cover max-h-40" />
                  )}
                </div>

                {/* Location */}
                {selectedRider.current_location && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Last Known Location</div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <MapPin size={14} className="text-amber-500" />
                      {selectedRider.current_location.lat.toFixed(5)}, {selectedRider.current_location.lng.toFixed(5)}
                    </div>
                    {selectedRider.last_seen && (
                      <div className="text-xs text-gray-400 mt-1">
                        Last seen: {new Date(selectedRider.last_seen).toLocaleString("en-IN")}
                      </div>
                    )}
                  </div>
                )}

                {/* Meta */}
                <div className="text-xs text-gray-400">
                  Rider ID: <span className="font-mono">{selectedRider.id}</span> · Joined {new Date(selectedRider.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </div>

                {/* Recent Trips */}
                {selectedRider.recent_trips?.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <TrendingUp size={12} /> Recent Trips
                    </div>
                    <div className="space-y-2">
                      {selectedRider.recent_trips.map(trip => (
                        <div key={trip.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                          <div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${trip.trip_type === "pickup" ? "bg-blue-100 text-blue-700" : "bg-teal-100 text-teal-700"}`}>
                              {trip.trip_type.toUpperCase()}
                            </span>
                            <div className="text-xs text-gray-400 mt-1">
                              {trip.completed_at ? new Date(trip.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : new Date(trip.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-bold ${trip.status === "completed" ? "text-green-600" : "text-gray-400"}`}>
                              {trip.status === "completed" ? `+₹${trip.fee}` : trip.status}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Rider Modal ── */}
      {editing && selectedRider && (
        <EditEntityModal
          key={selectedRider.id}
          title="Edit Rider"
          endpoint={`/admin/riders/${selectedRider.id}`}
          fields={[
            { key: "name", label: "Name", colSpan: 2 },
            { key: "phone", label: "Phone", type: "tel" },
            { key: "email", label: "Email", type: "email" },
            { key: "vehicle_type", label: "Vehicle type", type: "select",
              options: [
                { value: "bike", label: "Bike" },
                { value: "scooter", label: "Scooter" },
                { value: "cycle", label: "Cycle" },
                { value: "car", label: "Car" },
              ] },
            { key: "vehicle_number", label: "Vehicle number" },
          ]}
          initial={{
            name: selectedRider.name ?? "", phone: selectedRider.phone ?? "",
            email: selectedRider.email ?? "",
            vehicle_type: selectedRider.vehicle_type ?? "bike",
            vehicle_number: selectedRider.vehicle_number ?? "",
          }}
          onClose={() => setEditing(false)}
          onSaved={() => { openDetail(selectedRider.id); load(); }}
        />
      )}

      {/* ── Reset Rider Password Modal ── */}
      {resettingPw && selectedRider && (
        <ResetPasswordModal
          key={selectedRider.id}
          userId={selectedRider.id}
          userLabel={selectedRider.name || selectedRider.phone}
          onClose={() => setResettingPw(false)}
        />
      )}

      {/* ── Add Rider Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Add New Rider</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>

            <p className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg p-3 mb-5">
              Rider will be created with <strong>Pending Approval</strong> status. They must login, upload documents, and be manually approved before taking trips.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Full Name *</label>
                <input
                  value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Rider's full name"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Phone Number *</label>
                <input
                  value={addForm.phone}
                  onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+919876543210"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Vehicle Type</label>
                <div className="flex gap-2">
                  {VEHICLE_TYPES.map(v => (
                    <button
                      key={v}
                      onClick={() => setAddForm(f => ({ ...f, vehicle_type: v }))}
                      className={`flex-1 py-2 rounded-lg border text-sm font-semibold capitalize transition-colors ${addForm.vehicle_type === v ? "bg-amber-500 text-white border-amber-500" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Vehicle Number *</label>
                <input
                  value={addForm.vehicle_number}
                  onChange={e => setAddForm(f => ({ ...f, vehicle_number: e.target.value.toUpperCase() }))}
                  placeholder="PB10AB1234"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono uppercase"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={addLoading}
                className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50"
              >
                {addLoading ? "Creating..." : "Create Rider"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
