const STATUS_STYLES: Record<string, string> = {
  placed: "bg-orange-100 text-orange-700",
  confirmed: "bg-blue-100 text-blue-700",
  rider_assigned_pickup: "bg-indigo-100 text-indigo-700",
  picked_up: "bg-purple-100 text-purple-700",
  at_store: "bg-teal-100 text-teal-700",
  processing: "bg-yellow-100 text-yellow-700",
  ready_for_delivery: "bg-cyan-100 text-cyan-700",
  out_for_delivery: "bg-sky-100 text-sky-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
  pending_approval: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  online: "bg-green-100 text-green-700",
  offline: "bg-gray-100 text-gray-600",
  on_trip: "bg-blue-100 text-blue-700",
  customer: "bg-gray-100 text-gray-700",
  rider: "bg-blue-100 text-blue-700",
  store_owner: "bg-orange-100 text-orange-700",
  admin: "bg-purple-100 text-purple-700",
};

export default function Badge({ value }: { value: string }) {
  const cls = STATUS_STYLES[value] || "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {value.replace(/_/g, " ").toUpperCase()}
    </span>
  );
}
