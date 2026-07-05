"use client";
import { useState } from "react";
import { X, KeyRound } from "lucide-react";
import api from "@/lib/api";

type Props = {
  userId: string;
  userLabel: string; // who we're resetting, e.g. name or phone
  onClose: () => void;
};

// D5: super-admin resets a user's password. The backend also revokes all of
// their existing sessions; we surface its success message verbatim.
export default function ResetPasswordModal({ userId, userLabel, onClose }: Props) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const submit = async () => {
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSaving(true); setError("");
    try {
      const res = await api.put(`/admin/users/${userId}/credentials`, { password });
      setSuccessMsg(res.data?.message || "Password reset.");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to reset password");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !saving && onClose()} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <KeyRound size={18} className="text-amber-600" /> Reset Password
          </h2>
          <button onClick={() => !saving && onClose()} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        {successMsg ? (
          <>
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">{successMsg}</p>
            <button onClick={onClose}
              className="mt-5 w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-sm font-semibold text-white">
              Done
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Set a new app password for <span className="font-semibold text-gray-800">{userLabel}</span>.
              All their existing sessions will be signed out.
            </p>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">New password</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber-500"
            />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => !saving && onClose()} disabled={saving}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                Cancel
              </button>
              <button onClick={submit} disabled={saving || password.length < 8}
                className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-sm font-semibold text-white disabled:opacity-40">
                {saving ? "Resetting…" : "Reset password"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
