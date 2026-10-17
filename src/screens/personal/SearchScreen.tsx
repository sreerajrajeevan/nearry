import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { PageHeading } from "../../components/PageHeading";
import { FilterTabs } from "../../components/FilterTabs";
import { Icon } from "../../components/Icon";
import { Input } from "../../components/Input";
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
        <PageHeading
          greeting="Something in mind?"
          title={"Find your\nkind of hello."}
        />
        <Input
          accessibilityLabel="Search nearby"
          placeholder="Football, coffee, haircut…"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <FilterTabs
          options={filters}
          selected={filter}
          onSelect={setFilter}
          label="Search results"
        />
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
            title="No hellos just yet"
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
                <Text style={styles.sectionLabel}>Places to know</Text>
                {venues.map((venue) => (
                  <TouchableOpacity
                    accessibilityRole="button"
                    key={venue.id}
                    activeOpacity={0.65}
                    style={styles.venue}
                    onPress={() =>
                      navigation.navigate("VenueDetails", { venueId: venue.id })
                    }
                  >
                    <View style={styles.copy}>
                      <Text style={styles.title}>{venue.name}</Text>
                      <Text style={styles.meta}>
                        {venue.category} · {venue.area}
                      </Text>
                    </View>
                    <Icon
                      name="arrow-up-right"
                      size={17}
                      color={colors.accent}
                    />
                  </TouchableOpacity>
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
    ...typography.bodySmall,
    color: colors.textDim,
    marginTop: spacing.lg,
  },
  venue: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  copy: { flex: 1 },
  title: { ...typography.heading, color: colors.text },
  meta: { ...typography.bodySmall, color: colors.textDim, marginTop: 4 },
});
