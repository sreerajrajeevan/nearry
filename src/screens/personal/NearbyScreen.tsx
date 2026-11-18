import { useCardDistanceOrigin } from "../../store/CardDistanceContext";
import type { DistanceOrigin } from "../../utils/cardDistance";
import { PlanListSkeleton } from "../../components/Skeletons";
import { useMyRequests } from "../../store/MyRequestsContext";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Keyboard,
  FlatList,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  RouteProp,
} from "@react-navigation/native";
import {
  PlaceAttributions,
  GoogleMapsCredit,
} from "../../components/PlaceSuggestions";
import { Place, validPlace } from "../../services/places";
import { Screen } from "../../components/Screen";
import { PersonalHeader } from "../../components/PersonalHeader";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { PostRow } from "../../components/PostRow";
import { FeaturedOffers } from "../../components/FeaturedOffers";
import { StartingSoon } from "../../components/StartingSoon";
import { VenueRow } from "../../components/VenueRow";
import { DiscoverySearch } from "../../components/DiscoverySearch";
import { LocationSheet } from "../../components/LocationSheet";
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
import {
  HomeLocation,
  MAX_HOME_DISTANCE,
  RecentPlace,
  defaultDistance,
  homeLocationKey,
  isHomeDistance,
  parseHomeLocation,
  placeKind,
  rememberPlace,
  widenDistance,
} from "../../utils/homeLocation";
import { useDiscoveryClock } from "../../hooks/useDiscoveryClock";
import { EnterView, MotionPressable } from "../../components/Motion";
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
const NEAR_YOU = "Near you";
const planKey = (post: NeedPost) => post.id;

export function NearbyScreen() {
  const navigation = useNavigation<PersonalTabNav>();
  const route = useRoute<RouteProp<PersonalTabParamList, "Nearby">>();
  const { demoMode, profile, session } = useAuth();
  const now = useDiscoveryClock();
  const cardOrigin = useCardDistanceOrigin();
  const setup = onboardingPreferences(profile?.onboardingPreferences);
  const accountId = profile?.id ?? session?.user.id ?? null;
  const [posts, setPosts] = useState<NeedPost[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [resultOrigin, setResultOrigin] = useState<DistanceOrigin | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [refreshing, setRefreshing] = useState(false);
  // Where Home searches from, and what to call it.
  const [point, setPoint] = useState<LatLng | null>(() =>
    setup.area
      ? { latitude: setup.area.latitude, longitude: setup.area.longitude }
      : null,
  );
  const [place, setPlace] = useState<RecentPlace | null>(null);
  const [pointLabel, setPointLabel] = useState(setup.area?.label ?? "");
  // The distance asked for. Home may look further when nothing is that close.
  const [chosenKm, setChosenKm] = useState<number | null>(
    setup.area ? setup.radiusKm : null,
  );
  const [recents, setRecents] = useState<RecentPlace[]>([]);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [options, setOptions] = useState<PlanOptions>({
    ...DEFAULT_PLAN_OPTIONS,
  });
  const { category, freeOnly } = options;
  const [dateFilter, setDateFilter] = useState<PlanDateFilter>("all");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasLocation = demoMode || point !== null;
  const request = useRef(0);
  const scroll = useRef<FlatList<NeedPost>>(null);
  const picked = useRef(false);

  const persist = (next: HomeLocation) => {
    if (demoMode || !accountId) return;
    void AsyncStorage.setItem(
      homeLocationKey(accountId),
      JSON.stringify(next),
    ).catch(() => {});
  };
  const savedCurrent = (): HomeLocation["current"] =>
    place
      ? { type: "place", place }
      : point && pointLabel === NEAR_YOU
        ? { type: "me", ...point, savedAt: new Date().toISOString() }
        : null;

  // Reopen with the last place and distance on this device.
  useEffect(() => {
    if (demoMode || !accountId) return;
    let active = true;
    AsyncStorage.getItem(homeLocationKey(accountId))
      .then((raw) => {
        if (!active) return;
        const saved = parseHomeLocation(raw);
        setRecents(saved.recents);
        if (picked.current || !saved.current) return;
        const current = saved.current;
        if (current.type === "place") {
          setPlace(current.place);
          setPoint({
            latitude: current.place.latitude,
            longitude: current.place.longitude,
          });
          setPointLabel("");
          setChosenKm(saved.distanceKm ?? defaultDistance(current.place.kind));
        } else {
          setPlace(null);
          setPoint({
            latitude: current.latitude,
            longitude: current.longitude,
          });
          setPointLabel(NEAR_YOU);
          setChosenKm(saved.distanceKm ?? defaultDistance("me"));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [demoMode, accountId]);

  const choosePlace = (chosen: Place) => {
    picked.current = true;
    const kind = placeKind(chosen);
    const km = defaultDistance(kind);
    const nextRecents = rememberPlace(recents, chosen);
    setPlace(nextRecents[0]);
    setPoint({ latitude: chosen.latitude, longitude: chosen.longitude });
    setPointLabel("");
    cardOrigin?.selectArea({ kind: "area", point: chosen, label: chosen.name });
    setChosenKm(km);
    setRecents(nextRecents);
    setLocationError("");
    setLocationOpen(false);
    persist({
      current: { type: "place", place: nextRecents[0] },
      distanceKm: km,
      recents: nextRecents,
    });
  };
  useEffect(() => {
    if (route.params?.place) {
      if (validPlace(route.params.place)) choosePlace(route.params.place);
      navigation.setParams({ place: undefined });
    }
  }, [route.params?.place, navigation]);

  const locate = async () => {
    setLocating(true);
    setLocationError("");
    try {
      const position = await getCurrentPosition();
      if (position) {
        picked.current = true;
        const km = defaultDistance("me");
        setPlace(null);
        setPoint(position);
        cardOrigin?.setDevice(position);
        setPointLabel(NEAR_YOU);
        setChosenKm(km);
        setLocationOpen(false);
        persist({
          current: {
            type: "me",
            ...position,
            savedAt: new Date().toISOString(),
          },
          distanceKm: km,
          recents,
        });
      } else
        setLocationError(
          "Location is off for Nearry. Search for your area instead.",
        );
    } finally {
      setLocating(false);
    }
  };
  const changeDistance = (km: number) => {
    setChosenKm(km);
    setLocationOpen(false);
    persist({
      current: savedCurrent(),
      distanceKm: isHomeDistance(km) ? km : null,
      recents,
    });
  };

  const load = useCallback(
    async (silent = false) => {
      const version = ++request.current;
      if (!silent) setState("loading");
      try {
        // Fetch the widest area once; distance is applied on the phone so
        // changing it, or widening when nothing is close, needs no reload.
        const radiusM = MAX_HOME_DISTANCE * 1000;
        const places = point
          ? await nearbyVenues(point.latitude, point.longitude, radiusM)
          : await listVenues();
        const ids = point ? places.map((v) => v.id) : undefined;
        const [plans, openings] = await Promise.all([
          listPosts(point ? { nearby: { ...point, radiusM } } : {}),
          listLiveOffers(ids),
        ]);
        if (request.current !== version) return;
        setPosts(plans);
        setVenues(places);
        setOffers(openings);
        setResultOrigin(
          demoMode
            ? { kind: "sample" }
            : {
                kind: pointLabel === NEAR_YOU ? "saved" : "area",
                point: point ?? undefined,
                label: place?.name || pointLabel || "selected area",
              },
        );
        setState("ready");
      } catch {
        if (request.current === version) setState("error");
      }
    },
    [point, pointLabel, place?.name, demoMode],
  );

  // A stable function, so it can sit in the focus effect's dependencies.
  const refreshMyRequests = useMyRequests()?.refresh;
  useFocusEffect(
    useCallback(() => {
      void load();
      void refreshMyRequests?.();
      // Live updates only while Home is the screen in front; leaving and
      // coming back reloads anyway.
      const stopPosts = subscribeToPosts(() => void load(true));
      const stopOffers = subscribeToOffers(() => void load(true));
      return () => {
        request.current++;
        stopPosts();
        stopOffers();
      };
    }, [load, refreshMyRequests]),
  );
  const onRefresh = async () => {
    cardOrigin?.refresh();
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  // Keep the discovery area intact; the card provider independently measures from the viewer.
  useEffect(() => {
    if (!cardOrigin?.device || place) return;
    if (!point || pointLabel === NEAR_YOU) {
      setPoint(cardOrigin.device);
      setPointLabel(NEAR_YOU);
      setChosenKm((km) => km ?? defaultDistance("me"));
    }
  }, [cardOrigin?.device]);
  const hintOrigin: DistanceOrigin | undefined = resultOrigin
    ? cardOrigin?.device &&
      resultOrigin.point &&
      cardOrigin.device.latitude === resultOrigin.point.latitude &&
      cardOrigin.device.longitude === resultOrigin.point.longitude
      ? { ...resultOrigin, kind: "device" }
      : resultOrigin
    : undefined;
  const distances = new Map(venues.map((v) => [v.id, v.distanceKm]));
  const excludeAuthorId = profile?.id ?? session?.user.id;
  const plansWithin = (
    opts: PlanOptions,
    km: number | null,
    date: PlanDateFilter = dateFilter,
  ) =>
    discoveryPlans(
      posts,
      { ...opts, date, distances, excludeAuthorId, maxDistanceKm: km },
      now,
    );
  const reachFor = (opts: PlanOptions) =>
    chosenKm == null
      ? { distanceKm: null, widened: false }
      : widenDistance(chosenKm, (km) => plansWithin(opts, km).length);
  const reach = reachFor(options);
  const shownKm = reach.distanceKm;
  const withinShown = (distance: number | undefined) =>
    shownKm == null || (distance ?? Infinity) <= shownKm;
  const visiblePosts = plansWithin(options, shownKm);
  // Ignores the day filter: "soon" is always the next few hours.
  const startingSoon = startingSoonPlans(
    plansWithin(options, shownKm, "all"),
    now,
  );
  const visibleOffers = offers.filter(
    (o) =>
      (!category || offerDiscoveryCategory(o) === category) &&
      withinShown(planDistance(o, distances)),
  );
  const areaVenues = venues.filter((v) =>
    withinShown(planDistance({ venueId: v.id }, distances)),
  );
  const visibleVenues = areaVenues.filter(
    (v) => !category || venueCategory(v) === category,
  );
  const placeName =
    place?.name ||
    pointLabel ||
    (demoMode ? "Demo places" : point ? NEAR_YOU : "Choose location");
  const nearWhat = placeName === NEAR_YOU || !point ? "you" : placeName;
  const headerLabel =
    shownKm != null ? `${placeName} · ${shownKm} km` : placeName;
  const sheetFilters =
    freeOnly || options.audience !== "all" || options.sort !== "soonest";
  const hasFilters = !!category || dateFilter !== "all" || sheetFilters;
  const clearFilters = () => {
    setOptions({ ...DEFAULT_PLAN_OPTIONS });
    setDateFilter("all");
  };
  const openLocation = () => {
    Keyboard.dismiss();
    setLocationError("");
    setLocationOpen(true);
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

  const showPlans =
    !(state === "loading" && posts.length === 0 && offers.length === 0) &&
    !(state === "error" && posts.length === 0 && offers.length === 0);
  const renderPlan = ({
    item: post,
    index,
  }: {
    item: NeedPost;
    index: number;
  }) => (
    <EnterView index={Math.min(index, 6)}>
      <PostRow
        post={post}
        now={now}
        distanceKm={planDistance(post, distances)}
        distanceOrigin={hintOrigin}
        onPress={() => navigation.navigate("PostDetails", { postId: post.id })}
      />
    </EnterView>
  );

  return (
    <Screen style={styles.page}>
      <FlatList
        ref={scroll}
        data={showPlans ? visiblePosts : []}
        keyExtractor={planKey}
        renderItem={renderPlan}
        // Only the cards near the screen are built; the rest wait.
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
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
        ListHeaderComponent={
          <>
            <PersonalHeader
              compact
              context={headerLabel}
              location
              onContextPress={openLocation}
            />
            {place ? (
              <PlaceAttributions places={[place]} />
            ) : (
              ((!!pointLabel &&
                pointLabel === setup.area?.label &&
                setup.area?.source === "google") ||
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
              filtersActive={sheetFilters}
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
                    onPress={() =>
                      setOptions((o) => ({ ...o, category: item }))
                    }
                    style={[
                      styles.categoryChip,
                      selected && styles.categoryChipOn,
                    ]}
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
            {state === "loading" &&
            posts.length === 0 &&
            offers.length === 0 ? (
              <PlanListSkeleton label="Finding nearby plans" />
            ) : state === "error" &&
              posts.length === 0 &&
              offers.length === 0 ? (
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
                  distanceOrigin={hintOrigin}
                  now={now}
                  onOpen={(offerId) =>
                    navigation.navigate("OfferDetails", { offerId })
                  }
                  onViewAll={() =>
                    navigation.navigate("AllOffers", {
                      distanceOrigin: hintOrigin
                        ? {
                            kind:
                              hintOrigin.kind === "device"
                                ? "saved"
                                : hintOrigin.kind,
                            label: hintOrigin.label,
                          }
                        : undefined,
                      // Same area as Home: only the venues it is showing.
                      venueIds: point ? areaVenues.map((v) => v.id) : undefined,
                      distances: areaVenues.flatMap((v) =>
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
                  distanceOrigin={hintOrigin}
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
                    <Text style={styles.whenText}>
                      {DATE_LABELS[dateFilter]}
                    </Text>
                    <Icon
                      name={dateMenuOpen ? "chevron-up" : "chevron-down"}
                      size={15}
                      color={colors.ink}
                    />
                  </MotionPressable>
                </View>
                {dateMenuOpen && (
                  <View style={styles.whenMenu} accessibilityRole="menu">
                    {(Object.keys(DATE_LABELS) as PlanDateFilter[]).map(
                      (key) => (
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
                      ),
                    )}
                  </View>
                )}
                {reach.widened && chosenKm != null && (
                  <MotionPressable
                    accessibilityRole="button"
                    accessibilityHint="Change location or distance"
                    onPress={openLocation}
                    style={styles.widened}
                  >
                    <Icon name="compass" size={16} color={colors.amberDeep} />
                    <Text style={styles.widenedText}>
                      Nothing within {chosenKm} km of {nearWhat}, so we’re
                      showing plans within {shownKm} km.{" "}
                      <Text style={styles.widenedLink}>Change</Text>
                    </Text>
                  </MotionPressable>
                )}
                {state === "loading" && posts.length > 0 && (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={styles.sectionMeta}
                  >
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
              </>
            )}
          </>
        }
        ListFooterComponent={
          showPlans ? (
            <>
              {visiblePosts.length === 0 && state !== "loading" && (
                <>
                  <EmptyState
                    title={
                      hasFilters
                        ? "No plans for these filters"
                        : point
                          ? `No plans near ${nearWhat} yet`
                          : "No plans here yet"
                    }
                    hint={
                      hasFilters
                        ? `Nothing within ${MAX_HOME_DISTANCE} km matches. Try another day or remove a filter.`
                        : point
                          ? `Nothing within ${MAX_HOME_DISTANCE} km right now. Be the first to post one here.`
                          : "Start a plan and invite someone nearby."
                    }
                  />
                  <View style={styles.emptyActions}>
                    {hasFilters ? (
                      <Button
                        title="Clear filters"
                        variant="secondary"
                        onPress={clearFilters}
                      />
                    ) : (
                      <Button
                        title={
                          point ? "Post the first plan here" : "Start a plan"
                        }
                        variant="secondary"
                        onPress={() => navigation.navigate("CreatePost")}
                      />
                    )}
                    <Button
                      title={point ? "Change location" : "Choose location"}
                      variant="ghost"
                      onPress={openLocation}
                    />
                  </View>
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
                        navigation.navigate("VenueDetails", {
                          venueId: venue.id,
                        })
                      }
                    />
                  ))}
                </>
              )}
            </>
          ) : null
        }
      />
      {filtersOpen && (
        <PlanFilterSheet
          value={options}
          hasLocation={hasLocation}
          countFor={(draft) =>
            plansWithin(draft, reachFor(draft).distanceKm).length
          }
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => {
            setOptions(next);
            setFiltersOpen(false);
          }}
        />
      )}
      {locationOpen && (
        <LocationSheet
          demo={demoMode}
          bias={point}
          distanceKm={chosenKm}
          showDistance={hasLocation}
          recents={recents}
          locating={locating}
          error={locationError}
          onPickPlace={choosePlace}
          onUseMyLocation={() => void locate()}
          onDistance={changeDistance}
          onClose={() => setLocationOpen(false)}
        />
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  page: { paddingHorizontal: 16 },
  scroll: { paddingBottom: spacing.xl },
  emptyActions: { gap: 4 },
  widened: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: colors.amberSoft,
  },
  widenedText: {
    ...typography.bodySmall,
    color: colors.ink,
    flex: 1,
  },
  widenedLink: { color: colors.amberDeep, ...weight("800") },
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
    minHeight: 44,
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
