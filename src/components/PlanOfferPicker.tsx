import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Offer } from "../services/mappers";
import { AvailableSlot, listOfferSlots } from "../services/bookings";
import { listLiveOffers } from "../services/offers";
import { getVenue } from "../services/venues";
import { bundleCreationAvailable } from "../services/planOfferBundles";
import {
  bundleOfferEligible,
  bundleSlotAvailable,
  rupees,
} from "../utils/planOfferBundle";
import { formatWhen, formatTime } from "../utils/format";
import { colors, weight } from "../theme";
import { Input } from "./Input";
import { Button } from "./Button";

export type PlanOfferSelection = {
  offer: Offer;
  slot: AvailableSlot;
  venueName: string;
};

export function PlanOfferPicker({
  value,
  people,
  disabled,
  onChange,
}: {
  value: PlanOfferSelection | null;
  people: number;
  disabled: boolean;
  onChange: (selection: PlanOfferSelection | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [chosen, setChosen] = useState<Offer | null>(null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setBusy(true);
    setError("");
    void (async () => {
      if (!(await bundleCreationAvailable()))
        throw new Error(
          "Offers cannot be attached yet. You can still publish a regular plan.",
        );
      if (chosen) {
        const result = await listOfferSlots(chosen.id);
        if (active) setSlots(result);
      } else {
        const result = await listLiveOffers();
        if (active) setOffers(result.filter(bundleOfferEligible));
      }
    })()
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Could not load offers.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [open, chosen?.id, retry]);

  const chooseSlot = async (slot: AvailableSlot) => {
    if (!chosen || busy || disabled) return;
    if (!bundleSlotAvailable(slot, people)) {
      setError("Choose an empty future slot with enough places for everyone.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const venue = await getVenue(chosen.venueId!);
      if (!venue)
        throw new Error("This venue is unavailable. Choose another offer.");
      onChange({ offer: chosen, slot, venueName: venue.name });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not select the venue.");
    } finally {
      setBusy(false);
    }
  };
  const availableSlots = slots.filter((slot) =>
    bundleSlotAvailable(slot, people),
  );
  const visible = offers.filter((offer) =>
    `${offer.title} ${offer.businessName}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Make a plan with a local offer</Text>
      <Text style={styles.text}>One group reservation. Pay at the venue.</Text>
      {value && (
        <>
          <Text style={styles.title}>{value.offer.title}</Text>
          <Text style={styles.text}>
            {value.offer.businessName} · {value.venueName}
          </Text>
          <Text style={styles.text}>
            {formatWhen(value.slot.starts_at)} –{" "}
            {formatTime(value.slot.ends_at)}
          </Text>
          <Text style={styles.text}>
            {rupees(value.offer.priceCents!)} each ·{" "}
            {rupees(value.offer.priceCents! * people)} for {people} places
            including you
          </Text>
          <Text style={styles.text}>
            You are responsible for the full reserved total, even if your plan
            does not fill. The business must confirm within 30 minutes.
          </Text>
          {!bundleSlotAvailable(value.slot, people) && (
            <Text accessibilityRole="alert" style={styles.text}>
              Choose another empty slot or reduce people needed. This slot is
              unavailable for your group.
            </Text>
          )}
          <Button
            title="Remove attached offer"
            variant="ghost"
            disabled={disabled || busy}
            onPress={() => {
              onChange(null);
              setChosen(null);
              setSlots([]);
            }}
          />
        </>
      )}
      {!open && (
        <Button
          title={value ? "Change offer or slot" : "Browse bookable offers"}
          variant="secondary"
          disabled={disabled}
          onPress={() => setOpen(true)}
        />
      )}
      {open && (
        <>
          <Button
            title="Close offers"
            variant="ghost"
            disabled={busy}
            onPress={() => setOpen(false)}
          />
          {error ? (
            <>
              <Text accessibilityRole="alert" style={styles.text}>
                {error}
              </Text>
              <Button
                title="Retry offers"
                variant="ghost"
                onPress={() => setRetry((n) => n + 1)}
              />
            </>
          ) : null}
          {busy ? (
            <Text style={styles.text}>Checking available places…</Text>
          ) : (
            !error && (
              <>
                {chosen ? (
                  <>
                    <Text style={styles.title}>
                      {chosen.title} · {rupees(chosen.priceCents!)} each
                    </Text>
                    <Button
                      title="Choose another offer"
                      variant="ghost"
                      onPress={() => {
                        setChosen(null);
                        setSlots([]);
                      }}
                    />
                    {!availableSlots.length && (
                      <Text style={styles.text}>
                        No empty future slots fit your group. Try fewer people
                        or another offer.
                      </Text>
                    )}
                    <ScrollView style={styles.list} nestedScrollEnabled>
                      {availableSlots.map((slot) => (
                        <Button
                          key={slot.id}
                          title={`${formatWhen(slot.starts_at)} – ${formatTime(slot.ends_at)} · ${slot.seats_left} places left`}
                          variant="secondary"
                          disabled={
                            disabled || !bundleSlotAvailable(slot, people)
                          }
                          onPress={() => void chooseSlot(slot)}
                        />
                      ))}
                    </ScrollView>
                  </>
                ) : (
                  <>
                    <Input
                      label="Search offers or businesses"
                      value={query}
                      onChangeText={setQuery}
                      clearable
                    />
                    {!visible.length && (
                      <Text style={styles.text}>
                        No matching fixed-price offers with bookable group
                        slots. Try another search or create a regular plan.
                      </Text>
                    )}
                    <ScrollView style={styles.list} nestedScrollEnabled>
                      {visible.map((offer) => (
                        <Button
                          key={offer.id}
                          title={`${offer.title} · ${offer.businessName} · ${rupees(offer.priceCents!)} each`}
                          variant="secondary"
                          disabled={disabled}
                          onPress={() => {
                            setChosen(offer);
                            setSlots([]);
                          }}
                        />
                      ))}
                    </ScrollView>
                  </>
                )}
              </>
            )
          )}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    gap: 10,
    marginBottom: 20,
  },
  title: { color: colors.text, fontSize: 16, ...weight("bold") },
  text: { color: colors.textDim, fontSize: 14, lineHeight: 21 },
  list: { maxHeight: 280 },
});
