/**
 * Fetch the order's garment tag PDF from the backend and open the system
 * print dialog. Falls back to the share sheet if direct printing isn't
 * available on the platform.
 */

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
// expo-file-system v56 moved downloadAsync/cacheDirectory to the /legacy entry.
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import DEV_BACKEND_URL from "../config/dev";

const BASE_URL = __DEV__ ? `${DEV_BACKEND_URL}/api/v1` : "https://api.washingbells.in/api/v1";

/**
 * Download the order's tags PDF to local cache and return the file URI.
 */
async function downloadTagsPdf(orderId, orderNumber) {
  const token = await SecureStore.getItemAsync("store_auth_token");
  if (!token) throw new Error("Not authenticated");

  const url = `${BASE_URL}/orders/${orderId}/tags/pdf`;
  const filename = `${orderNumber || "order"}_tags.pdf`;
  const dest = `${FileSystem.cacheDirectory}${filename}`;

  const result = await FileSystem.downloadAsync(url, dest, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!result?.uri || result.status >= 400) {
    throw new Error(`Failed to download PDF (HTTP ${result?.status})`);
  }
  return result.uri;
}

/**
 * Open the native print dialog with the order's tag PDF.
 */
export async function printOrderTags(orderId, orderNumber) {
  const uri = await downloadTagsPdf(orderId, orderNumber);
  // expo-print can print a local PDF directly
  await Print.printAsync({ uri });
}

/**
 * Alternative: open the share sheet so the store owner can send the PDF to
 * AirDrop, email, Drive, etc. Use this when direct printing isn't an option.
 */
export async function shareOrderTags(orderId, orderNumber) {
  const uri = await downloadTagsPdf(orderId, orderNumber);
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error("Sharing not available on this device");
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `Tags for ${orderNumber}`,
    UTI: "com.adobe.pdf",
  });
}

/**
 * Download any order PDF (tags / invoice) to local cache and return the URI.
 */
async function downloadOrderPdf(path, filename) {
  const token = await SecureStore.getItemAsync("store_auth_token");
  if (!token) throw new Error("Not authenticated");
  const dest = `${FileSystem.cacheDirectory}${filename}`;
  const result = await FileSystem.downloadAsync(`${BASE_URL}${path}`, dest, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!result?.uri || result.status >= 400) {
    throw new Error(`Failed to download PDF (HTTP ${result?.status})`);
  }
  return result.uri;
}

/**
 * Open the native print dialog with the order's GST invoice.
 */
export async function printOrderInvoice(orderId, orderNumber) {
  const uri = await downloadOrderPdf(`/orders/${orderId}/invoice/pdf`, `${orderNumber || "order"}_invoice.pdf`);
  await Print.printAsync({ uri });
}

/**
 * Share the order's GST invoice via the system share sheet.
 */
export async function shareOrderInvoice(orderId, orderNumber) {
  const uri = await downloadOrderPdf(`/orders/${orderId}/invoice/pdf`, `${orderNumber || "order"}_invoice.pdf`);
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error("Sharing not available on this device");
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `Invoice for ${orderNumber}`,
    UTI: "com.adobe.pdf",
  });
}
