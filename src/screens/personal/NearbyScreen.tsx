import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { BrandHeader } from "../../components/BrandHeader";
import { PageHeading } from "../../components/PageHeading";
import { FilterTabs } from "../../components/FilterTabs";
import { Icon, IconName } from "../../components/Icon";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { PostRow } from "../../components/PostRow";
import { OfferRow } from "../../components/OfferRow";
import { colors, typography, spacing } from "../../theme";
import { listPosts, subscribeToPosts } from "../../services/posts";
import { listLiveOffers } from "../../services/offers";
import { getCurrentPosition, LatLng } from "../../services/location";
import { nearbyVenues, listVenues } from "../../services/venues";
import { NeedPost, Venue, Offer } from "../../services/mappers";
import { formatDistance } from "../../utils/format";
import {
  DiscoveryCategory,
  postCategory,
  venueCategory,
} from "../../utils/discovery";
import { useAuth } from "../../store/AuthContext";
import { PersonalTabNav } from "../../navigation/types";

const categories: { key: DiscoveryCategory; label: string; icon: IconName }[] =
  [
    { key: "Play", label: "Play", icon: "dribbble" },
    { key: "Meet", label: "Meet", icon: "coffee" },
    { key: "Explore", label: "Explore", icon: "compass" },
  ];

export function NearbyScreen() {
  const navigation = useNavigation<PersonalTabNav>();
  const { profile, demoMode } = useAuth();
  const [posts, setPosts] = useState<NeedPost[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [area, setArea] = useState("");
  const [appliedArea, setAppliedArea] = useState("");
  const [editingLocation, setEditingLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [category, setCategory] = useState<DiscoveryCategory | null>(null);
  const request = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      const version = ++request.current;
      if (!silent) setState("loading");
      try {
        let places = point
          ? await nearbyVenues(point.latitude, point.longitude, 5000)
          : await listVenues();
        if (appliedArea)
          places = places.filter((v) =>
            v.area.toLowerCase().includes(appliedArea.toLowerCase()),
          );
        const ids = point || appliedArea ? places.map((v) => v.id) : undefined;
        const [plans, openings] = await Promise.all([
          listPosts({ venueIds: ids }),
          listLiveOffers(ids),
        ]);
        if (request.current !== version) return;
        setPosts(plans);
        setVenues(places);
        setOffers(openings);
        setState("ready");
      } catch {
        if (request.current === version) setState("error");
      }
    },
    [point, appliedArea],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        request.current++;
      };
    }, [load]),
  );
  useEffect(() => subscribeToPosts(() => void load(true)), [load]);
  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };
  const applyArea = () => {
    setPoint(null);
    setAppliedArea(area.trim());
    setEditingLocation(false);
    setLocationError("");
  };
  const locate = async () => {
    setLocating(true);
    setLocationError("");
    try {
      const position = await getCurrentPosition();
      if (position) {
        setPoint(position);
        setAppliedArea("");
        setArea("");
        setEditingLocation(false);
      } else
        setLocationError(
          "Location unavailable. You can enter an area instead.",
        );
    } finally {
      setLocating(false);
    }
  };

  const distances = new Map(venues.map((v) => [v.id, v.distanceKm]));
  const visiblePosts = posts.filter(
    (p) => !category || postCategory(p) === category,
  );
  const visibleOffers = offers.filter(
    (o) => !category || postCategory({ title: o.title, tags: [] }) === category,
  );
  const visibleVenues = venues.filter(
    (v) => !category || venueCategory(v) === category,
  );
  const areaLabel =
    appliedArea ||
    (demoMode ? "Demo places" : point ? "Near you" : "Choose area");
  const scope = demoMode
    ? "Sample plans"
    : point
      ? "Within 5 km"
      : appliedArea || "All locations";
  const firstName = profile?.displayName?.trim().split(/\s+/)[0] || "there";
  const feedTitle =
    category === "Play"
      ? "A game nearby"
      : category === "Meet"
        ? "Good company nearby"
        : category === "Explore"
          ? "A little discovery nearby"
          : "A few hellos nearby";

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <BrandHeader
          context={areaLabel}
          location
          onContextPress={() => setEditingLocation((v) => !v)}
        />
        {editingLocation && (
          <View style={styles.locationEditor}>
            <Input
              label="Your area or city"
              value={area}
              onChangeText={setArea}
              placeholder="Try Kakkanad"
              returnKeyType="search"
              onSubmitEditing={applyArea}
            />
            <View style={styles.locationActions}>
              <Button
                title={area.trim() ? "Apply area" : "All locations"}
                variant="secondary"
                onPress={applyArea}
              />
              {!demoMode && (
                <Button
                  title="Use my location"
                  variant="ghost"
                  onPress={() => void locate()}
                  loading={locating}
                />
              )}
            </View>
            {!!locationError && (
              <Text accessibilityRole="alert" style={styles.error}>
                {locationError}
              </Text>
            )}
          </View>
        )}
        <PageHeading
          greeting={`Hello, ${firstName}.`}
          title={"What are\nyou up for?"}
        />
        <FilterTabs
          options={categories}
          selected={category}
          onSelect={(key) => setCategory(category === key ? null : key)}
          label="Choose an interest"
        />
        {state === "loading" && posts.length === 0 && offers.length === 0 ? (
          <Text accessibilityLiveRegion="polite" style={styles.status}>
            Finding a few hellos…
          </Text>
        ) : state === "error" && posts.length === 0 && offers.length === 0 ? (
          <>
            <EmptyState
              title="Couldn’t load nearby"
              hint="Check your connection and try again."
            />
            <Button
              title="Try again"
              variant="ghost"
              onPress={() => void load()}
            />
          </>
        ) : (
          <>
            {state === "error" && (
              <View>
                <Text accessibilityRole="alert" style={styles.error}>
                  Couldn’t refresh. Showing your last results.
                </Text>
                <Button
                  title="Try again"
                  variant="ghost"
                  onPress={() => void load(true)}
                />
              </View>
            )}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>{feedTitle}</Text>
              <Text style={styles.sectionMeta}>{scope}</Text>
            </View>
            {visiblePosts.map((post) => (
              <PostRow
                key={post.id}
                post={post}
                distanceKm={
                  post.venueId ? distances.get(post.venueId) : undefined
                }
                onPress={() =>
                  navigation.navigate("PostDetails", { postId: post.id })
                }
              />
            ))}
            {visibleOffers.length > 0 && (
              <>
                <Text style={styles.sectionHeading}>
                  A little time for yourself
                </Text>
                {visibleOffers.map((offer) => (
                  <OfferRow
                    key={offer.id}
                    offer={offer}
                    distanceKm={
                      offer.venueId ? distances.get(offer.venueId) : undefined
                    }
                    onPress={() =>
                      navigation.navigate("OfferDetails", { offerId: offer.id })
                    }
                  />
                ))}
              </>
            )}
            {visiblePosts.length === 0 && visibleOffers.length === 0 && (
              <>
                <EmptyState
                  title="Room for a new hello"
                  hint="Start a plan and invite someone nearby."
                />
                <Button
                  title="Start a plan"
                  variant="ghost"
                  onPress={() => navigation.navigate("CreatePost")}
                />
              </>
            )}
            {visibleVenues.length > 0 && (
              <>
                <Text style={styles.sectionHeading}>
                  Around the neighbourhood
                </Text>
                {visibleVenues.slice(0, 8).map((venue) => (
                  <TouchableOpacity
                    accessibilityRole="button"
                    key={venue.id}
                    style={styles.venueRow}
                    activeOpacity={0.65}
                    onPress={() =>
                      navigation.navigate("VenueDetails", { venueId: venue.id })
                    }
                  >
                    <View style={styles.flex}>
                      <Text style={styles.venueName}>{venue.name}</Text>
                      <Text style={styles.venueMeta}>
                        {[
                          venue.category,
                          venue.area,
                          venue.distanceKm == null
                            ? null
                            : formatDistance(venue.distanceKm),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
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
  scroll: { paddingBottom: spacing.xl },
  flex: { flex: 1 },
  locationEditor: { paddingBottom: spacing.md },
  locationActions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  error: {
    ...typography.bodySmall,
    color: colors.clayDeep,
    marginVertical: spacing.sm,
  },
  status: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginTop: spacing.lg,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: { ...typography.bodySmall, color: colors.text, flex: 1 },
  sectionMeta: {
    ...typography.caption,
    color: colors.textDim,
    flexShrink: 1,
    textAlign: "right",
  },
  sectionHeading: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginTop: spacing.lg,
  },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  venueName: { ...typography.body, color: colors.text },
  venueMeta: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: spacing.xs,
  },
});
