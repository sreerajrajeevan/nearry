import { useReducedMotion } from "../../store/MotionContext";
import { headerScrollState } from "../../utils/headerScroll";
import { useCardDistanceOrigin } from "../../store/CardDistanceContext";
import type { DistanceOrigin } from "../../utils/cardDistance";
import { mergePage, type Cursor } from "../../utils/pagination";
import { PlanListSkeleton } from "../../components/Skeletons";
import { useMyRequests } from "../../store/MyRequestsContext";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Keyboard,
  FlatList,
  Platform,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
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
import {
  listPostsPage,
  type PostPageFilter,
  subscribeToPosts,
} from "../../services/posts";
import { listOffersPage, subscribeToOffers } from "../../services/offers";
import {
  getCurrentPosition,
  getPositionIfAllowed,
  LatLng,
} from "../../services/location";
import { nearbyVenues, listVenues } from "../../services/venues";
import { NeedPost, Venue, Offer } from "../../services/mappers";
import { DiscoveryCategory, venueCategory } from "../../utils/discovery";
import { useAuth } from "../../store/AuthContext";
import { usePremium } from "../../store/PremiumContext";
import { premiumBlock } from "../../services/premium";
import { PersonalTabNav, PersonalTabParamList } from "../../navigation/types";
import { PlanFilterSheet } from "../../components/PlanFilterSheet";
import { Icon } from "../../components/Icon";
import {
  discoveryPlans,
  startingSoonPlans,
  planDistance,
  DEFAULT_PLAN_OPTIONS,
  PLAN_SORT_LABELS,
  HOST_GENDER_LABELS,
  PLAN_AUDIENCE_LABELS,
  PlanDateFilter,
  PlanOptions,
} from "../../utils/planDiscovery";
import {
  HOME_DISTANCES,
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
  const [resultOrigin, setResultOrigin] = useState<DistanceOrigin | null>(null);
  const setup = onboardingPreferences(profile?.onboardingPreferences);
  const accountId = profile?.id ?? session?.user.id ?? null;
  const [posts, setPosts] = useState<NeedPost[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState<Cursor | null>(null),
    [loadingMore, setLoadingMore] = useState(false),
    [pageError, setPageError] = useState("");
  const [effectiveKm, setEffectiveKm] = useState<number | null>(null),
    [soonPosts, setSoonPosts] = useState<NeedPost[]>([]);
  const moreLock = useRef(false),
    loadedScope = useRef("");
  const calendarDay = now.toDateString();
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
  const hostGender = options.hostGender;
  const premium = usePremium();
  const premiumStatus = premium?.snapshot.status;
  const [dateFilter, setDateFilter] = useState<PlanDateFilter>("all");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasLocation = demoMode || point !== null;
  const request = useRef(0);
  const scroll = useRef<FlatList<NeedPost>>(null);
  const picked = useRef(false);
  const reduced = useReducedMotion();
  const [headerHeight, setHeaderHeight] = useState(64),
    [backToTop, setBackToTop] = useState(false);
  const headerShift = useRef(new Animated.Value(0)).current;
  const scrollState = useRef({ lastY: 0, travel: 0, shown: true });
  const setHeaderShown = useCallback(
    (shown: boolean) => {
      scrollState.current.shown = shown;
      headerShift.stopAnimation();
      Animated.timing(headerShift, {
        toValue: shown ? 0 : -headerHeight,
        duration: reduced ? 0 : 180,
        useNativeDriver: true,
      }).start();
    },
    [headerHeight, reduced, headerShift],
  );
  useEffect(() => {
    setHeaderShown(scrollState.current.shown);
    return () => headerShift.stopAnimation();
  }, [setHeaderShown]);
  const onListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const previous = scrollState.current,
        next = headerScrollState(
          previous,
          event.nativeEvent.contentOffset.y,
          headerHeight,
        );
      scrollState.current = next;
      if (next.shown !== previous.shown) setHeaderShown(next.shown);
      setBackToTop(next.lastY > 600);
    },
    [headerHeight, setHeaderShown],
  );
  const scrollToTop = () => {
    scrollState.current = { lastY: 0, travel: 0, shown: true };
    setHeaderShown(true);
    setBackToTop(false);
    scroll.current?.scrollToOffset({ offset: 0, animated: !reduced });
  };

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
    cardOrigin?.selectArea({ kind: "area", point: chosen, label: chosen.name });
    setPlace(nextRecents[0]);
    setPoint({ latitude: chosen.latitude, longitude: chosen.longitude });
    setPointLabel("");
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
          "Could not get your location. Check location permission and GPS, or search for your area.",
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

  const queryScope = JSON.stringify([
    accountId,
    point,
    chosenKm,
    options,
    dateFilter,
    calendarDay,
  ]);
  const pageFilter = (km: number | null): PostPageFilter => ({
    category: options.category,
    freeOnly: options.freeOnly,
    audience: options.audience,
    sort: options.sort,
    date: dateFilter,
    excludeAuthorId: accountId ?? undefined,
    ...(point
      ? { nearby: { ...point, radiusM: (km ?? MAX_HOME_DISTANCE) * 1000 } }
      : {}),
    // Premium; only applied with an area (the reset effect clears it otherwise).
    ...(point && hostGender !== "all" ? { hostGender } : {}),
  });
  const load = useCallback(
    async (silent = false) => {
      const ticket = ++request.current;
      if (loadedScope.current !== queryScope) {
        setVenues([]);
        setOffers([]);
        setSoonPosts([]);
      }
      if (!silent || loadedScope.current !== queryScope) {
        setState("loading");
        setCursor(null);
      }
      setPageError("");
      try {
        const max = options.maxDistanceKm ?? MAX_HOME_DISTANCE;
        const base = point ? Math.min(chosenKm ?? max, max) : max;
        const radii = point
          ? [base, ...HOME_DISTANCES.filter((km) => km > base && km <= max)]
          : [max];
        let selected = base,
          page = await listPostsPage(pageFilter(base));
        if (!page.items.length)
          for (const radius of radii.slice(1)) {
            selected = radius;
            page = await listPostsPage(pageFilter(radius));
            if (page.items.length) break;
          }
        if (request.current !== ticket) return;
        loadedScope.current = queryScope;
        setPosts(page.items);
        setResultOrigin(
          demoMode
            ? { kind: "sample" }
            : {
                kind: pointLabel === NEAR_YOU ? "saved" : "area",
                point: point ?? undefined,
                label: place?.name || pointLabel || "selected area",
              },
        );
        setCursor(page.cursor);
        setEffectiveKm(point ? selected : null);
        setState("ready");
        // Side previews are independently bounded; they cannot hide a healthy plan feed.
        const [places, openings, soon] = await Promise.allSettled([
          point
            ? nearbyVenues(point.latitude, point.longitude, selected * 1000)
            : listVenues(),
          listOffersPage(
            {
              discoveryCategory: options.category,
              ...(point
                ? { nearby: { ...point, radiusM: selected * 1000 } }
                : {}),
            },
            null,
            20,
          ),
          dateFilter === "all" && options.sort === "soonest"
            ? Promise.resolve(page)
            : listPostsPage(
                { ...pageFilter(selected), date: "all", sort: "soonest" },
                null,
                8,
              ),
        ]);
        if (request.current !== ticket) return;

        setVenues(places.status === "fulfilled" ? places.value : []);
        setOffers(openings.status === "fulfilled" ? openings.value.items : []);
        setSoonPosts(soon.status === "fulfilled" ? soon.value.items : []);
        setState("ready");
        if (openings.status === "rejected")
          setPageError("Offers could not refresh. Pull down to try again.");
      } catch (e) {
        if (request.current !== ticket) return;
        // The server says the filter is Premium-only: drop it and reload.
        if (
          hostGender !== "all" &&
          premiumBlock(e instanceof Error ? e.message : "") === "filter"
        ) {
          setOptions((o) => ({ ...o, hostGender: "all" }));
          return;
        }
        {
          if (loadedScope.current === queryScope)
            setPageError(
              "Could not refresh nearby plans. Pull down to try again.",
            );
          else setState("error");
        }
      }
    },
    [
      point,
      chosenKm,
      options,
      dateFilter,
      accountId,
      calendarDay,
      pointLabel,
      place?.name,
      demoMode,
    ],
  );
  const loadMore = async () => {
    if (!cursor || moreLock.current || loadedScope.current !== queryScope)
      return;
    moreLock.current = true;
    setLoadingMore(true);
    setPageError("");
    const ticket = request.current;
    try {
      const page = await listPostsPage(pageFilter(effectiveKm), cursor);
      if (ticket !== request.current) return;
      setPosts((old) => mergePage(old, page.items));
      setCursor(page.cursor);
    } catch {
      if (ticket === request.current)
        setPageError("Could not load more plans. Please try again.");
    } finally {
      moreLock.current = false;
      setLoadingMore(false);
    }
  };

  // Premium ended: the filter no longer applies. Never while still loading,
  // or a Premium user would lose it on every app start.
  // Also cleared without a location: the filter is only applied with a point.
  useEffect(() => {
    if (
      hostGender !== "all" &&
      (premiumStatus === "free" || premiumStatus === "unavailable" || !point)
    )
      setOptions((o) => ({ ...o, hostGender: "all" }));
  }, [hostGender, premiumStatus, point]);

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
  const distances = useMemo(
    () =>
      new Map([
        ...venues.map((v) => [v.id, v.distanceKm] as const),
        ...offers
          .filter((o) => o.venueId && o.distanceKm != null)
          .map((o) => [o.venueId!, o.distanceKm] as const),
      ]),
    [venues, offers],
  );
  const excludeAuthorId = accountId ?? undefined;
  const reach = {
    distanceKm: effectiveKm,
    widened: chosenKm != null && effectiveKm != null && effectiveKm > chosenKm,
  };
  const shownKm = reach.distanceKm;
  const withinShown = (distance: number | undefined) =>
    shownKm == null || (distance ?? Infinity) <= shownKm;
  const visiblePosts = useMemo(
    () =>
      discoveryPlans(
        posts,
        {
          ...options,
          date: dateFilter,
          distances,
          excludeAuthorId,
          maxDistanceKm: shownKm,
        },
        now,
      ),
    [posts, options, dateFilter, distances, excludeAuthorId, shownKm, now],
  );
  const startingSoon = useMemo(
    () => startingSoonPlans(soonPosts, now),
    [soonPosts, now],
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
    freeOnly ||
    options.audience !== "all" ||
    options.sort !== "soonest" ||
    hostGender !== "all";
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
    ...(hostGender !== "all"
      ? [
          {
            key: "host",
            label: `Hosted by: ${HOST_GENDER_LABELS[hostGender]}`,
            remove: () => setOptions((o) => ({ ...o, hostGender: "all" })),
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
      <View style={styles.stage}>
        <FlatList
          ref={scroll}
          onScroll={onListScroll}
          scrollEventThrottle={16}
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
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ height: headerHeight }}
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
                        item
                          ? `${item} plans and offers`
                          : "All plans and offers"
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
                        // Same area as Home: only the venues it is showing.
                        distanceOrigin: hintOrigin
                          ? {
                              ...hintOrigin,
                              kind:
                                hintOrigin.kind === "device"
                                  ? "saved"
                                  : hintOrigin.kind,
                            }
                          : undefined,
                        area: point
                          ? {
                              ...point,
                              radiusM: (shownKm ?? MAX_HOME_DISTANCE) * 1000,
                            }
                          : undefined,
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
                            accessibilityState={{
                              selected: dateFilter === key,
                            }}
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
                {pageError ? (
                  <Text accessibilityRole="alert" style={styles.sectionMeta}>
                    {pageError}
                  </Text>
                ) : null}
                {cursor && (
                  <Button
                    title="More plans"
                    loading={loadingMore}
                    onPress={() => void loadMore()}
                    variant="secondary"
                  />
                )}
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
                          ? `Nothing within ${effectiveKm ?? chosenKm ?? MAX_HOME_DISTANCE} km matches. Try another day or remove a filter.`
                          : point
                            ? `Nothing within ${effectiveKm ?? chosenKm ?? MAX_HOME_DISTANCE} km right now. Be the first to post one here.`
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
        <Animated.View
          style={[
            styles.floatingHeader,
            { transform: [{ translateY: headerShift }] },
          ]}
          onLayout={(e) => {
            const height = e.nativeEvent.layout.height;
            if (height > 0 && Math.abs(height - headerHeight) > 1)
              setHeaderHeight(height);
          }}
        >
          <PersonalHeader
            compact
            variant="inline"
            showMessages={false}
            context={headerLabel}
            location
            onContextPress={openLocation}
          />
        </Animated.View>
        {backToTop && (
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="Back to top"
            onPress={scrollToTop}
            style={[styles.backToTop, { bottom: 16 }]}
          >
            <Icon name="arrow-up" size={20} color={colors.background} />
          </MotionPressable>
        )}
      </View>
      {filtersOpen && (
        <PlanFilterSheet
          value={options}
          hasLocation={hasLocation}
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
  stage: { flex: 1, overflow: "hidden" },
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: colors.background,
  },
  backToTop: {
    position: "absolute",
    right: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 11,
    elevation: 5,
  },

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
