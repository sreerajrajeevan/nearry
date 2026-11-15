import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Icon } from "./Icon";
import { Input } from "./Input";
import { Button } from "./Button";
import { PlaceSuggestions, PlaceAttributions } from "./PlaceSuggestions";
import { usePlaceSuggestions } from "../hooks/usePlaceSuggestions";
import { searchVenues } from "../services/venues";
import { Venue } from "../services/mappers";
import { getCurrentPosition } from "../services/location";
import { Place } from "../services/places";
import { manualPostLocation, PostLocation } from "../utils/postLocation";
import { colors, radius, spacing, typography, weight } from "../theme";

export type PostMeetingSpot = {
  name: string;
  venueId?: string;
  location?: PostLocation;
};
export function PostLocationField({
  value,
  onChange,
  onDraftChange,
  disabled = false,
  required = false,
}: {
  value: PostMeetingSpot | null;
  onChange: (value: PostMeetingSpot | null) => void;
  onDraftChange: (unfinished: boolean) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueError, setVenueError] = useState("");
  const [manual, setManual] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [preview, setPreview] = useState<Place | null>(null);
  const version = useRef(0);
  const suggestions = usePlaceSuggestions(
    query,
    undefined,
    !value && !manual && !disabled,
  );
  useEffect(() => {
    onDraftChange(!value && !!query.trim());
  }, [query, value, onDraftChange]);
  useEffect(
    () => () => {
      version.current++;
    },
    [],
  );
  useEffect(() => {
    let active = true;
    setVenues([]);
    setVenueError("");
    if (value || disabled || manual || query.trim().length < 2) return;
    const timer = setTimeout(
      () =>
        void searchVenues(query.trim())
          .then((rows) => {
            if (active) setVenues(rows.slice(0, 3));
          })
          .catch(() => {
            if (active)
              setVenueError(
                "Nearry venues could not load. You can still search Google or add a location below.",
              );
          }),
      300,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, value, disabled, manual]);
  const clear = () => {
    version.current++;
    setLocating(false);
    onChange(null);
    setQuery("");
    setManual(false);
    setLatitude("");
    setLongitude("");
    setPreview(null);
    setError("");
  };
  const usePosition = async () => {
    const ticket = ++version.current;
    setLocating(true);
    setError("");
    const point = await getCurrentPosition();
    if (ticket !== version.current) return;
    setLocating(false);
    if (!point) {
      setError(
        "Could not get your location. Allow location access or enter coordinates.",
      );
      return;
    }
    setLatitude(String(point.latitude));
    setLongitude(String(point.longitude));
  };
  const useManual = () => {
    const location = manualPostLocation(latitude, longitude);
    if (!query.trim() || !location) {
      setError(
        "Enter a place name and valid latitude / longitude. A name alone cannot locate your plan.",
      );
      return;
    }
    onChange({ name: query.trim(), location });
    setError("");
  };
  return (
    <View style={styles.section}>
      <Text style={styles.label}>
        {required ? "Meeting place *" : "Meeting place (optional)"}
      </Text>
      {value ? (
        <View style={styles.selected}>
          <View style={styles.pin}>
            <Icon name="map-pin" size={18} color={colors.amberDeep} />
          </View>
          <View style={styles.selectedCopy}>
            {/* The host's own label for the place; tap to rename. */}
            <TextInput
              accessibilityLabel="Place name for your post"
              value={value.name}
              maxLength={120}
              editable={!disabled}
              onChangeText={(name) => onChange({ ...value, name })}
              style={styles.selectedName}
              placeholder="Name this place"
              placeholderTextColor={colors.textFaint}
            />
            <Text style={styles.selectedMeta} numberOfLines={1}>
              {preview?.address ||
                (value.venueId
                  ? "Nearry venue"
                  : value.location
                    ? "Pinned on the map"
                    : "No map pin yet. Choose a place so it shows nearby.")}
            </Text>
            {preview && <PlaceAttributions places={[preview]} />}
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Change place"
            disabled={disabled}
            onPress={clear}
            hitSlop={8}
            style={styles.change}
          >
            <Icon name="x" size={18} color={colors.textDim} />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Input
            clearable
            label={manual ? "Place name" : undefined}
            placeholder="Search a venue, landmark or address"
            value={query}
            maxLength={120}
            editable={!disabled && !locating}
            onChangeText={(text) => {
              version.current++;
              setQuery(text);
              setError("");
            }}
          />
          {!manual && !disabled && (
            <>
              {!!venues.length && (
                <Text style={[styles.hint, styles.group]}>On Nearry</Text>
              )}
              {venues.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${v.name}, ${v.area}`}
                  style={styles.venueRow}
                  onPress={() => {
                    suggestions.onSessionEnd();
                    onChange({ name: v.name, venueId: v.id });
                  }}
                >
                  <Icon name="map-pin" size={18} color={colors.amberDeep} />
                  <View style={styles.selectedCopy}>
                    <Text style={styles.selectedName}>{v.name}</Text>
                    <Text style={styles.selectedMeta}>{v.area}</Text>
                  </View>
                  <Icon name="arrow-up-right" size={16} color={colors.accent} />
                </TouchableOpacity>
              ))}
              {!!venueError && <Text style={styles.hint}>{venueError}</Text>}
              {query.trim().length >= 3 && (
                <PlaceSuggestions
                  {...suggestions}
                  onRetry={suggestions.retry}
                  selectionLabel="Select"
                  onSelect={(place) => {
                    setPreview(place);
                    // Keep the host's independently entered label; do not persist Google's name/address.
                    onChange({
                      name: query.trim(),
                      location: {
                        latitude: place.latitude,
                        longitude: place.longitude,
                        source:
                          place.provider === "google"
                            ? "google"
                            : place.provider === "demo"
                              ? "demo"
                              : "geoapify",
                        placeId: place.id,
                      },
                    });
                  }}
                />
              )}
              <Button
                title="Can’t find it? Add a location"
                variant="ghost"
                onPress={() => {
                  suggestions.onSessionEnd();
                  setManual(true);
                }}
              />
            </>
          )}
          {manual && (
            <>
              <Text style={styles.hint}>
                Use your current location only if you are at the meeting spot.
                Otherwise paste the spot’s latitude and longitude from Google
                Maps. We won’t guess coordinates from a name.
              </Text>
              <Button
                title="Use my current location"
                variant="secondary"
                disabled={disabled}
                loading={locating}
                onPress={() => void usePosition()}
              />
              <Input
                label="Latitude"
                placeholder="e.g. 10.01002"
                value={latitude}
                editable={!disabled && !locating}
                keyboardType="numbers-and-punctuation"
                onChangeText={setLatitude}
              />
              <Input
                label="Longitude"
                placeholder="e.g. 76.36397"
                value={longitude}
                editable={!disabled && !locating}
                keyboardType="numbers-and-punctuation"
                onChangeText={setLongitude}
              />
              <Button
                title="Use this meeting spot"
                disabled={disabled || locating}
                onPress={useManual}
              />
              <Button
                title="Back to place search"
                variant="ghost"
                disabled={disabled}
                onPress={() => {
                  version.current++;
                  setLocating(false);
                  setManual(false);
                  setError("");
                }}
              />
            </>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { marginBottom: spacing.md },
  label: {
    ...typography.body,
    color: colors.textDim,
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginBottom: spacing.sm,
  },
  error: { ...typography.bodySmall, color: colors.red },
  group: { marginTop: spacing.sm, marginBottom: 0 },
  selected: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pin: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
  },
  selectedCopy: { flex: 1, minWidth: 0 },
  selectedName: {
    ...typography.body,
    ...weight("700"),
    color: colors.text,
    padding: 0,
  },
  selectedMeta: { ...typography.caption, color: colors.textDim, marginTop: 2 },
  change: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
});
