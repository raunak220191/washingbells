"use client";
import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import StatCard from "@/components/StatCard";
import {
  ShoppingBag, Store, Bike, Users, TrendingUp,
  IndianRupee, Activity, CheckCircle,
} from "lucide-react";
import api from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface DashboardData {
  total_orders: number;
  orders_today: number;
  active_orders: number;
  total_revenue: number;
  revenue_today: number;
  platform_earnings: number;
  total_customers: number;
  total_riders: number;
  total_stores: number;
  riders_online: number;
  stores_open: number;
}

const CHART_COLORS = ["#006241", "#BFA14A", "#A8C86B", "#003D2B", "#8FB996"];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [dashRes, ordersRes] = await Promise.all([
          api.get("/admin/dashboard"),
          api.get("/admin/orders?limit=10"),
        ]);
        setData(dashRes.data);
        setRecentOrders(ordersRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <PageLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
        </div>
      </PageLayout>
    );
  }

  const pieData = data ? [
    { name: "Active", value: data.active_orders },
    { name: "Delivered", value: data.total_orders - data.active_orders },
  ] : [];

  return (
    <PageLayout title="Dashboard">
      {/* Live badge */}
      <div className="flex items-center gap-2 mb-6">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Live · Updates every 30s
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Orders" value={data?.total_orders ?? 0} icon={ShoppingBag} color="bg-amber-500" sub={`${data?.orders_today} today`} />
        <StatCard label="Active Orders" value={data?.active_orders ?? 0} icon={Activity} color="bg-blue-500" />
        <StatCard label="Total Revenue" value={`₹${(data?.total_revenue ?? 0).toFixed(0)}`} icon={IndianRupee} color="bg-green-600" sub={`₹${(data?.revenue_today ?? 0).toFixed(0)} today`} />
        <StatCard label="Platform Earnings" value={`₹${(data?.platform_earnings ?? 0).toFixed(0)}`} icon={TrendingUp} color="bg-purple-600" sub="20% commission" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Customers" value={data?.total_customers ?? 0} icon={Users} color="bg-cyan-600" />
        <StatCard label="Riders" value={`${data?.riders_online ?? 0} / ${data?.total_riders ?? 0}`} icon={Bike} color="bg-indigo-500" sub="online / total" />
        <StatCard label="Stores" value={`${data?.stores_open ?? 0} / ${data?.total_stores ?? 0}`} icon={Store} color="bg-orange-500" sub="open / total" />
        <StatCard label="Delivered" value={data ? data.total_orders - data.active_orders : 0} icon={CheckCircle} color="bg-teal-600" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Order Status Pie */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Order Status Split</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Status bar breakdown */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Order Status Counts</h3>
          <div className="space-y-3">
            {[
              { label: "Placed (new)", count: recentOrders.filter(o => o.status === "placed").length, color: "bg-orange-400" },
              { label: "Processing", count: recentOrders.filter(o => o.status === "processing").length, color: "bg-yellow-400" },
              { label: "Out for Delivery", count: recentOrders.filter(o => o.status === "out_for_delivery").length, color: "bg-blue-400" },
              { label: "Delivered", count: recentOrders.filter(o => o.status === "delivered").length, color: "bg-green-400" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-36 text-sm text-gray-600 flex-shrink-0">{row.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                  <div
                    className={`${row.color} h-2.5 rounded-full`}
                    style={{ width: `${Math.min((row.count / (recentOrders.length || 1)) * 100 * 3, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-700 w-6 text-right">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Recent Orders</h3>
          <a href="/orders" className="text-sm text-amber-600 hover:text-amber-700 font-medium">View all →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                {["Order #", "Customer", "Total", "Status", "Payment", "Date"].map(h => (
                  <th key={h} className="px-6 py-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentOrders.slice(0, 8).map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 font-mono font-semibold text-amber-600">{order.order_number}</td>
                  <td className="px-6 py-3 text-gray-700">{order.customer_name || "—"}</td>
                  <td className="px-6 py-3 font-semibold text-gray-900">₹{order.total_amount?.toFixed(0)}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      order.status === "delivered" ? "bg-green-100 text-green-700" :
                      order.status === "cancelled" ? "bg-red-100 text-red-700" :
                      order.status === "placed" ? "bg-orange-100 text-orange-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>
                      {order.status?.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{order.payment_method?.toUpperCase()}</td>
                  <td className="px-6 py-3 text-gray-400 text-xs">
                    {order.created_at ? new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No orders yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageLayout>
  );
}
