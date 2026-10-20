import { LoadingImage } from "../../components/LoadingImage";
import { LoadingState } from "../../components/LoadingState";
import { SafetyActions } from "../../components/SafetyActions";
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Linking,
  Share,
  Alert,
  Modal,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { Icon, IconName } from "../../components/Icon";
import { CategoryArt } from "../../components/CategoryArt";
import { MotionPressable } from "../../components/Motion";
import { PostRow } from "../../components/PostRow";
import { OfferRow } from "../../components/OfferRow";
import { colors, typography, spacing } from "../../theme";
import { VenueDetailsProps } from "../../navigation/types";
import { getVenue } from "../../services/venues";
import { listPosts, subscribeToPosts } from "../../services/posts";
import { listLiveOffers, subscribeToOffers } from "../../services/offers";
import { listVenuePhotos, PhotoRef } from "../../services/photos";
import { useLiveQuery } from "../../hooks/useLiveQuery";
import { useReducedMotion } from "../../store/MotionContext";
import { venueCategory } from "../../utils/discovery";
import { formatDistance } from "../../utils/format";

function amenityIcon(name: string): IconName {
  const n = name.toLowerCase();
  if (/water|washroom|toilet/.test(n)) return "droplet";
  if (n.includes("park")) return "map-pin";
  if (n.includes("chang")) return "user";
  if (/equipment|rental/.test(n)) return "tool";
  if (/first aid|medical/.test(n)) return "plus-circle";
  if (/cafe|food|canteen/.test(n)) return "coffee";
  if (n.includes("locker")) return "lock";
  if (n.includes("wifi")) return "wifi";
  if (/air conditioning|ventilat/.test(n)) return "wind";
  if (/power|backup/.test(n)) return "zap";
  if (n.includes("seat")) return "users";
  return "check";
}

export function VenueDetailsScreen({ route, navigation }: VenueDetailsProps) {
  const { venueId } = route.params;
  const reduced = useReducedMotion();
  const scroll = useRef<ScrollView>(null);
  const offersTop = useRef(0),
    plansTop = useRef(0);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const { data, state, refreshing, refresh } = useLiveQuery(
    `venue:${venueId}`,
    async () => {
      const venue = await getVenue(venueId);
      if (!venue) throw new Error("Venue not found.");
      const [posts, offers, gallery] = await Promise.all([
        listPosts({ venueIds: [venueId] }),
        listLiveOffers([venueId]),
        listVenuePhotos(venueId)
          .then((photos) => ({ photos, unavailable: false }))
          .catch(() => ({ photos: [] as PhotoRef[], unavailable: true })),
      ]);
      return { venue, posts, offers, ...gallery };
    },
    (reload) => {
      const a = subscribeToPosts(reload),
        b = subscribeToOffers(reload);
      return () => {
        a();
        b();
      };
    },
  );
  const venue = data?.venue;
  const goBack = () => navigation.goBack();
  const toolbar = (
    <View style={styles.toolbar}>
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={goBack}
        style={styles.iconButton}
      >
        <Icon name="arrow-left" color={colors.text} />
      </MotionPressable>
      <Text style={styles.toolbarTitle}>Around the neighbourhood</Text>
      {venue && (
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Share venue"
          onPress={() => {
            void Share.share({
              message: `${venue.name} · ${venue.area}\nFind your next plan on Nearry.`,
            }).catch(() => {});
          }}
          style={styles.iconButton}
        >
          <Icon name="share-2" color={colors.text} />
        </MotionPressable>
      )}
    </View>
  );
  if (!data || !venue)
    return (
      <Screen padded={false}>
        {toolbar}
        <View style={styles.placeholder}>
          {state === "error" ? (
            <>
              <EmptyState
                title="Couldn’t load this place"
                hint="Check your connection and try again."
              />
              <Button title="Try again" onPress={() => void refresh()} />
            </>
          ) : (
            <LoadingState label="Getting to know this place…" layout="detail" />
          )}
        </View>
      </Screen>
    );
  const category = venueCategory(venue);
  const jump = (y: number) =>
    scroll.current?.scrollTo({ y, animated: !reduced });
  return (
    <Screen padded={false}>
      <ScrollView
        ref={scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh(true)}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {toolbar}
        <View style={styles.hero}>
          {data.photos.length ? (
            <LoadingImage
              source={{ uri: data.photos[0].photo_url }}
              resizeMode="cover"
              style={styles.heroPhoto}
            />
          ) : (
            <>
              <View style={styles.heroRing} />
              <CategoryArt category={category} size={230} />
            </>
          )}
          <View style={styles.heroLabel}>
            <Icon
              name={data.photos.length ? "camera" : "map-pin"}
              size={13}
              color={colors.text}
            />
            <Text style={styles.heroLabelText}>
              {data.photos.length
                ? `${data.photos.length} photo${data.photos.length === 1 ? "" : "s"}`
                : `${category} · Venue overview`}
            </Text>
          </View>
        </View>
        <View style={styles.intro}>
          <View style={styles.eyebrow}>
            <Text style={styles.category}>{venue.category}</Text>
            <Text style={styles.open}>
              {venue.openNow ? "Open now" : "Closed now"}
            </Text>
          </View>
          <Text accessibilityRole="header" style={styles.name}>
            {venue.name}
          </Text>
          <View style={styles.location}>
            <Icon name="map-pin" size={14} />
            <Text style={styles.meta}>
              {[
                venue.area,
                venue.distanceKm == null
                  ? null
                  : formatDistance(venue.distanceKm),
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          <View style={styles.rating}>
            <Icon name="star" size={14} color={colors.accent} />
            <Text style={styles.ratingText}>
              {venue.rating > 0
                ? `${venue.rating.toFixed(1)} · community rating`
                : "No ratings yet"}
            </Text>
          </View>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={`Directions to ${venue.name}`}
            onPress={() => {
              void Linking.openURL(
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name} ${venue.area}`)}`,
              ).catch(() =>
                Alert.alert("Couldn’t open maps", "Please try again."),
              );
            }}
            style={styles.directions}
          >
            <Icon name="navigation" size={16} color={colors.accent} />
            <Text style={styles.directionsText}>Directions</Text>
            <Icon name="arrow-up-right" size={15} color={colors.accent} />
          </MotionPressable>
          {state === "error" && (
            <>
              <Text accessibilityRole="alert" style={styles.meta}>
                Couldn’t refresh. Showing the last details.
              </Text>
              <Button
                title="Retry refresh"
                variant="ghost"
                onPress={() => void refresh(true)}
              />
            </>
          )}
        </View>
        <SafetyActions
          target={{
            kind: "venue",
            id: venue.id,
            userId: venue.businessId,
            name: venue.name,
          }}
          onReport={() =>
            navigation.navigate("Report", {
              target: { kind: "venue", id: venue.id, name: venue.name },
            })
          }
          onBlocked={() => navigation.goBack()}
        />
        <View
          style={styles.section}
          onLayout={(e) => {
            offersTop.current = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.sectionHeading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              A little opening
            </Text>
            <Text style={styles.count}>{data.offers.length}</Text>
          </View>
          {data.offers.length ? (
            data.offers.map((offer) => (
              <OfferRow
                key={offer.id}
                offer={offer}
                onPress={() =>
                  navigation.navigate("OfferDetails", { offerId: offer.id })
                }
              />
            ))
          ) : (
            <Text style={styles.meta}>
              No live offers here right now. You can still find or start a plan.
            </Text>
          )}
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Good to know
          </Text>
          {venue.amenities.length ? (
            <View style={styles.amenityGrid}>
              {venue.amenities.map((a) => (
                <View style={styles.amenity} key={a}>
                  <View style={styles.amenityIcon}>
                    <Icon
                      name={amenityIcon(a)}
                      size={17}
                      color={colors.accent}
                    />
                  </View>
                  <Text style={styles.amenityText}>{a}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.meta}>
              The business hasn’t added amenity details yet.
            </Text>
          )}
        </View>
        <View
          style={styles.section}
          onLayout={(e) => {
            plansTop.current = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.sectionHeading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              People making plans
            </Text>
            <Text style={styles.count}>{data.posts.length}</Text>
          </View>
          {data.posts.length ? (
            data.posts.map((post) => (
              <PostRow
                key={post.id}
                post={post}
                onPress={() =>
                  navigation.navigate("PostDetails", { postId: post.id })
                }
              />
            ))
          ) : (
            <View style={styles.firstPlan}>
              <Text style={styles.firstPlanTitle}>
                Be the first to say hello.
              </Text>
              <Text style={styles.meta}>
                Start a plan here and find your people.
              </Text>
            </View>
          )}
        </View>
        {data.photos.length > 0 && (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              A look around
            </Text>
            <View style={styles.gallery}>
              {data.photos.map((photo, index) => (
                <MotionPressable
                  key={photo.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open venue photo ${index + 1}`}
                  onPress={() => setSelectedPhoto(photo.photo_url)}
                  style={styles.galleryTile}
                >
                  <LoadingImage
                    source={{ uri: photo.photo_url }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                </MotionPressable>
              ))}
            </View>
          </View>
        )}
        {data.unavailable && (
          <Text style={styles.photoNote}>
            Venue photos are unavailable right now.
          </Text>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.footerCopy}>
          <Text style={styles.footerTitle}>
            {data.offers.length
              ? "Make a little time"
              : data.posts.length
                ? "Good company awaits"
                : "Your next hello"}
          </Text>
          <Text style={styles.meta}>
            {data.offers.length
              ? `${data.offers.length} live offer${data.offers.length === 1 ? "" : "s"}`
              : `${venue.name}`}
          </Text>
        </View>
        <Button
          title={
            data.offers.length
              ? "View times"
              : data.posts.length
                ? "See plans"
                : "Start a plan"
          }
          onPress={() => {
            if (data.offers.length) jump(offersTop.current);
            else if (data.posts.length) jump(plansTop.current);
            else navigation.navigate("PersonalTabs", { screen: "CreatePost" });
          }}
        />
      </View>
      <Modal
        visible={selectedPhoto !== null}
        onRequestClose={() => setSelectedPhoto(null)}
        animationType={reduced ? "none" : "fade"}
      >
        <SafeAreaView style={styles.viewer}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            style={styles.closePhoto}
            onPress={() => setSelectedPhoto(null)}
          >
            <Icon name="x" size={22} color={colors.onAccent} />
          </MotionPressable>
          {selectedPhoto && (
            <LoadingImage
              source={{ uri: selectedPhoto }}
              style={styles.fullPhoto}
              resizeMode="contain"
            />
          )}
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { paddingBottom: 30 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.onAccent,
  },
  toolbarTitle: { ...typography.caption, color: colors.textDim, flex: 1 },
  hero: {
    minHeight: 236,
    marginHorizontal: 16,
    borderRadius: 28,
    backgroundColor: colors.claySoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroPhoto: { width: "100%", height: 236 },
  heroRing: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: colors.onAccent,
  },
  heroLabel: {
    position: "absolute",
    left: 16,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.onAccent,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
  },
  heroLabelText: { ...typography.caption, color: colors.text },
  intro: { padding: 24 },
  eyebrow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  category: { ...typography.label, color: colors.accent },
  open: { ...typography.caption, color: colors.textDim },
  name: {
    ...typography.display,
    fontSize: 30,
    lineHeight: 35,
    color: colors.text,
    marginBottom: 12,
  },
  location: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { ...typography.bodySmall, color: colors.textDim, flexShrink: 1 },
  rating: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 10 },
  ratingText: { ...typography.caption, color: colors.text },
  directions: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingHorizontal: 14,
    minHeight: 46,
    backgroundColor: colors.onAccent,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    marginTop: 20,
  },
  directionsText: { ...typography.label, color: colors.accent },
  section: { paddingHorizontal: 24, marginBottom: 28 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    ...typography.heading,
    fontSize: 19,
    color: colors.text,
    marginBottom: 8,
    flexShrink: 1,
  },
  count: { ...typography.caption, color: colors.accent, marginBottom: 8 },
  amenityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 10,
  },
  amenity: {
    flexBasis: "46%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  amenityIcon: {
    width: 34,
    height: 34,
    backgroundColor: colors.claySoft,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  amenityText: { ...typography.bodySmall, color: colors.text, flex: 1 },
  firstPlan: {
    backgroundColor: colors.claySoft,
    padding: 18,
    borderRadius: 20,
  },
  firstPlanTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: 5,
  },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 },
  galleryTile: {
    flexBasis: "46%",
    flexGrow: 1,
    height: 142,
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: colors.surfaceRaised,
  },
  galleryImage: { width: "100%", height: "100%" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.onAccent,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerCopy: { flex: 1, minWidth: 0 },
  footerTitle: { ...typography.label, color: colors.text, marginBottom: 4 },
  viewer: { flex: 1, backgroundColor: colors.ink },
  closePhoto: {
    width: 48,
    height: 48,
    alignSelf: "flex-end",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  fullPhoto: { flex: 1, width: "100%" },
  photoNote: {
    ...typography.caption,
    color: colors.textDim,
    marginHorizontal: 24,
    marginBottom: 20,
  },
  placeholder: { padding: 24 },
  skeletonHero: {
    height: 220,
    backgroundColor: colors.claySoft,
    borderRadius: 24,
    marginBottom: 24,
  },
  skeletonLine: {
    height: 30,
    width: "70%",
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
    marginBottom: 16,
  },
});
