"use client";
import { useState } from "react";
import { X, Save } from "lucide-react";
import api from "@/lib/api";

export type EditField = {
  key: string;
  label: string;
  type?: "text" | "email" | "tel" | "select";
  options?: { value: string; label: string }[];
  colSpan?: 1 | 2;
};

type Props = {
  title: string;
  endpoint: string; // PUT target, e.g. /admin/users/123
  fields: EditField[];
  initial: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
};

// Parent should mount this with a `key` tied to the entity id so the form
// re-initialises when a different record is edited.
export default function EditEntityModal({ title, endpoint, fields, initial, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setError("");
    try {
      await api.put(endpoint, form);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to save changes");
    } finally { setSaving(false); }
  };

  const cls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !saving && onClose()} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Save size={18} className="text-amber-600" /> {title}</h2>
          <button onClick={() => !saving && onClose()} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.key} className={f.colSpan === 2 ? "col-span-2" : ""}>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">{f.label}</label>
              {f.type === "select" ? (
                <select className={cls} value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}>
                  {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input className={cls} type={f.type === "tel" || f.type === "email" ? f.type : "text"}
                  value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={() => !saving && onClose()} disabled={saving}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-sm font-semibold text-white disabled:opacity-40">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
