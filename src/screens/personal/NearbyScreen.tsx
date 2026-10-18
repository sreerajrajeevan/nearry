import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Image,
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
import { PageHeading } from "../../components/PageHeading";
import { FilterTabs } from "../../components/FilterTabs";
import { IconName } from "../../components/Icon";
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
import { HOME_CATEGORIES, listSpotlightOffers } from "../../services/photos";
import { Icon } from "../../components/Icon";

const categories: {
  key: DiscoveryCategory | "All";
  label: string;
  icon: IconName;
}[] = [
  { key: "All", label: "All", icon: "grid" },
  { key: "Play", label: "Play", icon: "dribbble" },
  { key: "Meet", label: "Meet", icon: "users" },
  { key: "Unwind", label: "Unwind", icon: "sun" },
];

export function NearbyScreen() {
  const navigation = useNavigation<PersonalTabNav>();
  const route = useRoute<RouteProp<PersonalTabParamList, "Nearby">>();
  const { profile, demoMode } = useAuth();
  const [posts, setPosts] = useState<NeedPost[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [spotlight, setSpotlight] = useState<
    { id: string; title: string; cover_photo_url: string | null }[]
  >([]);
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
        const [plans, openings, featured] = await Promise.all([
          listPosts({ venueIds: ids }),
          listLiveOffers(ids),
          listSpotlightOffers(10).catch(() => []),
        ]);
        if (request.current !== version) return;
        setPosts(plans);
        setVenues(places);
        setOffers(openings);
        setSpotlight(featured);
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
        <PageHeading
          compact
          greeting={`Hello, ${firstName}.`}
          title={"What are you\nup for?"}
        />
        <DiscoverySearch onPress={() => navigation.navigate("Search")} />
        <FilterTabs
          options={categories}
          selected={category || "All"}
          onSelect={(key) => setCategory(key === "All" ? null : key)}
          label="Choose an interest"
        />
        <View style={styles.shortcutGrid}>
          {HOME_CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.key}
              activeOpacity={0.7}
              style={styles.shortcutTile}
              onPress={() => navigation.navigate("Search")}
              accessibilityRole="button"
              accessibilityLabel={c.label}
            >
              <View style={styles.shortcutIcon}>
                <Icon name={c.icon} size={22} color={colors.clay} />
              </View>
              <Text style={styles.shortcutLabel}>{c.label}</Text>
              <Text style={styles.shortcutHint} numberOfLines={1}>
                {c.hint}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {spotlight.length > 0 && (
          <View style={styles.spotlightSection}>
            <Text style={styles.sectionHeading}>In the spotlight</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.spotlightRow}
            >
              {spotlight.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  activeOpacity={0.85}
                  style={styles.spotlightCard}
                  onPress={() =>
                    navigation.navigate("OfferDetails", { offerId: s.id })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={s.title}
                >
                  {s.cover_photo_url ? (
                    <Image
                      source={{ uri: s.cover_photo_url }}
                      style={styles.spotlightImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={[styles.spotlightImage, styles.spotlightFallback]}
                    />
                  )}
                  <View style={styles.spotlightOverlay}>
                    <Text
                      style={styles.spotlightTitle}
                      numberOfLines={2}
                    >
                      {s.title}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
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
  shortcutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.md,
    marginHorizontal: -spacing.xs,
  },
  shortcutTile: {
    width: "25%",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  shortcutIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.claySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  shortcutLabel: {
    ...typography.label,
    color: colors.text,
    textAlign: "center",
  },
  shortcutHint: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: "center",
  },
  spotlightSection: { marginTop: spacing.sm },
  spotlightRow: { gap: spacing.md, paddingRight: spacing.lg },
  spotlightCard: {
    width: 240,
    height: 140,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
  },
  spotlightImage: { width: "100%", height: "100%" },
  spotlightFallback: { backgroundColor: colors.claySoft },
  spotlightOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.sm,
    backgroundColor: "rgba(37, 42, 38, 0.55)",
  },
  spotlightTitle: {
    ...typography.label,
    color: colors.white,
  },
});
