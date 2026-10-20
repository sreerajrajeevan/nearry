import { LoadingState } from "./LoadingState";
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from "react-native";
import { Place, PlaceAttribution } from "../services/places";
import { Icon } from "./Icon";
import { Button } from "./Button";
import { colors, typography, spacing } from "../theme";

export function PlaceAttributions({ places }: { places: Place[] }) {
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
            <Text style={styles.link}>{item.label}</Text>
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
export function PlaceSuggestions({
  places,
  loading,
  error,
  onSelect,
  onRetry,
}: {
  places: Place[];
  loading: boolean;
  error: string;
  onSelect: (place: Place) => void;
  onRetry: () => void;
}) {
  return (
    <View>
      {loading ? (
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
            accessibilityLabel={`Explore near ${place.name}, ${place.address}`}
            onPress={() => onSelect(place)}
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
  link: { ...typography.caption, color: colors.accent, paddingVertical: 4 },
});
