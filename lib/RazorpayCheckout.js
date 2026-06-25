/**
 * Razorpay checkout via WebView — Expo Go compatible (no native module).
 *
 * Loads Razorpay's hosted checkout.js inside a WebView and bridges the result
 * back to React Native. On success the parent receives the real
 * { razorpay_payment_id, razorpay_order_id, razorpay_signature } to verify
 * server-side.
 *
 * Usage:
 *   <RazorpayCheckout
 *     visible={visible}
 *     options={{ key, order_id, amount, name, description, prefill, notes }}
 *     onSuccess={(data) => ...}
 *     onDismiss={() => ...}
 *     onError={(msg) => ...}
 *   />
 */
import React from "react";
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { COLORS } from "../constants/theme";

// Guards against the WebView native module being unavailable (e.g. a dev build
// compiled before react-native-webview was added). Instead of crashing the
// whole screen, we surface a clean error so the order flow can continue.
class WebViewBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail?.(); }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function buildHtml(options) {
  const rzOptions = {
    key: options.key,
    order_id: options.order_id,
    amount: options.amount, // paise
    currency: options.currency || "INR",
    name: options.name || "WashingBells",
    description: options.description || "Order payment",
    prefill: options.prefill || {},
    notes: options.notes || {},
    theme: { color: "#4A5D4E" },
  };
  const json = JSON.stringify(rzOptions);
  return `<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" /></head>
<body style="background:#f3f4f6;margin:0">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  function post(msg){ window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  try {
    var options = ${json};
    options.handler = function(response){ post({ type: 'success', data: response }); };
    options.modal = { ondismiss: function(){ post({ type: 'dismiss' }); }, escape: true, backdropclose: false };
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function(resp){ post({ type: 'failed', data: (resp && resp.error) || {} }); });
    rzp.open();
  } catch (e) {
    post({ type: 'error', message: String(e) });
  }
</script>
</body>
</html>`;
}

export default function RazorpayCheckout({ visible, options, onSuccess, onDismiss, onError }) {
  if (!visible || !options) return null;

  const handleMessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === "success") onSuccess?.(msg.data);
    else if (msg.type === "dismiss") onDismiss?.();
    else if (msg.type === "failed") onError?.(msg.data?.description || "Payment failed");
    else if (msg.type === "error") onError?.(msg.message || "Could not open payment");
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={() => onDismiss?.()}>
      <SafeAreaView style={styles.container}>
        {/* Always-present header so the user can back out (critical on iOS,
            and a safety net if the payment page fails to load). */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => onDismiss?.()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Secure Payment</Text>
          <View style={{ width: 56 }} />
        </View>
        <WebViewBoundary onFail={() => onError?.("Payment screen unavailable. Please update the app and try again.")}>
          <WebView
            originWhitelist={["*"]}
            source={{ html: buildHtml(options), baseUrl: "https://checkout.razorpay.com" }}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={COLORS.forestGreen} />
              </View>
            )}
          />
        </WebViewBoundary>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#e5e7eb",
  },
  cancel: { color: "#dc2626", fontSize: 15, fontWeight: "600", width: 56 },
  title: { fontSize: 15, fontWeight: "700", color: "#111827" },
  loader: { position: "absolute", top: 60, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" },
});
