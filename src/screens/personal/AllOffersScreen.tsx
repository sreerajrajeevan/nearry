import { RowListSkeleton } from "../../components/Skeletons";
import React, { useState } from "react";
import { EnterView } from "../../components/Motion";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PersonalStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { BackButton } from "../../components/BackButton";
import { PageHeading } from "../../components/PageHeading";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { MotionPressable } from "../../components/Motion";
import { OfferRow } from "../../components/OfferRow";
import { useLiveQuery } from "../../hooks/useLiveQuery";
import { useDiscoveryClock } from "../../hooks/useDiscoveryClock";
import { listLiveOffers, subscribeToOffers } from "../../services/offers";
import {
  discoverOffers,
  OFFER_CATEGORIES,
  OfferCategory,
} from "../../utils/offerDiscovery";
import { colors, typography, weight } from "../../theme";

/** Every live offer in the area Home is showing, with simple category tabs. */
export function AllOffersScreen({
  route,
  navigation,
}: NativeStackScreenProps<PersonalStackParamList, "AllOffers">) {
  const venueIds = route.params?.venueIds;
  const distances = new Map(route.params?.distances ?? []);
  const now = useDiscoveryClock();
  const [category, setCategory] = useState<OfferCategory>("all");
  const { data, state, error, refresh } = useLiveQuery(
    `offers:${venueIds?.join(",") ?? "all"}`,
    () => listLiveOffers(venueIds),
    subscribeToOffers,
  );
  const live = discoverOffers(data ?? [], "all", now);
  const shown = discoverOffers(live, category, now).sort(
    // Spotlighted offers first, then the ones ending soonest.
    (a, b) =>
      Number(b.isSpotlight) - Number(a.isSpotlight) ||
      Date.parse(a.endsAt) - Date.parse(b.endsAt),
  );
  const counts = new Map(
    OFFER_CATEGORIES.map((c) => [
      c.key,
      discoverOffers(live, c.key, now).length,
    ]),
  );
  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <BackButton onPress={() => navigation.goBack()} />
        <PageHeading
          compact
          title="Offers nearby"
          greeting="From local businesses"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {OFFER_CATEGORIES.filter(
            (c) => c.key === "all" || (counts.get(c.key) ?? 0) > 0,
          ).map((c) => {
            const on = category === c.key;
            return (
              <MotionPressable
                key={c.key}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${c.label}, ${counts.get(c.key) ?? 0} offers`}
                onPress={() => setCategory(c.key)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {c.label}
                </Text>
                <Text style={[styles.chipCount, on && styles.chipTextOn]}>
                  {counts.get(c.key) ?? 0}
                </Text>
              </MotionPressable>
            );
          })}
        </ScrollView>
        {state === "loading" && !data ? (
          <RowListSkeleton label="Finding offers" square />
        ) : state === "error" && !data ? (
          <View style={styles.gap}>
            <EmptyState
              title="Offers could not load"
              hint={error || "Please try again."}
            />
            <Button title="Try again" onPress={() => void refresh()} />
          </View>
        ) : shown.length ? (
          shown.map((offer, index) => (
            <EnterView key={`${category}:${offer.id}`} index={index}>
              <OfferRow
                offer={offer}
                distanceKm={
                  offer.venueId ? distances.get(offer.venueId) : undefined
                }
                onPress={() =>
                  navigation.navigate("OfferDetails", { offerId: offer.id })
                }
              />
            </EnterView>
          ))
        ) : (
          <EmptyState
            title={
              category === "all" ? "No offers right now" : "Nothing here yet"
            }
            hint="Local businesses add new offers often. Check back soon."
          />
        )}
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  gap: { gap: 12 },
  chips: { gap: 8, paddingBottom: 16, paddingRight: 16 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.night, borderColor: colors.night },
  chipText: { ...typography.bodySmall, ...weight("700"), color: colors.text },
  chipCount: { ...typography.caption, ...weight("700"), color: colors.textDim },
  chipTextOn: { color: "#FFFFFF" },
});
