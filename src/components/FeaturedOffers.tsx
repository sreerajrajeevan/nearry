import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Offer } from "../services/mappers";
import { colors, typography } from "../theme";
import { postCategory } from "../utils/discovery";
import { CategoryArt } from "./CategoryArt";
import { MotionPressable } from "./Motion";
import { Icon } from "./Icon";
import { useReducedMotion } from "../store/MotionContext";

export function FeaturedOffers({
  offers,
  onOpen,
  onCreate,
}: {
  offers: Offer[];
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const cardWidth = Math.min(342, width - 64);
  const scroll = useRef<ScrollView>(null);
  const [active, setActive] = useState(0);
  const featured = offers.filter((o) => o.isSpotlight);
  const items = (featured.length ? featured : offers).slice(0, 5);
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          Worth stepping out for
        </Text>
        <Icon name="sun" size={20} color={colors.accent} />
      </View>
      {items.length ? (
        <>
          <ScrollView
            ref={scroll}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={cardWidth + 12}
            contentContainerStyle={styles.rail}
            onMomentumScrollEnd={(e) =>
              setActive(
                Math.max(
                  0,
                  Math.min(
                    items.length - 1,
                    Math.round(
                      e.nativeEvent.contentOffset.x / (cardWidth + 12),
                    ),
                  ),
                ),
              )
            }
          >
            {items.map((offer) => (
              <MotionPressable
                key={offer.id}
                accessibilityRole="button"
                accessibilityLabel={`${offer.title}. ${offer.businessName}. View available times`}
                onPress={() => onOpen(offer.id)}
                style={[styles.card, { width: cardWidth }]}
              >
                {offer.coverPhotoUrl ? (
                  <Image
                    source={{ uri: offer.coverPhotoUrl }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.illustration}>
                    <CategoryArt
                      category={postCategory({
                        title: `${offer.title} ${offer.description}`,
                        tags: [],
                      })}
                      size={150}
                    />
                  </View>
                )}
                <View
                  style={[
                    styles.cover,
                    !offer.coverPhotoUrl && styles.illustratedCover,
                  ]}
                >
                  <Text style={styles.kicker}>A LITTLE OPENING</Text>
                  <Text style={styles.offerTitle}>{offer.title}</Text>
                  <Text style={styles.meta}>
                    {offer.businessName}
                    {offer.priceCents != null
                      ? ` · ${offer.priceCents === 0 ? "Free" : `₹${Math.round(offer.priceCents / 100)}`}`
                      : ""}
                  </Text>
                  <View style={styles.action}>
                    <Text style={styles.actionText}>Find a time</Text>
                    <Icon
                      name="arrow-up-right"
                      size={17}
                      color={colors.onAccent}
                    />
                  </View>
                </View>
              </MotionPressable>
            ))}
          </ScrollView>
          {items.length > 1 && (
            <View style={styles.dots}>
              {items.map((item, index) => (
                <MotionPressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Show featured offer ${index + 1}`}
                  accessibilityState={{ selected: index === active }}
                  style={styles.dotTarget}
                  onPress={() => {
                    scroll.current?.scrollTo({
                      x: index * (cardWidth + 12),
                      animated: !reduced,
                    });
                    setActive(index);
                  }}
                >
                  <View
                    style={[styles.dot, index === active && styles.activeDot]}
                  />
                </MotionPressable>
              ))}
            </View>
          )}
        </>
      ) : (
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Start a plan"
          onPress={onCreate}
          style={styles.invitation}
        >
          <View style={styles.invitationArt}>
            <CategoryArt category="Meet" size={142} />
          </View>
          <Text style={styles.kicker}>YOUR NEIGHBOURHOOD, YOUR PEOPLE</Text>
          <Text style={[styles.offerTitle, { maxWidth: "65%" }]}>
            Make the first move.
          </Text>
          <Text style={[styles.meta, { maxWidth: "65%" }]}>
            A good plan starts with one person.
          </Text>
          <View style={styles.action}>
            <Text style={styles.actionText}>Start a plan</Text>
            <Icon name="arrow-up-right" size={17} color={colors.onAccent} />
          </View>
        </MotionPressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { marginBottom: 30 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  title: { ...typography.heading, fontSize: 19, color: colors.text, flex: 1 },
  rail: { gap: 12, paddingRight: 12 },
  card: {
    minHeight: 230,
    borderRadius: 25,
    backgroundColor: colors.ink,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  photo: { position: "absolute", width: "100%", height: "100%" },
  illustration: { position: "absolute", top: -8, right: -16, opacity: 0.9 },
  cover: {
    padding: 20,
    paddingTop: 45,
    backgroundColor: "rgba(37,42,38,0.78)",
  },
  illustratedCover: { backgroundColor: "transparent", paddingTop: 100 },
  kicker: {
    ...typography.caption,
    fontSize: 11,
    letterSpacing: 1.3,
    color: colors.onAccent,
    marginBottom: 10,
  },
  offerTitle: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    color: colors.onAccent,
    maxWidth: "95%",
  },
  meta: { ...typography.bodySmall, color: colors.onAccent, marginTop: 9 },
  action: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16 },
  actionText: { ...typography.label, color: colors.onAccent },
  invitation: {
    padding: 22,
    minHeight: 235,
    borderRadius: 25,
    backgroundColor: colors.ink,
    overflow: "hidden",
  },
  invitationArt: { position: "absolute", right: -20, top: 42 },
  dots: { flexDirection: "row", justifyContent: "center", marginTop: 2 },
  dotTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
  },
  activeDot: { width: 18, backgroundColor: colors.accent },
});
