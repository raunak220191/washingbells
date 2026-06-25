"use client";
import { useEffect, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import PageLayout from "@/components/PageLayout";
import api from "@/lib/api";
import {
  Bold, Italic, List, ListOrdered, Heading2, Heading3, Link2, Undo, Redo,
  Save, AlertTriangle, CheckCircle, RefreshCw, Send, Eye, History,
  Mail, Edit3, UserX, Trash2, Search,
} from "lucide-react";

type EmailEvent = {
  id: string | null;
  event: string;
  name: string;
  audience: "customer" | "store" | "rider" | "admin";
  enabled: boolean;
  subject_template: string;
  body_html: string;
  body_text: string;
  updated_at: string | null;
};

type EmailLog = {
  id: string;
  event: string;
  audience: string;
  to: string | null;
  subject: string;
  status: string;
  error: string | null;
  created_at: string;
};

type ConfigStatus = {
  enabled: boolean;
  has_api_key: boolean;
  from_address: string | null;
  from_name: string | null;
  reply_to: string | null;
  admin_address: string | null;
  will_actually_send: boolean;
};

const AUDIENCE_LABEL: Record<string, string> = {
  customer: "Customer", store: "Store Owner", rider: "Rider", admin: "Admin",
};

const AUDIENCE_COLOR: Record<string, string> = {
  customer: "bg-blue-100 text-blue-700",
  store: "bg-orange-100 text-orange-700",
  rider: "bg-purple-100 text-purple-700",
  admin: "bg-gray-200 text-gray-700",
};

const STATUS_COLOR: Record<string, string> = {
  sent: "bg-green-100 text-green-700",
  dev_logged: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
  disabled: "bg-gray-100 text-gray-500",
  no_address: "bg-gray-100 text-gray-500",
  no_template: "bg-gray-100 text-gray-500",
};

function ToolbarBtn({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${active ? "bg-amber-100 text-amber-700" : "text-gray-600 hover:bg-gray-100"}`}
    >
      {children}
    </button>
  );
}

type Recipient = { id: string; name: string | null; phone: string; email: string | null; role: string };
type Unsubscribed = { id: string; email: string; source: string; unsubscribed_at: string };

type Tab = "events" | "compose" | "unsubscribed";

export default function EmailPage() {
  const [tab, setTab] = useState<Tab>("events");
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [editing, setEditing] = useState<EmailEvent | null>(null);
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [testTo, setTestTo] = useState("");

  // Compose tab state
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeAudience, setComposeAudience] = useState<"customer" | "store" | "rider" | "admin">("admin");
  const [composeSending, setComposeSending] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientRoleFilter, setRecipientRoleFilter] = useState("");
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);

  // Unsubscribed tab state
  const [unsubs, setUnsubs] = useState<Unsubscribed[]>([]);
  const [unsubsLoading, setUnsubsLoading] = useState(false);

  const composeEditor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-amber-600 underline" } }),
    ],
    content: "",
    editorProps: {
      attributes: { class: "prose prose-sm max-w-none focus:outline-none min-h-[280px] px-5 py-4" },
    },
    immediatelyRender: false,
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-amber-600 underline" } }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[280px] px-5 py-4",
      },
    },
    immediatelyRender: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, configRes] = await Promise.all([
        api.get("/admin/email/events"),
        api.get("/admin/email/config-status"),
      ]);
      setEvents(eventsRes.data || []);
      setConfig(configRes.data);
    } finally { setLoading(false); }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const res = await api.get("/admin/email/log?limit=100");
      setLogs(res.data || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  // When an event is selected, load it into the editing form
  useEffect(() => {
    if (!selectedEvent || !editor) return;
    const found = events.find(e => e.event === selectedEvent);
    if (!found) return;
    setEditing({ ...found });
    setTestTo(config?.admin_address || "");
    editor.commands.setContent(found.body_html || "");
  }, [selectedEvent, events, editor, config?.admin_address]);

  const handleSave = async () => {
    if (!editing || !editor) return;
    setSaving(true);
    try {
      const body_html = editor.getHTML();
      await api.put(`/admin/email/events/${editing.event}`, {
        name: editing.name,
        audience: editing.audience,
        enabled: editing.enabled,
        subject_template: editing.subject_template,
        body_html,
        body_text: editing.body_text,
      });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  };

  const handleToggleEnabled = async (event: EmailEvent, enabled: boolean) => {
    try {
      await api.put(`/admin/email/events/${event.event}`, { enabled });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Toggle failed");
    }
  };

  const handleSendTest = async () => {
    if (!editing) return;
    const to = (testTo || "").trim();
    if (!to) { alert("Enter a test recipient address."); return; }
    try {
      const res = await api.post("/admin/email/test", {
        event: editing.event,
        to,
        audience: editing.audience,
      });
      if (res.data?.sent) {
        alert(`Test ${config?.will_actually_send ? "sent" : "logged"} to ${to}.`);
      } else {
        alert(`Test could not be processed. Check the log for details.`);
      }
      if (showLogs) loadLogs();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Test failed");
    }
  };

  const setLink = () => {
    if (!editor) return;
    const url = window.prompt("URL", "https://");
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  // ── Compose tab handlers ───────────────────────────────────
  const loadRecipients = useCallback(async () => {
    try {
      const params: any = { only_with_email: true, limit: 30 };
      if (recipientSearch) params.q = recipientSearch;
      if (recipientRoleFilter) params.role = recipientRoleFilter;
      const res = await api.get("/admin/email/recipients", { params });
      setRecipients(res.data || []);
    } catch {}
  }, [recipientSearch, recipientRoleFilter]);

  useEffect(() => {
    if (!recipientPickerOpen) return;
    const id = setTimeout(loadRecipients, 200); // debounce
    return () => clearTimeout(id);
  }, [recipientPickerOpen, recipientSearch, recipientRoleFilter, loadRecipients]);

  const handleSendCompose = async () => {
    const to = (composeTo || "").trim();
    if (!to) { alert("Recipient address required."); return; }
    if (!composeSubject.trim()) { alert("Subject required."); return; }
    const body_html = composeEditor?.getHTML() || "";
    if (!body_html || body_html === "<p></p>") { alert("Body required."); return; }
    setComposeSending(true);
    try {
      const res = await api.post("/admin/email/compose", {
        to,
        subject: composeSubject.trim(),
        body_html,
        audience: composeAudience,
      });
      if (res.data?.sent) {
        alert(`Sent to ${to}.`);
        composeEditor?.commands.setContent("");
        setComposeSubject("");
      } else {
        alert(`Failed: ${res.data?.error || "unknown"}`);
      }
      if (showLogs) loadLogs();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Send failed");
    } finally { setComposeSending(false); }
  };

  // ── Unsubscribed tab handlers ──────────────────────────────
  const loadUnsubs = useCallback(async () => {
    setUnsubsLoading(true);
    try {
      const res = await api.get("/admin/email/unsubscribed?limit=200");
      setUnsubs(res.data || []);
    } finally { setUnsubsLoading(false); }
  }, []);

  useEffect(() => { if (tab === "unsubscribed") loadUnsubs(); }, [tab, loadUnsubs]);

  const handleResubscribe = async (email: string) => {
    if (!window.confirm(`Re-subscribe ${email}? They will start receiving non-essential emails again.`)) return;
    try {
      await api.delete(`/admin/email/unsubscribed/${encodeURIComponent(email)}`);
      await loadUnsubs();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Failed");
    }
  };

  return (
    <PageLayout title="Email Notifications">
      {/* Config Status Banner */}
      {config && !config.will_actually_send && (
        <div className="mb-4 flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <AlertTriangle size={18} className="text-orange-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-orange-800">
            <strong>Email sending is not active yet.</strong> Emails will be logged but not delivered until all of these are set in <code className="bg-orange-100 px-1 rounded">backend/.env</code>:
            <ul className="mt-2 space-y-0.5 text-xs font-mono">
              <li className="flex items-center gap-2">{config.has_api_key ? <CheckCircle size={11} className="text-green-600" /> : <span className="w-3 h-3 rounded-full bg-orange-300 inline-block" />} SENDGRID_API_KEY</li>
              <li className="flex items-center gap-2">{config.from_address ? <CheckCircle size={11} className="text-green-600" /> : <span className="w-3 h-3 rounded-full bg-orange-300 inline-block" />} EMAIL_FROM_ADDRESS {config.from_address && `= ${config.from_address}`}</li>
              <li className="flex items-center gap-2">{config.enabled ? <CheckCircle size={11} className="text-green-600" /> : <span className="w-3 h-3 rounded-full bg-orange-300 inline-block" />} EMAIL_ENABLED=true</li>
            </ul>
          </div>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {[
          { key: "events" as Tab, label: "Event Templates", icon: Mail },
          { key: "compose" as Tab, label: "Compose", icon: Edit3 },
          { key: "unsubscribed" as Tab, label: "Unsubscribed", icon: UserX },
        ].map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                active
                  ? "border-amber-500 text-amber-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Top bar */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw size={13} /> Refresh
        </button>
        <button
          onClick={() => { setShowLogs(s => !s); if (!showLogs) loadLogs(); }}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          <History size={13} /> {showLogs ? "Hide" : "View"} Log
        </button>
        <div className="ml-auto text-xs text-gray-500">
          From: <span className="font-mono">{config?.from_address || "—"}</span>
          {config?.from_name && <> · <span className="font-mono">{config.from_name}</span></>}
        </div>
      </div>

      {showLogs && (
        <div className="mb-5 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-sm">Recent Email Activity</h3>
            <span className="text-xs text-gray-400">{logs.length} most recent</span>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase">
                <tr>
                  {["Time", "Event", "Audience", "To", "Subject", "Status"].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-6 text-center text-gray-400">No emails sent yet</td></tr>
                ) : logs.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-700">{l.event}</td>
                    <td className="px-3 py-1.5"><span className={`px-1.5 py-0.5 rounded text-xs font-bold ${AUDIENCE_COLOR[l.audience] || "bg-gray-100"}`}>{AUDIENCE_LABEL[l.audience] || l.audience}</span></td>
                    <td className="px-3 py-1.5 font-mono text-gray-500">{l.to || <span className="italic text-gray-300">—</span>}</td>
                    <td className="px-3 py-1.5 text-gray-700 truncate max-w-[200px]" title={l.subject}>{l.subject || "—"}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${STATUS_COLOR[l.status] || "bg-gray-100"}`}>{l.status}</span>
                      {l.error && <div className="text-xs text-red-500 mt-0.5 truncate max-w-[200px]" title={l.error}>{l.error}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "events" && (
      <div className="grid grid-cols-12 gap-4">
        {/* Events list */}
        <div className="col-span-4 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800">Events ({events.length})</h3>
            <p className="text-xs text-gray-400 mt-0.5">Toggle to enable, click to edit template</p>
          </div>
          <div className="divide-y divide-gray-100 max-h-[700px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>
            ) : events.map(e => (
              <div key={e.event} className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${selectedEvent === e.event ? "bg-amber-50 border-l-4 border-l-amber-500" : ""}`}>
                <div className="flex items-start gap-3" onClick={() => setSelectedEvent(e.event)}>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate">{e.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${AUDIENCE_COLOR[e.audience]}`}>
                        {AUDIENCE_LABEL[e.audience]}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">{e.event}</span>
                    </div>
                  </div>
                  <label className="inline-flex items-center cursor-pointer" onClick={ev => ev.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={!!e.enabled}
                      onChange={ev => handleToggleEnabled(e, ev.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-9 h-5 rounded-full relative transition-colors ${e.enabled ? "bg-green-500" : "bg-gray-300"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${e.enabled ? "left-[18px]" : "left-0.5"}`} />
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="col-span-8 bg-white border border-gray-200 rounded-xl">
          {!editing ? (
            <div className="p-12 text-center text-gray-400">
              <p className="text-sm">Select an event on the left to edit its template.</p>
            </div>
          ) : (
            <>
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{editing.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${AUDIENCE_COLOR[editing.audience]}`}>
                        {AUDIENCE_LABEL[editing.audience]}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">{editing.event}</span>
                      {editing.updated_at && <span className="text-xs text-gray-400">· updated {new Date(editing.updated_at).toLocaleDateString("en-IN")}</span>}
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editing.enabled}
                      onChange={ev => setEditing(p => p ? ({ ...p, enabled: ev.target.checked }) : p)}
                      className="sr-only"
                    />
                    <div className={`w-9 h-5 rounded-full relative transition-colors ${editing.enabled ? "bg-green-500" : "bg-gray-300"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${editing.enabled ? "left-[18px]" : "left-0.5"}`} />
                    </div>
                    <span className="text-xs font-semibold text-gray-600">{editing.enabled ? "Enabled" : "Disabled"}</span>
                  </label>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Subject</label>
                  <input
                    value={editing.subject_template}
                    onChange={e => setEditing(p => p ? ({ ...p, subject_template: e.target.value }) : p)}
                    placeholder="Use {{variables}} like {{order_number}}, {{customer_name}}, {{total_amount}}"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">HTML Body</label>
                    <button
                      onClick={() => setPreviewMode(p => !p)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
                    >
                      <Eye size={11} /> {previewMode ? "Edit" : "Preview"}
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {!previewMode && editor && (
                      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-100 bg-gray-50">
                        <ToolbarBtn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></ToolbarBtn>
                        <ToolbarBtn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></ToolbarBtn>
                        <div className="w-px h-5 bg-gray-200 mx-1" />
                        <ToolbarBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={14} /></ToolbarBtn>
                        <ToolbarBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={14} /></ToolbarBtn>
                        <div className="w-px h-5 bg-gray-200 mx-1" />
                        <ToolbarBtn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={14} /></ToolbarBtn>
                        <ToolbarBtn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} /></ToolbarBtn>
                        <ToolbarBtn title="Link" active={editor.isActive("link")} onClick={setLink}><Link2 size={14} /></ToolbarBtn>
                        <div className="w-px h-5 bg-gray-200 mx-1" />
                        <ToolbarBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo size={14} /></ToolbarBtn>
                        <ToolbarBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo size={14} /></ToolbarBtn>
                      </div>
                    )}
                    {previewMode
                      ? <div className="prose prose-sm max-w-none px-5 py-4 min-h-[280px]" dangerouslySetInnerHTML={{ __html: editor?.getHTML() || "" }} />
                      : <EditorContent editor={editor} />}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Plain Text Fallback</label>
                  <textarea
                    value={editing.body_text}
                    onChange={e => setEditing(p => p ? ({ ...p, body_text: e.target.value }) : p)}
                    placeholder="Used by email clients that don't render HTML"
                    rows={5}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                  <strong>Available variables (depending on event):</strong>
                  <div className="mt-1 font-mono text-blue-700 flex flex-wrap gap-x-3 gap-y-1">
                    <span>{`{{customer_name}}`}</span>
                    <span>{`{{order_number}}`}</span>
                    <span>{`{{total_amount}}`}</span>
                    <span>{`{{items_count}}`}</span>
                    <span>{`{{store_name}}`}</span>
                    <span>{`{{owner_name}}`}</span>
                    <span>{`{{rider_name}}`}</span>
                    <span>{`{{pickup_slot}}`}</span>
                    <span>{`{{vendor_code}}`}</span>
                    <span>{`{{city}}`}</span>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-gray-100 flex items-center gap-3 bg-gray-50">
                <input
                  value={testTo}
                  onChange={e => setTestTo(e.target.value)}
                  placeholder="Send test to email…"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={handleSendTest}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100"
                >
                  <Send size={13} /> Send Test
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 disabled:opacity-50"
                >
                  <Save size={14} /> {saving ? "Saving..." : "Save Template"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {/* ── COMPOSE TAB ── */}
      {tab === "compose" && (
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Compose Email</h2>
            <p className="text-xs text-gray-500 mt-1">
              Send a one-off email to any address. Bypasses the event template system.
              Customer-audience emails honour the unsubscribe list and include a footer.
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* Recipient */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">To</label>
              <div className="flex gap-2">
                <input
                  value={composeTo}
                  onChange={e => setComposeTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setRecipientPickerOpen(p => !p)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Search size={13} /> Pick user
                </button>
              </div>
              {recipientPickerOpen && (
                <div className="mt-2 border border-gray-200 rounded-lg bg-gray-50 p-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={recipientSearch}
                      onChange={e => setRecipientSearch(e.target.value)}
                      placeholder="Search by name, email, phone…"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500"
                    />
                    <select
                      value={recipientRoleFilter}
                      onChange={e => setRecipientRoleFilter(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500"
                    >
                      <option value="">All roles</option>
                      <option value="customer">Customer</option>
                      <option value="rider">Rider</option>
                      <option value="store_owner">Store Owner</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {recipients.length === 0 ? (
                      <div className="text-xs text-gray-400 italic text-center py-4">No users with an email match.</div>
                    ) : recipients.map(r => (
                      <button
                        key={r.id}
                        onClick={() => {
                          if (r.email) {
                            setComposeTo(r.email);
                            // Auto-set audience from role
                            const aud = (r.role === "store_owner" ? "store" : r.role) as any;
                            if (["customer", "store", "rider", "admin"].includes(aud)) setComposeAudience(aud);
                            setRecipientPickerOpen(false);
                          }
                        }}
                        className="w-full text-left bg-white hover:bg-amber-50 border border-gray-100 rounded-lg px-3 py-2 text-xs flex items-center gap-3"
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800">{r.name || <span className="italic text-gray-400">No name</span>}</div>
                          <div className="text-gray-500">{r.email}</div>
                        </div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700 capitalize">{r.role.replace("_", " ")}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Audience */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Audience</label>
              <div className="flex gap-2">
                {[
                  { v: "customer", label: "Customer" },
                  { v: "rider", label: "Rider" },
                  { v: "store", label: "Store Owner" },
                  { v: "admin", label: "Admin / Other" },
                ].map(o => (
                  <button
                    key={o.v}
                    onClick={() => setComposeAudience(o.v as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      composeAudience === o.v
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {composeAudience === "customer" && (
                <p className="text-xs text-gray-500 mt-1.5">
                  Customer emails check the suppression list and auto-include an unsubscribe footer.
                </p>
              )}
            </div>

            {/* Subject */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Subject</label>
              <input
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
                placeholder="Quick subject line"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Body */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Body</label>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {composeEditor && (
                  <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-100 bg-gray-50">
                    <ToolbarBtn title="Bold" active={composeEditor.isActive("bold")} onClick={() => composeEditor.chain().focus().toggleBold().run()}><Bold size={14} /></ToolbarBtn>
                    <ToolbarBtn title="Italic" active={composeEditor.isActive("italic")} onClick={() => composeEditor.chain().focus().toggleItalic().run()}><Italic size={14} /></ToolbarBtn>
                    <div className="w-px h-5 bg-gray-200 mx-1" />
                    <ToolbarBtn title="Heading 2" active={composeEditor.isActive("heading", { level: 2 })} onClick={() => composeEditor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={14} /></ToolbarBtn>
                    <ToolbarBtn title="Heading 3" active={composeEditor.isActive("heading", { level: 3 })} onClick={() => composeEditor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={14} /></ToolbarBtn>
                    <div className="w-px h-5 bg-gray-200 mx-1" />
                    <ToolbarBtn title="Bullet list" active={composeEditor.isActive("bulletList")} onClick={() => composeEditor.chain().focus().toggleBulletList().run()}><List size={14} /></ToolbarBtn>
                    <ToolbarBtn title="Numbered list" active={composeEditor.isActive("orderedList")} onClick={() => composeEditor.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} /></ToolbarBtn>
                    <ToolbarBtn title="Link" active={composeEditor.isActive("link")} onClick={() => {
                      const url = window.prompt("URL", "https://");
                      if (url) composeEditor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
                    }}><Link2 size={14} /></ToolbarBtn>
                    <div className="w-px h-5 bg-gray-200 mx-1" />
                    <ToolbarBtn title="Undo" onClick={() => composeEditor.chain().focus().undo().run()}><Undo size={14} /></ToolbarBtn>
                    <ToolbarBtn title="Redo" onClick={() => composeEditor.chain().focus().redo().run()}><Redo size={14} /></ToolbarBtn>
                  </div>
                )}
                <EditorContent editor={composeEditor} />
              </div>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 rounded-b-xl">
            <button
              onClick={() => { composeEditor?.commands.setContent(""); setComposeSubject(""); setComposeTo(""); }}
              className="text-sm font-semibold text-gray-500 hover:text-gray-800"
            >
              Clear
            </button>
            <button
              onClick={handleSendCompose}
              disabled={composeSending || !config?.will_actually_send}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 disabled:opacity-50"
              title={config?.will_actually_send ? "" : "Backend isn't configured to send. The send will be logged but not delivered."}
            >
              <Send size={14} /> {composeSending ? "Sending..." : config?.will_actually_send ? "Send" : "Dev-log Send"}
            </button>
          </div>
        </div>
      )}

      {/* ── UNSUBSCRIBED TAB ── */}
      {tab === "unsubscribed" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Unsubscribed Recipients</h2>
              <p className="text-xs text-gray-500 mt-1">Customer audience emails are skipped for these addresses.</p>
            </div>
            <button onClick={loadUnsubs} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
          {unsubsLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : unsubs.length === 0 ? (
            <div className="p-12 text-center">
              <UserX size={32} className="text-gray-300 mx-auto" />
              <p className="text-sm font-semibold text-gray-600 mt-3">Nobody has unsubscribed</p>
              <p className="text-xs text-gray-400 mt-1">When a customer taps the unsubscribe footer in an email, they appear here.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Email</th>
                  <th className="px-5 py-3 text-left font-semibold">Source</th>
                  <th className="px-5 py-3 text-left font-semibold">Unsubscribed</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {unsubs.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-5 py-2.5 font-mono text-gray-800">{u.email}</td>
                    <td className="px-5 py-2.5 text-xs text-gray-500 capitalize">{u.source || "—"}</td>
                    <td className="px-5 py-2.5 text-xs text-gray-500">{new Date(u.unsubscribed_at).toLocaleString("en-IN")}</td>
                    <td className="px-5 py-2.5 text-right">
                      <button
                        onClick={() => handleResubscribe(u.email)}
                        className="inline-flex items-center gap-1 text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded"
                      >
                        <Trash2 size={11} /> Re-subscribe
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <style jsx global>{`
        .ProseMirror h2 { font-size: 1.25rem; font-weight: 700; margin: 1rem 0 0.5rem; color: #111; }
        .ProseMirror h3 { font-size: 1.1rem; font-weight: 700; margin: 0.75rem 0 0.4rem; color: #222; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; margin: 0.5rem 0; }
        .ProseMirror li { margin: 0.25rem 0; }
        .ProseMirror p { margin: 0.5rem 0; line-height: 1.6; }
        .ProseMirror a { color: #d97706; text-decoration: underline; }
        .ProseMirror:focus { outline: none; }
      `}</style>
    </PageLayout>
  );
}
