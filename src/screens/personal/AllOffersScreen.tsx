import React, { useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PersonalStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { BackButton } from "../../components/BackButton";
import { PageHeading } from "../../components/PageHeading";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { MotionPressable, EnterView } from "../../components/Motion";
import { OfferRow } from "../../components/OfferRow";
import { RowListSkeleton } from "../../components/Skeletons";
import { usePagedQuery } from "../../hooks/usePagedQuery";
import { listOffersPage, subscribeToOffers } from "../../services/offers";
import {
  OFFER_CATEGORIES,
  type OfferCategory,
} from "../../utils/offerDiscovery";
import { colors, typography, weight } from "../../theme";
export function AllOffersScreen({
  route,
  navigation,
}: NativeStackScreenProps<PersonalStackParamList, "AllOffers">) {
  const { venueIds, area } = route.params ?? {},
    distances = new Map(route.params?.distances ?? []);
  const [category, setCategory] = useState<OfferCategory>("all");
  const pages = usePagedQuery(
    "offers:" + JSON.stringify([venueIds, area, category]),
    (cursor) => listOffersPage({ venueIds, nearby: area, category }, cursor),
    subscribeToOffers,
  );
  return (
    <Screen>
      <FlatList
        data={pages.items}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={
          <>
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
              {OFFER_CATEGORIES.map((c) => (
                <MotionPressable
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  accessibilityRole="button"
                  accessibilityLabel={c.label}
                  accessibilityState={{ selected: category === c.key }}
                  style={[styles.chip, category === c.key && styles.chipOn]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      category === c.key && styles.chipTextOn,
                    ]}
                  >
                    {c.label}
                  </Text>
                </MotionPressable>
              ))}
            </ScrollView>
          </>
        }
        ListEmptyComponent={
          pages.state === "loading" ? (
            <RowListSkeleton label="Finding offers" square />
          ) : pages.state === "error" ? (
            <>
              <EmptyState title="Offers could not load" hint={pages.error} />
              <Button title="Try again" onPress={() => void pages.refresh()} />
            </>
          ) : (
            <EmptyState
              title="No offers here yet"
              hint="Try another category or check back soon."
            />
          )
        }
        renderItem={({ item: o, index }) => (
          <EnterView index={index}>
            <OfferRow
              offer={o}
              distanceOrigin={route.params?.distanceOrigin}
              distanceKm={
                o.distanceKm ??
                (o.venueId ? distances.get(o.venueId) : undefined)
              }
              onPress={() =>
                navigation.navigate("OfferDetails", { offerId: o.id })
              }
            />
          </EnterView>
        )}
        ListFooterComponent={
          <>
            {pages.moreError ? (
              <Text style={styles.chipText}>{pages.moreError}</Text>
            ) : null}
            {pages.cursor && (
              <Button
                title="More offers"
                loading={pages.loadingMore}
                onPress={() => void pages.loadMore()}
              />
            )}
          </>
        }
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  chips: { gap: 8, paddingBottom: 16, paddingRight: 16 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  chipOn: { backgroundColor: colors.night, borderColor: colors.night },
  chipText: { ...typography.bodySmall, ...weight("700"), color: colors.text },
  chipTextOn: { color: "#FFFFFF" },
});
