import { RowListSkeleton } from "../../components/Skeletons";
import { Alert } from "../../services/appAlert";
import { BackButton } from "../../components/BackButton";
import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
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
import { offerPriceLabel } from "../../utils/offerPrice";
import { colors, typography, spacing, weight } from "../../theme";

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
            <BackButton onPress={() => navigation.goBack()} />
            <PageHeading
              greeting="Your shop window."
              title="My offers"
              subtitle="Everything you've put out for the neighbourhood."
            />
            <Button
              title="Create an offer"
              variant="solid"
              onPress={() => {
                if (profile?.verificationStatus !== "verified")
                  navigation.navigate("BusinessVerification");
                else
                  navigation.navigate("BusinessTabs", {
                    screen: "CreateOffer",
                  });
              }}
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
            <RowListSkeleton label="Loading your offers" square count={3} />
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
        renderItem={({ item: offer }) => {
          const deal = [
            typeof offer.discountPct === "number"
              ? `${offer.discountPct}% off`
              : "",
            offer.priceCents != null
              ? `${offerPriceLabel(offer.priceCents)} at venue`
              : "",
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <View style={styles.row}>
              <View style={styles.rowTop}>
                <View style={styles.thumb}>
                  {offer.coverPhotoUrl ? (
                    <Image
                      cachePolicy="memory-disk"
                      transition={150}
                      source={{ uri: offer.coverPhotoUrl }}
                      style={styles.thumbImage}
                    />
                  ) : (
                    <Icon name="tag" size={22} color={colors.amberDeep} />
                  )}
                </View>
                <View style={styles.rowCopy}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={2}>
                      {offer.title}
                    </Text>
                    <Badge
                      label={statusLabel(offer)}
                      tone={offer.status === "live" ? "green" : "neutral"}
                    />
                  </View>
                  {!!deal && <Text style={styles.deal}>{deal}</Text>}
                  <Text style={styles.meta}>
                    {formatWhen(offer.startsAt)} → {formatWhen(offer.endsAt)}
                  </Text>
                </View>
              </View>
              <View style={styles.rowBottom}>
                <View style={styles.count}>
                  <Icon name="calendar" size={13} color={colors.ink} />
                  <Text style={styles.countText}>
                    {offer.redemptions} booking
                    {offer.redemptions === 1 ? "" : "s"}
                  </Text>
                </View>
                <View style={styles.actions}>
                  {offer.status === "live" && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      activeOpacity={0.7}
                      disabled={busy === offer.id}
                      onPress={() => onCancel(offer)}
                      style={styles.textAction}
                    >
                      <Text style={styles.dangerText}>
                        {busy === offer.id ? "Cancelling…" : "Cancel offer"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {offer.status === "draft" && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      activeOpacity={0.7}
                      disabled={busy === offer.id}
                      onPress={() => onDelete(offer)}
                      style={styles.textAction}
                    >
                      <Text style={styles.dangerText}>
                        {busy === offer.id ? "Deleting…" : "Delete"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {(offer.status === "live" || offer.status === "draft") && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${offer.title}`}
                      activeOpacity={0.7}
                      onPress={() =>
                        navigation.navigate("EditOffer", { offerId: offer.id })
                      }
                      style={styles.editPill}
                    >
                      <Icon name="edit-2" size={13} color={colors.ink} />
                      <Text style={styles.editText}>Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: spacing.xl },
  create: { marginBottom: spacing.md },
  loading: {
    ...typography.bodySmall,
    color: colors.textDim,
    paddingVertical: spacing.lg,
  },
  row: {
    padding: 14,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowTop: { flexDirection: "row", gap: 12 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
  },
  thumbImage: { width: "100%", height: "100%" },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  title: {
    ...typography.body,
    ...weight("800"),
    color: colors.ink,
    flex: 1,
  },
  deal: { ...typography.bodySmall, color: colors.amberDeep, ...weight("800") },
  meta: { ...typography.caption, color: colors.textDim },
  rowBottom: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  count: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
  },
  countText: { ...typography.caption, color: colors.ink, ...weight("700") },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  textAction: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  dangerText: { ...typography.caption, color: colors.red, ...weight("700") },
  editPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  editText: { ...typography.caption, color: colors.ink, ...weight("800") },
});
