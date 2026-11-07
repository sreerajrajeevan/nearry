import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { NeedPost } from "../services/mappers";
import { formatWhen, formatDistance } from "../utils/format";
import { postState } from "../utils/flowState";
import { postCategory } from "../utils/discovery";
import { planCost } from "../utils/planDiscovery";
import { colors, typography } from "../theme";
import { MotionPressable } from "./Motion";
import { PlanCover } from "./PlanCover";
import { Avatar } from "./Avatar";
import { AudienceBadge, audienceLabel } from "./AudienceBadge";
import { Icon } from "./Icon";

/** A photo-led community note; the whole card opens the full plan. */
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
        <PlanCover post={post} aspectRatio={2.85} artworkSize={84} />
      </View>
      <View style={styles.content}>
        <Text style={styles.category}>
          {postCategory(post)} · {formatWhen(post.startsAt, now)}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {post.title}
        </Text>
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
          <Text style={[styles.spots, !status.accepting && styles.closed]}>
            {spots}
          </Text>
          <Icon name="chevron-right" size={18} color={colors.forest} />
        </View>
      </View>
    </MotionPressable>
  );
}
const styles = StyleSheet.create({
  card: {
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cover: { borderRadius: 8, overflow: "hidden", marginBottom: 7 },
  content: { minWidth: 0 },
  category: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textDim,
    fontWeight: "400",
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
  author: { ...typography.bodySmall, color: colors.textDim, flex: 1 },
  spots: {
    ...typography.caption,
    fontSize: 12,
    color: colors.forest,
    flexShrink: 1,
  },
  closed: { color: colors.textDim },
});
