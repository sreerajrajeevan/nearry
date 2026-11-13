import { LoadingState } from "../../components/LoadingState";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Keyboard,
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
  GoogleMapsCredit,
} from "../../components/PlaceSuggestions";
import { usePlaceSuggestions } from "../../hooks/usePlaceSuggestions";
import { Place, validPlace } from "../../services/places";
import { Screen } from "../../components/Screen";
import { PersonalHeader } from "../../components/PersonalHeader";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { PostRow } from "../../components/PostRow";
import { FeaturedOffers } from "../../components/FeaturedOffers";
import { VenueRow } from "../../components/VenueRow";
import { DiscoverySearch } from "../../components/DiscoverySearch";
import { colors, typography, spacing } from "../../theme";
import { listPosts, subscribeToPosts } from "../../services/posts";
import { listLiveOffers, subscribeToOffers } from "../../services/offers";
import { getCurrentPosition, LatLng } from "../../services/location";
import { nearbyVenues, listVenues } from "../../services/venues";
import { NeedPost, Venue, Offer } from "../../services/mappers";
import { postCategory, venueCategory } from "../../utils/discovery";
import { useAuth } from "../../store/AuthContext";
import { PersonalTabNav, PersonalTabParamList } from "../../navigation/types";
import { PlanFilterSheet } from "../../components/PlanFilterSheet";
import { Icon } from "../../components/Icon";
import {
  discoveryPlans,
  planDistance,
  DEFAULT_PLAN_OPTIONS,
  PLAN_SORT_LABELS,
  PLAN_AUDIENCE_LABELS,
  PlanDateFilter,
  PlanOptions,
} from "../../utils/planDiscovery";
import { useDiscoveryClock } from "../../hooks/useDiscoveryClock";
import { MotionPressable } from "../../components/Motion";
import { onboardingPreferences } from "../../utils/onboarding";

export function NearbyScreen() {
  const navigation = useNavigation<PersonalTabNav>();
  const route = useRoute<RouteProp<PersonalTabParamList, "Nearby">>();
  const { demoMode, profile, session } = useAuth();
  const now = useDiscoveryClock();
  const setup = onboardingPreferences(profile?.onboardingPreferences);
  const [posts, setPosts] = useState<NeedPost[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [point, setPoint] = useState<LatLng | null>(() => setup.area ?? null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [setupAreaLabel, setSetupAreaLabel] = useState(setup.area?.label ?? "");
  const [area, setArea] = useState("");
  const [appliedArea, setAppliedArea] = useState("");
  const [editingLocation, setEditingLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [options, setOptions] = useState<PlanOptions>({
    ...DEFAULT_PLAN_OPTIONS,
    maxDistanceKm: setup.area ? setup.radiusKm : null,
  });
  const { category, freeOnly } = options;
  const [dateFilter, setDateFilter] = useState<PlanDateFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasLocation = demoMode || point !== null;
  const radiusKm = options.maxDistanceKm ?? 5;
  const request = useRef(0);
  const scroll = useRef<ScrollView>(null);
  const suggestions = usePlaceSuggestions(area, point, editingLocation);
  const choosePlace = (place: Place) => {
    setSetupAreaLabel("");
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
          ? await nearbyVenues(point.latitude, point.longitude, radiusKm * 1000)
          : await listVenues();
        if (appliedArea)
          places = places.filter((v) =>
            v.area.toLowerCase().includes(appliedArea.toLowerCase()),
          );
        const ids = point || appliedArea ? places.map((v) => v.id) : undefined;
        const [plans, openings] = await Promise.all([
          listPosts(
            point
              ? { nearby: { ...point, radiusM: radiusKm * 1000 } }
              : { venueIds: ids },
          ),
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
    [point, appliedArea, radiusKm],
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
    setSetupAreaLabel("");
    if (!demoMode)
      setOptions((current) => ({
        ...current,
        maxDistanceKm: null,
        sort: current.sort === "nearest" ? "soonest" : current.sort,
      }));
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
        setSetupAreaLabel("");
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
      ...options,
      date: dateFilter,
      distances,
      excludeAuthorId: profile?.id ?? session?.user.id,
    },
    now,
  );
  const visibleOffers = offers.filter(
    (o) =>
      (!category ||
        postCategory({ title: `${o.title} ${o.description}`, tags: [] }) ===
          category) &&
      (options.maxDistanceKm == null ||
        (planDistance(o, distances) ?? Infinity) <= options.maxDistanceKm),
  );
  const visibleVenues = venues.filter(
    (v) =>
      (!category || venueCategory(v) === category) &&
      (options.maxDistanceKm == null ||
        (planDistance({ venueId: v.id }, distances) ?? Infinity) <=
          options.maxDistanceKm),
  );
  const areaLabel =
    selectedPlace?.name ||
    appliedArea ||
    setupAreaLabel ||
    (demoMode ? "Demo places" : point ? "Near you" : "Choose area");
  const scope = demoMode
    ? "Sample plans"
    : point
      ? `Within ${radiusKm} km`
      : "";
  const filterSummary = [
    scope,
    options.sort === "soonest" ? PLAN_SORT_LABELS.soonest : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const hasFilters =
    !!category ||
    dateFilter !== "all" ||
    freeOnly ||
    options.audience !== "all" ||
    options.maxDistanceKm !== null ||
    options.sort !== "soonest";
  const clearFilters = () => {
    setOptions({ ...DEFAULT_PLAN_OPTIONS });
    setDateFilter("all");
  };
  const chips = [
    ...(category
      ? [
          {
            key: "category",
            label: category,
            remove: () => setOptions((o) => ({ ...o, category: null })),
          },
        ]
      : []),
    ...(options.maxDistanceKm !== null
      ? [
          {
            key: "distance",
            label: `Within ${options.maxDistanceKm} km`,
            remove: () => setOptions((o) => ({ ...o, maxDistanceKm: null })),
          },
        ]
      : []),
    ...(freeOnly
      ? [
          {
            key: "cost",
            label: "Free only",
            remove: () => setOptions((o) => ({ ...o, freeOnly: false })),
          },
        ]
      : []),
    ...(options.audience !== "all"
      ? [
          {
            key: "audience",
            label: PLAN_AUDIENCE_LABELS[options.audience],
            remove: () => setOptions((o) => ({ ...o, audience: "all" })),
          },
        ]
      : []),
    ...(options.sort !== "soonest"
      ? [
          {
            key: "sort",
            label: PLAN_SORT_LABELS[options.sort],
            remove: () => setOptions((o) => ({ ...o, sort: "soonest" })),
          },
        ]
      : []),
  ];

  return (
    <Screen style={styles.page}>
      <ScrollView
        ref={scroll}
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
              clearable
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
        {selectedPlace ? (
          <PlaceAttributions places={[selectedPlace]} />
        ) : (
          ((!!setupAreaLabel && setup.area?.source === "google") ||
            posts.some((p) => p.location?.source === "google")) && (
            <GoogleMapsCredit />
          )
        )}

        <DiscoverySearch
          compact
          onPress={() => navigation.navigate("Search")}
          onFilterPress={() => {
            Keyboard.dismiss();
            setFiltersOpen(true);
          }}
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
            <FeaturedOffers
              offers={visibleOffers}
              distances={distances}
              now={now}
              onOpen={(offerId) =>
                navigation.navigate("OfferDetails", { offerId })
              }
            />
            <View style={styles.plansHeading}>
              <Text accessibilityRole="header" style={styles.plansTitle}>
                Plans near you
              </Text>
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel="Post a plan"
                onPress={() => navigation.navigate("CreatePost")}
                style={styles.postAction}
              >
                <Icon name="plus" size={15} color={colors.coralDeep} />
                <Text style={styles.postActionText}>Post a plan</Text>
              </MotionPressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateFilters}
            >
              {(
                [
                  { key: "all", label: "All" },
                  { key: "today", label: "Today" },
                  { key: "week", label: "This week" },
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
                    {item.key === "all" ? "🔥 All" : item.label}
                  </Text>
                </MotionPressable>
              ))}
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel="Plans within 2 kilometres"
                accessibilityState={{ selected: options.maxDistanceKm === 2 }}
                onPress={() => {
                  if (!hasLocation) {
                    setEditingLocation(true);
                    scroll.current?.scrollTo({ y: 0, animated: false });
                    setLocationError(
                      "Choose an area or use your location to find plans within 2 km.",
                    );
                    return;
                  }
                  setOptions((current) => ({
                    ...current,
                    maxDistanceKm: current.maxDistanceKm === 2 ? null : 2,
                  }));
                }}
                style={[
                  styles.dateChip,
                  options.maxDistanceKm === 2 && styles.dateChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.dateText,
                    options.maxDistanceKm === 2 && styles.dateTextSelected,
                  ]}
                >
                  Under 2 km
                </Text>
              </MotionPressable>
            </ScrollView>
            {demoMode && !!filterSummary && (
              <Text style={styles.sectionMeta}>{filterSummary}</Text>
            )}
            {state === "loading" && posts.length > 0 && (
              <Text accessibilityLiveRegion="polite" style={styles.sectionMeta}>
                Updating nearby plans…
              </Text>
            )}
            {chips.length > 0 && (
              <View style={styles.appliedFilters}>
                {chips.map((chip) => (
                  <MotionPressable
                    key={chip.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${chip.label}`}
                    onPress={chip.remove}
                    style={styles.appliedChip}
                  >
                    <Text style={styles.appliedText}>{chip.label}</Text>
                    <Icon name="x" size={13} color={colors.forest} />
                  </MotionPressable>
                ))}
              </View>
            )}
            {visiblePosts.map((post) => (
              <PostRow
                key={post.id}
                post={post}
                now={now}
                distanceKm={planDistance(post, distances)}
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
                      ? "Try another day, widen the distance, or remove a filter."
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
      {filtersOpen && (
        <PlanFilterSheet
          value={options}
          hasLocation={hasLocation}
          demo={demoMode}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => {
            setOptions(next);
            setFiltersOpen(false);
          }}
          onChooseArea={() => {
            setFiltersOpen(false);
            setEditingLocation(true);
            scroll.current?.scrollTo({ y: 0, animated: false });
          }}
        />
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  page: { paddingHorizontal: 16 },
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
  plansHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  plansTitle: {
    ...typography.heading,
    color: colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    flexShrink: 1,
  },
  postAction: {
    minHeight: 44,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  postActionText: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.coralDeep,
  },
  dateFilters: { gap: 7, paddingBottom: 13, paddingRight: 8 },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  dateChipSelected: { backgroundColor: colors.ink },
  dateText: {
    ...typography.bodySmall,
    fontWeight: "500",
    color: colors.textDim,
  },
  dateTextSelected: { color: colors.onAccent, fontWeight: "600" },
  appliedFilters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  appliedChip: {
    minHeight: 44,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.sageSoft,
  },
  appliedText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.forest,
    flexShrink: 1,
  },
});
