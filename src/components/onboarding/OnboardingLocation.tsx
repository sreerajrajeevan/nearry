import React, { useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import { getCurrentPosition } from "../../services/location";
import type { Place } from "../../services/places";
import { PlaceSuggestions, GoogleMapsCredit } from "../PlaceSuggestions";
import { usePlaceSuggestions } from "../../hooks/usePlaceSuggestions";
import { Icon } from "../Icon";
import { MotionPressable } from "../Motion";
import {
  OnboardingInput,
  OnboardingButton,
  OnboardingHeading,
  OnboardingLink,
  ob,
  onboardingColors as c,
} from "./OnboardingKit";
import {
  ONBOARDING_RADII,
  OnboardingPreferences,
} from "../../utils/onboarding";

export function OnboardingLocation({
  value,
  onChange,
  business = false,
  manualArea,
  onManualArea,
  busy = false,
  onBusyChange,
}: {
  value: OnboardingPreferences;
  onChange: (next: OnboardingPreferences) => void;
  business?: boolean;
  manualArea: string;
  onManualArea: (area: string) => void;
  busy?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const suggestions = usePlaceSuggestions(
    query,
    value.area,
    query.trim().length >= 3 && !busy,
  );
  const select = (place: Place) => {
    onChange({
      ...value,
      area: {
        label: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        source: place.provider,
        acquiredAt: new Date().toISOString(),
      },
    });
    onManualArea(place.name);
    setQuery("");
    setError("");
  };
  async function locate() {
    if (locating) return;
    setLocating(true);
    onBusyChange?.(true);
    setError("");
    try {
      const position = await withDeadline(getCurrentPosition(), 20000);
      if (!position) {
        setError("Location is unavailable. Search for your area instead.");
        return;
      }
      let label = "Current location";
      try {
        const [address] = await withDeadline(
          Location.reverseGeocodeAsync(position),
          5000,
        );
        label =
          [
            address?.district || address?.subregion,
            address?.city || address?.region,
          ]
            .filter(Boolean)
            .filter((x, i, a) => a.indexOf(x) === i)
            .join(", ") || label;
      } catch {
        /* Coordinates remain usable when the device cannot name the area. */
      }
      onChange({
        ...value,
        area: {
          ...position,
          label,
          source: "device",
          acquiredAt: new Date().toISOString(),
        },
      });
      onManualArea(label);
      setQuery("");
    } catch {
      setError("Could not get your location. Search for an area instead.");
    } finally {
      setLocating(false);
      onBusyChange?.(false);
    }
  }
  return (
    <>
      <OnboardingHeading
        kicker={business ? "Your neighbourhood" : "Keep it close"}
        title={
          business ? "Where can people\nfind you?" : "Where’s your nearby?"
        }
        subtitle={
          business
            ? "Choose the area your business calls home."
            : "Choose an area to start exploring. You can change it anytime."
        }
      />
      <View
        style={styles.radar}
        accessibilityLabel="Illustration of nearby possibilities"
      >
        <View
          style={[
            styles.circle,
            {
              width: 100 + value.radiusKm * 4,
              height: 100 + value.radiusKm * 4,
            },
          ]}
        />
        <View style={styles.center}>
          <Icon name="map-pin" color={c.white} size={20} />
        </View>
        <Text
          style={[
            styles.item,
            { left: 28, top: 20, transform: [{ rotate: "-8deg" }] },
          ]}
        >
          🏸
        </Text>
        <Text
          style={[
            styles.item,
            { right: 24, top: 48, transform: [{ rotate: "8deg" }] },
          ]}
        >
          ☕
        </Text>
        <Text style={[styles.item, { left: 64, bottom: 26 }]}>🌿</Text>
        <Text style={styles.caption}>Your nearby possibilities</Text>
      </View>
      <OnboardingButton
        title={
          value.area?.source === "device"
            ? "Current location selected"
            : "Use my current location"
        }
        secondary
        onPress={() => void locate()}
        loading={locating}
        disabled={busy}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={ob.error}>
          {error}
        </Text>
      )}
      {value.area && (
        <View style={[ob.card, { marginTop: 16 }]}>
          <Text style={{ fontWeight: "600", color: c.ink }}>
            {value.area.label}
          </Text>
          <Text style={ob.help}>Location selected</Text>
          <OnboardingLink
            title="Change area"
            disabled={busy}
            onPress={() => {
              onChange({ ...value, area: undefined });
              onManualArea("");
            }}
          />
          {value.area.source === "google" && <GoogleMapsCredit />}
        </View>
      )}
      {!value.area && (
        <>
          <OnboardingInput
            label="Search for an area"
            placeholder="e.g. Kakkanad, Kochi"
            value={query}
            editable={!busy}
            onChangeText={(text) => {
              setQuery(text);
              onManualArea("");
              setError("");
            }}
            clearable
            autoCapitalize="words"
            maxLength={120}
          />
          {query.trim().length >= 3 && (
            <PlaceSuggestions
              {...suggestions}
              places={suggestions.places}
              loading={suggestions.loading}
              error={suggestions.error}
              onRetry={suggestions.retry}
              sessionToken={suggestions.sessionToken}
              onSessionEnd={suggestions.onSessionEnd}
              onSelect={select}
              selectionLabel="Choose area"
            />
          )}
          {business &&
            query.trim().length >= 3 &&
            !suggestions.loading &&
            !suggestions.error &&
            !suggestions.places.length && (
              <OnboardingLink
                title={`Use “${query.trim()}” as area name only`}
                disabled={busy}
                onPress={() => {
                  onManualArea(query.trim());
                  setQuery("");
                }}
              />
            )}
          {business && !!manualArea && (
            <Text style={ob.help}>
              {manualArea} · area name only; no map coordinates.
            </Text>
          )}
        </>
      )}
      {!business && (
        <>
          <View style={styles.labelRow}>
            <Text style={ob.label}>Show plans within</Text>
            <Text style={ob.label}>{value.radiusKm} km</Text>
          </View>
          <Slider
            accessibilityLabel="Search distance"
            accessibilityValue={{
              min: 2,
              max: 25,
              now: value.radiusKm,
              text: `${value.radiusKm} kilometres`,
            }}
            minimumValue={0}
            maximumValue={ONBOARDING_RADII.length - 1}
            step={1}
            value={ONBOARDING_RADII.indexOf(value.radiusKm)}
            disabled={busy}
            minimumTrackTintColor={c.bright}
            maximumTrackTintColor={c.line}
            thumbTintColor={c.orange}
            onValueChange={(index) =>
              onChange({
                ...value,
                radiusKm: ONBOARDING_RADII[Math.round(index)],
              })
            }
          />
          <View style={styles.labelRow}>
            {ONBOARDING_RADII.map((r) => (
              <MotionPressable
                key={r}
                accessibilityRole="button"
                accessibilityLabel={`Within ${r} km`}
                accessibilityState={{ selected: value.radiusKm === r }}
                disabled={busy}
                onPress={() => onChange({ ...value, radiusKm: r })}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={[
                    ob.help,
                    value.radiusKm === r && {
                      color: c.orange,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {r} km
                </Text>
              </MotionPressable>
            ))}
          </View>
          <Text style={ob.help}>
            Your live location is never shown to other people.
          </Text>
        </>
      )}
    </>
  );
}
async function withDeadline<T>(
  work: Promise<T>,
  milliseconds: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Location timed out")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const styles = StyleSheet.create({
  radar: {
    height: 225,
    borderRadius: 24,
    backgroundColor: c.mint,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  circle: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#F15A3255",
    backgroundColor: "#F15A3212",
  },
  center: {
    position: "absolute",
    borderWidth: 5,
    borderColor: c.white,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.bright,
    alignItems: "center",
    justifyContent: "center",
  },
  item: {
    position: "absolute",
    fontSize: 28,
    lineHeight: 42,
    padding: 6,
    borderRadius: 16,
    backgroundColor: c.white,
    overflow: "hidden",
  },
  caption: {
    position: "absolute",
    bottom: 12,
    right: 15,
    color: c.green,
    fontSize: 11,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
