import { LoadingState } from "../../components/LoadingState";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLiveQuery } from "../../hooks/useLiveQuery";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BusinessStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { PageHeading } from "../../components/PageHeading";
import { FilterTabs } from "../../components/FilterTabs";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { useAuth } from "../../store/AuthContext";
import {
  listMyOffers,
  cancelOffer,
  deleteOffer,
  subscribeToOffers,
} from "../../services/offers";
import { Offer } from "../../services/mappers";
import { formatWhen } from "../../utils/format";
import { colors, typography, spacing } from "../../theme";

type Props = NativeStackScreenProps<BusinessStackParamList, "MyOffers">;
type Filter = "all" | "live" | "drafts" | "ended";
const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "drafts", label: "Drafts" },
  { key: "ended", label: "Ended" },
];

function statusLabel(offer: Offer): string {
  switch (offer.status) {
    case "live":
      return new Date(offer.endsAt).getTime() <= Date.now() ? "Ended" : "Live";
    case "draft":
      return "Draft";
    case "cancelled":
      return "Cancelled";
    default:
      return "Ended";
  }
}

/** The business's own offers, with cancel for live ones. */
export function MyOffersScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const {
    data: offers = [],
    state,
    refreshing,
    refresh: load,
  } = useLiveQuery(
    `my-offers:${profile?.id}`,
    async () => (profile ? listMyOffers(profile.id) : []),
    subscribeToOffers,
  );

  const onCancel = (offer: Offer) => {
    if (busy) return;
    Alert.alert(
      "Cancel this offer?",
      "Customers will no longer be able to book it. This cannot be undone.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel offer",
          style: "destructive",
          onPress: async () => {
            setBusy(offer.id);
            try {
              await cancelOffer(offer.id);
              await load(true);
            } catch (e) {
              Alert.alert(
                "Could not cancel",
                e instanceof Error ? e.message : "Please try again.",
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const onDelete = (offer: Offer) => {
    if (busy) return;
    Alert.alert(
      "Delete this draft?",
      "It will be removed permanently. This cannot be undone.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy(offer.id);
            try {
              await deleteOffer(offer.id);
              await load(true);
            } catch (e) {
              Alert.alert(
                "Could not delete",
                e instanceof Error ? e.message : "Please try again.",
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const visible = offers.filter((o) => {
    if (filter === "all") return true;
    if (filter === "live")
      return o.status === "live" && new Date(o.endsAt).getTime() > Date.now();
    if (filter === "drafts") return o.status === "draft";
    return (
      o.status === "ended" ||
      o.status === "cancelled" ||
      (o.status === "live" && new Date(o.endsAt).getTime() <= Date.now())
    );
  });

  return (
    <Screen>
      <FlatList
        data={state === "ready" ? visible : []}
        keyExtractor={(o) => o.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
        ListHeaderComponent={
          <>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.back}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <PageHeading
              greeting="Your shop window."
              title="My offers"
              subtitle="Everything you've put out for the neighbourhood."
            />
            <Button
              title="Create an offer"
              variant="secondary"
              onPress={() =>
                navigation.navigate("BusinessTabs", { screen: "CreateOffer" })
              }
              style={styles.create}
            />
            <FilterTabs
              options={filters}
              selected={filter}
              onSelect={setFilter}
              label="Filter my offers"
            />
          </>
        }
        ListEmptyComponent={
          state === "loading" ? (
            <LoadingState label="Loading your offers…" layout="list" />
          ) : state === "error" ? (
            <>
              <EmptyState
                title="Couldn’t load your offers"
                hint="Check your connection and retry."
              />
              <Button title="Retry" onPress={() => void load()} />
            </>
          ) : (
            <EmptyState
              title={
                offers.length ? "No offers in this view" : "Nothing here yet"
              }
              hint={
                offers.length
                  ? "Try another filter to see your other offers."
                  : "Create your first offer and it will appear here."
              }
            />
          )
        }
        renderItem={({ item: offer }) => (
          <View style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.title}>{offer.title}</Text>
              <Badge
                label={statusLabel(offer)}
                tone={offer.status === "live" ? "green" : "neutral"}
              />
            </View>
            <Text style={styles.meta}>
              {formatWhen(offer.startsAt)} → {formatWhen(offer.endsAt)}
            </Text>
            {offer.priceCents != null && (
              <Text style={styles.meta}>
                ₹{(offer.priceCents / 100).toFixed(2).replace(/\.00$/, "")}
                {typeof offer.discountPct === "number"
                  ? ` · ${offer.discountPct}% off`
                  : ""}
              </Text>
            )}
            <View style={styles.rowBottom}>
              <Text style={styles.meta}>
                {offer.redemptions} booking
                {offer.redemptions === 1 ? "" : "s"}
              </Text>
              <View style={styles.actions}>
                {(offer.status === "live" || offer.status === "draft") && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.7}
                    onPress={() =>
                      navigation.navigate("EditOffer", { offerId: offer.id })
                    }
                    style={styles.link}
                  >
                    <Text style={styles.actionText}>Edit</Text>
                    <Icon
                      name="arrow-up-right"
                      size={15}
                      color={colors.accent}
                    />
                  </TouchableOpacity>
                )}
                {offer.status === "live" ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.7}
                    disabled={busy === offer.id}
                    onPress={() => onCancel(offer)}
                    style={styles.link}
                  >
                    <Text style={styles.actionText}>
                      {busy === offer.id ? "Cancelling…" : "Cancel offer"}
                    </Text>
                    <Icon
                      name="arrow-up-right"
                      size={15}
                      color={colors.accent}
                    />
                  </TouchableOpacity>
                ) : null}
                {offer.status === "draft" ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.7}
                    disabled={busy === offer.id}
                    onPress={() => onDelete(offer)}
                    style={styles.link}
                  >
                    <Text style={[styles.actionText, styles.deleteText]}>
                      {busy === offer.id ? "Deleting…" : "Delete"}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: spacing.xl },
  back: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  backText: { ...typography.label, color: colors.textDim },
  create: { marginBottom: spacing.md },
  loading: {
    ...typography.bodySmall,
    color: colors.textDim,
    paddingVertical: spacing.lg,
  },
  row: {
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    flexGrow: 1,
    flexShrink: 1,
  },
  meta: { ...typography.bodySmall, color: colors.textDim },
  rowBottom: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  link: { flexDirection: "row", alignItems: "center", gap: 4 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  actionText: { ...typography.bodySmall, color: colors.accent },
  deleteText: { color: colors.red },
});
