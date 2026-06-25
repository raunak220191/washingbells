"use client";
import { useEffect, useState, useCallback } from "react";
import PageLayout from "@/components/PageLayout";
import api from "@/lib/api";
import {
  RefreshCw, X, Search, Inbox as InboxIcon, Mail, MailOpen,
  Archive, ArchiveRestore, Trash2, Paperclip, AlertTriangle,
  ExternalLink, Reply,
} from "lucide-react";
import { useRouter } from "next/navigation";

type InboxListItem = {
  id: string;
  from_email: string | null; from_name: string | null;
  to_email: string | null;
  subject: string; excerpt: string;
  read: boolean; archived: boolean;
  spam_score: number | null;
  order_number: string | null; order_id: string | null;
  user_id: string | null;
  attachments_count: number;
  received_at: string;
};

type InboxDetail = InboxListItem & {
  text: string; html: string;
  attachments: { upload_id: string; filename: string; content_type: string; size: number }[];
  envelope: any;
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const formatFull = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function InboxPage() {
  const router = useRouter();
  const [items, setItems] = useState<InboxListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InboxDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100, only_unread: onlyUnread, include_archived: includeArchived };
      if (search) params.q = search;
      const res = await api.get("/inbox/list", { params });
      setItems(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } finally { setLoading(false); }
  }, [search, onlyUnread, includeArchived]);

  useEffect(() => { load(); }, [load]);

  const open = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.get(`/inbox/${id}`);
      setDetail(res.data);
      // Mark read in list view too
      setItems(prev => prev.map(it => it.id === id ? { ...it, read: true } : it));
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Failed to load");
    } finally { setDetailLoading(false); }
  };

  const toggleRead = async (id: string, currentRead: boolean) => {
    try {
      await api.put(`/inbox/${id}/read`, { read: !currentRead });
      setItems(prev => prev.map(it => it.id === id ? { ...it, read: !currentRead } : it));
      if (selectedId === id && detail) setDetail({ ...detail, read: !currentRead });
    } catch {}
  };

  const toggleArchive = async (id: string, currentArchived: boolean) => {
    try {
      await api.put(`/inbox/${id}/archive`, { archived: !currentArchived });
      if (!includeArchived) setItems(prev => prev.filter(it => it.id !== id));
      else setItems(prev => prev.map(it => it.id === id ? { ...it, archived: !currentArchived } : it));
      if (selectedId === id) setSelectedId(null);
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this email forever?")) return;
    try {
      await api.delete(`/inbox/${id}`);
      setItems(prev => prev.filter(it => it.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch {}
  };

  const replyTo = (d: InboxDetail) => {
    // Pre-fill the compose tab on the email page
    const params = new URLSearchParams({
      to: d.from_email || "",
      subject: d.subject?.toLowerCase().startsWith("re:") ? d.subject : `Re: ${d.subject || ""}`,
    });
    router.push(`/email?${params.toString()}`);
  };

  return (
    <PageLayout title="Inbox">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search subject, sender, content…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-72 focus:outline-none focus:border-amber-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox" checked={onlyUnread}
            onChange={e => setOnlyUnread(e.target.checked)}
            className="rounded text-amber-500 focus:ring-amber-500"
          />
          Unread only
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox" checked={includeArchived}
            onChange={e => setIncludeArchived(e.target.checked)}
            className="rounded text-amber-500 focus:ring-amber-500"
          />
          Include archived
        </label>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw size={13} /> Refresh
        </button>
        <span className="ml-auto text-sm text-gray-500">{items.length} of {total}</span>
      </div>

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* List */}
        <div className="col-span-5 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
          ) : items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <InboxIcon size={36} className="text-gray-300" />
              <p className="text-sm font-semibold text-gray-600 mt-3">No emails</p>
              <p className="text-xs text-gray-400 mt-1">
                Configure SendGrid Inbound Parse to route mail here.
              </p>
            </div>
          ) : (
            <div className="overflow-y-auto divide-y divide-gray-100">
              {items.map(it => (
                <button
                  key={it.id}
                  onClick={() => open(it.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors flex items-start gap-3 ${
                    selectedId === it.id ? "bg-amber-50 border-l-4 border-l-amber-500" : ""
                  } ${!it.read ? "bg-blue-50/30" : ""}`}
                >
                  {!it.read
                    ? <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                    : <span className="w-2 h-2 rounded-full mt-2 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm truncate ${!it.read ? "font-bold text-gray-900" : "text-gray-700"}`}>
                        {it.from_name || it.from_email || "Unknown sender"}
                      </span>
                      {it.attachments_count > 0 && <Paperclip size={11} className="text-gray-400 shrink-0" />}
                      {it.spam_score && it.spam_score > 5 && <AlertTriangle size={11} className="text-red-500 shrink-0" />}
                      <span className="ml-auto text-xs text-gray-400 shrink-0">{formatTime(it.received_at)}</span>
                    </div>
                    <div className={`text-sm truncate mt-0.5 ${!it.read ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                      {it.subject || "(no subject)"}
                    </div>
                    <div className="text-xs text-gray-400 truncate mt-0.5">{it.excerpt}</div>
                    {it.order_number && (
                      <div className="mt-1.5">
                        <span className="font-mono text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
                          {it.order_number}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="col-span-7 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-center text-gray-400 p-8">
              <div>
                <Mail size={36} className="mx-auto text-gray-300" />
                <p className="text-sm font-semibold mt-3">Select an email to read it</p>
              </div>
            </div>
          ) : detailLoading || !detail ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
          ) : (
            <>
              <div className="p-5 border-b border-gray-100 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-gray-900">{detail.subject || "(no subject)"}</h2>
                  <div className="text-xs text-gray-500 mt-1">
                    <strong className="text-gray-700">From:</strong> {detail.from_name && `${detail.from_name} `}
                    <span className="font-mono">&lt;{detail.from_email}&gt;</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    <strong className="text-gray-700">To:</strong> <span className="font-mono">{detail.to_email}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{formatFull(detail.received_at)}</div>
                  {detail.spam_score && (
                    <div className="text-xs text-gray-500 mt-1">
                      Spam score: <span className={detail.spam_score > 5 ? "text-red-600 font-bold" : "text-gray-700"}>{detail.spam_score.toFixed(1)}</span>
                    </div>
                  )}
                  {(detail.order_number || detail.user_id) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {detail.order_number && (
                        <button
                          onClick={() => router.push(`/orders?order_id=${detail.order_id}`)}
                          className="text-xs font-mono font-bold text-amber-700 hover:underline bg-amber-50 px-2 py-0.5 rounded inline-flex items-center gap-1"
                        >
                          {detail.order_number} <ExternalLink size={9} />
                        </button>
                      )}
                      {detail.user_id && (
                        <button
                          onClick={() => router.push(`/customers`)}
                          className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded inline-flex items-center gap-1 hover:underline"
                        >
                          Linked user <ExternalLink size={9} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <button onClick={() => replyTo(detail)} title="Reply" className="p-1.5 rounded hover:bg-gray-100"><Reply size={16} /></button>
                  <button onClick={() => toggleRead(detail.id, detail.read)} title={detail.read ? "Mark unread" : "Mark read"} className="p-1.5 rounded hover:bg-gray-100">
                    {detail.read ? <Mail size={16} /> : <MailOpen size={16} />}
                  </button>
                  <button onClick={() => toggleArchive(detail.id, detail.archived)} title={detail.archived ? "Unarchive" : "Archive"} className="p-1.5 rounded hover:bg-gray-100">
                    {detail.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                  </button>
                  <button onClick={() => handleDelete(detail.id)} title="Delete" className="p-1.5 rounded hover:bg-red-100 text-red-600"><Trash2 size={16} /></button>
                  <button onClick={() => setSelectedId(null)} title="Close" className="p-1.5 rounded hover:bg-gray-100"><X size={16} /></button>
                </div>
              </div>

              {/* Attachments */}
              {detail.attachments && detail.attachments.length > 0 && (
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Attachments ({detail.attachments.length})</div>
                  <div className="flex flex-wrap gap-2">
                    {detail.attachments.map(a => (
                      <a
                        key={a.upload_id}
                        href={`/api/v1/upload/${a.upload_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs hover:bg-amber-50"
                      >
                        <Paperclip size={12} className="text-gray-400" />
                        <span className="font-semibold text-gray-700">{a.filename}</span>
                        <span className="text-gray-400">({(a.size / 1024).toFixed(1)} kB)</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5">
                {detail.html
                  // eslint-disable-next-line react/no-danger
                  ? <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: detail.html }} />
                  : <pre className="text-sm whitespace-pre-wrap text-gray-800 font-sans">{detail.text}</pre>}
              </div>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
