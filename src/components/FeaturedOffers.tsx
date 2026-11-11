import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Offer } from "../services/mappers";
import { colors, typography } from "../theme";
import { activityArtwork } from "../utils/activityArtwork";
import { ActivityArt } from "./ActivityArt";
import { DemoPhoto } from "./DemoPhoto";
import { LoadingImage } from "./LoadingImage";
import { MotionPressable } from "./Motion";
import { Icon, IconName } from "./Icon";

function offerKind(offer: Offer) {
  const text =
    `${offer.title} ${offer.description} ${offer.businessName}`.toLowerCase();
  if (/gym|fitness|training|workout/.test(text)) return "fitness";
  if (/restaurant|café|cafe|food|dine|dining|meal/.test(text)) return "dining";
  if (/turf|sport|football|court|badminton|cricket/.test(text)) return "sports";
  return "more";
}
const filters: { key: string; label: string; icon: IconName }[] = [
  { key: "all", label: "All offers", icon: "grid" },
  { key: "fitness", label: "Fitness", icon: "activity" },
  { key: "dining", label: "Dining", icon: "coffee" },
  { key: "sports", label: "Sports", icon: "dribbble" },
  { key: "more", label: "More", icon: "more-horizontal" },
];
function OfferTile({
  offer,
  width,
  onPress,
}: {
  offer: Offer;
  width: number;
  onPress: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const photo = !!offer.coverPhotoUrl && !failed;
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={`${offer.businessName}. ${offer.title}. View offer`}
      onPress={onPress}
      style={[styles.card, { width }]}
    >
      {photo ? (
        <LoadingImage
          source={{ uri: offer.coverPhotoUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : offer.demoScene ? (
        <DemoPhoto scene={offer.demoScene} />
      ) : (
        <View style={styles.art}>
          <ActivityArt artwork={activityArtwork(offer)} size={115} />
        </View>
      )}
      <LinearGradient
        colors={["rgba(0,25,29,0.26)", "rgba(0,25,29,0.88)"]}
        style={styles.cover}
      >
        <View style={styles.business}>
          <Icon name="tag" size={14} color={colors.white} />
          <Text style={styles.businessText} numberOfLines={2}>
            {offer.businessName}
          </Text>
        </View>
        <View style={styles.bottom}>
          <Text style={styles.title} numberOfLines={3}>
            {offer.title}
          </Text>
          <View style={styles.footer}>
            <Text style={styles.price}>
              {offer.priceCents == null
                ? "View offer"
                : offer.priceCents === 0
                  ? "Free"
                  : `₹${Math.round(offer.priceCents / 100)}`}
            </Text>
            <View style={styles.arrow}>
              <Icon name="chevron-right" size={19} color={colors.ink} />
            </View>
          </View>
        </View>
      </LinearGradient>
    </MotionPressable>
  );
}
export function FeaturedOffers({
  offers,
  onOpen,
}: {
  offers: Offer[];
  onOpen: (id: string) => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const [filter, setFilter] = useState("all");
  const cardWidth = Math.min(235, Math.max(148, (width - 48) * 0.42));
  const filtered = offers.filter(
    (o) => filter === "all" || offerKind(o) === filter,
  );
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {filters.map((item) => (
          <MotionPressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected: item.key === filter }}
            accessibilityLabel={item.label}
            onPress={() => setFilter(item.key)}
            style={[styles.chip, filter === item.key && styles.selected]}
          >
            <Icon
              name={item.icon}
              size={16}
              color={filter === item.key ? colors.white : colors.ink}
            />
            <Text
              style={[
                styles.chipText,
                filter === item.key && styles.selectedText,
              ]}
            >
              {item.label}
            </Text>
          </MotionPressable>
        ))}
      </ScrollView>
      {filtered.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + 12}
          decelerationRate="fast"
          contentContainerStyle={[
            styles.rail,
            { minHeight: fontScale > 1.3 ? 250 : 174 },
          ]}
        >
          {filtered.slice(0, 12).map((offer) => (
            <OfferTile
              key={`${offer.id}:${offer.coverPhotoUrl}`}
              offer={offer}
              width={cardWidth}
              onPress={() => onOpen(offer.id)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No{" "}
            {filter === "all"
              ? "live"
              : filters.find((f) => f.key === filter)?.label.toLowerCase()}{" "}
            offers nearby yet.
          </Text>
          {filter !== "all" && (
            <MotionPressable
              accessibilityRole="button"
              onPress={() => setFilter("all")}
              style={styles.clear}
            >
              <Text style={styles.clearText}>See all offers</Text>
            </MotionPressable>
          )}
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  filters: { gap: 8, paddingBottom: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 24,
    backgroundColor: colors.sandSoft,
  },
  selected: { backgroundColor: colors.teal },
  chipText: { ...typography.bodySmall, color: colors.ink, fontWeight: "600" },
  selectedText: { color: colors.white },
  rail: { gap: 12, paddingRight: 4, paddingBottom: 6 },
  card: {
    minHeight: 174,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: colors.teal,
  },
  art: { position: "absolute", top: 35, right: -10 },
  cover: { flex: 1, padding: 12, justifyContent: "space-between", gap: 30 },
  business: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  businessText: { ...typography.label, color: colors.white, flex: 1 },
  bottom: { gap: 12 },
  title: {
    ...typography.heading,
    fontWeight: "800",
    fontSize: 18,
    lineHeight: 21,
    color: colors.white,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  price: { ...typography.label, color: colors.white, flexShrink: 1 },
  arrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
  },
  empty: {
    padding: 18,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 20,
  },
  emptyText: { ...typography.bodySmall, color: colors.textDim },
  clear: { minHeight: 44, justifyContent: "center" },
  clearText: { ...typography.label, color: colors.teal },
});
