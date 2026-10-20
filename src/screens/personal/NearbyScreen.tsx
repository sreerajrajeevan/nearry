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
import { FeaturedOffers } from "../../components/FeaturedOffers";
import { MotionPressable } from "../../components/Motion";
import { useReducedMotion } from "../../store/MotionContext";

export function NearbyScreen() {
  const navigation = useNavigation<PersonalTabNav>();
  const route = useRoute<RouteProp<PersonalTabParamList, "Nearby">>();
  const { profile, demoMode } = useAuth();
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
  const request = useRef(0);
  const scroll = useRef<ScrollView>(null);
  const feedTop = useRef(0);
  const reduced = useReducedMotion();
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
  const visiblePosts = posts.filter(
    (p) => !category || postCategory(p) === category,
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
          : category === "Unwind"
            ? "A little time for yourself"
            : "Nearby for you";

  return (
    <Screen>
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
        <View style={styles.intro}>
          <Text style={styles.greeting}>Hello, {firstName}.</Text>
          <Text accessibilityRole="header" style={styles.heroTitle}>
            A little more{"\n"}life,{" "}
            <Text style={styles.heroAccent}>nearby.</Text>
          </Text>
        </View>
        <DiscoverySearch onPress={() => navigation.navigate("Search")} />
        <CategoryGrid
          selected={category}
          onSelect={(key) => {
            setCategory(key);
            scroll.current?.scrollTo({
              y: feedTop.current,
              animated: !reduced,
            });
          }}
        />
        <FeaturedOffers
          offers={offers}
          onOpen={(offerId) => navigation.navigate("OfferDetails", { offerId })}
          onCreate={() => navigation.navigate("CreatePost")}
        />
        <View
          onLayout={(event) => {
            feedTop.current = event.nativeEvent.layout.y;
          }}
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
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>{feedTitle}</Text>
              {category ? (
                <MotionPressable
                  accessibilityRole="button"
                  accessibilityLabel="Show all nearby results"
                  onPress={() => setCategory(null)}
                  style={styles.resetFilter}
                >
                  <Text style={styles.resetText}>Show all</Text>
                </MotionPressable>
              ) : (
                <Text style={styles.sectionMeta}>{scope}</Text>
              )}
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
  scroll: { paddingBottom: spacing.xl },
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
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.heading, color: colors.text, flex: 1 },
  sectionMeta: {
    ...typography.caption,
    color: colors.textDim,
    flexShrink: 1,
    textAlign: "right",
  },
  sectionHeading: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  intro: { marginTop: 8, marginBottom: 22 },
  greeting: { ...typography.bodySmall, color: colors.textDim, marginBottom: 9 },
  heroTitle: {
    ...typography.display,
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -1.4,
    color: colors.text,
  },
  heroAccent: { color: colors.accent },
  resetFilter: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  resetText: { ...typography.bodySmall, color: colors.accent },
});
