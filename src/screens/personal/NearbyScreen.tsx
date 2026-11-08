import { LoadingState } from "../../components/LoadingState";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  RouteProp,
} from "@react-navigation/native";
import {
  PlaceSuggestions,
  PlaceAttributions,
} from "../../components/PlaceSuggestions";
import { usePlaceSuggestions } from "../../hooks/usePlaceSuggestions";
import { Place, validPlace } from "../../services/places";
import { Screen } from "../../components/Screen";
import { PersonalHeader } from "../../components/PersonalHeader";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { PostRow } from "../../components/PostRow";
import { OfferRow } from "../../components/OfferRow";
import { VenueRow } from "../../components/VenueRow";
import { DiscoverySearch } from "../../components/DiscoverySearch";
import { colors, typography, spacing } from "../../theme";
import { listPosts, subscribeToPosts } from "../../services/posts";
import { listLiveOffers, subscribeToOffers } from "../../services/offers";
import { getCurrentPosition, LatLng } from "../../services/location";
import { nearbyVenues, listVenues } from "../../services/venues";
import { NeedPost, Venue, Offer } from "../../services/mappers";
import {
  DiscoveryCategory,
  postCategory,
  venueCategory,
} from "../../utils/discovery";
import { useAuth } from "../../store/AuthContext";
import { PersonalTabNav, PersonalTabParamList } from "../../navigation/types";
import { CategoryGrid } from "../../components/CategoryGrid";
import { Icon } from "../../components/Icon";
import { discoveryPlans, PlanDateFilter } from "../../utils/planDiscovery";
import { useDiscoveryClock } from "../../hooks/useDiscoveryClock";
import { MotionPressable } from "../../components/Motion";

export function NearbyScreen() {
  const navigation = useNavigation<PersonalTabNav>();
  const route = useRoute<RouteProp<PersonalTabParamList, "Nearby">>();
  const { demoMode, profile, session } = useAuth();
  const now = useDiscoveryClock();
  const [posts, setPosts] = useState<NeedPost[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [area, setArea] = useState("");
  const [appliedArea, setAppliedArea] = useState("");
  const [editingLocation, setEditingLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [category, setCategory] = useState<DiscoveryCategory | null>(null);
  const [dateFilter, setDateFilter] = useState<PlanDateFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const request = useRef(0);
  const suggestions = usePlaceSuggestions(area, point, editingLocation);
  const choosePlace = (place: Place) => {
    setSelectedPlace(place);
    setPoint({ latitude: place.latitude, longitude: place.longitude });
    setArea("");
    setAppliedArea("");
    setLocationError("");
    setEditingLocation(false);
  };
  useEffect(() => {
    if (route.params?.place) {
      if (validPlace(route.params.place)) choosePlace(route.params.place);
      navigation.setParams({ place: undefined });
    }
  }, [route.params?.place, navigation]);

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
  useEffect(() => subscribeToOffers(() => void load(true)), [load]);
  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };
  const applyArea = () => {
    setPoint(null);
    setSelectedPlace(null);
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
        setSelectedPlace(null);
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
  const visiblePosts = discoveryPlans(
    posts,
    {
      category,
      date: dateFilter,
      freeOnly,
      excludeAuthorId: profile?.id ?? session?.user.id,
    },
    now,
  );
  const visibleOffers = offers.filter(
    (o) =>
      !category ||
      postCategory({ title: `${o.title} ${o.description}`, tags: [] }) ===
        category,
  );
  const visibleVenues = venues.filter(
    (v) => !category || venueCategory(v) === category,
  );
  const areaLabel =
    selectedPlace?.name ||
    appliedArea ||
    (demoMode ? "Demo places" : point ? "Near you" : "Choose area");
  const scope = demoMode ? "Sample plans" : point ? "Within 5 km" : "";
  const filterSummary = [
    scope,
    category ? `${category} plans` : "",
    freeOnly ? "Free only" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const hasFilters = !!category || dateFilter !== "all" || freeOnly;
  const clearFilters = () => {
    setCategory(null);
    setDateFilter("all");
    setFreeOnly(false);
  };

  return (
    <Screen style={styles.page}>
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
        <PersonalHeader
          compact
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
              placeholder="Try Infopark or Kakkanad"
              maxLength={120}
              returnKeyType="search"
              onSubmitEditing={applyArea}
            />
            {area.trim().length >= 3 && (
              <PlaceSuggestions
                {...suggestions}
                onRetry={suggestions.retry}
                onSelect={choosePlace}
              />
            )}
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
        {selectedPlace && <PlaceAttributions places={[selectedPlace]} />}
        <DiscoverySearch
          compact
          onPress={() => navigation.navigate("Search")}
          onFilterPress={() => setFiltersOpen((v) => !v)}
          filtersOpen={filtersOpen}
          filtersActive={hasFilters}
        />
        {state === "loading" && posts.length === 0 && offers.length === 0 ? (
          <LoadingState
            label="Finding nearby places and plans…"
            layout="list"
          />
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateFilters}
            >
              {(
                [
                  { key: "all", label: "All plans" },
                  { key: "today", label: "Today" },
                  { key: "weekend", label: "This weekend" },
                ] as const
              ).map((item) => (
                <MotionPressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  aria-pressed={dateFilter === item.key}
                  accessibilityState={{ selected: dateFilter === item.key }}
                  onPress={() => setDateFilter(item.key)}
                  style={[
                    styles.dateChip,
                    dateFilter === item.key && styles.dateChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dateText,
                      dateFilter === item.key && styles.dateTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </MotionPressable>
              ))}
            </ScrollView>
            {!!filterSummary && (
              <Text style={styles.sectionMeta}>{filterSummary}</Text>
            )}
            {filtersOpen && (
              <View style={styles.filterPanel}>
                <Text style={styles.filterLabel}>What are you up for?</Text>
                <CategoryGrid selected={category} onSelect={setCategory} />
                <MotionPressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="Free plans only"
                  aria-checked={freeOnly}
                  accessibilityState={{ checked: freeOnly }}
                  onPress={() => setFreeOnly((v) => !v)}
                  style={styles.freeFilter}
                >
                  <Icon
                    name={freeOnly ? "check-square" : "square"}
                    size={20}
                    color={colors.forest}
                  />
                  <Text style={styles.resetText}>Free plans only</Text>
                </MotionPressable>
                <Button
                  title="Reset filters"
                  variant="ghost"
                  onPress={clearFilters}
                />
              </View>
            )}
            {visiblePosts.map((post) => (
              <PostRow
                key={post.id}
                post={post}
                now={now}
                distanceKm={
                  post.venueId ? distances.get(post.venueId) : undefined
                }
                onPress={() =>
                  navigation.navigate("PostDetails", { postId: post.id })
                }
              />
            ))}
            {visiblePosts.length === 0 && (
              <>
                <EmptyState
                  title={
                    hasFilters
                      ? "No plans for these filters"
                      : "No plans here yet"
                  }
                  hint={
                    hasFilters
                      ? "Try another day or category."
                      : "Start a plan and invite someone nearby."
                  }
                />
                <Button
                  title={hasFilters ? "Clear filters" : "Start a plan"}
                  variant="ghost"
                  onPress={
                    hasFilters
                      ? clearFilters
                      : () => navigation.navigate("CreatePost")
                  }
                />
              </>
            )}
            {visibleOffers.length > 0 && (
              <>
                <Text accessibilityRole="header" style={styles.sectionHeading}>
                  Offers nearby
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
            {visibleVenues.length > 0 && (
              <>
                <Text style={styles.sectionHeading}>
                  Around the neighbourhood
                </Text>
                {visibleVenues.slice(0, 8).map((venue) => (
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
  page: { paddingHorizontal: 18 },
  scroll: { paddingBottom: spacing.xl },
  locationEditor: { paddingBottom: spacing.md },
  locationActions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  error: {
    ...typography.bodySmall,
    color: colors.clayDeep,
    marginVertical: spacing.sm,
  },
  sectionMeta: {
    ...typography.caption,
    color: colors.textDim,
    flexShrink: 1,
    marginTop: 3,
  },
  sectionHeading: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  dateFilters: {
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: 2,
  },
  dateChip: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    justifyContent: "center",
  },
  dateChipSelected: {
    borderBottomColor: colors.forest,
  },
  dateText: {
    ...typography.bodySmall,
    fontWeight: "400",
    color: colors.textDim,
  },
  dateTextSelected: { color: colors.forest, fontWeight: "600" },
  filterLabel: { ...typography.label, color: colors.text, marginBottom: 8 },
  filterPanel: {
    backgroundColor: colors.sageSoft,
    borderRadius: 14,
    padding: 12,
    marginBottom: 18,
  },
  freeFilter: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resetText: { ...typography.bodySmall, color: colors.accent },
});
