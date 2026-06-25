"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import PageLayout from "@/components/PageLayout";
import api from "@/lib/api";
import { RefreshCw, Bike, Phone, Clock } from "lucide-react";
import "leaflet/dist/leaflet.css";

// Leaflet needs the DOM, so the map components must be loaded client-side only.
// Dynamic import with ssr:false is the standard Next App Router fix.
const RiderMap = dynamic(() => import("./_components/RiderMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-gray-400 bg-gray-100">
      Loading map...
    </div>
  ),
});

type Rider = {
  id: string;
  name: string | null;
  phone: string;
  vehicle_type: string | null;
  vehicle_number: string | null;
  rider_status: string;
  location: { lat: number; lng: number } | null;
  last_updated: string | null;
};

const POLL_INTERVAL_MS = 10_000;

function formatRelative(timestamp: string | null) {
  if (!timestamp) return "—";
  const ms = Date.now() - new Date(timestamp).getTime();
  if (ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 30) return "just now";
  if (sec < 90) return "1 min ago";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)} hr ago`;
}

export default function TrackingPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  const load = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await api.get("/admin/riders/online");
      if (!mountedRef.current) return;
      setRiders(res.data || []);
      setLastFetched(new Date());
    } catch {
      // Quiet — poll will retry
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    load().finally(() => setLoading(false));
    const id = setInterval(() => load(false), POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, []);

  const onTrip = riders.filter(r => r.rider_status === "on_trip").length;
  const online = riders.filter(r => r.rider_status === "online").length;

  return (
    <PageLayout title="Live Tracking">
      <div className="flex gap-3 mb-4 items-center">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-green-50 border-green-200 text-green-800">
          <span className="text-xl font-bold">{online}</span>
          <span className="text-xs font-medium">Idle Online</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-blue-50 border-blue-200 text-blue-800">
          <span className="text-xl font-bold">{onTrip}</span>
          <span className="text-xs font-medium">On Trip</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-gray-50 border-gray-200 text-gray-700">
          <span className="text-xl font-bold">{riders.length}</span>
          <span className="text-xs font-medium">Tracked</span>
        </div>
        <button onClick={() => load(true)} className="ml-auto flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw size={13} /> Refresh
        </button>
        {lastFetched && (
          <span className="text-xs text-gray-400">
            Updated {lastFetched.toLocaleTimeString("en-IN")} · auto-refreshing every 10s
          </span>
        )}
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Map */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <RiderMap
            riders={riders.filter(r => r.location)}
            selectedId={selectedId}
            onMarkerClick={setSelectedId}
          />
        </div>

        {/* Rider list */}
        <div className="w-80 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 sticky top-0 bg-white">
            <h3 className="text-sm font-bold text-gray-800">Riders</h3>
            <p className="text-xs text-gray-400 mt-0.5">Click to focus on the map</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
            ) : riders.length === 0 ? (
              <div className="p-8 text-center">
                <Bike size={32} className="text-gray-300 mx-auto" />
                <p className="text-sm font-semibold text-gray-600 mt-3">No riders online</p>
                <p className="text-xs text-gray-400 mt-1">Riders appear here when they go online in the app.</p>
              </div>
            ) : (
              riders.map(rider => (
                <button
                  key={rider.id}
                  onClick={() => setSelectedId(rider.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-amber-50 transition-colors ${
                    selectedId === rider.id ? "bg-amber-50 border-l-4 border-l-amber-500" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${rider.rider_status === "on_trip" ? "bg-blue-500" : "bg-green-500"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">{rider.name || "Unnamed Rider"}</div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                        <Bike size={11} />
                        <span>{(rider.vehicle_type || "").toUpperCase()} · {rider.vehicle_number || "—"}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1 flex items-center gap-2 font-mono">
                        <Phone size={10} />{rider.phone}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rider.rider_status === "on_trip" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                          {rider.rider_status === "on_trip" ? "On Trip" : "Online"}
                        </span>
                        <span className="text-xs text-gray-400 inline-flex items-center gap-1">
                          <Clock size={10} />{formatRelative(rider.last_updated)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
