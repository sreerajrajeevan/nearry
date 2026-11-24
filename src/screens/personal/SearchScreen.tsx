import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { PlaceSuggestions } from "../../components/PlaceSuggestions";
import { usePlaceSuggestions } from "../../hooks/usePlaceSuggestions";
import { usePagedQuery } from "../../hooks/usePagedQuery";
import { Screen } from "../../components/Screen";
import { PersonalHeader } from "../../components/PersonalHeader";
import { PageHeading } from "../../components/PageHeading";
import { FilterTabs } from "../../components/FilterTabs";
import { DiscoverySearch } from "../../components/DiscoverySearch";
import { VenueRow } from "../../components/VenueRow";
import { PostRow } from "../../components/PostRow";
import { OfferRow } from "../../components/OfferRow";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { Button } from "../../components/Button";
import { searchVenuesPage } from "../../services/venues";
import { listPostsPage } from "../../services/posts";
import { listOffersPage } from "../../services/offers";
import { NeedPost, Venue, Offer } from "../../services/mappers";
import { PersonalTabNav } from "../../navigation/types";
import { useAuth } from "../../store/AuthContext";
import { colors, typography, spacing } from "../../theme";
type Filter = "all" | "venues" | "posts" | "offers";
const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "venues", label: "Places" },
  { key: "posts", label: "Plans" },
  { key: "offers", label: "Offers" },
];
type Row =
  | { kind: "post"; value: NeedPost }
  | { kind: "venue"; value: Venue }
  | { kind: "offer"; value: Offer };
export function SearchScreen() {
  const navigation = useNavigation<PersonalTabNav>(),
    { profile } = useAuth();
  const [query, setQuery] = useState(""),
    [term, setTerm] = useState(""),
    [filter, setFilter] = useState<Filter>("all");
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const enabled = query.trim() === term && !!term,
    scope = profile?.id ?? "";
  const venues = usePagedQuery("search-venues:" + scope + ":" + term, (c) =>
    term
      ? searchVenuesPage(term, c)
      : Promise.resolve({ items: [], cursor: null }),
  );
  const posts = usePagedQuery("search-posts:" + scope + ":" + term, (c) =>
    term
      ? listPostsPage({ search: term, status: "open" }, c)
      : Promise.resolve({ items: [], cursor: null }),
  );
  const offers = usePagedQuery("search-offers:" + scope + ":" + term, (c) =>
    term
      ? listOffersPage({ search: term }, c)
      : Promise.resolve({ items: [], cursor: null }),
  );
  const suggestions = usePlaceSuggestions(
    query,
    undefined,
    filter === "all" || filter === "venues",
  );
  const rows: Row[] = enabled
    ? [
        ...(filter === "all" || filter === "posts"
          ? posts.items.map((value) => ({ kind: "post" as const, value }))
          : []),
        ...(filter === "all" || filter === "offers"
          ? offers.items.map((value) => ({ kind: "offer" as const, value }))
          : []),
        ...(filter === "all" || filter === "venues"
          ? venues.items.map((value) => ({ kind: "venue" as const, value }))
          : []),
      ]
    : [];
  const sections = [
    { key: "posts", label: "plans", page: posts },
    { key: "offers", label: "offers", page: offers },
    { key: "venues", label: "places", page: venues },
  ].filter((s) => filter === "all" || filter === s.key);
  const loading =
    !!query.trim() &&
    (!enabled || sections.some((s) => s.page.state === "loading"));
  return (
    <Screen keyboard>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.kind + ":" + r.value.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={
          <>
            <PersonalHeader />
            <PageHeading
              compact
              greeting="Something in mind?"
              title={"Find your\nnext hello."}
            />
            <DiscoverySearch value={query} onChangeText={setQuery} />
            <FilterTabs
              options={filters}
              selected={filter}
              onSelect={setFilter}
              label="Search results"
            />
            {(filter === "all" || filter === "venues") &&
              query.trim().length >= 3 && (
                <View style={{ marginBottom: spacing.lg }}>
                  <Text style={styles.label}>Find a location</Text>
                  <PlaceSuggestions
                    {...suggestions}
                    onRetry={suggestions.retry}
                    onSelect={(place) =>
                      navigation.navigate("PlaceDetails", { place })
                    }
                  />
                </View>
              )}
            {loading && <LoadingState label="Searching…" layout="list" />}
          </>
        }
        renderItem={({ item: r }) =>
          r.kind === "post" ? (
            <PostRow
              post={r.value}
              onPress={() =>
                navigation.navigate("PostDetails", { postId: r.value.id })
              }
            />
          ) : r.kind === "offer" ? (
            <OfferRow
              offer={r.value}
              onPress={() =>
                navigation.navigate("OfferDetails", { offerId: r.value.id })
              }
            />
          ) : (
            <VenueRow
              venue={r.value}
              onPress={() =>
                navigation.navigate("VenueDetails", { venueId: r.value.id })
              }
            />
          )
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title={
                term
                  ? "No matching Nearry plans or venues"
                  : "What would you like to find?"
              }
              hint="Search for a place, activity, or service."
            />
          ) : null
        }
        ListFooterComponent={
          enabled ? (
            <>
              {sections.map((s) => (
                <View key={s.key}>
                  {(s.page.state === "error" || s.page.error) && (
                    <Button
                      title={"Retry " + s.label}
                      variant="ghost"
                      onPress={() => void s.page.refresh()}
                    />
                  )}
                  {s.page.moreError && (
                    <Text accessibilityRole="alert" style={styles.label}>
                      {s.page.moreError}
                    </Text>
                  )}
                  {s.page.cursor && (
                    <Button
                      title={"More " + s.label}
                      loading={s.page.loadingMore}
                      variant="ghost"
                      onPress={() => void s.page.loadMore()}
                    />
                  )}
                </View>
              ))}
            </>
          ) : null
        }
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { paddingTop: spacing.md, paddingBottom: spacing.xl },
  label: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginVertical: spacing.md,
  },
});
