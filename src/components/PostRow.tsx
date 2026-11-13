import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { NeedPost } from "../services/mappers";
import { formatWhen, formatDistance } from "../utils/format";
import { postState } from "../utils/flowState";
import { planCost } from "../utils/planDiscovery";
import { colors, typography } from "../theme";
import { MotionPressable } from "./Motion";
import { PlanCover } from "./PlanCover";
import { Avatar } from "./Avatar";
import { AudienceBadge, audienceLabel } from "./AudienceBadge";
import { Icon } from "./Icon";

function postedLabel(createdAt: string, now: Date) {
  const elapsed = now.getTime() - Date.parse(createdAt);
  if (!Number.isFinite(elapsed) || elapsed < 0) return "New plan";
  if (elapsed < 60_000) return "Just posted";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} hr ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}
/** One complete tap target: opens the real details and eligibility-checked join flow. */
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
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 350 || fontScale > 1.4;
  const spots = status.accepting
    ? `${post.spotsLeft} ${post.spotsLeft === 1 ? "spot" : "spots"} left`
    : status.label;
  const progress = Math.min(
    1,
    Math.max(0, post.joinedCount / Math.max(1, post.vacancies)),
  );
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={[
        post.title,
        `Hosted by ${post.authorName}`,
        formatWhen(post.startsAt, now),
        post.venueName,
        distanceKm != null && formatDistance(distanceKm),
        spots,
        planCost(post),
        audienceLabel(post.genderPreference),
        cta,
      ]
        .filter(Boolean)
        .join(". ")}
      accessibilityHint="Open the plan to review details and request to join"
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.hostRow}>
        <Avatar name={post.authorName} uri={post.authorAvatarUrl} size={33} />
        <View style={styles.hostCopy}>
          <Text numberOfLines={1} style={styles.author}>
            {post.authorName}
          </Text>
          <Text style={styles.posted}>{postedLabel(post.createdAt, now)}</Text>
        </View>
        {distanceKm != null && (
          <View style={styles.distance}>
            <Icon name="map-pin" size={12} color={colors.coralDeep} />
            <Text style={styles.distanceText}>
              {formatDistance(distanceKm)}
            </Text>
          </View>
        )}
      </View>
      <View style={[styles.body, stacked && styles.stackedBody]}>
        <View style={[styles.cover, stacked && styles.stackedCover]}>
          <PlanCover
            post={post}
            fill={!stacked}
            aspectRatio={2}
            artworkSize={84}
          />
          {status.accepting && post.spotsLeft === 1 && (
            <View style={styles.lastSpot}>
              <Text style={styles.lastSpotText}>Last spot</Text>
            </View>
          )}
        </View>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={stacked ? undefined : 2}>
            {post.title}
          </Text>
          <Text style={styles.description} numberOfLines={1}>
            {post.description}
          </Text>
          <View style={styles.metaRow}>
            <Icon name="calendar" size={13} />
            <Text style={styles.meta}>{formatWhen(post.startsAt, now)}</Text>
          </View>
          {!!post.venueName && (
            <View style={styles.metaRow}>
              <Icon name="map-pin" size={13} />
              <Text style={styles.meta} numberOfLines={2}>
                {post.venueName}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.tags}>
        <AudienceBadge preference={post.genderPreference} />
        {post.costCents != null && (
          <View style={styles.cost}>
            <Icon
              name={post.costCents === 0 ? "gift" : "tag"}
              size={12}
              color={post.costCents === 0 ? colors.success : colors.textDim}
            />
            <Text style={styles.costText}>
              {post.costCents === 0 ? "Free" : planCost(post)}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.footer}>
        <View style={styles.availability}>
          <Text style={[styles.spots, !status.accepting && styles.closed]}>
            {post.joinedCount > 0
              ? `${post.joinedCount}/${post.vacancies} joined · `
              : ""}
            {spots}
          </Text>
          {status.accepting && (
            <View accessible={false} style={styles.track}>
              <View
                style={[styles.progress, { width: `${progress * 100}%` }]}
              />
            </View>
          )}
        </View>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{cta}</Text>
          <Icon name="arrow-up-right" size={13} color={colors.onAccent} />
        </View>
      </View>
    </MotionPressable>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 15,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 13,
  },
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 13,
  },
  hostCopy: { flex: 1, minWidth: 0 },
  author: { ...typography.bodySmall, fontWeight: "700", color: colors.ink },
  posted: { ...typography.caption, color: colors.textDim, marginTop: 1 },
  distance: { flexDirection: "row", alignItems: "center", gap: 4 },
  distanceText: {
    ...typography.caption,
    color: colors.textDim,
    fontWeight: "500",
  },
  body: { flexDirection: "row", alignItems: "stretch", gap: 13 },
  stackedBody: { flexDirection: "column" },
  cover: {
    width: "33%",
    maxWidth: 160,
    minHeight: 113,
    borderRadius: 14,
    overflow: "hidden",
  },
  stackedCover: { width: "100%", maxWidth: "100%", minHeight: 0 },
  lastSpot: {
    position: "absolute",
    top: 7,
    left: 7,
    backgroundColor: colors.ink,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  lastSpotText: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "600",
    color: colors.onAccent,
  },
  content: { flex: 1, minWidth: 0, justifyContent: "center" },
  title: {
    ...typography.heading,
    fontWeight: "700",
    fontSize: 17,
    lineHeight: 22,
    color: colors.ink,
    marginBottom: 4,
  },
  description: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textDim,
    marginBottom: 8,
  },
  metaRow: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 4 },
  meta: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textDim,
    flex: 1,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    marginTop: 7,
    marginBottom: 10,
  },
  cost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
    paddingVertical: 4,
  },
  costText: { ...typography.caption, color: colors.textDim },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  availability: { flex: 1, minWidth: 0 },
  spots: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 17,
    color: colors.ink,
    fontWeight: "500",
  },
  closed: { color: colors.textDim },
  track: {
    height: 3,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 7,
    maxWidth: 170,
  },
  progress: {
    height: "100%",
    backgroundColor: colors.success,
    borderRadius: 3,
  },
  cta: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 10,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: colors.ink,
  },
  ctaText: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.onAccent,
  },
});
