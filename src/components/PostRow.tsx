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

/** A compact photo and readable summary; the whole row opens the full plan. */
export function PostRow({
  post,
  distanceKm,
  cta = "View plan",
  onPress,
}: {
  post: NeedPost;
  distanceKm?: number;
  cta?: string;
  onPress: () => void;
}) {
  const status = postState(post);
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
        formatWhen(post.startsAt),
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
        <PlanCover post={post} aspectRatio={0.82} artworkSize={72} />
      </View>
      <View style={styles.content}>
        <View style={styles.topLine}>
          <Text style={styles.category}>{postCategory(post)}</Text>
          <Text style={[styles.spots, !status.accepting && styles.closed]}>
            {spots}
          </Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {post.title}
        </Text>
        <View style={styles.metaRow}>
          <Icon name="calendar" size={13} />
          <Text style={styles.meta} numberOfLines={1}>
            {formatWhen(post.startsAt)}
          </Text>
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
          <Icon name="arrow-up-right" size={16} color={colors.forest} />
        </View>
      </View>
    </MotionPressable>
  );
}
const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cover: { width: 96, borderRadius: 14, overflow: "hidden" },
  content: { flex: 1, minWidth: 0 },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "space-between",
    marginBottom: 5,
  },
  category: {
    ...typography.caption,
    fontSize: 10,
    color: colors.sageDeep,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    ...typography.heading,
    fontSize: 17,
    lineHeight: 23,
    color: colors.forest,
    marginBottom: 7,
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
  footer: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 7 },
  author: { ...typography.caption, color: colors.textDim, flex: 1 },
  spots: { ...typography.caption, color: colors.sageDeep, flexShrink: 1 },
  closed: { color: colors.textDim },
});
