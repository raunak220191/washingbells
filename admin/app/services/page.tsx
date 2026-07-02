"use client";
import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import api from "@/lib/api";
import { CATEGORIES, categoryStyle } from "@/lib/categories";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Save, X, RefreshCw } from "lucide-react";

const ICONS = ["shirt-outline","water-outline","layers-outline","footsteps-outline","thermometer-outline","diamond-outline","tv-outline","basket-outline","shirt","car-outline","flower-outline","sparkles-outline"];
const PRICING_UNITS = ["piece","pair","kg","sqft","set"];
const SERVICE_TYPES = ["pickup_drop","at_home"];

export default function ServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Item search across all services — matching services auto-expand
  const q = search.trim().toLowerCase();
  const visibleServices = q
    ? services
        .map(s => (s.name.toLowerCase().includes(q)
          ? s
          : { ...s, items: s.items.filter((i: any) => i.name.toLowerCase().includes(q) || (i.category || "").toLowerCase().includes(q)) }))
        .filter(s => s.items.length > 0 || s.name.toLowerCase().includes(q))
    : services;

  // New service form
  const [showNewSvc, setShowNewSvc] = useState(false);
  const [newSvc, setNewSvc] = useState({ name: "", description: "", icon: "shirt-outline", pricing_unit: "piece", service_type: "pickup_drop" });

  // Edit service
  const [editSvc, setEditSvc] = useState<any>(null);

  // New item form per service
  const [newItem, setNewItem] = useState<Record<string, { name: string; price: string; category: string }>>({});

  // Edit item
  const [editItem, setEditItem] = useState<{ svcId: string; itemId: string; name: string; price: string; category: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/services");
      setServices(res.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreateService = async () => {
    if (!newSvc.name.trim()) return;
    try {
      await api.post("/admin/services", newSvc);
      setShowNewSvc(false);
      setNewSvc({ name: "", description: "", icon: "shirt-outline", pricing_unit: "piece", service_type: "pickup_drop" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const handleUpdateService = async () => {
    if (!editSvc) return;
    try {
      await api.put(`/admin/services/${editSvc.id}`, editSvc);
      setEditSvc(null);
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const handleDeleteService = async (id: string, name: string) => {
    if (!confirm(`Delete service "${name}" and all its items? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/services/${id}`);
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const handleAddItem = async (svcId: string) => {
    const item = newItem[svcId];
    if (!item?.name || !item?.price) return;
    try {
      await api.post(`/admin/services/${svcId}/items`, { name: item.name, price: parseFloat(item.price), category: item.category || "unisex" });
      setNewItem(prev => ({ ...prev, [svcId]: { name: "", price: "", category: "unisex" } }));
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const handleUpdateItem = async () => {
    if (!editItem) return;
    try {
      await api.put(`/admin/services/${editItem.svcId}/items/${editItem.itemId}`, {
        name: editItem.name, price: parseFloat(editItem.price), category: editItem.category || "unisex",
      });
      setEditItem(null);
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const handleDeleteItem = async (svcId: string, itemId: string, name: string) => {
    if (!confirm(`Delete item "${name}"?`)) return;
    try {
      await api.delete(`/admin/services/${svcId}/items/${itemId}`);
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <PageLayout title="Services & Pricing">
      <div className="flex justify-between items-center gap-3 mb-5">
        <p className="text-sm text-gray-500 shrink-0">{services.length} service categories · Edit prices live</p>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search items or categories…"
          className="flex-1 max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
        />
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCw size={13} />
          </button>
          <button onClick={() => setShowNewSvc(true)} className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-400 transition-colors">
            <Plus size={15} /> Add Service Category
          </button>
        </div>
      </div>

      {/* New Service Form */}
      {showNewSvc && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-5">
          <h3 className="font-bold text-amber-900 mb-4 flex items-center gap-2"><Plus size={16} /> New Service Category</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Service Name *</label>
              <input value={newSvc.name} onChange={e => setNewSvc({...newSvc, name: e.target.value})}
                placeholder="e.g. Wedding Dress Cleaning" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Description</label>
              <input value={newSvc.description} onChange={e => setNewSvc({...newSvc, description: e.target.value})}
                placeholder="Short description" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Icon</label>
              <select value={newSvc.icon} onChange={e => setNewSvc({...newSvc, icon: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Pricing Unit</label>
              <select value={newSvc.pricing_unit} onChange={e => setNewSvc({...newSvc, pricing_unit: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                {PRICING_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Service Type</label>
              <select value={newSvc.service_type} onChange={e => setNewSvc({...newSvc, service_type: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateService} className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-400 transition-colors">
              Create Service
            </button>
            <button onClick={() => setShowNewSvc(false)} className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Services List */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading services...</div>
      ) : (
        <div className="space-y-3">
          {q && visibleServices.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">No items match “{search}”.</div>
          )}
          {visibleServices.map(svc => (
            <div key={svc.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Service Header */}
              {editSvc?.id === svc.id ? (
                <div className="p-4 bg-blue-50 border-b border-blue-100">
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <input value={editSvc.name} onChange={e => setEditSvc({...editSvc, name: e.target.value})}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Name" />
                    <input value={editSvc.description} onChange={e => setEditSvc({...editSvc, description: e.target.value})}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Description" />
                    <select value={editSvc.pricing_unit} onChange={e => setEditSvc({...editSvc, pricing_unit: e.target.value})}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                      {PRICING_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={editSvc.active} onChange={e => setEditSvc({...editSvc, active: e.target.checked})} className="accent-amber-500" />
                      Active (visible to customers)
                    </label>
                    <div className="ml-auto flex gap-2">
                      <button onClick={handleUpdateService} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-500 transition-colors">
                        <Save size={12} /> Save
                      </button>
                      <button onClick={() => setEditSvc(null)} className="border border-gray-200 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                  onClick={() => setExpanded(expanded === svc.id ? null : svc.id)}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpanded(expanded === svc.id ? null : svc.id);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    {(q ? true : expanded === svc.id) ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{svc.name}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{svc.pricing_unit}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{svc.service_type}</span>
                        {!svc.active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Hidden</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{svc.items.length} items · {svc.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setEditSvc(svc)} className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-2.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1">
                      <Pencil size={11} /> Edit
                    </button>
                    <button onClick={() => handleDeleteService(svc.id, svc.name)} className="text-xs bg-red-100 text-red-700 hover:bg-red-200 px-2.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1">
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Items (expanded — searches auto-expand) */}
              {(q ? true : expanded === svc.id) && (
                <div className="border-t border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="px-5 py-2.5 text-left font-semibold">Item Name</th>
                        <th className="px-5 py-2.5 text-left font-semibold">Category</th>
                        <th className="px-5 py-2.5 text-left font-semibold">Price (₹)</th>
                        <th className="px-5 py-2.5 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {svc.items.map((item: any) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          {editItem && editItem.svcId === svc.id && editItem.itemId === item.id ? (
                            <>
                              <td className="px-5 py-2">
                                <input value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})}
                                  className="border border-amber-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-amber-500" />
                              </td>
                              <td className="px-5 py-2">
                                <select value={editItem.category} onChange={e => setEditItem({...editItem, category: e.target.value})}
                                  className="border border-amber-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-amber-500 capitalize">
                                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </td>
                              <td className="px-5 py-2">
                                <input type="number" value={editItem.price} onChange={e => setEditItem({...editItem, price: e.target.value})}
                                  className="border border-amber-300 rounded px-2 py-1 text-sm w-28 focus:outline-none focus:border-amber-500" />
                              </td>
                              <td className="px-5 py-2 text-right">
                                <div className="flex gap-1.5 justify-end">
                                  <button onClick={handleUpdateItem} className="bg-amber-500 text-white px-2.5 py-1 rounded text-xs font-semibold hover:bg-amber-400 transition-colors flex items-center gap-1">
                                    <Save size={10} /> Save
                                  </button>
                                  <button onClick={() => setEditItem(null)} className="border border-gray-200 px-2.5 py-1 rounded text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                                    <X size={10} />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-5 py-2.5 text-gray-800">{item.name}</td>
                              <td className="px-5 py-2.5">
                                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${categoryStyle(item.category || "unisex")}`}>
                                  {item.category || "unisex"}
                                </span>
                              </td>
                              <td className="px-5 py-2.5 font-semibold text-green-700">₹{item.price}</td>
                              <td className="px-5 py-2.5 text-right">
                                <div className="flex gap-1.5 justify-end">
                                  <button onClick={() => setEditItem({ svcId: svc.id, itemId: item.id, name: item.name, price: String(item.price), category: item.category || "unisex" })}
                                    className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-2.5 py-1 rounded font-semibold transition-colors flex items-center gap-0.5">
                                    <Pencil size={10} /> Edit
                                  </button>
                                  <button onClick={() => handleDeleteItem(svc.id, item.id, item.name)}
                                    className="text-xs bg-red-100 text-red-700 hover:bg-red-200 px-2.5 py-1 rounded font-semibold transition-colors flex items-center gap-0.5">
                                    <Trash2 size={10} /> Del
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}

                      {/* Add new item row */}
                      <tr className="bg-green-50">
                        <td className="px-5 py-2">
                          <input
                            value={newItem[svc.id]?.name || ""}
                            onChange={e => setNewItem(prev => ({ ...prev, [svc.id]: { ...prev[svc.id], name: e.target.value } }))}
                            placeholder="New item name (e.g. Saree Blouse)"
                            className="border border-green-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-green-500 bg-white"
                          />
                        </td>
                        <td className="px-5 py-2">
                          <select
                            value={newItem[svc.id]?.category || "unisex"}
                            onChange={e => setNewItem(prev => ({ ...prev, [svc.id]: { ...prev[svc.id], category: e.target.value } }))}
                            className="border border-green-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-green-500 bg-white capitalize"
                          >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-5 py-2">
                          <input
                            type="number"
                            value={newItem[svc.id]?.price || ""}
                            onChange={e => setNewItem(prev => ({ ...prev, [svc.id]: { ...prev[svc.id], price: e.target.value } }))}
                            placeholder="₹ Price"
                            className="border border-green-300 rounded px-2 py-1 text-sm w-28 focus:outline-none focus:border-green-500 bg-white"
                          />
                        </td>
                        <td className="px-5 py-2 text-right">
                          <button
                            onClick={() => handleAddItem(svc.id)}
                            disabled={!newItem[svc.id]?.name || !newItem[svc.id]?.price}
                            className="bg-green-600 disabled:opacity-40 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-green-500 transition-colors flex items-center gap-1 ml-auto"
                          >
                            <Plus size={10} /> Add Item
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
