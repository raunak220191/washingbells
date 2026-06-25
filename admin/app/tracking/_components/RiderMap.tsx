"use client";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// Fix Leaflet's default icon path — broken by bundlers because the default
// uses a relative URL that doesn't resolve in webpack/turbopack.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Rider = {
  id: string;
  name: string | null;
  phone: string;
  vehicle_type: string | null;
  vehicle_number: string | null;
  rider_status: string;
  location: { lat: number; lng: number } | null;
};

const LUDHIANA: [number, number] = [30.9010, 75.8573];

// Small divIcon factory for differently coloured rider pins (on-trip vs idle)
function riderIcon(status: string) {
  const color = status === "on_trip" ? "#1d4ed8" : "#16a34a";
  const html = `<div style="
    width:28px;height:28px;border-radius:50%;background:${color};
    border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);
    display:flex;align-items:center;justify-content:center;
    color:white;font-size:14px;line-height:1;font-weight:bold;
  ">🛵</div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

// Helper component: when selectedId changes, fly the map to the rider
function FlyToSelected({ riders, selectedId }: { riders: Rider[]; selectedId: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const r = riders.find(x => x.id === selectedId);
    if (r?.location) {
      map.flyTo([r.location.lat, r.location.lng], 15, { duration: 0.8 });
    }
  }, [selectedId, riders, map]);
  return null;
}

// On first load with riders, auto-fit bounds to show all of them
function AutoFitBounds({ riders }: { riders: Rider[] }) {
  const map = useMap();
  const fittedRef = useRef(false);
  useEffect(() => {
    if (fittedRef.current) return;
    const withLoc = riders.filter(r => r.location);
    if (withLoc.length === 0) return;
    if (withLoc.length === 1) {
      const r = withLoc[0];
      map.setView([r.location!.lat, r.location!.lng], 14);
    } else {
      const bounds = L.latLngBounds(withLoc.map(r => [r.location!.lat, r.location!.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
    fittedRef.current = true;
  }, [riders, map]);
  return null;
}

export default function RiderMap({
  riders, selectedId, onMarkerClick,
}: {
  riders: Rider[];
  selectedId: string | null;
  onMarkerClick: (id: string) => void;
}) {
  // Memoise the marker list so React doesn't tear them down on every poll
  const markers = useMemo(() => riders.filter(r => r.location), [riders]);

  return (
    <MapContainer
      center={LUDHIANA}
      zoom={12}
      scrollWheelZoom
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <AutoFitBounds riders={markers} />
      <FlyToSelected riders={markers} selectedId={selectedId} />
      {markers.map(r => (
        <Marker
          key={r.id}
          position={[r.location!.lat, r.location!.lng]}
          icon={riderIcon(r.rider_status)}
          eventHandlers={{ click: () => onMarkerClick(r.id) }}
        >
          <Popup>
            <div style={{ minWidth: 140, fontFamily: "system-ui, sans-serif" }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{r.name || "Unnamed Rider"}</div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                {(r.vehicle_type || "").toUpperCase()} · {r.vehicle_number || "—"}
              </div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>📞 {r.phone}</div>
              <div style={{ marginTop: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  padding: "2px 6px", borderRadius: 4,
                  background: r.rider_status === "on_trip" ? "#dbeafe" : "#dcfce7",
                  color: r.rider_status === "on_trip" ? "#1d4ed8" : "#15803d",
                }}>
                  {r.rider_status === "on_trip" ? "On Trip" : "Online"}
                </span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
