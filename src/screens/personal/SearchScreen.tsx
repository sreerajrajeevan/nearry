import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { PlaceSuggestions } from "../../components/PlaceSuggestions";
import { usePlaceSuggestions } from "../../hooks/usePlaceSuggestions";
import { Screen } from "../../components/Screen";
import { PersonalHeader } from "../../components/PersonalHeader";
import { PageHeading } from "../../components/PageHeading";
import { FilterTabs } from "../../components/FilterTabs";
import { DiscoverySearch } from "../../components/DiscoverySearch";
import { VenueRow } from "../../components/VenueRow";
import { EmptyState } from "../../components/EmptyState";
import { Button } from "../../components/Button";
import { PostRow } from "../../components/PostRow";
import { OfferRow } from "../../components/OfferRow";
import { colors, typography, spacing } from "../../theme";
import { searchVenues } from "../../services/venues";
import { listPosts } from "../../services/posts";
import { listLiveOffers } from "../../services/offers";
import { NeedPost, Venue, Offer } from "../../services/mappers";
import { PersonalTabNav } from "../../navigation/types";

type Filter = "all" | "venues" | "posts" | "offers";
const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "venues", label: "Places" },
  { key: "posts", label: "Plans" },
  { key: "offers", label: "Offers" },
];
export function SearchScreen() {
  const navigation = useNavigation<PersonalTabNav>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const suggestions = usePlaceSuggestions(
    query,
    undefined,
    filter === "all" || filter === "venues",
  );
  const [retry, setRetry] = useState(0);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [posts, setPosts] = useState<NeedPost[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error" | "ready">(
    "idle",
  );
  useEffect(() => {
    let active = true;
    const q = query.trim();
    setVenues([]);
    setPosts([]);
    setOffers([]);
    if (!q) {
      setState("idle");
      return;
    }
    setState("loading");
    const timer = setTimeout(async () => {
      try {
        const [v, p, o] = await Promise.all([
          searchVenues(q),
          listPosts({ search: q }),
          listLiveOffers(),
        ]);
        if (!active) return;
        setVenues(v);
        setPosts(p);
        setOffers(
          o.filter((offer) =>
            `${offer.title} ${offer.businessName} ${offer.description}`
              .toLowerCase()
              .includes(q.toLowerCase()),
          ),
        );
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, retry]);
  const showVenues = filter === "all" || filter === "venues";
  const showPosts = filter === "all" || filter === "posts";
  const showOffers = filter === "all" || filter === "offers";
  const count =
    (showVenues ? venues.length : 0) +
    (showPosts ? posts.length : 0) +
    (showOffers ? offers.length : 0);
  return (
    <Screen keyboard>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
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
        {showVenues && query.trim().length >= 3 && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={styles.sectionLabel}>Find a location</Text>
            <PlaceSuggestions
              {...suggestions}
              onRetry={suggestions.retry}
              onSelect={(place) =>
                navigation.navigate("PlaceDetails", { place })
              }
            />
          </View>
        )}
        {state === "idle" ? (
          <EmptyState
            title="What would you like to find?"
            hint="Search for places, plans, or an opening nearby."
          />
        ) : state === "loading" ? (
          <Text accessibilityLiveRegion="polite" style={styles.status}>
            Looking around…
          </Text>
        ) : state === "error" ? (
          <>
            <EmptyState
              title="Couldn’t search right now"
              hint="Check your connection and try again."
            />
            <Button
              title="Try again"
              variant="ghost"
              onPress={() => setRetry((v) => v + 1)}
            />
          </>
        ) : count === 0 ? (
          <EmptyState
            title="No matching Nearry plans or venues"
            hint="Try another place, activity, or service."
          />
        ) : (
          <>
            <Text accessibilityLiveRegion="polite" style={styles.status}>
              {count} result{count === 1 ? "" : "s"}
            </Text>
            {showPosts && posts.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>People & plans</Text>
                {posts.map((post) => (
                  <PostRow
                    key={post.id}
                    post={post}
                    onPress={() =>
                      navigation.navigate("PostDetails", { postId: post.id })
                    }
                  />
                ))}
              </>
            )}
            {showOffers && offers.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>A little opening</Text>
                {offers.map((offer) => (
                  <OfferRow
                    key={offer.id}
                    offer={offer}
                    onPress={() =>
                      navigation.navigate("OfferDetails", { offerId: offer.id })
                    }
                  />
                ))}
              </>
            )}
            {showVenues && venues.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Places on Nearry</Text>
                {venues.map((venue) => (
                  <VenueRow
                    key={venue.id}
                    venue={venue}
                    onPress={() =>
                      navigation.navigate("VenueDetails", { venueId: venue.id })
                    }
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { paddingTop: spacing.md, paddingBottom: spacing.xl },
  status: { ...typography.bodySmall, color: colors.textDim },
  sectionLabel: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
});
