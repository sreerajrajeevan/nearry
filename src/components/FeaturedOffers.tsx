import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Offer } from "../services/mappers";
import { colors, typography } from "../theme";
import {
  OFFER_CATEGORIES,
  OfferCategory,
  discoverOffers,
  offerCategory,
} from "../utils/offerDiscovery";
import { formatDistance } from "../utils/format";
import { MotionPressable } from "./Motion";
import { LoadingImage } from "./LoadingImage";
import { Icon } from "./Icon";

function OfferTile({
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
  const category = offerCategory(offer);
  const theme = {
    all: { backgroundColor: "#F3EBDD", emoji: "🎟️" },
    fitness: {
      backgroundColor: offer.priceCents === 0 ? "#A17BF0" : "#F2A847",
      emoji: offer.priceCents === 0 ? "💪" : "🏋️",
    },
    sports: { backgroundColor: "#E7EEDA", emoji: "🏸" },
    food: { backgroundColor: "#FFECDB", emoji: "🍜" },
    wellness: { backgroundColor: "#ECE5FA", emoji: "🧘" },
  }[category];
  const subject = `${offer.title} ${offer.description}`.toLowerCase();
  const emoji =
    category === "sports"
      ? /badminton|shuttle/.test(subject)
        ? "🏸"
        : /cricket/.test(subject)
          ? "🏏"
          : /tennis/.test(subject)
            ? "🎾"
            : "⚽"
      : category === "food"
        ? /coffee|caf[eé]|tea/.test(subject)
          ? "☕"
          : "🍜"
        : category === "wellness"
          ? /hair|salon/.test(subject)
            ? "💇"
            : /spa|massage/.test(subject)
              ? "💆"
              : "🧘"
          : theme.emoji;
  const headline =
    offer.discountPct != null && offer.discountPct > 0
      ? `${offer.discountPct}% OFF`
      : offer.priceCents === 0
        ? offer.title.length <= 24 && /free/i.test(offer.title)
          ? offer.title
          : "Free"
        : offer.priceCents != null
          ? `₹${(offer.priceCents / 100).toLocaleString("en-IN")}`
          : "Local offer";
  return (
    <MotionPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${headline}. ${offer.title}. ${offer.businessName}. View offer`}
      style={[styles.card, { width }]}
    >
      <View style={[styles.art, { backgroundColor: theme.backgroundColor }]}>
        {offer.coverPhotoUrl && !failed ? (
          <LoadingImage
            source={{ uri: offer.coverPhotoUrl }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <Text accessible={false} style={styles.emoji}>
            {emoji}
          </Text>
        )}
      </View>
      <View style={styles.copy}>
        <Text style={styles.highlight} numberOfLines={1}>
          {headline}
        </Text>
        <Text style={styles.business} numberOfLines={1}>
          {offer.businessName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {distanceKm != null ? `${formatDistance(distanceKm)} · ` : ""}Till{" "}
          {new Date(offer.endsAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          })}
        </Text>
        <View style={styles.action}>
          <Text style={styles.actionText}>Claim</Text>
        </View>
      </View>
    </MotionPressable>
  );
}
export function FeaturedOffers({
  offers,
  distances,
  onOpen,
  now = new Date(),
}: {
  offers: Offer[];
  distances?: ReadonlyMap<string, number | undefined>;
  onOpen: (id: string) => void;
  now?: Date;
}) {
  const { width, fontScale } = useWindowDimensions();
  const [category, setCategory] = useState<OfferCategory>(() =>
    discoverOffers(offers, "fitness", now).length ? "fitness" : "all",
  );
  const [expanded, setExpanded] = useState(false);
  const available = discoverOffers(offers, "all", now);
  const matches = discoverOffers(offers, category, now);
  const items = expanded ? matches : matches.slice(0, 6);
  const cardWidth =
    Math.max(172, Math.min(250, (width - 44) / 2)) * Math.min(fontScale, 1.5);
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          Offers near you
        </Text>
        {available.length > 0 && (
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={
              expanded ? "Show fewer offers" : "See all nearby offers"
            }
            onPress={() => {
              setCategory("all");
              setExpanded(!expanded);
            }}
            style={styles.seeAll}
          >
            <Text style={styles.seeAllText}>
              {expanded ? "Show less" : "See all"}
            </Text>
            <Icon
              name={expanded ? "chevron-up" : "arrow-right"}
              size={14}
              color={colors.coralDeep}
            />
          </MotionPressable>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
      >
        {OFFER_CATEGORIES.filter(
          (item) => item.key !== "all" || category === "all" || expanded,
        ).map((item) => (
          <MotionPressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={`${item.label} offers`}
            accessibilityState={{ selected: category === item.key }}
            onPress={() => setCategory(item.key)}
            style={[
              styles.category,
              category === item.key && styles.categorySelected,
            ]}
          >
            <Text accessible={false} style={styles.categoryEmoji}>
              {item.emoji}
            </Text>
            <Text
              style={[
                styles.categoryText,
                category === item.key && styles.categoryTextSelected,
              ]}
            >
              {item.label}
            </Text>
          </MotionPressable>
        ))}
      </ScrollView>
      {items.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          decelerationRate="fast"
          snapToInterval={cardWidth + 8}
        >
          {items.map((offer) => (
            <OfferTile
              key={offer.id}
              offer={offer}
              width={cardWidth}
              distanceKm={
                offer.venueId ? distances?.get(offer.venueId) : undefined
              }
              onPress={() => onOpen(offer.id)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Icon name="tag" size={18} />
          <Text style={styles.emptyText}>
            {available.length
              ? "No offers in this category yet."
              : "No local offers right now. Check back soon."}
          </Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { marginTop: 19, marginBottom: 18 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  title: {
    ...typography.heading,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    color: colors.ink,
    flexShrink: 1,
  },
  seeAll: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4 },
  seeAllText: {
    ...typography.bodySmall,
    fontSize: 14,
    fontWeight: "600",
    color: colors.coralDeep,
  },
  categories: { gap: 8, paddingBottom: 14, paddingRight: 8 },
  category: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 9,
    paddingVertical: 9,
    minHeight: 44,
    borderRadius: 26,
    backgroundColor: colors.surface,
  },
  categorySelected: { backgroundColor: "#293341" },
  categoryEmoji: { fontSize: 15 },
  categoryText: {
    ...typography.bodySmall,
    color: colors.textDim,
    fontWeight: "500",
  },
  categoryTextSelected: { color: colors.onAccent, fontWeight: "700" },
  rail: { gap: 8, paddingBottom: 4, paddingRight: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: 112,
  },
  art: {
    width: 50,
    height: 56,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  emoji: { fontSize: 29 },
  copy: { flex: 1, minWidth: 0 },
  highlight: {
    ...typography.heading,
    fontSize: 15,
    lineHeight: 20,
    color: colors.coralDeep,
    fontWeight: "700",
  },
  business: {
    ...typography.bodySmall,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 2,
  },
  meta: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 14,
    color: colors.textDim,
    marginTop: 4,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#253342",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  actionText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: "700",
    color: colors.onAccent,
  },
  empty: {
    flexDirection: "row",
    gap: 9,
    padding: 15,
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  emptyText: { ...typography.bodySmall, color: colors.textDim, flex: 1 },
});
