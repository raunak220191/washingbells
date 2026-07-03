import api from "./api";

/**
 * Repopulate the basket from a past order's line items ("Order again").
 *
 * The customer order API returns line items by service_name + item_name (not by
 * id), so we resolve them against the live catalogue before adding to the cart.
 * Items that no longer exist (renamed / removed service) are skipped gracefully
 * rather than failing the whole reorder.
 *
 * @param {object} order  an order object with `.items` [{ service_name, item_name, quantity }]
 * @param {function} addItem  cartStore.addItem(serviceId, itemId, quantity)
 * @returns {Promise<{added:number, skipped:number}>}
 */
export async function reorderToCart(order, addItem) {
  const res = await api.get("/services");
  const services = res.data || [];

  let added = 0;
  let skipped = 0;

  for (const line of order?.items || []) {
    const svc = services.find((s) => s.name === line.service_name);
    const item = svc?.items?.find((it) => it.name === line.item_name);
    if (svc && item) {
      // Cart quantities are whole numbers — kg lines (e.g. 2.5) round up so a
      // fractional historical quantity doesn't 422 and abort the reorder.
      const qty = Math.max(1, Math.ceil(Number(line.quantity) || 1));
      try {
        await addItem(svc.id, item.id, qty);
        added += 1;
      } catch (e) {
        skipped += 1;
      }
    } else {
      skipped += 1;
    }
  }

  return { added, skipped };
}
