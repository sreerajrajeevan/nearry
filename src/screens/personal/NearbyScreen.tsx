import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  TextInput,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { EmptyState } from "../../components/EmptyState";
import { PostRow } from "../../components/PostRow";
import { colors, typography, spacing } from "../../theme";
import { listPosts, subscribeToPosts } from "../../services/posts";
import { listLiveOffers } from "../../services/offers";
import { getCurrentPosition, LatLng } from "../../services/location";
import { isDemoMode } from "../../services/supabase";
import { nearbyVenues, listVenues } from "../../services/venues";
import { NeedPost, Venue, Offer } from "../../services/mappers";
import { formatWhen } from "../../utils/format";
import { useAuth } from "../../store/AuthContext";
import { PersonalTabNav } from "../../navigation/types";

type LoadState = "loading" | "error" | "ready";

const CATEGORIES: { label: string; icon: string; keywords: string[] }[] = [
  {
    label: "Play",
    icon: "⚽",
    keywords: ["football", "cricket", "sport", "game", "turf", "match", "badminton", "tennis", "run", "cycling", "swim", "volleyball"],
  },
  {
    label: "Meet",
    icon: "☕",
    keywords: ["coffee", "meet", "chat", "dinner", "lunch", "drink", "social", "movie", "tea"],
  },
  { label: "Explore", icon: "🧭", keywords: [] },
];

export function NearbyScreen() {
  const navigation = useNavigation<PersonalTabNav>();
  const { profile } = useAuth();
  const [posts, setPosts] = useState<NeedPost[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [area, setArea] = useState("");
  const [appliedArea, setAppliedArea] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setState("loading");
      try {
        let v = point
          ? await nearbyVenues(point.latitude, point.longitude, 5000)
          : await listVenues();
        if (appliedArea)
          v = v.filter((venue) =>
            venue.area.toLowerCase().includes(appliedArea.toLowerCase()),
          );
        const ids = point || appliedArea ? v.map((v) => v.id) : undefined;
        const [p, o] = await Promise.all([
          listPosts({ venueIds: ids }),
          listLiveOffers(ids),
        ]);
        setPosts(p);
        setVenues(v);
        setOffers(o);
        setState("ready");
      } catch {
        setState("error");
      }
    },
    [point, appliedArea],
  );

  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load]),
  );
  useEffect(() => subscribeToPosts(() => load(true)), [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const venueDist = new Map(venues.map((v) => [v.id, v.distanceKm]));
  const cat = CATEGORIES.find((c) => c.label === category);
  const visiblePosts =
    cat && cat.keywords.length > 0
      ? posts.filter((p) =>
          cat.keywords.some((k) =>
            `${p.title} ${p.tags.join(" ")}`.toLowerCase().includes(k),
          ),
        )
      : posts;

  const areaLabel = isDemoMode()
    ? "Sample"
    : appliedArea || (point ? "Near you" : "Everywhere");
  const firstName = profile?.displayName?.split(" ")[0] || "there";

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.clay}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.logoMark} />
          <Text style={styles.wordmark}>nearry</Text>
          <View style={styles.flex} />
          <Text style={styles.headerLocation}>📍 {areaLabel}</Text>
        </View>

        <Text style={styles.hello}>Hello, {firstName}.</Text>
        <Text style={styles.headline}>What are{"\n"}you up for?</Text>

        {/* Categories */}
        <View style={styles.catRow}>
          {CATEGORIES.map((c) => {
            const active = category === c.label;
            return (
              <TouchableOpacity
                key={c.label}
                activeOpacity={0.7}
                onPress={() => setCategory(active ? null : c.label)}
                style={styles.cat}
              >
                <Text style={styles.catIcon}>{c.icon}</Text>
                <Text style={[styles.catLabel, active && styles.catActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Location */}
        <View style={styles.locRow}>
          <TextInput
            value={area}
            onChangeText={setArea}
            placeholder="Area or city…"
            placeholderTextColor={colors.faint}
            style={styles.locInput}
            onSubmitEditing={() => {
              setPoint(null);
              setAppliedArea(area.trim());
            }}
          />
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setLocating(true);
              setLocationError("");
              void getCurrentPosition()
                .then((p) => {
                  if (p) {
                    setPoint(p);
                    setAppliedArea("");
                  } else
                    setLocationError(
                      "Location unavailable. Type an area instead.",
                    );
                })
                .finally(() => setLocating(false));
            }}
          >
            <Text style={styles.locLink}>
              {locating ? "Locating…" : "Use my location"}
            </Text>
          </TouchableOpacity>
        </View>
        {!!locationError && (
          <Text style={styles.error}>{locationError}</Text>
        )}

        <View style={styles.divider} />

        {state === "loading" && posts.length === 0 ? (
          <Text style={styles.status}>Loading…</Text>
        ) : state === "error" && posts.length === 0 ? (
          <View>
            <EmptyState
              title="Couldn't load"
              hint="Check your connection and retry."
            />
            <TouchableOpacity activeOpacity={0.7} onPress={() => load()}>
              <Text style={styles.retry}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>A few hellos nearby</Text>
              <Text style={styles.sectionMeta}>
                {point ? "Within 5 km" : "Within 3 km"}
              </Text>
            </View>

            {visiblePosts.length > 0 ? (
              visiblePosts.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  distanceKm={
                    post.venueId ? venueDist.get(post.venueId) : undefined
                  }
                  cta="I'm interested"
                  onPress={() =>
                    navigation.navigate("PostDetails", { postId: post.id })
                  }
                />
              ))
            ) : (
              <EmptyState
                title="Nothing here yet"
                hint="Be the first to gather people nearby."
              />
            )}

            {offers.length > 0 && (
              <>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionTitle}>Little treats nearby</Text>
                </View>
                {offers.map((offer) => (
                  <TouchableOpacity
                    key={offer.id}
                    activeOpacity={0.7}
                    style={styles.offerRow}
                    onPress={() =>
                      navigation.navigate("OfferDetails", { offerId: offer.id })
                    }
                  >
                    <Text style={styles.offerTitle}>{offer.title}</Text>
                    <Text style={styles.offerMeta}>
                      {[
                        offer.businessName,
                        formatWhen(offer.startsAt),
                        offer.venueId && venueDist.get(offer.venueId) !== undefined
                          ? `${(venueDist.get(offer.venueId) as number).toFixed(1)} km`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                    <View style={styles.offerBottom}>
                      <Text style={styles.offerCta}>View</Text>
                      {offer.priceCents != null && (
                        <Text style={styles.offerPrice}>
                          ₹{(offer.priceCents / 100).toFixed(0)} ↗
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {venues.length > 0 && (
              <>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionTitle}>Places nearby</Text>
                </View>
                {venues.slice(0, 8).map((venue) => (
                  <TouchableOpacity
                    key={venue.id}
                    activeOpacity={0.7}
                    style={styles.offerRow}
                    onPress={() =>
                      navigation.navigate("VenueDetails", { venueId: venue.id })
                    }
                  >
                    <Text style={styles.offerTitle}>{venue.name}</Text>
                    <Text style={styles.offerMeta}>
                      {[
                        venue.category,
                        venue.area,
                        venue.distanceKm !== undefined
                          ? `${venue.distanceKm.toFixed(1)} km`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
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
  scroll: { paddingBottom: spacing.xl },
  flex: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  logoMark: {
    width: 30,
    height: 30,
    backgroundColor: colors.clay,
    borderRadius: 9,
    borderBottomLeftRadius: 2,
    marginRight: spacing.sm,
  },
  wordmark: { ...typography.heading, fontSize: 24, color: colors.text, letterSpacing: -0.5 },
  headerLocation: { ...typography.body, color: colors.muted },
  hello: { ...typography.body, color: colors.muted, marginTop: spacing.lg },
  headline: { ...typography.display, fontSize: 40, lineHeight: 46, color: colors.text, marginTop: spacing.xs },
  catRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.lg },
  cat: { flexDirection: "row", alignItems: "center", gap: 6 },
  catIcon: { fontSize: 18 },
  catLabel: { ...typography.body, color: colors.muted },
  catActive: { color: colors.clay, fontWeight: "700" },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  locInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    paddingVertical: spacing.xs,
  },
  locLink: { ...typography.body, color: colors.clay, fontWeight: "600" },
  error: { ...typography.bodySmall, color: colors.clayDeep, marginTop: spacing.xs },
  divider: { height: 1, backgroundColor: colors.hairline, marginTop: spacing.lg },
  status: { ...typography.body, color: colors.muted, marginTop: spacing.xl },
  retry: { ...typography.body, color: colors.clay, fontWeight: "600", marginTop: spacing.md },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: spacing.xl,
  },
  sectionTitle: { ...typography.body, color: colors.text, fontWeight: "600" },
  sectionMeta: { ...typography.bodySmall, color: colors.muted },
  offerRow: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  offerTitle: { ...typography.title, fontSize: 22, color: colors.text },
  offerMeta: { ...typography.body, color: colors.muted, marginTop: spacing.xs },
  offerBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  offerCta: { ...typography.body, color: colors.clay, fontWeight: "600" },
  offerPrice: { ...typography.body, color: colors.text, fontWeight: "600" },
});
