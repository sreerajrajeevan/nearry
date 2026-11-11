import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { NeedPost } from "../services/mappers";
import { formatWhen, formatDistance } from "../utils/format";
import { postState } from "../utils/flowState";
import { postCategory } from "../utils/discovery";
import { planCost } from "../utils/planDiscovery";
import { colors, typography } from "../theme";
import { MotionPressable } from "./Motion";
import { PlanCover } from "./PlanCover";
import { Avatar } from "./Avatar";
import { audienceLabel } from "./AudienceBadge";
import { Icon } from "./Icon";

/** Owner-uploaded photography, real availability, and one clear path to the plan. */
export function PostRow({
  post,
  distanceKm,
  cta = "View plan",
  onPress,
  now = new Date(),
}: {
  post: NeedPost;
  distanceKm?: number;
  cta?: string;
  onPress: () => void;
  now?: Date;
}) {
  const { fontScale } = useWindowDimensions();
  const status = postState(post, now.getTime());
  const spots = status.accepting
    ? `${post.spotsLeft} spot${post.spotsLeft === 1 ? "" : "s"} left`
    : status.label;
  const place = [
    post.venueName,
    distanceKm == null ? null : formatDistance(distanceKm),
  ]
    .filter(Boolean)
    .join(" · ");
  const category = postCategory(post);
  const audience =
    post.genderPreference && post.genderPreference !== "any"
      ? audienceLabel(post.genderPreference)
      : null;
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={[
        post.title,
        formatWhen(post.startsAt, now),
        place,
        spots,
        planCost(post),
        audienceLabel(post.genderPreference),
        cta,
      ]
        .filter(Boolean)
        .join(". ")}
      onPress={onPress}
      style={styles.card}
    >
      <View style={StyleSheet.absoluteFill} accessible={false}>
        <PlanCover post={post} fill artworkSize={130} />
      </View>
      <LinearGradient
        colors={[
          "rgba(0,24,28,0.04)",
          "rgba(0,24,28,0.48)",
          "rgba(0,24,28,0.94)",
        ]}
        locations={[0, 0.35, 1]}
        style={[
          styles.content,
          { minHeight: 226 + Math.max(0, fontScale - 1) * 160 },
        ]}
      >
        <View style={styles.top}>
          <View style={styles.category}>
            <Icon
              name={
                category === "Play"
                  ? "dribbble"
                  : category === "Meet"
                    ? "coffee"
                    : category === "Explore"
                      ? "compass"
                      : "sun"
              }
              size={13}
              color={colors.ink}
            />
            <Text style={styles.categoryText}>{category}</Text>
          </View>
          {!!audience && (
            <View style={styles.audience}>
              <Icon name="users" size={12} color={colors.white} />
              <Text style={styles.audienceText}>{audience}</Text>
            </View>
          )}
        </View>
        <Text
          style={styles.title}
          numberOfLines={fontScale > 1.3 ? undefined : 2}
        >
          {post.title}
        </Text>
        <View style={styles.metaRow}>
          <Icon name="calendar" size={14} color={colors.white} />
          <Text style={styles.meta}>{formatWhen(post.startsAt, now)}</Text>
        </View>
        {!!place && (
          <View style={styles.metaRow}>
            <Icon name="map-pin" size={14} color={colors.white} />
            <Text style={styles.meta} numberOfLines={2}>
              {place}
            </Text>
          </View>
        )}
        <View style={styles.footer}>
          <Avatar name={post.authorName} uri={post.authorAvatarUrl} size={29} />
          <View style={styles.host}>
            <Text style={styles.author} numberOfLines={1}>
              {post.authorName}
            </Text>
            <Text style={styles.spots}>
              {spots}
              {post.joinedCount > 0 ? ` · ${post.joinedCount} joined` : ""}
            </Text>
          </View>
          <View
            style={[styles.action, !status.accepting && styles.closedAction]}
          >
            <Text style={styles.actionText}>{cta}</Text>
            <Icon name="arrow-right" size={16} color={colors.onAction} />
          </View>
        </View>
      </LinearGradient>
    </MotionPressable>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.deepTeal,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 14,
  },
  content: { padding: 16, justifyContent: "flex-end" },
  top: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
    marginBottom: 25,
  },
  category: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 20,
    backgroundColor: colors.cream,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  categoryText: { ...typography.caption, fontWeight: "700", color: colors.ink },
  audience: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    backgroundColor: colors.deepTeal,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  audienceText: { ...typography.caption, color: colors.white },
  title: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "800",
    color: colors.white,
    marginBottom: 8,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowRadius: 6,
  },
  metaRow: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 2 },
  meta: { ...typography.bodySmall, color: colors.white, flex: 1 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 7,
    rowGap: 10,
    marginTop: 14,
  },
  host: { flex: 1, minWidth: 65 },
  author: { ...typography.caption, color: colors.white, fontWeight: "600" },
  spots: { ...typography.caption, color: colors.onTeal },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 24,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.action,
  },
  actionText: { ...typography.label, color: colors.onAction },
  closedAction: { backgroundColor: colors.teal },
});
