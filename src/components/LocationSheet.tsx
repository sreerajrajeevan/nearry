import React, { useEffect, useState } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { colors, typography, weight } from "../theme";
import { useReducedMotion } from "../store/MotionContext";
import { usePlaceSuggestions } from "../hooks/usePlaceSuggestions";
import { Place, PlaceBias, resolvePlace } from "../services/places";
import { HOME_DISTANCES, distanceLabel } from "../utils/homeLocation";
import { LoadingState } from "./LoadingState";
import { Input } from "./Input";
import { Icon, IconName } from "./Icon";
import { PlaceAttributions, PlaceSuggestions } from "./PlaceSuggestions";

function Row({
  icon,
  title,
  subtitle,
  onPress,
  label,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowIcon}>
        <Icon name={icon} size={17} color={colors.amberDeep} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/** Everything about "where": search, current location, recent places and distance. */
export function LocationSheet({
  demo,
  bias,
  distanceKm,
  showDistance,
  recents,
  locating,
  error,
  onPickPlace,
  onUseMyLocation,
  onDistance,
  onClose,
}: {
  demo: boolean;
  bias: PlaceBias | null;
  distanceKm: number | null;
  showDistance: boolean;
  recents: Place[];
  locating: boolean;
  error: string;
  onPickPlace: (place: Place) => void;
  onUseMyLocation: () => void;
  onDistance: (km: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [opening, setOpening] = useState(false);
  const [notFound, setNotFound] = useState("");
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const suggestions = usePlaceSuggestions(query, bias, true);
  const searching = query.trim().length >= 3;

  // Pressing search picks the top suggestion, waiting for it if needed.
  useEffect(() => {
    if (!submitted || suggestions.loading) return;
    setSubmitted(false);
    const typed = query.trim().toLowerCase();
    const top =
      suggestions.places.find((p) => p.name.toLowerCase() === typed) ??
      suggestions.places[0];
    if (!top) {
      setNotFound(
        suggestions.error ||
          "Couldn’t find that place. Try a fuller name, like “Koramangala, Bengaluru”.",
      );
      return;
    }
    let active = true;
    setOpening(true);
    resolvePlace(top, { sessionToken: suggestions.sessionToken })
      .then((place) => {
        if (!active) return;
        suggestions.onSessionEnd();
        Keyboard.dismiss();
        onPickPlace(place);
      })
      .catch((e) => {
        if (active)
          setNotFound(
            e instanceof Error ? e.message : "Couldn’t open that place.",
          );
      })
      .finally(() => {
        if (active) setOpening(false);
      });
    return () => {
      active = false;
    };
  }, [submitted, suggestions.loading, suggestions.places]);

  const submit = () => {
    setNotFound("");
    if (searching) setSubmitted(true);
  };

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      presentationStyle="overFullScreen"
      animationType={reduced ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close location"
          onPress={onClose}
        />
        <SafeAreaView edges={["top", "left", "right"]} style={styles.position}>
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.handle} accessible={false} />
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>
                Location
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close location"
                onPress={onClose}
                style={styles.close}
              >
                <Icon name="x" size={22} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.scroller}
              contentContainerStyle={[
                styles.content,
                { paddingBottom: Math.max(insets.bottom, 16) + 8 },
              ]}
              keyboardShouldPersistTaps="handled"
            >
              <Input
                clearable
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  setNotFound("");
                  setSubmitted(false);
                }}
                accessibilityLabel="Search a city, area or place"
                placeholder="Search a city, area or place"
                maxLength={120}
                returnKeyType="search"
                onSubmitEditing={submit}
                autoCorrect={false}
              />
              {opening ? (
                <LoadingState label="Opening place…" layout="inline" />
              ) : searching ? (
                <PlaceSuggestions
                  {...suggestions}
                  selectionLabel="Show plans near"
                  onRetry={suggestions.retry}
                  onSelect={onPickPlace}
                />
              ) : (
                <View>
                  {!demo && (
                    <Row
                      icon="navigation"
                      title={
                        locating ? "Finding you…" : "Use my current location"
                      }
                      label="Use my current location"
                      onPress={onUseMyLocation}
                    />
                  )}
                  {recents.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>Recent</Text>
                      {recents.map((place) => (
                        <Row
                          key={`${place.provider}:${place.id}`}
                          icon="clock"
                          title={place.name}
                          subtitle={place.address}
                          label={`Show plans near ${place.name}`}
                          onPress={() => onPickPlace(place)}
                        />
                      ))}
                      <PlaceAttributions places={recents} />
                    </>
                  )}
                </View>
              )}
              {!!(notFound || error) && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {notFound || error}
                </Text>
              )}
              {showDistance && !searching && (
                <View style={styles.distance}>
                  <Text accessibilityRole="header" style={styles.sectionLabel}>
                    Distance
                  </Text>
                  <View
                    accessibilityRole="radiogroup"
                    accessibilityLabel="Distance"
                    style={styles.chips}
                  >
                    {HOME_DISTANCES.map((km) => {
                      const on = distanceKm === km;
                      return (
                        <Pressable
                          key={km}
                          accessibilityRole="radio"
                          accessibilityLabel={`Within ${km} kilometres`}
                          accessibilityState={{ checked: on }}
                          aria-checked={on}
                          onPress={() => onDistance(km)}
                          style={[styles.chip, on && styles.chipOn]}
                        >
                          <Text
                            style={[styles.chipText, on && styles.chipTextOn]}
                          >
                            {distanceLabel(km)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.hint}>
                    If nothing is that close, we look a little further and tell
                    you.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(3,7,18,0.42)" },
  position: { flex: 1, justifyContent: "flex-end", paddingTop: 20 },
  sheet: {
    height: "86%",
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 20,
    paddingRight: 12,
    paddingVertical: 6,
  },
  title: { ...typography.title, color: colors.ink, flex: 1 },
  close: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  scroller: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: 0.6 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.body, color: colors.ink, ...weight("700") },
  rowSubtitle: { ...typography.caption, color: colors.textDim, marginTop: 1 },
  sectionLabel: {
    ...typography.label,
    color: colors.textDim,
    marginTop: 18,
    marginBottom: 2,
  },
  distance: { marginTop: 6 },
  chips: { flexDirection: "row", gap: 6, marginTop: 8 },
  chip: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 4,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: { backgroundColor: colors.night, borderColor: colors.night },
  chipText: { ...typography.label, color: colors.gray800, ...weight("700") },
  chipTextOn: { color: colors.onAccent },
  hint: { ...typography.caption, color: colors.textDim, marginTop: 10 },
  error: {
    ...typography.bodySmall,
    color: colors.clayDeep,
    marginTop: 12,
  },
});
