import React, { useState } from "react";
import { View, Text, Linking } from "react-native";
import { Input } from "./Input";
import { Button } from "./Button";
import { getCurrentPosition } from "../services/location";
import { BusinessVenueSubmission } from "../utils/businessVenue";
import { colors, spacing, typography } from "../theme";

type Props = {
  value: BusinessVenueSubmission;
  onChange: (v: BusinessVenueSubmission) => void;
  disabled?: boolean;
  onLocatingChange?: (busy: boolean) => void;
};
export function BusinessVenueFields({
  value,
  onChange,
  disabled,
  onLocatingChange,
}: Props) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [latText, setLatText] = useState(
    Number.isFinite(value.latitude) ? String(value.latitude) : "",
  );
  const [lngText, setLngText] = useState(
    Number.isFinite(value.longitude) ? String(value.longitude) : "",
  );
  const update = (patch: Partial<BusinessVenueSubmission>) =>
    onChange({ ...value, ...patch });
  const pinned =
    Number.isFinite(value.latitude) &&
    Math.abs(value.latitude) <= 90 &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.longitude) <= 180;
  const locked = disabled || locating;
  return (
    <View>
      <Text
        style={{
          ...typography.body,
          color: colors.textDim,
          marginBottom: spacing.md,
        }}
      >
        Your address and map location will appear on your venue and offers after
        admin approval.
      </Text>
      <Input
        label="Venue name"
        value={value.name}
        onChangeText={(name) => update({ name })}
        editable={!locked}
        maxLength={120}
      />
      <Input
        label="Business category"
        value={value.category}
        onChangeText={(category) => update({ category })}
        editable={!locked}
        maxLength={60}
        placeholder="Café, sports, fitness…"
      />
      <Input
        label="Area / locality"
        value={value.area}
        onChangeText={(area) => update({ area })}
        editable={!locked}
        maxLength={120}
      />
      <Input
        label="Full public address"
        value={value.address}
        onChangeText={(address) => update({ address })}
        editable={!locked}
        multiline
        maxLength={500}
        placeholder="Building, street, locality, city and postcode"
      />
      <Button
        title="Use current location at my venue"
        variant="secondary"
        loading={locating}
        disabled={disabled}
        onPress={async () => {
          setLocating(true);
          onLocatingChange?.(true);
          setError("");
          try {
            const point = await getCurrentPosition();
            if (!point) {
              setError(
                "Allow location access and try again, or enter your venue’s coordinates below.",
              );
              return;
            }
            setLatText(String(point.latitude));
            setLngText(String(point.longitude));
            update({ ...point, source: "device" });
          } finally {
            setLocating(false);
            onLocatingChange?.(false);
          }
        }}
      />
      <Text
        style={{
          ...typography.caption,
          color: colors.textDim,
          marginVertical: spacing.sm,
        }}
      >
        Use this while at your business. Otherwise, enter the latitude and
        longitude of your venue below.
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Input
          label="Latitude"
          containerStyle={{ flex: 1 }}
          value={latText}
          editable={!disabled && !locating}
          onChangeText={(t) => {
            setLatText(t);
            update({ latitude: t.trim() ? Number(t) : NaN, source: "manual" });
          }}
          placeholder="9.9990"
        />
        <Input
          label="Longitude"
          containerStyle={{ flex: 1 }}
          value={lngText}
          editable={!disabled && !locating}
          onChangeText={(t) => {
            setLngText(t);
            update({ longitude: t.trim() ? Number(t) : NaN, source: "manual" });
          }}
          placeholder="76.3000"
        />
      </View>
      {pinned && (
        <Button
          title="Check this pin on a map ↗"
          variant="secondary"
          onPress={() =>
            void Linking.openURL(
              `https://www.google.com/maps/search/?api=1&query=${value.latitude},${value.longitude}`,
            )
          }
        />
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.red, marginTop: spacing.sm }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
