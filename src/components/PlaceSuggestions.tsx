import { LoadingState } from "./LoadingState";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Keyboard,
} from "react-native";
import {
  Place,
  PlaceSuggestion,
  PlaceAttribution,
  resolvePlace,
} from "../services/places";
import { Icon } from "./Icon";
import { Button } from "./Button";
import { colors, typography, spacing } from "../theme";

export function PlaceAttributions({ places }: { places: PlaceSuggestion[] }) {
  const unique = new Map<string, PlaceAttribution>();
  for (const place of places)
    for (const item of place.attributions)
      unique.set(item.label + item.url, item);
  if (places.some((p) => p.provider === "demo"))
    return <Text style={styles.caption}>Sample places · demo only</Text>;
  return (
    <View style={styles.attributions}>
      {[...unique.values()].map((item) =>
        item.url ? (
          <TouchableOpacity
            key={item.label + item.url}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(item.url!).catch(() => {})}
          >
            <Text
              numberOfLines={item.label === "Google Maps" ? 1 : undefined}
              style={
                item.label === "Google Maps"
                  ? styles.googleAttribution
                  : styles.link
              }
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text key={item.label} style={styles.caption}>
            {item.label}
          </Text>
        ),
      )}
    </View>
  );
}
export function GoogleMapsCredit() {
  return (
    <PlaceAttributions
      places={[
        {
          provider: "google",
          id: "meeting-locations",
          name: "",
          address: "",
          attributions: [
            { label: "Google Maps", url: "https://maps.google.com/" },
          ],
        },
      ]}
    />
  );
}
export function PlaceSuggestions({
  places,
  loading,
  error,
  onSelect,
  onRetry,
  sessionToken,
  onSessionEnd,
  selectionLabel = "Explore near",
}: {
  selectionLabel?: string;
  places: PlaceSuggestion[];
  loading: boolean;
  error: string;
  onSelect: (place: Place) => void;
  onRetry: () => void;
  sessionToken?: string;
  onSessionEnd?: () => void;
}) {
  const [resolving, setResolving] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const selection = useRef<{ version: number; controller?: AbortController }>({
    version: 0,
  });
  useEffect(() => {
    selection.current.version++;
    selection.current.controller?.abort();
    setResolving(false);
    setSelectionError("");
    return () => {
      selection.current.version++;
      selection.current.controller?.abort();
    };
  }, [places]);
  const choose = async (place: PlaceSuggestion) => {
    if (
      selection.current.controller &&
      !selection.current.controller.signal.aborted
    )
      return;
    const controller = new AbortController();
    selection.current.controller = controller;
    const ticket = ++selection.current.version;
    setResolving(true);
    setSelectionError("");
    try {
      const resolved = await resolvePlace(place, {
        sessionToken,
        signal: controller.signal,
      });
      if (controller.signal.aborted || ticket !== selection.current.version)
        return;
      onSessionEnd?.();
      Keyboard.dismiss();
      onSelect(resolved);
    } catch (e) {
      if (!controller.signal.aborted && ticket === selection.current.version)
        setSelectionError(
          e instanceof Error
            ? e.message
            : "Could not open this place. Try again.",
        );
    } finally {
      if (ticket === selection.current.version) {
        controller.abort();
        setResolving(false);
      }
    }
  };
  return (
    <View>
      {resolving ? (
        <LoadingState label="Opening place…" layout="inline" />
      ) : loading ? (
        <LoadingState label="Finding places…" layout="inline" />
      ) : error ? (
        <View>
          <Text accessibilityRole="alert" style={styles.caption}>
            {error}
          </Text>
          <Button
            title="Retry place search"
            variant="ghost"
            onPress={onRetry}
          />
        </View>
      ) : !places.length ? (
        <Text style={styles.caption}>
          No matching places. Try a fuller name or city.
        </Text>
      ) : (
        places.map((place) => (
          <TouchableOpacity
            key={`${place.provider}:${place.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${selectionLabel} ${place.name}, ${place.address}`}
            onPress={() => void choose(place)}
            style={styles.row}
          >
            <Icon name="map-pin" size={18} color={colors.accent} />
            <View style={styles.copy}>
              <Text style={styles.name}>{place.name}</Text>
              <Text style={styles.caption}>{place.address}</Text>
            </View>
            <Icon name="arrow-up-right" size={16} color={colors.accent} />
          </TouchableOpacity>
        ))
      )}
      {!!selectionError && (
        <Text accessibilityRole="alert" style={styles.caption}>
          {selectionError}
        </Text>
      )}
      <PlaceAttributions places={places} />
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  copy: { flex: 1 },
  name: { ...typography.heading, color: colors.text },
  caption: { ...typography.bodySmall, color: colors.textDim, marginTop: 4 },
  attributions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  googleAttribution: {
    fontSize: 14,
    fontWeight: "400",
    fontStyle: "normal",
    letterSpacing: 0,
    color: "#1F1F1F",
    paddingVertical: 4,
  },
  link: { ...typography.caption, color: colors.accent, paddingVertical: 4 },
});
