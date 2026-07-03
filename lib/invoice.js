/**
 * Download the order's GST invoice PDF from the backend and open the system
 * print / share dialog. Mirrors the store app's printTags helper.
 */

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
// expo-file-system moved downloadAsync/cacheDirectory to the /legacy entry.
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "./secureStore";
import DEV_BACKEND_URL from "../config/dev";

const BASE_URL = __DEV__ ? `${DEV_BACKEND_URL}/api/v1` : "https://api.washingbells.com/api/v1";

async function downloadInvoice(orderId, orderNumber) {
  const token = await SecureStore.getItemAsync("auth_token");
  if (!token) throw new Error("Not authenticated");

  const url = `${BASE_URL}/orders/${orderId}/invoice/pdf`;
  const filename = `${orderNumber || "order"}_invoice.pdf`;
  const dest = `${FileSystem.cacheDirectory}${filename}`;

  const result = await FileSystem.downloadAsync(url, dest, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!result?.uri || result.status >= 400) {
    throw new Error(`Failed to download invoice (HTTP ${result?.status})`);
  }
  return result.uri;
}

/** Open the native print dialog with the order's GST invoice. */
export async function printInvoice(orderId, orderNumber) {
  const uri = await downloadInvoice(orderId, orderNumber);
  await Print.printAsync({ uri });
}

/** Share the order's GST invoice via the system share sheet. */
export async function shareInvoice(orderId, orderNumber) {
  const uri = await downloadInvoice(orderId, orderNumber);
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error("Sharing not available on this device");
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `Invoice ${orderNumber || ""}`.trim(),
    UTI: "com.adobe.pdf",
  });
}
