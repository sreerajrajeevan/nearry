import React, { useEffect, useRef, useState } from "react";
import { useMyOfferStatus } from "../store/MyRequestsContext";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Offer } from "../services/mappers";
import { colors, typography, weight } from "../theme";
import { discoverOffers, spotlightOffers } from "../utils/offerDiscovery";
import { activityArtwork } from "../utils/activityArtwork";
import { formatDistance } from "../utils/format";
import { MotionPressable } from "./Motion";
import { LoadingImage } from "./LoadingImage";
import { ActivityArt } from "./ActivityArt";
import { Icon } from "./Icon";

function offerHeadline(offer: Offer) {
  return offer.discountPct != null && offer.discountPct > 0
    ? `${offer.discountPct}% OFF`
    : offer.priceCents === 0
      ? "FREE"
      : offer.priceCents != null
        ? `₹${(offer.priceCents / 100).toLocaleString("en-IN")}`
        : null;
}

function OfferSlide({
  offer,
  width,
  distanceKm,
  onPress,
}: {
  offer: Offer;
  width: number;
  distanceKm?: number;
  onPress: () => void;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [offer.coverPhotoUrl]);
  const headline = offerHeadline(offer);
  const mine = useMyOfferStatus(offer.id);
  const ends = new Date(offer.endsAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
  const meta = [
    offer.title,
    distanceKm != null ? formatDistance(distanceKm) : `till ${ends}`,
  ].join(" · ");
  return (
    <MotionPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        headline,
        offer.title,
        offer.businessName,
        distanceKm != null && formatDistance(distanceKm),
        `Till ${ends}`,
        mine === "booked"
          ? "You've booked this"
          : mine === "requested"
            ? "Booking requested"
            : null,
        "View offer",
      ]
        .filter(Boolean)
        .join(". ")}
      style={[styles.slide, { width, height: Math.round(width * 0.6) }]}
    >
      {offer.coverPhotoUrl && !failed ? (
        <LoadingImage
          source={{ uri: offer.coverPhotoUrl }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.fallback}>
          <ActivityArt
            artwork={activityArtwork({
              title: offer.title,
              description: `${offer.description} ${offer.businessName}`,
            })}
            size={Math.round(width * 0.3)}
          />
        </View>
      )}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.7)"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      {headline && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{headline}</Text>
        </View>
      )}
      <View style={styles.panel}>
        <View style={styles.panelCopy}>
          <Text style={styles.business} numberOfLines={1}>
            {offer.businessName}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <View
          style={[
            styles.claim,
            mine === "requested" && styles.claimWaiting,
            mine === "booked" && styles.claimBooked,
          ]}
        >
          {mine && (
            <Icon
              name={mine === "booked" ? "check" : "clock"}
              size={14}
              color={mine === "booked" ? colors.success : colors.textDim}
            />
          )}
          <Text
            style={[
              styles.claimText,
              mine === "requested" && styles.claimTextWaiting,
              mine === "booked" && styles.claimTextBooked,
            ]}
          >
            {mine === "booked"
              ? "Booked"
              : mine === "requested"
                ? "Requested"
                : "Claim"}
          </Text>
        </View>
      </View>
    </MotionPressable>
  );
}

/**
 * Spotlighted offers as a swipeable photo carousel; "View all" opens every
 * live offer. Category filtering happens on Home.
 */
export function FeaturedOffers({
  offers,
  distances,
  onOpen,
  onViewAll,
  now = new Date(),
}: {
  offers: Offer[];
  distances?: ReadonlyMap<string, number | undefined>;
  onOpen: (id: string) => void;
  onViewAll: () => void;
  now?: Date;
}) {
  const { width, fontScale } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const rail = useRef<ScrollView>(null);
  const matches = discoverOffers(offers, "all", now);
  const items = spotlightOffers(offers, now);
  const slideWidth = Math.round(
    Math.min(340, Math.max(260, (width - 32) * 0.86)) *
      Math.min(Math.max(fontScale, 1), 1.2),
  );
  const step = slideWidth + 14;
  useEffect(() => {
    setPage(0);
    rail.current?.scrollTo({ x: 0, animated: false });
  }, [items.length]);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(
      Math.min(
        items.length - 1,
        Math.max(0, Math.round(event.nativeEvent.contentOffset.x / step)),
      ),
    );
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          Offers nearby
        </Text>
        {matches.length > 0 && (
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={`View all ${matches.length} offers nearby`}
            onPress={onViewAll}
            style={styles.seeAll}
          >
            <Text style={styles.seeAllText}>View all</Text>
            <View style={styles.countPill}>
              <Text style={styles.countText}>{matches.length}</Text>
            </View>
            <Icon name="chevron-right" size={16} color={colors.ink} />
          </MotionPressable>
        )}
      </View>
      {items.length ? (
        <>
          <ScrollView
            ref={rail}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            decelerationRate="fast"
            snapToInterval={step}
            onScroll={onScroll}
            scrollEventThrottle={32}
          >
            {items.map((offer) => (
              <OfferSlide
                key={offer.id}
                offer={offer}
                width={slideWidth}
                distanceKm={
                  offer.venueId ? distances?.get(offer.venueId) : undefined
                }
                onPress={() => onOpen(offer.id)}
              />
            ))}
          </ScrollView>
          {items.length > 1 && (
            <View
              style={styles.dots}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
            >
              {items.map((offer, index) => (
                <View
                  key={offer.id}
                  style={[styles.dot, index === page && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </>
      ) : matches.length ? (
        // Nothing spotlighted: a slim card still leads to every offer.
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel={`View all ${matches.length} offers nearby`}
          onPress={onViewAll}
          style={styles.empty}
        >
          <Icon name="tag" size={18} color={colors.amberDeep} />
          <Text style={styles.emptyText}>
            {matches.length} {matches.length === 1 ? "offer" : "offers"} from
            local businesses
          </Text>
          <Icon name="chevron-right" size={18} color={colors.ink} />
        </MotionPressable>
      ) : (
        <View style={styles.empty}>
          <Icon name="tag" size={18} />
          <Text style={styles.emptyText}>
            {offers.length
              ? "No offers in this category yet."
              : "No local offers right now. Check back soon."}
          </Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { marginTop: 18, marginBottom: 20 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  title: {
    ...typography.heading,
    fontSize: 20,
    lineHeight: 26,
    ...weight("800"),
    color: colors.ink,
    flexShrink: 1,
  },
  seeAll: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  seeAllText: {
    ...typography.bodySmall,
    fontSize: 14,
    ...weight("700"),
    color: colors.ink,
  },
  countPill: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
  },
  countText: { fontSize: 12, ...weight("800"), color: colors.amberDeep },
  rail: { gap: 14, paddingRight: 16 },
  slide: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.ink,
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },
  badge: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.amberBright,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    color: colors.onAmber,
    ...weight("800"),
  },
  panel: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 13,
    paddingRight: 9,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.96)",
  },
  panelCopy: { flex: 1, minWidth: 0 },
  business: {
    ...typography.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.night,
    ...weight("800"),
  },
  meta: { ...typography.caption, fontSize: 12, color: colors.textDim },
  claim: {
    minHeight: 36,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.night,
    alignItems: "center",
    justifyContent: "center",
  },
  claimWaiting: {
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceRaised,
  },
  claimBooked: {
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
    backgroundColor: colors.successSoft,
  },
  claimTextWaiting: { color: colors.textDim },
  claimTextBooked: { color: colors.success },
  claimText: {
    ...typography.label,
    color: colors.onAccent,
    ...weight("700"),
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D1D5DB" },
  dotActive: { width: 20, backgroundColor: colors.ink },
  empty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 15,
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  emptyText: { ...typography.bodySmall, color: colors.textDim, flex: 1 },
});
