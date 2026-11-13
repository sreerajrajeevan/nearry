import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { NeedPost } from "../services/mappers";
import { formatWhen, formatDistance } from "../utils/format";
import { postState } from "../utils/flowState";
import { postCategory } from "../utils/discovery";
import { planCost } from "../utils/planDiscovery";
import { colors, typography, shadows } from "../theme";
import { MotionPressable } from "./Motion";
import { PlanCover } from "./PlanCover";
import { Avatar } from "./Avatar";
import { AudienceBadge, audienceLabel } from "./AudienceBadge";
import { Icon } from "./Icon";

/** A generous left photo with a readable plan summary alongside it. */
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
  const status = postState(post, now.getTime());
  const spots = status.accepting
    ? `${post.spotsLeft} spot${post.spotsLeft === 1 ? "" : "s"} left`
    : status.label;
  const place = [
    post.venueName,
    distanceKm == null ? null : `${formatDistance(distanceKm)} away`,
  ]
    .filter(Boolean)
    .join(" · ");
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
      <View style={styles.cover}>
        <PlanCover post={post} fill artworkSize={84} />
      </View>
      <View style={styles.content}>
        <Text style={styles.category}>{postCategory(post)}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {post.title}
        </Text>
        <View style={styles.metaRow}>
          <Icon name="calendar" size={13} />
          <Text style={styles.meta}>{formatWhen(post.startsAt, now)}</Text>
        </View>
        {!!place && (
          <View style={styles.metaRow}>
            <Icon name="map-pin" size={13} />
            <Text style={styles.meta} numberOfLines={1}>
              {place}
            </Text>
          </View>
        )}
        {post.genderPreference && post.genderPreference !== "any" && (
          <AudienceBadge preference={post.genderPreference} />
        )}
        <View style={styles.footer}>
          <Avatar name={post.authorName} uri={post.authorAvatarUrl} size={22} />
          <Text style={styles.author} numberOfLines={1}>
            {post.authorName}
          </Text>
        </View>
        <View style={styles.availability}>
          <Text style={[styles.spots, !status.accepting && styles.closed]}>
            {spots}
          </Text>
          <Icon name="chevron-right" size={18} color={colors.accent} />
        </View>
      </View>
    </MotionPressable>
  );
}
const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 14,
    padding: 12,
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  cover: {
    width: "40%",
    maxWidth: 200,
    minHeight: 154,
    borderRadius: 16,
    overflow: "hidden",
  },
  content: { flex: 1, minWidth: 0, justifyContent: "center" },
  category: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 18,
    color: colors.accent,
    fontWeight: "700",
  },
  title: {
    ...typography.heading,
    fontSize: 18,
    lineHeight: 24,
    color: colors.ink,
    marginTop: 1,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginBottom: 3,
  },
  meta: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textDim,
    flex: 1,
  },
  footer: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 9 },
  availability: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 5,
  },
  author: { ...typography.bodySmall, color: colors.textDim, flex: 1 },
  spots: {
    ...typography.caption,
    fontSize: 12,
    color: colors.accent,
    fontWeight: "700",
    flexShrink: 1,
  },
  closed: { color: colors.textDim },
});
