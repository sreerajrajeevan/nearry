import React, { useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { NeedPost } from "../services/mappers";
import { formatWhen, formatTime, formatDistance } from "../utils/format";
import { postState } from "../utils/flowState";
import { planCost } from "../utils/planDiscovery";
import { postCategory } from "../utils/discovery";
import { colors, typography } from "../theme";
import { MotionPressable } from "./Motion";
import { PlanCover } from "./PlanCover";
import { Avatar } from "./Avatar";
import { audienceLabel } from "./AudienceBadge";
import { Icon } from "./Icon";
import { useSavedPlans } from "../store/SavedPlansContext";
import { Alert } from "../services/appAlert";
function postedLabel(createdAt: string, now: Date) {
  const minutes = (now.getTime() - Date.parse(createdAt)) / 60_000;
  if (!Number.isFinite(minutes) || minutes < 1) return "Just posted";
  return minutes < 60
    ? `${Math.floor(minutes)} min ago`
    : minutes < 1440
      ? `${Math.floor(minutes / 60)} hr ago`
      : `${Math.floor(minutes / 1440)}d ago`;
}
export function PostRow({
  post,
  distanceKm,
  cta,
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
  const stacked = width < 330 || fontScale > 1.4;
  const saved = useSavedPlans();
  const bookmarked = saved?.ids.includes(post.id) ?? false;
  const [saving, setSaving] = useState(false);
  const progress = Math.min(
    1,
    Math.max(0, post.joinedCount / Math.max(1, post.vacancies)),
  );
  const action = cta ?? (status.accepting ? "Join" : "View");
  const skills = ["beginner", "intermediate", "advanced"];
  const skill = post.tags.find((tag) => skills.includes(tag.toLowerCase()));
  const gym = /\b(gym|fitness|workout|strength)\b/i.test(
    `${post.title} ${post.tags.join(" ")}`,
  );
  const category = gym ? "Gym" : postCategory(post);
  const audience =
    post.genderPreference === "male"
      ? "Male only"
      : post.genderPreference === "female"
        ? "Female only"
        : "Anyone";
  const avatarTone = ["#6D2AAB", "#B22749", "#205B87", "#387358"][
    [...post.authorId].reduce(
      (hash, character) => hash + character.charCodeAt(0),
      0,
    ) % 4
  ];
  const initials = post.authorName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0])
    .join("");
  const spots = status.accepting ? `${post.spotsLeft} left` : status.label;
  return (
    <View style={styles.card}>
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
          "View plan",
        ]
          .filter(Boolean)
          .join(". ")}
        onPress={onPress}
      >
        <View style={styles.hostRow}>
          {post.authorAvatarUrl ? (
            <Avatar
              name={post.authorName}
              uri={post.authorAvatarUrl}
              size={33}
            />
          ) : (
            <View style={[styles.avatar, { backgroundColor: avatarTone }]}>
              <Text style={styles.initials}>{initials}</Text>
            </View>
          )}
          <View style={styles.hostCopy}>
            <Text style={styles.author} numberOfLines={1}>
              {post.authorName}
            </Text>
            <Text style={styles.posted}>
              {postedLabel(post.createdAt, now)}
            </Text>
          </View>
          {distanceKm != null && (
            <View style={styles.distance}>
              <Text accessible={false} style={styles.pin}>
                📍
              </Text>
              <Text style={styles.distanceText}>
                {formatDistance(distanceKm)}
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.body, stacked && styles.stacked]}>
          <View style={[styles.cover, stacked && styles.stackedCover]}>
            <PlanCover
              post={post}
              fill={!stacked}
              aspectRatio={2}
              artworkSize={76}
            />
            {status.accepting && post.spotsLeft === 1 && (
              <View style={styles.lastSpot}>
                <Text style={styles.lastSpotText}>Last spot</Text>
              </View>
            )}
            <View style={styles.coverLabel}>
              <Text style={styles.coverLabelText}>{category}</Text>
            </View>
          </View>
          <View style={styles.content}>
            <Text style={styles.title} numberOfLines={stacked ? undefined : 2}>
              {post.title}
            </Text>
            <Text style={styles.description} numberOfLines={1}>
              {post.description}
            </Text>
            <Text style={styles.meta}>
              <Text accessible={false}>🗓️ </Text>
              {formatWhen(post.startsAt, now).split(",")[0]} ·{" "}
              <Text accessible={false}>⏰ </Text>
              {formatTime(post.startsAt)}
            </Text>
            {!!post.venueName && (
              <Text style={styles.venue} numberOfLines={2}>
                <Text accessible={false}>📍 </Text>
                {post.venueName}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.tags}>
          <View
            style={[
              styles.audience,
              post.genderPreference === "male"
                ? styles.male
                : post.genderPreference === "female"
                  ? styles.female
                  : styles.any,
            ]}
          >
            <Text
              style={[
                styles.tagText,
                post.genderPreference === "male"
                  ? styles.maleText
                  : post.genderPreference === "female"
                    ? styles.femaleText
                    : styles.anyText,
              ]}
            >
              <Text accessible={false}>
                {post.genderPreference === "female"
                  ? "♀ "
                  : post.genderPreference === "male"
                    ? "♂ "
                    : "👥 "}
              </Text>
              {audience}
            </Text>
          </View>
          {skill && (
            <Text style={styles.tagText}>
              <Text accessible={false}>🎯 </Text>
              {skill[0].toUpperCase() + skill.slice(1).toLowerCase()}
            </Text>
          )}
          {post.costCents != null && (
            <Text style={styles.tagText}>
              <Text accessible={false}>
                {post.costCents === 0 ? "💸 " : "🏷️ "}
              </Text>
              {post.costCents === 0 ? "Free" : planCost(post)}
            </Text>
          )}
        </View>
      </MotionPressable>
      <View style={styles.footer}>
        <View style={styles.members}>
          <View style={styles.memberCircle}>
            <Icon name="users" size={13} color={colors.textDim} />
          </View>
          <View style={styles.memberGhost} />
        </View>
        <View style={styles.availability}>
          <Text style={styles.spots}>
            <Text style={styles.joined}>
              {post.joinedCount}/{post.vacancies}
            </Text>{" "}
            joined · {spots}
          </Text>
          {status.accepting && (
            <View style={styles.track}>
              <View
                style={[styles.progress, { width: `${progress * 100}%` }]}
              />
            </View>
          )}
        </View>
        {saved && (
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={`${bookmarked ? "Unsave" : "Save"} plan: ${post.title}`}
            accessibilityState={{
              selected: bookmarked,
              disabled: saving || saved.status === "loading",
            }}
            disabled={saving || saved.status === "loading"}
            style={styles.bookmark}
            onPress={() => {
              setSaving(true);
              void saved
                .toggle(post.id)
                .catch((error) =>
                  Alert.alert("Couldn’t save plan", error.message),
                )
                .finally(() => setSaving(false));
            }}
          >
            <View style={bookmarked ? styles.bookmarked : undefined}>
              <Icon
                name="bookmark"
                size={20}
                color={bookmarked ? colors.onAccent : colors.ink}
              />
            </View>
          </MotionPressable>
        )}
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel={`${action}: ${post.title}`}
          accessibilityHint="Review the plan and request a place; the host approves requests"
          onPress={onPress}
          style={styles.cta}
        >
          <Text style={styles.ctaText}>{action}</Text>
        </MotionPressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 13,
    borderRadius: 24,
    backgroundColor: colors.surface,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: "#F0F0F1",
    shadowColor: "#20232B",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 10,
  },
  avatar: {
    width: 33,
    height: 33,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { ...typography.label, color: colors.onAccent, fontWeight: "700" },
  hostCopy: { flex: 1, minWidth: 0 },
  author: { ...typography.bodySmall, fontWeight: "700", color: colors.ink },
  posted: { ...typography.caption, color: colors.textDim, marginTop: 2 },
  distance: { flexDirection: "row", alignItems: "center", gap: 1 },
  pin: { fontSize: 13 },
  distanceText: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.textDim,
    fontWeight: "600",
  },
  body: { flexDirection: "row", gap: 11, alignItems: "stretch" },
  stacked: { flexDirection: "column" },
  cover: {
    width: "30%",
    maxWidth: 150,
    minHeight: 99,
    overflow: "hidden",
    borderRadius: 15,
  },
  stackedCover: { width: "100%", maxWidth: "100%", minHeight: 0 },
  lastSpot: {
    position: "absolute",
    left: 6,
    top: 6,
    backgroundColor: "#A81F4C",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  lastSpotText: {
    ...typography.caption,
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 9,
    lineHeight: 12,
  },
  coverLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  coverLabelText: {
    ...typography.caption,
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 10,
  },
  content: { flex: 1, minWidth: 0, paddingVertical: 2 },
  title: {
    ...typography.heading,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 5,
  },
  description: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textDim,
    marginBottom: 5,
  },
  meta: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 19,
    color: colors.textDim,
  },
  venue: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    color: colors.ink,
    marginTop: 3,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    marginVertical: 9,
    minHeight: 24,
  },
  audience: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8 },
  male: { backgroundColor: "#EDF5FE" },
  female: { backgroundColor: "#FCEAF0" },
  any: { backgroundColor: "#F1F3F2" },
  maleText: { color: "#205A91" },
  femaleText: { color: "#8A2754" },
  anyText: { color: colors.textDim },
  tagText: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textDim,
    fontWeight: "500",
  },
  footer: { flexDirection: "row", alignItems: "center", gap: 7 },
  members: { width: 30, height: 27, justifyContent: "center" },
  memberCircle: {
    width: 22,
    height: 22,
    borderRadius: 12,
    backgroundColor: "#E9ECEF",
    alignItems: "center",
    justifyContent: "center",
  },
  memberGhost: {
    position: "absolute",
    right: 0,
    width: 19,
    height: 19,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#B5BAC2",
    backgroundColor: colors.surface,
  },
  availability: { flex: 1, minWidth: 0 },
  joined: { fontWeight: "700", color: colors.ink },
  spots: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textDim,
  },
  track: {
    height: 3,
    marginTop: 4,
    backgroundColor: "#ECEEEF",
    borderRadius: 3,
    overflow: "hidden",
  },
  progress: { height: "100%", backgroundColor: "#33815B", borderRadius: 3 },
  bookmark: {
    minWidth: 36,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  bookmarked: { backgroundColor: colors.ink, padding: 4, borderRadius: 6 },
  cta: {
    minWidth: 61,
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#161B25",
  },
  ctaText: {
    ...typography.bodySmall,
    color: colors.onAccent,
    fontWeight: "700",
  },
});
