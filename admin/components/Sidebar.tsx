"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ShoppingBag, Store, Bike, Users,
  Wallet, LogOut, ChevronRight, Tag, Megaphone,
  Scissors, Settings, Bell, FileText, Map, Mail, Image as ImageIcon,
  Inbox as InboxIcon, Database, Banknote, PackagePlus,
} from "lucide-react";
import { clearToken, isLoggedIn } from "@/lib/auth";
import api from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders/create", label: "New Order", icon: PackagePlus },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/services", label: "Services & Pricing", icon: Scissors },
  { href: "/promotions", label: "Promotions", icon: Tag },
  { href: "/content", label: "Banners & Content", icon: Megaphone },
  { href: "/stores", label: "Stores", icon: Store },
  { href: "/riders", label: "Riders", icon: Bike },
  { href: "/tracking", label: "Live Tracking", icon: Map },
  { href: "/photos", label: "Photo Audit", icon: ImageIcon },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/financials", label: "Financials", icon: Wallet },
  { href: "/payouts", label: "Payouts", icon: Banknote },
  { href: "/terms", label: "Terms & Conditions", icon: FileText },
  { href: "/email", label: "Email Notifications", icon: Mail },
  { href: "/inbox", label: "Inbox", icon: InboxIcon },
  { href: "/db", label: "Database", icon: Database },
  { href: "/settings", label: "Platform Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [inboxUnread, setInboxUnread] = useState(0);

  // Poll unread counts every 30 s while logged in
  useEffect(() => {
    if (!isLoggedIn()) return;
    const fetchCounts = async () => {
      try {
        const [n, i] = await Promise.allSettled([
          api.get("/admin/notifications/unread-count"),
          api.get("/inbox/unread-count"),
        ]);
        if (n.status === "fulfilled") setUnreadCount(n.value.data.count ?? 0);
        if (i.status === "fulfilled") setInboxUnread(i.value.data.count ?? 0);
      } catch {}
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Clear badges when navigating to the matching section
  useEffect(() => {
    if (pathname.startsWith("/notifications")) setUnreadCount(0);
    if (pathname.startsWith("/inbox")) setInboxUnread(0);
  }, [pathname]);

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  return (
    <aside className="w-64 bg-forest text-white flex flex-col fixed inset-y-0 left-0 z-50">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Washing Bells" className="w-9 h-9 rounded-lg" />
          <div>
            <div className="font-bold text-white text-sm">
              Washing<span className="text-gold">Bells</span>
            </div>
            <div className="text-xs text-white/50">Super Admin</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/orders" ? pathname === "/orders" : pathname.startsWith(href);
          const badge = href === "/notifications" ? unreadCount
                       : href === "/inbox" ? inboxUnread
                       : 0;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-amber-500 text-forest"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {badge > 0 && !active && (
                <span className="min-w-[20px] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              {active && <ChevronRight size={14} />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-red-400 transition-colors w-full"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
        <p className="text-xs text-white/40 mt-3 px-3">v1.0.0 · Phase 2</p>
      </div>
    </aside>
  );
}
