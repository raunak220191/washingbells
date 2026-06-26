/**
 * AddressScreen — Enterprise-grade address management
 *
 * Design principles applied:
 * ─ Visual hierarchy via layered elevation & grouped sections
 * ─ Gestalt proximity for related form fields
 * ─ Consistent touch targets (≥ 44pt)
 * ─ Micro-feedback via color transitions on selection
 * ─ Progressive disclosure (list → form)
 * ─ Inline validation cues
 * ─ Accessibility-friendly contrast ratios
 */
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS } from "../../../constants/theme";
import { useAddressStore } from "../../../stores/addressStore";
import Button from "../../../components/common/Button";
import Screen from "../../../components/common/Screen";

const { width: SCREEN_W } = Dimensions.get("window");

const LABEL_OPTIONS = [
  { key: "Home", icon: "home-outline", filledIcon: "home" },
  { key: "Work", icon: "briefcase-outline", filledIcon: "briefcase" },
  { key: "Other", icon: "location-outline", filledIcon: "location" },
];

// ─── Reusable Input Field ──────────────────────────────────
const InputField = ({
  label: fieldLabel,
  required,
  value,
  onChangeText,
  placeholder,
  multiline,
  numberOfLines,
  keyboardType,
  maxLength,
  icon,
  wrapperStyle,
  inputStyle,
  error,
}) => {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[s.fieldWrapper, wrapperStyle]}>
      <Text style={s.fieldLabel}>
        {fieldLabel}
        {required && <Text style={{ color: COLORS.error }}> *</Text>}
      </Text>
      <View
        style={[
          s.inputContainer,
          focused && s.inputContainerFocused,
          error && s.inputContainerError,
          multiline && { alignItems: "flex-start" },
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? COLORS.forestGreen : COLORS.textMuted}
            style={{ marginRight: SPACING.sm, marginTop: multiline ? 2 : 0 }}
          />
        )}
        <TextInput
          style={[
            s.inputText,
            multiline && s.inputMultiline,
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted + "99"}
          multiline={multiline}
          numberOfLines={numberOfLines}
          keyboardType={keyboardType}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {error && <Text style={s.fieldError}>{error}</Text>}
    </View>
  );
};

export default function AddressScreen() {
  const router = useRouter();
  const {
    addresses,
    selectedAddress,
    isLoading,
    fetchAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    selectAddress,
  } = useAddressStore();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // UI state
  const [mode, setMode] = useState("list"); // list | form
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Form fields
  const [label, setLabel] = useState("Home");
  const [fullAddress, setFullAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("Punjab");
  const [pincode, setPincode] = useState("");
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    fetchAddresses();
    animateIn();
  }, []);

  // If no addresses, go straight to form
  useEffect(() => {
    if (!isLoading && addresses.length === 0 && mode === "list") {
      setMode("form");
    }
  }, [addresses, isLoading]);

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 9,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    animateIn();
  };

  const resetForm = () => {
    setLabel("Home");
    setFullAddress("");
    setLandmark("");
    setCity("");
    setState("Punjab");
    setPincode("");
    setLatitude(0);
    setLongitude(0);
    setIsDefault(false);
    setEditingId(null);
    setFormErrors({});
  };

  const openAddForm = () => {
    resetForm();
    setIsDefault(addresses.length === 0);
    switchMode("form");
  };

  const openEditForm = (addr) => {
    setLabel(addr.label);
    setFullAddress(addr.full_address);
    setLandmark(addr.landmark || "");
    setCity(addr.city);
    setState(addr.state);
    setPincode(addr.pincode);
    setLatitude(addr.latitude);
    setLongitude(addr.longitude);
    setIsDefault(addr.is_default);
    setEditingId(addr.id);
    setFormErrors({});
    switchMode("form");
  };

  const detectCurrentLocation = async () => {
    setDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "WashingBells needs location access to auto-detect your address. Please enable it in Settings.",
          [{ text: "OK" }]
        );
        setDetecting(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);

      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (geo) {
        const parts = [geo.name, geo.street, geo.district, geo.subregion].filter(
          Boolean
        );
        setFullAddress(parts.join(", "));
        setCity(geo.city || geo.subregion || "");
        setState(geo.region || "Punjab");
        setPincode(geo.postalCode || "");
        setFormErrors({});
      }
    } catch (err) {
      console.log("Location detect error:", err);
      Alert.alert(
        "Detection Failed",
        "We couldn't auto-detect your location. Please enter your address manually."
      );
    } finally {
      setDetecting(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!fullAddress.trim()) errors.fullAddress = "Address is required";
    if (!city.trim()) errors.city = "City is required";
    if (!pincode.trim() || pincode.length < 6)
      errors.pincode = "Enter a valid 6-digit pincode";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const data = {
      label,
      full_address: fullAddress.trim(),
      landmark: landmark.trim() || null,
      latitude: latitude || 30.9,
      longitude: longitude || 75.85,
      city: city.trim(),
      state: state.trim() || "Punjab",
      pincode: pincode.trim(),
      is_default: isDefault,
    };

    setSaving(true);
    try {
      if (editingId) {
        await updateAddress(editingId, data);
      } else {
        const newAddr = await addAddress(data);
        selectAddress(newAddr);
      }
      resetForm();
      switchMode("list");
      await fetchAddresses();
    } catch (err) {
      Alert.alert(
        "Save Failed",
        err?.response?.data?.detail || "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (addr) => {
    Alert.alert(
      "Remove Address",
      `Are you sure you want to delete your "${addr.label}" address?\n\n${addr.full_address}`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAddress(addr.id);
              await fetchAddresses();
            } catch {
              Alert.alert("Error", "Could not delete address. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleSelectAndGoBack = (addr) => {
    selectAddress(addr);
    router.back();
  };

  // ─── LIST VIEW ──────────────────────────────────────────
  const renderList = () => (
    <Animated.View
      style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
      >
        {/* ── GPS Detection Hero Card ── */}
        <TouchableOpacity
          style={s.gpsHero}
          onPress={() => {
            openAddForm();
            setTimeout(detectCurrentLocation, 400);
          }}
          activeOpacity={0.85}
        >
          <View style={s.gpsHeroIconWrap}>
            <View style={s.gpsHeroIconRing}>
              {detecting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <MaterialCommunityIcons
                  name="crosshairs-gps"
                  size={24}
                  color={COLORS.white}
                />
              )}
            </View>
          </View>
          <View style={s.gpsHeroText}>
            <Text style={s.gpsHeroTitle}>Use Current Location</Text>
            <Text style={s.gpsHeroSub}>
              Quickly add your address via GPS
            </Text>
          </View>
          <View style={s.gpsHeroArrow}>
            <Ionicons name="arrow-forward-circle" size={28} color={COLORS.gold} />
          </View>
        </TouchableOpacity>

        {/* ── Divider with label ── */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerLabel}>SAVED ADDRESSES</Text>
          <View style={s.dividerLine} />
        </View>

        {/* ── Loading / Empty / List ── */}
        {isLoading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.forestGreen} />
            <Text style={s.loadingText}>Loading addresses…</Text>
          </View>
        ) : addresses.length === 0 ? (
          <View style={s.emptyState}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="map-outline" size={48} color={COLORS.forestGreen + "40"} />
            </View>
            <Text style={s.emptyTitle}>No saved addresses yet</Text>
            <Text style={s.emptySub}>
              Add your first delivery address to{"\n"}start ordering with WashingBells
            </Text>
            <TouchableOpacity style={s.emptyAction} onPress={openAddForm}>
              <Ionicons name="add-circle" size={20} color={COLORS.white} />
              <Text style={s.emptyActionText}>Add New Address</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={s.listCount}>
              {addresses.length} address{addresses.length !== 1 ? "es" : ""}
            </Text>
            {addresses.map((addr, idx) => {
              const isSelected = selectedAddress?.id === addr.id;
              const labelOpt = LABEL_OPTIONS.find((l) => l.key === addr.label) || LABEL_OPTIONS[2];
              return (
                <TouchableOpacity
                  key={addr.id}
                  style={[s.card, isSelected && s.cardSelected]}
                  onPress={() => handleSelectAndGoBack(addr)}
                  activeOpacity={0.7}
                >
                  {/* Selection indicator stripe */}
                  {isSelected && <View style={s.cardStripe} />}

                  <View style={s.cardBody}>
                    {/* Top: Icon + Label + Badges */}
                    <View style={s.cardHeader}>
                      <View
                        style={[
                          s.cardIcon,
                          isSelected && s.cardIconSelected,
                        ]}
                      >
                        <Ionicons
                          name={isSelected ? labelOpt.filledIcon : labelOpt.icon}
                          size={18}
                          color={isSelected ? COLORS.white : COLORS.forestGreen}
                        />
                      </View>
                      <View style={s.cardLabels}>
                        <Text style={s.cardLabelText}>{addr.label}</Text>
                        {addr.is_default && (
                          <View style={s.badgeDefault}>
                            <Ionicons name="shield-checkmark" size={10} color={COLORS.white} />
                            <Text style={s.badgeDefaultText}>Default</Text>
                          </View>
                        )}
                        {isSelected && (
                          <View style={s.badgeSelected}>
                            <Text style={s.badgeSelectedText}>Selected</Text>
                          </View>
                        )}
                      </View>
                      {/* Actions */}
                      <View style={s.cardActions}>
                        <TouchableOpacity
                          style={s.cardActionBtn}
                          onPress={() => openEditForm(addr)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                          <Feather name="edit-2" size={15} color={COLORS.forestGreen} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.cardActionBtn, s.cardActionBtnDanger]}
                          onPress={() => handleDelete(addr)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                          <Feather name="trash-2" size={15} color={COLORS.error} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Address text */}
                    <Text style={s.cardAddress} numberOfLines={2}>
                      {addr.full_address}
                    </Text>

                    {/* Meta row: landmark, city line */}
                    <View style={s.cardMeta}>
                      {addr.landmark ? (
                        <View style={s.cardMetaChip}>
                          <Ionicons name="flag-outline" size={11} color={COLORS.textMuted} />
                          <Text style={s.cardMetaChipText}>{addr.landmark}</Text>
                        </View>
                      ) : null}
                      <View style={s.cardMetaChip}>
                        <Ionicons name="navigate-outline" size={11} color={COLORS.textMuted} />
                        <Text style={s.cardMetaChipText}>
                          {addr.city}, {addr.pincode}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Floating Add Button ── */}
      {addresses.length > 0 && (
        <TouchableOpacity
          style={s.fab}
          onPress={openAddForm}
          activeOpacity={0.85}
        >
          <View style={s.fabInner}>
            <Ionicons name="add" size={24} color={COLORS.white} />
            <Text style={s.fabLabel}>Add New</Text>
          </View>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  // ─── FORM VIEW ──────────────────────────────────────────
  const renderForm = () => (
    <Animated.View
      style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.formContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── GPS Detect Banner ── */}
          <TouchableOpacity
            style={s.gpsFormBanner}
            onPress={detectCurrentLocation}
            activeOpacity={0.8}
            disabled={detecting}
          >
            <View style={s.gpsFormIconWrap}>
              {detecting ? (
                <ActivityIndicator size="small" color={COLORS.gold} />
              ) : (
                <MaterialCommunityIcons
                  name="crosshairs-gps"
                  size={20}
                  color={COLORS.gold}
                />
              )}
            </View>
            <Text style={s.gpsFormText}>
              {detecting ? "Detecting your location…" : "Auto-fill using GPS"}
            </Text>
            {!detecting && (
              <Ionicons name="chevron-forward" size={16} color={COLORS.gold} />
            )}
          </TouchableOpacity>

          {/* ── Label Section (Save as) ── */}
          <View style={s.formSection}>
            <Text style={s.formSectionTitle}>Address Type</Text>
            <View style={s.labelPills}>
              {LABEL_OPTIONS.map((opt) => {
                const active = label === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[s.labelPill, active && s.labelPillActive]}
                    onPress={() => setLabel(opt.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={active ? opt.filledIcon : opt.icon}
                      size={16}
                      color={active ? COLORS.white : COLORS.forestGreen}
                    />
                    <Text style={[s.labelPillText, active && s.labelPillTextActive]}>
                      {opt.key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Address Details Section ── */}
          <View style={s.formSection}>
            <Text style={s.formSectionTitle}>Address Details</Text>

            <InputField
              label="Full Address"
              required
              value={fullAddress}
              onChangeText={(t) => {
                setFullAddress(t);
                if (formErrors.fullAddress) setFormErrors((p) => ({ ...p, fullAddress: "" }));
              }}
              placeholder="House/Flat No., Building Name, Street, Area"
              multiline
              numberOfLines={3}
              icon="location-outline"
              error={formErrors.fullAddress}
            />

            <InputField
              label="Landmark"
              value={landmark}
              onChangeText={setLandmark}
              placeholder="e.g. Near City Hospital, Behind Metro Station"
              icon="flag-outline"
            />
          </View>

          {/* ── Location Section ── */}
          <View style={s.formSection}>
            <Text style={s.formSectionTitle}>City & Region</Text>

            <View style={s.formRow}>
              <InputField
                label="City"
                required
                value={city}
                onChangeText={(t) => {
                  setCity(t);
                  if (formErrors.city) setFormErrors((p) => ({ ...p, city: "" }));
                }}
                placeholder="e.g. Ludhiana"
                icon="business-outline"
                wrapperStyle={{ flex: 1, marginRight: SPACING.sm }}
                error={formErrors.city}
              />
              <InputField
                label="State"
                value={state}
                onChangeText={setState}
                placeholder="e.g. Punjab"
                icon="map-outline"
                wrapperStyle={{ flex: 1, marginLeft: SPACING.sm }}
              />
            </View>

            <InputField
              label="Pincode"
              required
              value={pincode}
              onChangeText={(t) => {
                const cleaned = t.replace(/[^0-9]/g, "").slice(0, 6);
                setPincode(cleaned);
                if (formErrors.pincode && cleaned.length === 6)
                  setFormErrors((p) => ({ ...p, pincode: "" }));
              }}
              placeholder="6-digit pincode"
              keyboardType="number-pad"
              maxLength={6}
              icon="keypad-outline"
              wrapperStyle={{ width: "55%" }}
              error={formErrors.pincode}
            />
          </View>

          {/* ── Preferences ── */}
          <View style={s.formSection}>
            <Text style={s.formSectionTitle}>Preferences</Text>

            <TouchableOpacity
              style={s.toggleRow}
              onPress={() => setIsDefault(!isDefault)}
              activeOpacity={0.7}
            >
              <View style={s.toggleLeft}>
                <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.forestGreen} />
                <View style={s.toggleTextWrap}>
                  <Text style={s.toggleTitle}>Default Address</Text>
                  <Text style={s.toggleSub}>Use this for all new orders</Text>
                </View>
              </View>
              <View style={[s.toggleSwitch, isDefault && s.toggleSwitchOn]}>
                <View style={[s.toggleKnob, isDefault && s.toggleKnobOn]} />
              </View>
            </TouchableOpacity>
          </View>

          {/* ── GPS Confirmation ── */}
          {latitude !== 0 && longitude !== 0 && (
            <View style={s.gpsConfirm}>
              <View style={s.gpsConfirmDot} />
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={COLORS.success}
              />
              <Text style={s.gpsConfirmText}>
                GPS coordinates captured • {latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E
              </Text>
            </View>
          )}
        </ScrollView>

        {/* ── Bottom Save Bar ── */}
        <View style={s.formFooter}>
          <View style={s.formFooterInner}>
            {editingId && (
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => {
                  resetForm();
                  switchMode("list");
                }}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
            <Button
              title={editingId ? "Update Address" : "Save Address"}
              onPress={handleSave}
              loading={saving}
              variant="secondary"
              style={[s.saveBtn, !editingId && { flex: 1 }]}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );

  // ─── MAIN RENDER ────────────────────────────────────────
  return (
    <Screen padded={false}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => {
            if (mode === "form" && addresses.length > 0) {
              resetForm();
              switchMode("list");
            } else {
              router.back();
            }
          }}
          style={s.headerBackBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={mode === "form" && addresses.length > 0 ? "close" : "arrow-back"}
            size={22}
            color={COLORS.black}
          />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>
            {mode === "form"
              ? editingId
                ? "Edit Address"
                : "New Address"
              : "My Addresses"}
          </Text>
          {mode === "list" && addresses.length > 0 && (
            <Text style={s.headerSubtitle}>Tap to select for delivery</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Progress Indicator (form only) ── */}
      {mode === "form" && (
        <View style={s.progressBar}>
          <View
            style={[
              s.progressFill,
              {
                width:
                  fullAddress && city && pincode.length === 6
                    ? "100%"
                    : fullAddress
                    ? "50%"
                    : "15%",
              },
            ]}
          />
        </View>
      )}

      {/* ── Content ── */}
      <View style={s.body}>
        {mode === "list" ? renderList() : renderForm()}
      </View>
    </Screen>
  );
}

// ───────────────────────────────────────────────────────────
// STYLES
// ───────────────────────────────────────────────────────────
// Brand-tinted soft shadows (no flat neutral/black drop shadows — see design system).
const CARD_SHADOW = {
  shadowColor: COLORS.darkForest,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
};
const CARD_SHADOW_LG = {
  shadowColor: COLORS.darkForest,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 16,
  elevation: 6,
};

const s = StyleSheet.create({
  // ── Layout ──
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1 },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + "80",
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.black,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },

  // ── Progress Bar ──
  progressBar: {
    height: 3,
    backgroundColor: COLORS.border,
  },
  progressFill: {
    height: 3,
    backgroundColor: COLORS.forestGreen,
    borderRadius: 2,
  },

  // ═══════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: 100,
  },

  // ── GPS Hero Card ──
  gpsHero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.gold + "50",
    ...CARD_SHADOW_LG,
  },
  gpsHeroIconWrap: {
    marginRight: SPACING.md,
  },
  gpsHeroIconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.gold,
    justifyContent: "center",
    alignItems: "center",
  },
  gpsHeroText: {
    flex: 1,
  },
  gpsHeroTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.black,
    letterSpacing: 0.1,
  },
  gpsHeroSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  gpsHeroArrow: {
    marginLeft: SPACING.sm,
  },

  // ── Divider ──
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginHorizontal: SPACING.md,
  },

  // ── Loading ──
  loadingWrap: {
    alignItems: "center",
    marginTop: 60,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },

  // ── Empty State ──
  emptyState: {
    alignItems: "center",
    marginTop: 40,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.mintGreen + "60",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.black,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
  emptyAction: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.forestGreen,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
    marginTop: SPACING.xxl,
    gap: SPACING.sm,
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.white,
  },

  // ── Address Count ──
  listCount: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
    fontWeight: "500",
  },

  // ── Address Card ──
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  cardSelected: {
    borderColor: COLORS.forestGreen,
    borderWidth: 1.5,
  },
  cardStripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: COLORS.forestGreen,
    borderTopLeftRadius: RADIUS.lg,
    borderBottomLeftRadius: RADIUS.lg,
  },
  cardBody: {
    padding: SPACING.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.mintGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  cardIconSelected: {
    backgroundColor: COLORS.forestGreen,
  },
  cardLabels: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginLeft: SPACING.md,
    gap: SPACING.xs,
  },
  cardLabelText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.black,
    letterSpacing: 0.1,
  },
  badgeDefault: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  badgeDefaultText: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.white,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  badgeSelected: {
    backgroundColor: COLORS.gold + "25",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeSelectedText: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.gold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardActions: {
    flexDirection: "row",
    gap: SPACING.xs,
  },
  cardActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  cardActionBtnDanger: {
    backgroundColor: COLORS.error + "0D",
  },
  cardAddress: {
    fontSize: 13.5,
    color: COLORS.textLight,
    lineHeight: 19,
    marginLeft: 50,
  },
  cardMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: SPACING.sm,
    marginLeft: 50,
    gap: SPACING.sm,
  },
  cardMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  cardMetaChipText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
  },

  // ── FAB ──
  fab: {
    position: "absolute",
    bottom: 24,
    right: SPACING.lg,
    borderRadius: RADIUS.full,
    ...CARD_SHADOW_LG,
  },
  fabInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.forestGreen,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
    gap: SPACING.sm,
  },
  fabLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.white,
    letterSpacing: 0.2,
  },

  // ═══════════════════════════════════════════════════════════
  // FORM VIEW
  // ═══════════════════════════════════════════════════════════
  formContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: 140,
  },

  // ── GPS Banner (form) ──
  gpsFormBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cream,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.gold + "40",
  },
  gpsFormIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.gold + "20",
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.md,
  },
  gpsFormText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.gold,
    letterSpacing: 0.1,
  },

  // ── Form Section ──
  formSection: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border + "80",
    ...CARD_SHADOW,
  },
  formSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.forestGreen,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: SPACING.md,
  },

  // ── Form Row ──
  formRow: {
    flexDirection: "row",
  },

  // ── Label Pills ──
  labelPills: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  labelPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.forestGreen + "40",
    backgroundColor: COLORS.white,
    gap: 6,
  },
  labelPillActive: {
    backgroundColor: COLORS.forestGreen,
    borderColor: COLORS.forestGreen,
  },
  labelPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.forestGreen,
  },
  labelPillTextActive: {
    color: COLORS.white,
  },

  // ── Toggle Row ──
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.xs,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: SPACING.md,
  },
  toggleTextWrap: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  toggleSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.border,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleSwitchOn: {
    backgroundColor: COLORS.forestGreen,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.white,
    ...CARD_SHADOW,
  },
  toggleKnobOn: {
    alignSelf: "flex-end",
  },

  // ── GPS Confirmation ──
  gpsConfirm: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.success + "12",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.success + "30",
  },
  gpsConfirmDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  gpsConfirmText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.success,
    fontWeight: "500",
  },

  // ── Footer ──
  formFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border + "80",
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    ...CARD_SHADOW_LG,
  },
  formFooterInner: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textLight,
  },
  saveBtn: {
    flex: 1,
  },

  // ═══════════════════════════════════════════════════════════
  // INPUT FIELD COMPONENT
  // ═══════════════════════════════════════════════════════════
  fieldWrapper: {
    marginBottom: SPACING.sm,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textLight,
    marginBottom: 6,
    marginTop: SPACING.sm,
    letterSpacing: 0.2,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
  },
  inputContainerFocused: {
    borderColor: COLORS.forestGreen,
    backgroundColor: COLORS.white,
  },
  inputContainerError: {
    borderColor: COLORS.error + "80",
    backgroundColor: COLORS.error + "05",
  },
  inputText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: 0,
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  fieldError: {
    fontSize: 11,
    color: COLORS.error,
    marginTop: 4,
    marginLeft: 2,
    fontWeight: "500",
  },
});