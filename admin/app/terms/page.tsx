"use client";
import { useEffect, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import PageLayout from "@/components/PageLayout";
import api from "@/lib/api";
import {
  Bold, Italic, List, ListOrdered, Heading2, Heading3,
  Link2, Undo, Redo, Save, History, Eye, AlertTriangle,
  RefreshCw, Trash2,
} from "lucide-react";

type Role = "customer" | "rider" | "store";

type TermsDoc = {
  id: string | null;
  role: string;
  version: number;
  content_html: string;
  summary: string;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

const ROLE_TABS: { key: Role; label: string; description: string }[] = [
  { key: "customer", label: "Customer", description: "Shown when customers first open the app or after a new version is published." },
  { key: "rider",    label: "Rider",    description: "Shown to riders before they can start taking trips." },
  { key: "store",    label: "Store Owner", description: "Shown to store owners before they can accept orders." },
];

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

export default function TermsPage() {
  const [activeRole, setActiveRole] = useState<Role>("customer");
  const [latest, setLatest] = useState<TermsDoc | null>(null);
  const [history, setHistory] = useState<TermsDoc[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-amber-600 underline" } }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[400px] px-5 py-4",
      },
    },
    immediatelyRender: false, // Next.js SSR safety
  });

  const load = useCallback(async (role: Role) => {
    setLoading(true);
    try {
      const [latestRes, historyRes] = await Promise.all([
        api.get(`/terms/${role}`),
        api.get(`/terms/admin/list`, { params: { role } }),
      ]);
      const l: TermsDoc = latestRes.data;
      setLatest(l);
      setHistory(historyRes.data || []);
      setSummary(l?.summary || "");
      editor?.commands.setContent(l?.content_html || "");
    } finally { setLoading(false); }
  }, [editor]);

  useEffect(() => {
    if (editor) load(activeRole);
  }, [activeRole, editor, load]);

  const handlePublish = async () => {
    if (!editor) return;
    const html = editor.getHTML();
    if (!html || html === "<p></p>") {
      alert("Please write some content before publishing.");
      return;
    }
    const confirmMsg = latest?.version
      ? `Publish a new version? All existing ${activeRole}s will need to re-accept the updated T&C on their next login.`
      : `Publish the first ${activeRole} T&C? Users will be required to accept on next login.`;
    if (!window.confirm(confirmMsg)) return;
    setPublishing(true);
    try {
      await api.post("/terms/admin/publish", {
        role: activeRole, content_html: html, summary,
      });
      await load(activeRole);
      alert("Published successfully.");
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Publish failed");
    } finally { setPublishing(false); }
  };

  const handleDeleteVersion = async (id: string, version: number) => {
    if (!window.confirm(`Delete v${version}? This cannot be undone.`)) return;
    try {
      await api.delete(`/terms/admin/${id}`);
      await load(activeRole);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Delete failed");
    }
  };

  const loadVersionIntoEditor = (doc: TermsDoc) => {
    editor?.commands.setContent(doc.content_html || "");
    setSummary(doc.summary || "");
    setShowHistory(false);
  };

  const setLink = () => {
    if (!editor) return;
    const url = window.prompt("URL", "https://");
    if (!url) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const activeTab = ROLE_TABS.find(t => t.key === activeRole)!;

  return (
    <PageLayout title="Terms & Conditions">
      {/* Role Tabs */}
      <div className="flex gap-2 mb-5">
        {ROLE_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveRole(t.key)}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${activeRole === t.key ? "bg-amber-500 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Description + Version */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex items-start gap-4">
        <div className="flex-1">
          <p className="text-sm text-gray-600">{activeTab.description}</p>
          <div className="flex items-center gap-3 mt-2">
            {latest && latest.version > 0 ? (
              <span className="text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                Active: v{latest.version}
              </span>
            ) : (
              <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                <AlertTriangle size={11} /> No version published yet
              </span>
            )}
            {latest?.updated_at && (
              <span className="text-xs text-gray-400">
                Last updated {new Date(latest.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
            <span className="text-xs text-gray-400">· {history.length} version{history.length === 1 ? "" : "s"} on record</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <History size={14} /> History
          </button>
          <button
            onClick={() => setPreviewMode(p => !p)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <Eye size={14} /> {previewMode ? "Edit" : "Preview"}
          </button>
          <button
            onClick={() => load(activeRole)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Version History */}
      {showHistory && (
        <div className="bg-white border border-gray-200 rounded-xl mb-4 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-sm">Version History</h3>
            <span className="text-xs text-gray-400">{history.length} total</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {history.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No versions published yet.</div>
            ) : history.map(h => (
              <div key={h.id || ""} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${h.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  v{h.version}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{h.summary || <span className="italic text-gray-400">No summary</span>}</div>
                  <div className="text-xs text-gray-400">{h.updated_at && new Date(h.updated_at).toLocaleString("en-IN")}</div>
                </div>
                <button onClick={() => loadVersionIntoEditor(h)} className="text-xs font-semibold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded">
                  Load
                </button>
                {!h.active && h.id && (
                  <button onClick={() => handleDeleteVersion(h.id!, h.version)} className="text-xs font-semibold text-red-500 hover:bg-red-50 p-1 rounded">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary input */}
      <div className="bg-white border border-gray-200 rounded-xl mb-4 p-4">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Change Summary (shown to users in the acceptance dialog)</label>
        <input
          value={summary}
          onChange={e => setSummary(e.target.value)}
          placeholder="e.g. Updated cancellation policy"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          maxLength={200}
        />
      </div>

      {/* Editor / Preview */}
      <div className="bg-white border border-gray-200 rounded-xl mb-4 overflow-hidden">
        {!previewMode && editor && (
          <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-100 bg-gray-50">
            <ToolbarBtn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></ToolbarBtn>
            <ToolbarBtn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolbarBtn>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <ToolbarBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></ToolbarBtn>
            <ToolbarBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={15} /></ToolbarBtn>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <ToolbarBtn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></ToolbarBtn>
            <ToolbarBtn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></ToolbarBtn>
            <ToolbarBtn title="Link" active={editor.isActive("link")} onClick={setLink}><Link2 size={15} /></ToolbarBtn>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <ToolbarBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo size={15} /></ToolbarBtn>
            <ToolbarBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo size={15} /></ToolbarBtn>
          </div>
        )}
        {loading ? (
          <div className="min-h-[400px] flex items-center justify-center text-gray-400">Loading...</div>
        ) : previewMode ? (
          <div className="prose prose-sm max-w-none px-5 py-4 min-h-[400px]" dangerouslySetInnerHTML={{ __html: editor?.getHTML() || "" }} />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>

      {/* Publish Bar */}
      <div className="sticky bottom-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4 shadow-md">
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-800">
            Publish {latest?.version ? `v${latest.version + 1}` : "v1"} of {activeTab.label} T&C
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            {latest?.version
              ? `All existing ${activeRole}s will be required to accept the new version on their next login.`
              : `This will be the first published version for ${activeRole}s.`}
          </p>
        </div>
        <button
          onClick={handlePublish}
          disabled={publishing || loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 disabled:opacity-50"
        >
          <Save size={15} />
          {publishing ? "Publishing..." : "Publish New Version"}
        </button>
      </div>

      {/* Editor styles for tiptap prose */}
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
