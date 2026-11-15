import React, { useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { NeedPost } from "../services/mappers";
import { formatWhen, formatDistance } from "../utils/format";
import { postState } from "../utils/flowState";
import { planCost } from "../utils/planDiscovery";
import { colors, typography, weight } from "../theme";
import { MotionPressable } from "./Motion";
import { PlanCover } from "./PlanCover";
import { Avatar } from "./Avatar";
import { AudienceBadge, audienceLabel } from "./AudienceBadge";
import { Icon } from "./Icon";
import { useSavedPlans } from "../store/SavedPlansContext";
import { Alert } from "../services/appAlert";

const HOST_TONES = ["#1E293B", "#047857", "#4338CA", "#9D174D"];

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/**
 * A plan as a photo card: host and availability on the photo, title and time
 * over a dark fade, then who has joined with Save and the main action below.
 * With large text the title moves under the photo so nothing is clipped.
 */
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
  const { fontScale } = useWindowDimensions();
  const overlay = fontScale <= 1.3;
  const saved = useSavedPlans();
  const bookmarked = saved?.ids.includes(post.id) ?? false;
  const [saving, setSaving] = useState(false);
  const action = cta ?? (status.accepting ? "Join" : "View");
  const hostTone =
    HOST_TONES[
      [...post.authorId].reduce((hash, ch) => hash + ch.charCodeAt(0), 0) %
        HOST_TONES.length
    ];
  const badge = status.accepting
    ? post.spotsLeft === 1
      ? "Last spot"
      : `${post.spotsLeft} spots left`
    : status.label;
  const where =
    distanceKm != null
      ? `${formatDistance(distanceKm)} away`
      : (post.venueName ?? "");
  const when = formatWhen(post.startsAt, now);
  const cost = post.costCents != null ? planCost(post) : "";
  const restricted =
    post.genderPreference === "female" || post.genderPreference === "male";

  const titleBlock = (
    <>
      {restricted && (
        <AudienceBadge
          preference={post.genderPreference}
          style={styles.audience}
        />
      )}
      <Text
        style={[
          styles.title,
          overlay ? styles.titleOnPhoto : styles.titlePlain,
        ]}
        numberOfLines={overlay ? 2 : undefined}
      >
        {post.title}
      </Text>
      <View style={styles.metaRow}>
        <Icon
          name="clock"
          size={13}
          color={overlay ? colors.amberBright : colors.amberDeep}
        />
        <Text
          style={[styles.meta, overlay ? styles.metaOnPhoto : styles.metaPlain]}
          numberOfLines={overlay ? 1 : undefined}
        >
          {[when, where, cost].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </>
  );

  return (
    <View style={styles.card}>
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel={[
          post.title,
          `Hosted by ${post.authorName}`,
          when,
          post.venueName,
          distanceKm != null && formatDistance(distanceKm),
          badge,
          cost,
          audienceLabel(post.genderPreference),
          "View plan",
        ]
          .filter(Boolean)
          .join(". ")}
        onPress={onPress}
      >
        <View style={styles.cover}>
          <PlanCover post={post} aspectRatio={1.9} artworkSize={96} />
          <LinearGradient
            pointerEvents="none"
            colors={
              overlay
                ? ["rgba(0,0,0,0.25)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.82)"]
                : ["rgba(0,0,0,0.25)", "rgba(0,0,0,0)", "rgba(0,0,0,0)"]
            }
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.topRow}>
            <View style={styles.hostPill}>
              {post.authorAvatarUrl ? (
                <Avatar
                  name={post.authorName}
                  uri={post.authorAvatarUrl}
                  size={24}
                />
              ) : (
                <View
                  style={[styles.hostAvatar, { backgroundColor: hostTone }]}
                >
                  <Text style={styles.hostInitials}>
                    {initialsOf(post.authorName)}
                  </Text>
                </View>
              )}
              <Text style={styles.hostName} numberOfLines={1}>
                {post.authorName}
              </Text>
            </View>
            <View
              style={[styles.badge, !status.accepting && styles.badgeMuted]}
            >
              <Text
                style={[
                  styles.badgeText,
                  !status.accepting && styles.badgeTextMuted,
                ]}
              >
                {badge}
              </Text>
            </View>
          </View>
          {overlay && <View style={styles.photoCopy}>{titleBlock}</View>}
        </View>
        {!overlay && <View style={styles.plainCopy}>{titleBlock}</View>}
      </MotionPressable>
      <View style={styles.footer}>
        <View style={styles.joinedIcon}>
          <Icon name="users" size={14} color={colors.textDim} />
        </View>
        <Text style={styles.joined}>
          <Text style={styles.joinedCount}>
            {post.joinedCount} of {post.vacancies}
          </Text>{" "}
          joined
        </Text>
        {saved && (
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={`${bookmarked ? "Unsave" : "Save"} plan: ${post.title}`}
            accessibilityState={{
              selected: bookmarked,
              disabled: saving || saved.status === "loading",
            }}
            disabled={saving || saved.status === "loading"}
            style={[styles.save, bookmarked && styles.saved]}
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
            <Icon
              name="bookmark"
              size={18}
              color={bookmarked ? colors.onAccent : colors.ink}
            />
          </MotionPressable>
        )}
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel={`${action}: ${post.title}`}
          accessibilityHint="Review the plan and request a place; the host approves requests"
          onPress={onPress}
          style={[styles.cta, !status.accepting && styles.ctaQuiet]}
        >
          <Text
            style={[styles.ctaText, !status.accepting && styles.ctaTextQuiet]}
          >
            {action}
          </Text>
        </MotionPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: 14,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cover: { position: "relative" },
  topRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  hostPill: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  hostAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  hostInitials: { fontSize: 10, color: colors.white, ...weight("800") },
  hostName: {
    ...typography.caption,
    fontSize: 12,
    color: colors.white,
    ...weight("700"),
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.amberBright,
  },
  badgeMuted: { backgroundColor: "rgba(255,255,255,0.92)" },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.onAmber,
    ...weight("800"),
  },
  badgeTextMuted: { color: colors.ink },
  photoCopy: { position: "absolute", left: 14, right: 14, bottom: 12, gap: 3 },
  audience: { marginTop: 0, marginBottom: 4 },
  plainCopy: { paddingHorizontal: 16, paddingTop: 12, gap: 4 },
  title: {
    ...typography.heading,
    fontSize: 18,
    lineHeight: 23,
    ...weight("800"),
  },
  titleOnPhoto: { color: colors.white },
  titlePlain: { color: colors.ink },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 17,
    flexShrink: 1,
    ...weight("500"),
  },
  metaOnPhoto: { color: "#E5E7EB" },
  metaPlain: { color: colors.textDim },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 10,
  },
  joinedIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  joined: { ...typography.bodySmall, color: colors.textDim, flex: 1 },
  joinedCount: { color: colors.ink, ...weight("800") },
  save: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  saved: { backgroundColor: colors.ink, borderColor: colors.ink },
  cta: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaQuiet: { backgroundColor: colors.ink },
  ctaText: {
    ...typography.label,
    fontSize: 14,
    color: colors.onAmber,
    ...weight("800"),
  },
  ctaTextQuiet: { color: colors.onAccent },
});
