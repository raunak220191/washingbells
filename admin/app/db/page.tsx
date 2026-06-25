"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import PageLayout from "@/components/PageLayout";
import api from "@/lib/api";
import {
  RefreshCw, Database, Plus, Save, Trash2, X, Search,
  ChevronLeft, ChevronRight, AlertTriangle, History,
  CheckCircle, Lock,
} from "lucide-react";

type CollectionInfo = { name: string; count: number; editable: boolean };

type ListResp = {
  collection: string;
  editable: boolean;
  total: number;
  limit: number;
  skip: number;
  documents: any[];
};

type AuditRow = {
  id: string;
  actor: { id: string; name: string | null; phone: string } | null;
  collection: string;
  action: "insert" | "update" | "delete";
  doc_id: string | null;
  before: any;
  after: any;
  created_at: string;
};

const PAGE_SIZE = 25;

function safeStringify(v: any): string {
  try { return JSON.stringify(v, null, 2); }
  catch { return String(v); }
}

function shortValue(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") {
    if (v.$oid) return v.$oid.slice(-8);
    if (v.$date) return new Date(v.$date).toLocaleString("en-IN");
    const s = JSON.stringify(v);
    return s.length > 50 ? s.slice(0, 50) + "…" : s;
  }
  const s = String(v);
  return s.length > 50 ? s.slice(0, 50) + "…" : s;
}

function docId(doc: any): string | null {
  if (!doc || !doc._id) return null;
  if (typeof doc._id === "string") return doc._id;
  if (doc._id.$oid) return doc._id.$oid;
  return null;
}

export default function DBPage() {
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("-created_at");
  const [skip, setSkip] = useState(0);

  // Editor drawer
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);

  // Audit log overlay
  const [showAudit, setShowAudit] = useState(false);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const active = useMemo(() => collections.find(c => c.name === activeName), [collections, activeName]);

  const loadCollections = useCallback(async () => {
    try {
      const res = await api.get("/admin/db/collections");
      setCollections(res.data || []);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Failed to load collections");
    }
  }, []);

  const loadList = useCallback(async (name: string, options?: { skip?: number; filter?: string; sort?: string }) => {
    setLoading(true);
    try {
      const params: any = {
        limit: PAGE_SIZE,
        skip: options?.skip ?? skip,
        sort: options?.sort ?? sort,
      };
      const fStr = (options?.filter ?? filter).trim();
      if (fStr) params.q = fStr;
      const res = await api.get(`/admin/db/${name}`, { params });
      setData(res.data);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Failed to load");
    } finally { setLoading(false); }
  }, [filter, sort, skip]);

  useEffect(() => { loadCollections(); }, [loadCollections]);

  useEffect(() => {
    if (!activeName) return;
    setSkip(0);
    loadList(activeName, { skip: 0 });
  }, [activeName]);

  // Re-fetch when filter/sort change (debounced)
  useEffect(() => {
    if (!activeName) return;
    const t = setTimeout(() => loadList(activeName, { skip: 0 }), 200);
    return () => clearTimeout(t);
  }, [filter, sort]);

  const openEditor = (doc: any) => {
    const id = docId(doc);
    if (!id) { alert("Document has no _id"); return; }
    setIsNew(false);
    setEditingId(id);
    setEditingText(safeStringify(doc));
    setEditorError(null);
  };

  const openNew = () => {
    if (!active?.editable) return;
    setIsNew(true);
    setEditingId("__new__");
    setEditingText("{\n  \n}");
    setEditorError(null);
  };

  const handleSave = async () => {
    if (!activeName) return;
    let parsed: any;
    try {
      parsed = JSON.parse(editingText);
    } catch (e: any) {
      setEditorError(`Invalid JSON: ${e.message}`);
      return;
    }
    setSaving(true);
    setEditorError(null);
    try {
      if (isNew) {
        await api.post(`/admin/db/${activeName}`, { document: parsed });
      } else if (editingId) {
        await api.put(`/admin/db/${activeName}/${editingId}`, { document: parsed });
      }
      setEditingId(null);
      await loadCollections();
      await loadList(activeName);
    } catch (e: any) {
      setEditorError(e?.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!activeName || !editingId || isNew) return;
    if (!window.confirm("Delete this document? This cannot be undone (but is recorded in the audit log).")) return;
    setSaving(true);
    try {
      await api.delete(`/admin/db/${activeName}/${editingId}`);
      setEditingId(null);
      await loadCollections();
      await loadList(activeName);
    } catch (e: any) {
      setEditorError(e?.response?.data?.detail || "Delete failed");
    } finally { setSaving(false); }
  };

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const params: any = { limit: 100 };
      if (activeName) params.collection = activeName;
      const res = await api.get("/admin/db/_audit/log", { params });
      setAudit(res.data || []);
    } finally { setAuditLoading(false); }
  }, [activeName]);

  useEffect(() => { if (showAudit) loadAudit(); }, [showAudit, loadAudit]);

  // Columns derived from displayed documents — pick interesting fields
  const columns = useMemo(() => {
    if (!data?.documents?.length) return ["_id"];
    const fields = new Set<string>(["_id"]);
    for (const doc of data.documents) {
      for (const k of Object.keys(doc || {})) {
        fields.add(k);
        if (fields.size > 7) break;
      }
      if (fields.size > 7) break;
    }
    return Array.from(fields).slice(0, 7);
  }, [data]);

  return (
    <PageLayout title="Database">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <AlertTriangle size={14} className="text-orange-500" />
          <span>
            Power-user view of MongoDB. Edits go through audit log. <strong>Users</strong> and <strong>orders</strong> are read-only here — use their dedicated admin pages.
          </span>
        </div>
        <button
          onClick={() => setShowAudit(s => !s)}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          <History size={13} /> Audit Log
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Sidebar */}
        <div className="col-span-3 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Database size={14} /> Collections
            </h3>
            <button onClick={loadCollections} className="p-1 rounded hover:bg-gray-100"><RefreshCw size={12} /></button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {collections.map(c => (
              <button
                key={c.name}
                onClick={() => setActiveName(c.name)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-amber-50 flex items-center gap-2 ${
                  activeName === c.name ? "bg-amber-50 border-l-4 border-l-amber-500" : ""
                }`}
              >
                <span className="flex-1 font-mono">{c.name}</span>
                <span className="text-xs text-gray-400">{c.count.toLocaleString("en-IN")}</span>
                {!c.editable && <Lock size={10} className="text-gray-400" />}
              </button>
            ))}
          </div>
        </div>

        {/* Main */}
        <div className="col-span-9 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          {!activeName ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
              <Database size={36} className="text-gray-300" />
              <p className="text-sm font-semibold mt-3">Pick a collection</p>
              <p className="text-xs mt-1">Editable collections show a save button. Others are read-only.</p>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-gray-900 font-mono">{activeName}</h2>
                {active?.editable
                  ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1"><CheckCircle size={9} /> editable</span>
                  : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1"><Lock size={9} /> read-only</span>}
                <span className="text-xs text-gray-400">{data?.total ?? 0} docs</span>
                <div className="ml-auto flex items-center gap-2">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={filter}
                      onChange={e => setFilter(e.target.value)}
                      placeholder='{"role":"customer"}'
                      className="pl-7 pr-3 py-1.5 border border-gray-200 rounded text-xs font-mono w-72 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <select
                    value={sort}
                    onChange={e => setSort(e.target.value)}
                    className="border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="-created_at">Newest first</option>
                    <option value="created_at">Oldest first</option>
                    <option value="-updated_at">Recently updated</option>
                    <option value="_id">_id ascending</option>
                  </select>
                  {active?.editable && (
                    <button
                      onClick={openNew}
                      className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded text-xs font-bold hover:bg-amber-600"
                    >
                      <Plus size={11} /> Insert
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto">
                {loading ? (
                  <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
                ) : !data?.documents?.length ? (
                  <div className="p-12 text-center text-gray-400 text-sm">No documents match this filter.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>
                        {columns.map(c => (
                          <th key={c} className="px-3 py-2 text-left font-semibold font-mono normal-case whitespace-nowrap">{c}</th>
                        ))}
                        <th className="px-3 py-2 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.documents.map(doc => {
                        const id = docId(doc);
                        return (
                          <tr key={id || Math.random()} className="hover:bg-gray-50">
                            {columns.map(c => (
                              <td key={c} className="px-3 py-2 font-mono text-xs text-gray-700 max-w-[200px] truncate" title={shortValue(doc[c])}>
                                {shortValue(doc[c])}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => openEditor(doc)}
                                className="text-xs font-semibold text-amber-700 hover:bg-amber-50 px-2 py-1 rounded"
                              >
                                {active?.editable ? "Edit" : "View"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              {data && data.total > PAGE_SIZE && (
                <div className="px-5 py-2 border-t border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    {skip + 1}–{Math.min(skip + (data.documents?.length || 0), data.total)} of {data.total}
                  </span>
                  <div className="flex gap-1">
                    <button
                      disabled={skip === 0}
                      onClick={() => { const ns = Math.max(0, skip - PAGE_SIZE); setSkip(ns); loadList(activeName, { skip: ns }); }}
                      className="p-1.5 border border-gray-200 rounded disabled:opacity-30 hover:bg-gray-50"
                    ><ChevronLeft size={14} /></button>
                    <button
                      disabled={skip + PAGE_SIZE >= data.total}
                      onClick={() => { const ns = skip + PAGE_SIZE; setSkip(ns); loadList(activeName, { skip: ns }); }}
                      className="p-1.5 border border-gray-200 rounded disabled:opacity-30 hover:bg-gray-50"
                    ><ChevronRight size={14} /></button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Editor Drawer ── */}
      {editingId && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setEditingId(null)} />
          <div className="w-[640px] bg-white h-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {isNew ? "Insert document" : "Edit document"}
                </h2>
                <div className="text-xs text-gray-500 font-mono mt-0.5">
                  {activeName}{!isNew && editingId && ` · ${editingId.slice(-8)}`}
                </div>
              </div>
              <button onClick={() => setEditingId(null)} className="p-1.5 rounded hover:bg-gray-100"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-hidden p-4 flex flex-col">
              <textarea
                value={editingText}
                onChange={e => setEditingText(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full font-mono text-xs leading-relaxed border border-gray-200 rounded p-3 focus:outline-none focus:border-amber-500 resize-none bg-gray-50"
                disabled={!active?.editable}
              />
              {editorError && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  {editorError}
                </div>
              )}
              <div className="text-xs text-gray-400 mt-2">
                Tip: dates may be entered as <code className="bg-gray-100 px-1 rounded">{"{\"$date\":\"2026-05-31T00:00:00Z\"}"}</code>,
                ObjectIds as <code className="bg-gray-100 px-1 rounded">{"{\"$oid\":\"...\"}"}</code>.
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex items-center gap-2">
              {!isNew && active?.editable && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded text-sm font-bold disabled:opacity-50"
                >
                  <Trash2 size={13} /> Delete
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-2 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                {active?.editable && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded text-sm font-bold hover:bg-amber-600 disabled:opacity-50"
                  >
                    <Save size={13} /> {saving ? "Saving..." : isNew ? "Insert" : "Save"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Audit Log Drawer ── */}
      {showAudit && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowAudit(false)} />
          <div className="w-[640px] bg-white h-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h2 className="text-base font-bold text-gray-900">Audit Log</h2>
                <div className="text-xs text-gray-500 mt-0.5">{activeName ? `Filtered to: ${activeName}` : "All collections"}</div>
              </div>
              <button onClick={() => setShowAudit(false)} className="p-1.5 rounded hover:bg-gray-100"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {auditLoading ? (
                <div className="text-center text-gray-400 text-sm py-8">Loading…</div>
              ) : audit.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">No edits recorded yet.</div>
              ) : audit.map(row => (
                <div key={row.id} className="border border-gray-200 rounded p-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                      row.action === "insert" ? "bg-green-100 text-green-700" :
                      row.action === "update" ? "bg-blue-100 text-blue-700" :
                      "bg-red-100 text-red-700"
                    }`}>{row.action}</span>
                    <span className="font-mono font-bold">{row.collection}</span>
                    {row.doc_id && <span className="font-mono text-gray-400">{row.doc_id.slice(-8)}</span>}
                    <span className="ml-auto text-gray-400">{new Date(row.created_at).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    By: {row.actor?.name || row.actor?.phone || row.actor?.id || "unknown"}
                  </div>
                  {row.action === "update" && row.before && row.after && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer">View diff</summary>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-gray-400 font-bold mb-1">BEFORE</div>
                          <pre className="bg-red-50 p-2 rounded overflow-x-auto max-h-40 font-mono text-xs">{safeStringify(row.before)}</pre>
                        </div>
                        <div>
                          <div className="text-gray-400 font-bold mb-1">AFTER</div>
                          <pre className="bg-green-50 p-2 rounded overflow-x-auto max-h-40 font-mono text-xs">{safeStringify(row.after)}</pre>
                        </div>
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
