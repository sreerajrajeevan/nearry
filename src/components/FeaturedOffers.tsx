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
    fitness: { backgroundColor: "#FFE5CE", emoji: "🏋️" },
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
      ? `${offer.discountPct}% off`
      : offer.priceCents === 0
        ? "Free opening"
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
        <Text style={styles.description} numberOfLines={1}>
          {offer.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {distanceKm != null ? `${formatDistance(distanceKm)} · ` : ""}Till{" "}
          {new Date(offer.endsAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          })}
        </Text>
        <View style={styles.action}>
          <Text style={styles.actionText}>View offer</Text>
          <Icon name="arrow-up-right" size={12} color={colors.onAccent} />
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
  const [category, setCategory] = useState<OfferCategory>("all");
  const [expanded, setExpanded] = useState(false);
  const available = discoverOffers(offers, "all", now);
  const matches = discoverOffers(offers, category, now);
  const items = expanded ? matches : matches.slice(0, 6);
  const cardWidth =
    Math.min(320, Math.max(270, width - 85)) * Math.min(fontScale, 1.3);
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
        {OFFER_CATEGORIES.map((item) => (
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
          snapToInterval={cardWidth + 12}
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
  section: { marginTop: 18, marginBottom: 23 },
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
  seeAll: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5 },
  seeAllText: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.coralDeep,
  },
  categories: { gap: 8, paddingBottom: 13, paddingRight: 8 },
  category: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    minHeight: 44,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  categorySelected: { backgroundColor: colors.ink },
  categoryEmoji: { fontSize: 16 },
  categoryText: {
    ...typography.bodySmall,
    color: colors.textDim,
    fontWeight: "500",
  },
  categoryTextSelected: { color: colors.onAccent, fontWeight: "600" },
  rail: { gap: 12, paddingBottom: 2, paddingRight: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 140,
  },
  art: {
    width: 76,
    height: 88,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  emoji: { fontSize: 39 },
  copy: { flex: 1, minWidth: 0 },
  highlight: {
    ...typography.heading,
    fontSize: 18,
    lineHeight: 23,
    color: colors.coralDeep,
    fontWeight: "700",
  },
  business: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 2,
  },
  description: { ...typography.caption, color: colors.textDim, marginTop: 2 },
  meta: { ...typography.caption, color: colors.textDim, marginTop: 3 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    backgroundColor: colors.ink,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginTop: 8,
  },
  actionText: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.onAccent,
  },
  empty: {
    flexDirection: "row",
    gap: 9,
    padding: 15,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { ...typography.bodySmall, color: colors.textDim, flex: 1 },
});
