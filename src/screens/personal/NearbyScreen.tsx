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
import { StartingSoon } from "../../components/StartingSoon";
import { VenueRow } from "../../components/VenueRow";
import { DiscoverySearch } from "../../components/DiscoverySearch";
import { colors, typography, spacing, weight } from "../../theme";
import { listPosts, subscribeToPosts } from "../../services/posts";
import { listLiveOffers, subscribeToOffers } from "../../services/offers";
import { getCurrentPosition, LatLng } from "../../services/location";
import { nearbyVenues, listVenues } from "../../services/venues";
import { NeedPost, Venue, Offer } from "../../services/mappers";
import { DiscoveryCategory, venueCategory } from "../../utils/discovery";
import { useAuth } from "../../store/AuthContext";
import { PersonalTabNav, PersonalTabParamList } from "../../navigation/types";
import { PlanFilterSheet } from "../../components/PlanFilterSheet";
import { Icon } from "../../components/Icon";
import {
  discoveryPlans,
  startingSoonPlans,
  planDistance,
  DEFAULT_PLAN_OPTIONS,
  PLAN_SORT_LABELS,
  PLAN_AUDIENCE_LABELS,
  PlanDateFilter,
  PlanOptions,
} from "../../utils/planDiscovery";
import { useDiscoveryClock } from "../../hooks/useDiscoveryClock";
import { MotionPressable } from "../../components/Motion";
import { offerDiscoveryCategory } from "../../utils/offerDiscovery";
import { onboardingPreferences } from "../../utils/onboarding";

const DISCOVERY_CATEGORIES: readonly DiscoveryCategory[] = [
  "Play",
  "Meet",
  "Explore",
  "Unwind",
];
const DATE_LABELS: Record<PlanDateFilter, string> = {
  all: "Any day",
  today: "Today",
  week: "This week",
  weekend: "This weekend",
};

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
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
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
  // Ignores the day filter: "soon" is always the next few hours.
  const startingSoon = startingSoonPlans(
    discoveryPlans(
      posts,
      {
        ...options,
        date: "all",
        distances,
        excludeAuthorId: profile?.id ?? session?.user.id,
      },
      now,
    ),
    now,
  );
  const visibleOffers = offers.filter(
    (o) =>
      (!category || offerDiscoveryCategory(o) === category) &&
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
          style={styles.categoryRail}
        >
          {([null, ...DISCOVERY_CATEGORIES] as const).map((item) => {
            const selected = category === item;
            const label = item ?? "All";
            return (
              <MotionPressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={
                  item ? `${item} plans and offers` : "All plans and offers"
                }
                aria-pressed={selected}
                accessibilityState={{ selected }}
                onPress={() => setOptions((o) => ({ ...o, category: item }))}
                style={[styles.categoryChip, selected && styles.categoryChipOn]}
              >
                {selected && <View style={styles.categoryDot} />}
                <Text
                  style={[
                    styles.categoryText,
                    selected && styles.categoryTextOn,
                  ]}
                >
                  {label}
                </Text>
              </MotionPressable>
            );
          })}
        </ScrollView>
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
              onViewAll={() =>
                navigation.navigate("AllOffers", {
                  // Same area as Home: only the venues it is showing.
                  venueIds:
                    point || appliedArea ? venues.map((v) => v.id) : undefined,
                  distances: venues.flatMap((v) =>
                    v.distanceKm == null
                      ? []
                      : [[v.id, v.distanceKm] as [string, number]],
                  ),
                })
              }
            />
            <StartingSoon
              posts={startingSoon}
              now={now}
              distanceOf={(post) => planDistance(post, distances)}
              onOpen={(postId) =>
                navigation.navigate("PostDetails", { postId })
              }
            />
            <View style={styles.plansHeading}>
              <Text accessibilityRole="header" style={styles.plansTitle}>
                Plans near you
              </Text>
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel={`When: ${DATE_LABELS[dateFilter]}`}
                accessibilityHint="Choose which days to show"
                accessibilityState={{ expanded: dateMenuOpen }}
                onPress={() => setDateMenuOpen((open) => !open)}
                style={styles.whenButton}
              >
                <Text style={styles.whenText}>{DATE_LABELS[dateFilter]}</Text>
                <Icon
                  name={dateMenuOpen ? "chevron-up" : "chevron-down"}
                  size={15}
                  color={colors.ink}
                />
              </MotionPressable>
            </View>
            {dateMenuOpen && (
              <View style={styles.whenMenu} accessibilityRole="menu">
                {(Object.keys(DATE_LABELS) as PlanDateFilter[]).map((key) => (
                  <MotionPressable
                    key={key}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: dateFilter === key }}
                    onPress={() => {
                      setDateFilter(key);
                      setDateMenuOpen(false);
                    }}
                    style={styles.whenOption}
                  >
                    <Text
                      style={[
                        styles.whenOptionText,
                        dateFilter === key && styles.whenOptionTextOn,
                      ]}
                    >
                      {DATE_LABELS[key]}
                    </Text>
                    {dateFilter === key && (
                      <Icon name="check" size={17} color={colors.ink} />
                    )}
                  </MotionPressable>
                ))}
              </View>
            )}
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
    marginBottom: 12,
  },
  plansTitle: {
    ...typography.heading,
    color: colors.ink,
    fontSize: 20,
    lineHeight: 26,
    ...weight("800"),
    flexShrink: 1,
  },
  categoryRail: { flexGrow: 0, marginHorizontal: -16 },
  categories: { gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryChipOn: { backgroundColor: colors.night, borderColor: colors.night },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.amberBright,
  },
  categoryText: {
    ...typography.label,
    fontSize: 14,
    color: colors.gray800,
    ...weight("700"),
  },
  categoryTextOn: { color: colors.onAccent },
  whenButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  whenText: { ...typography.label, color: colors.ink },
  whenMenu: {
    alignSelf: "flex-end",
    minWidth: 190,
    marginTop: -2,
    marginBottom: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  whenOption: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
  },
  whenOptionText: { ...typography.body, color: colors.textDim },
  whenOptionTextOn: { color: colors.ink, ...weight("700") },
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
