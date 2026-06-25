/**
 * Pickup Photos Card — shows the garment photos the rider took at pickup.
 *
 * The order doc only stores upload IDs / URLs. We fetch each image's base64
 * lazily from /upload/{id} the first time it's rendered, then cache it in
 * component state so re-renders don't refetch.
 */

import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  Modal, ActivityIndicator, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../constants/theme";
import api from "../lib/api";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

function relativeTime(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return `${Math.floor(hr / 24)} d ago`;
}

export default function PickupPhotosCard({ photos, photosAt, title = "Pickup Photos", onCapture = null, capturing = false }) {
  // photos: array of { url, upload_id?, size, uploaded_at }
  const items = Array.isArray(photos) ? photos : [];
  const [resolved, setResolved] = useState({}); // upload_id -> base64 data URI
  const [loadingIds, setLoadingIds] = useState({});
  const [viewerIdx, setViewerIdx] = useState(null);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  // When a capture handler is provided (store intake), always render so the
  // store owner can take the first photo. Otherwise hide when empty.
  if (items.length === 0 && !onCapture) return null;

  const dataFor = (p) => {
    if (!p) return null;
    if (typeof p.url === "string" && p.url.startsWith("data:")) return p.url;
    if (p.upload_id && resolved[p.upload_id]) return resolved[p.upload_id];
    return null;
  };

  const fetchPhoto = async (uploadId) => {
    if (!uploadId || resolved[uploadId] || loadingIds[uploadId]) return;
    setLoadingIds(prev => ({ ...prev, [uploadId]: true }));
    try {
      const res = await api.get(`/upload/${uploadId}`);
      if (mounted.current && res.data?.data) {
        setResolved(prev => ({ ...prev, [uploadId]: res.data.data }));
      }
    } catch {
      // Quiet — the thumbnail will show a broken-image placeholder
    } finally {
      if (mounted.current) {
        setLoadingIds(prev => {
          const next = { ...prev };
          delete next[uploadId];
          return next;
        });
      }
    }
  };

  // Kick off fetches for all photos that need one (idempotent)
  items.forEach(p => p?.upload_id && fetchPhoto(p.upload_id));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="images" size={16} color={COLORS.storeOrange} />
        <Text style={styles.title}>{title} ({items.length})</Text>
        {photosAt && <Text style={styles.timeMeta}>{relativeTime(photosAt)}</Text>}
        {onCapture && (
          <TouchableOpacity style={styles.captureBtn} onPress={onCapture} disabled={capturing}>
            {capturing
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="camera" size={13} color="#fff" /><Text style={styles.captureText}>Take Photo</Text></>}
          </TouchableOpacity>
        )}
      </View>

      {items.length === 0 ? (
        <Text style={styles.emptyHint}>No photos yet. Capture garment condition at intake.</Text>
      ) : (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((p, i) => {
          const data = dataFor(p);
          const isLoading = p.upload_id && loadingIds[p.upload_id];
          return (
            <TouchableOpacity
              key={p.upload_id || p.url || i}
              activeOpacity={0.8}
              style={styles.thumb}
              onPress={() => setViewerIdx(i)}
              disabled={!data}
            >
              {data ? (
                <Image source={{ uri: data }} style={styles.thumbImg} />
              ) : (
                <View style={styles.thumbPlaceholder}>
                  {isLoading
                    ? <ActivityIndicator size="small" color={COLORS.storeOrange} />
                    : <Ionicons name="image-outline" size={28} color={COLORS.textMuted} />}
                </View>
              )}
              <View style={styles.thumbIndex}>
                <Text style={styles.thumbIndexText}>{i + 1}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      )}

      {/* Fullscreen viewer */}
      <Modal visible={viewerIdx !== null} transparent animationType="fade" onRequestClose={() => setViewerIdx(null)}>
        <View style={styles.viewer}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerIdx(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.viewerCounter}>{(viewerIdx ?? 0) + 1} / {items.length}</Text>
          {viewerIdx !== null && (() => {
            const data = dataFor(items[viewerIdx]);
            return data
              ? <Image source={{ uri: data }} style={styles.viewerImg} resizeMode="contain" />
              : <ActivityIndicator color="#fff" size="large" />;
          })()}
          {viewerIdx !== null && items.length > 1 && (
            <View style={styles.viewerNav}>
              <TouchableOpacity
                style={[styles.navBtn, viewerIdx === 0 && styles.navBtnDisabled]}
                disabled={viewerIdx === 0}
                onPress={() => setViewerIdx(viewerIdx - 1)}
              >
                <Ionicons name="chevron-back" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navBtn, viewerIdx === items.length - 1 && styles.navBtnDisabled]}
                disabled={viewerIdx === items.length - 1}
                onPress={() => setViewerIdx(viewerIdx + 1)}
              >
                <Ionicons name="chevron-forward" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const THUMB = 88;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.md },
  title: { flex: 1, fontSize: 14, fontWeight: "700", color: COLORS.black },
  timeMeta: { fontSize: 11, color: COLORS.textMuted },
  captureBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.storeOrange, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full },
  captureText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  emptyHint: { fontSize: 12, color: COLORS.textMuted, lineHeight: 18 },

  row: { gap: SPACING.sm, paddingRight: SPACING.lg },
  thumb: { width: THUMB, height: THUMB, borderRadius: RADIUS.md, overflow: "hidden", position: "relative" },
  thumbImg: { width: THUMB, height: THUMB, backgroundColor: COLORS.borderLight },
  thumbPlaceholder: {
    width: THUMB, height: THUMB, backgroundColor: COLORS.borderLight,
    alignItems: "center", justifyContent: "center", borderRadius: RADIUS.md,
  },
  thumbIndex: {
    position: "absolute", top: 4, left: 4,
    backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  thumbIndexText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  viewer: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center", alignItems: "center",
  },
  viewerClose: { position: "absolute", top: 56, right: 24, padding: 8 },
  viewerCounter: { position: "absolute", top: 64, alignSelf: "center", color: "#fff", fontSize: 14, fontWeight: "600" },
  viewerImg: { width: SCREEN_W, height: SCREEN_H * 0.8 },
  viewerNav: {
    position: "absolute", bottom: 60, left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-around", paddingHorizontal: SPACING.xl,
  },
  navBtn: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  navBtnDisabled: { opacity: 0.3 },
});
