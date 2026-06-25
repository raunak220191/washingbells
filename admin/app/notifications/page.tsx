"use client";
import { useEffect, useState, useCallback } from "react";
import PageLayout from "@/components/PageLayout";
import { CheckCircle, XCircle, Bell, CheckCheck, RefreshCw } from "lucide-react";
import api from "@/lib/api";

interface Notification {
  id: string;
  type: "order_accepted" | "order_rejected";
  order_id: string;
  order_number: string;
  store_name: string;
  note: string;
  read: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/admin/notifications", {
        params: { unread_only: unreadOnly, limit: 100 },
      });
      setNotifications(res.data);
    } catch {
      // silently keep current state
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    setLoading(true);
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const markAllRead = async () => {
    setMarking(true);
    try {
      await api.post("/admin/notifications/mark-read", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } finally {
      setMarking(false);
    }
  };

  const markOneRead = async (id: string) => {
    try {
      await api.post("/admin/notifications/mark-read", { ids: [id] });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {}
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <PageLayout title="Notifications">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
              <Bell size={14} />
              {unreadCount} unread
            </span>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            Unread only
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={marking}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Feed */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Bell size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">No notifications yet</p>
            <p className="text-xs mt-1">Order accept / reject events will appear here</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {notifications.map((n) => {
              const accepted = n.type === "order_accepted";
              return (
                <li
                  key={n.id}
                  className={`flex items-start gap-4 px-6 py-4 transition-colors ${
                    n.read ? "bg-white" : "bg-amber-50"
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5 ${
                      accepted ? "bg-green-100" : "bg-red-100"
                    }`}
                  >
                    {accepted ? (
                      <CheckCircle size={18} className="text-green-600" />
                    ) : (
                      <XCircle size={18} className="text-red-500" />
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-bold uppercase tracking-wide ${
                          accepted ? "text-green-700" : "text-red-600"
                        }`}
                      >
                        {accepted ? "Order Accepted" : "Order Rejected"}
                      </span>
                      {!n.read && (
                        <span className="w-2 h-2 bg-amber-500 rounded-full" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {n.order_number}
                      {n.store_name && (
                        <span className="font-normal text-gray-500">
                          {" "}· {n.store_name}
                        </span>
                      )}
                    </p>
                    {n.note && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{n.note}</p>
                    )}
                  </div>

                  {/* Meta + action */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {n.created_at ? timeAgo(n.created_at) : ""}
                    </span>
                    {!n.read && (
                      <button
                        onClick={() => markOneRead(n.id)}
                        className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageLayout>
  );
}
