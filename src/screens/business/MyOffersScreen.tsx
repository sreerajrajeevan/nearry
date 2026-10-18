import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BusinessStackParamList } from "../../navigation/types";
import { useLiveQuery } from "../../hooks/useLiveQuery";
import { useAuth } from "../../store/AuthContext";
import {
  listMyOffers,
  publishOffer,
  cancelOffer,
  subscribeToOffers,
} from "../../services/offers";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { PageHeading } from "../../components/PageHeading";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { FilterTabs } from "../../components/FilterTabs";
import { formatWhen } from "../../utils/format";
import { colors, spacing, typography } from "../../theme";

type Filter = "all" | "draft" | "live" | "ended";
const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "live", label: "Live" },
  { key: "ended", label: "Ended" },
];
export function MyOffersScreen({
  navigation,
}: NativeStackScreenProps<BusinessStackParamList, "MyOffers">) {
  const { profile, refreshProfile } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const {
    data: offers = [],
    state,
    refresh,
  } = useLiveQuery(
    `my-offers:${profile?.id}`,
    async () => {
      if (!profile) return [];
      await refreshProfile();
      return listMyOffers(profile.id);
    },
    subscribeToOffers,
  );
  const verified = profile?.verificationStatus === "verified";
  const ended = (o: (typeof offers)[number]) =>
    o.status === "cancelled" ||
    o.status === "ended" ||
    (o.status === "live" && new Date(o.endsAt).getTime() <= Date.now());
  const visible = offers.filter(
    (o) =>
      filter === "all" ||
      (filter === "ended" ? ended(o) : o.status === filter && !ended(o)),
  );
  const run = async (id: string, action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(id);
    try {
      await action();
      await refresh(true);
    } catch (e) {
      Alert.alert(
        "Could not update offer",
        e instanceof Error ? e.message : "Please retry.",
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Button
          title="← Back"
          variant="ghost"
          onPress={() => navigation.goBack()}
        />
        <PageHeading
          title="My offers"
          subtitle="Keep drafts, publish an opening, and manage your live offers."
        />
        <Button
          title="Create an offer"
          variant="secondary"
          onPress={() =>
            navigation.navigate("BusinessTabs", { screen: "CreateOffer" })
          }
        />
        <FilterTabs
          options={filters}
          selected={filter}
          onSelect={setFilter}
          label="Filter my offers"
        />
        {!verified && (
          <Text style={styles.meta}>
            Drafts are ready to edit. Publishing becomes available after your
            business is verified.
          </Text>
        )}
        {state === "loading" ? (
          <Text style={styles.meta}>Loading your offers…</Text>
        ) : state === "error" ? (
          <>
            <EmptyState
              title="Couldn’t load offers"
              hint="Check your connection and retry."
            />
            <Button title="Retry" onPress={() => void refresh()} />
          </>
        ) : !visible.length ? (
          <EmptyState
            title="No offers in this view"
            hint="Your saved offers appear here, including drafts."
          />
        ) : (
          visible.map((offer) => (
            <View key={offer.id} style={styles.offer}>
              <View style={styles.top}>
                <Text style={styles.title}>{offer.title}</Text>
                <Badge
                  label={
                    offer.status === "cancelled"
                      ? "Cancelled"
                      : ended(offer)
                        ? "Ended"
                        : offer.status === "draft"
                          ? "Draft"
                          : "Live"
                  }
                />
              </View>
              <Text style={styles.meta}>
                {formatWhen(offer.startsAt)} – {formatWhen(offer.endsAt)}
              </Text>
              <Text style={styles.meta}>
                {offer.slotCapacity} places per {offer.slotMinutes ?? 60}-minute
                slot
              </Text>
              {!ended(offer) && (
                <View style={styles.actions}>
                  <Button
                    title="Edit offer"
                    variant="secondary"
                    disabled={busy !== null}
                    onPress={() =>
                      navigation.navigate("EditOffer", { offerId: offer.id })
                    }
                  />
                  {offer.status === "draft" && (
                    <Button
                      title="Publish"
                      disabled={
                        !verified ||
                        busy !== null ||
                        new Date(offer.endsAt).getTime() <= Date.now()
                      }
                      loading={busy === `publish:${offer.id}`}
                      onPress={() =>
                        void run(`publish:${offer.id}`, () =>
                          publishOffer(offer.id),
                        )
                      }
                    />
                  )}
                  <Button
                    title={
                      offer.status === "draft" ? "Cancel draft" : "End offer"
                    }
                    variant="ghost"
                    disabled={busy !== null}
                    loading={busy === `cancel:${offer.id}`}
                    onPress={() =>
                      Alert.alert(
                        "End this offer?",
                        "Upcoming reservations will be cancelled and customers will be notified.",
                        [
                          { text: "Keep offer", style: "cancel" },
                          {
                            text: "End offer",
                            style: "destructive",
                            onPress: () =>
                              void run(`cancel:${offer.id}`, () =>
                                cancelOffer(offer.id),
                              ),
                          },
                        ],
                      )
                    }
                  />
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  meta: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginTop: spacing.sm,
  },
  offer: {
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  top: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: { ...typography.heading, color: colors.text, flex: 1 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
