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
        <PlanCover post={post} />
      </View>
      <View style={styles.content}>
        <Text style={styles.category}>{postCategory(post)}</Text>
        <Text style={styles.title}>{post.title}</Text>
        <View style={styles.metaRow}>
          <Icon name="calendar" size={15} />
          <Text style={styles.meta}>{formatWhen(post.startsAt)}</Text>
        </View>
        {!!place && (
          <View style={styles.metaRow}>
            <Icon name="map-pin" size={15} />
            <Text style={styles.meta}>{place}</Text>
          </View>
        )}
        {post.genderPreference && post.genderPreference !== "any" && (
          <AudienceBadge preference={post.genderPreference} />
        )}
        <View style={styles.footer}>
          <Avatar name={post.authorName} uri={post.authorAvatarUrl} size={30} />
          <Text style={styles.author} numberOfLines={1}>
            {post.authorName}
          </Text>
          <Text style={[styles.spots, !status.accepting && styles.closed]}>
            {spots}
          </Text>
          <Icon name="arrow-right" size={19} color={colors.forest} />
        </View>
      </View>
    </MotionPressable>
  );
}
const styles = StyleSheet.create({
  card: {
    marginBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 16,
  },
  cover: { borderRadius: 18, overflow: "hidden", marginBottom: 12 },
  content: { paddingHorizontal: 2 },
  category: {
    ...typography.caption,
    color: colors.sageDeep,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  title: {
    ...typography.heading,
    fontSize: 20,
    lineHeight: 26,
    color: colors.forest,
    marginBottom: 9,
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 5,
  },
  meta: { ...typography.bodySmall, color: colors.textDim, flex: 1 },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  author: { ...typography.bodySmall, color: colors.text, flex: 1 },
  spots: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.sageDeep,
    flexShrink: 1,
  },
  closed: { color: colors.textDim },
});
