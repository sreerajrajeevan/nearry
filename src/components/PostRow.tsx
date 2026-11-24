import { CardLocation } from "./CardLocation";
import { useCardDistance } from "../store/CardDistanceContext";
import type { DistanceOrigin } from "../utils/cardDistance";
import React, { useState } from "react";
import { samePost } from "../utils/samePost";
import { useToast } from "../store/ToastContext";
import { useMyPlanStatus } from "../store/MyRequestsContext";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { NeedPost } from "../services/mappers";
import { formatWhen } from "../utils/format";
import { postState } from "../utils/flowState";
import { planCost } from "../utils/planDiscovery";
import { colors, typography, weight } from "../theme";
import { MotionPressable, PopView } from "./Motion";
import { PlanCover } from "./PlanCover";
import { Avatar } from "./Avatar";
import { audienceLabel } from "./AudienceBadge";
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
function PostRowView({
  post,
  distanceKm,
  distanceOrigin,
  cta,
  onPress,
  now = new Date(),
}: {
  post: NeedPost;
  distanceKm?: number;
  distanceOrigin?: DistanceOrigin;
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
  const toast = useToast();
  // Once I've asked to join, the card says so instead of offering Join again.
  const mine = useMyPlanStatus(post.id);
  const action =
    cta ??
    (mine === "pending"
      ? "Requested"
      : mine === "approved"
        ? "You're in"
        : status.accepting
          ? "Join"
          : "View");
  const hostTone =
    HOST_TONES[
      [...post.authorId].reduce((hash, ch) => hash + ch.charCodeAt(0), 0) %
        HOST_TONES.length
    ];
  const badge = status.accepting
    ? post.urgent
      ? "Players needed"
      : post.spotsLeft === 1
        ? "Last spot"
        : `${post.spotsLeft} spots left`
    : status.label;
  const distance = useCardDistance(post.venueId, post.location, {
    km: distanceKm,
    origin: distanceOrigin,
  });
  const where = post.venueName || distance.venueName;
  const when = formatWhen(post.startsAt, now);
  const cost =
    post.costCents == null
      ? ""
      : post.costCents === 0
        ? "Free"
        : planCost(post);
  const restricted =
    post.genderPreference === "female" || post.genderPreference === "male";

  const titleBlock = (
    <>
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
          {[when, cost].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <CardLocation name={where} distance={distance.label} light={overlay} />
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
          distance.label,
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
          <View style={StyleSheet.absoluteFill}>
            <PlanCover post={post} fill artworkSize={96} />
          </View>
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
          {/* The sizer keeps the usual 1.9 photo shape; the content beside it
              can make the cover taller when the host, badge, title and details
              need more room (narrow screens, two-line titles), so they never
              overlap. */}
          <View style={styles.coverRow}>
            <View style={styles.coverSizer} />
            <View style={styles.coverContent}>
              <View style={styles.topRow}>
                <View style={styles.hostColumn}>
                  <View style={styles.hostPill}>
                    {post.authorAvatarUrl ? (
                      <Avatar
                        name={post.authorName}
                        uri={post.authorAvatarUrl}
                        size={24}
                      />
                    ) : (
                      <View
                        style={[
                          styles.hostAvatar,
                          { backgroundColor: hostTone },
                        ]}
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
                  {restricted && (
                    <View
                      style={[
                        styles.onlyTag,
                        {
                          backgroundColor:
                            post.genderPreference === "female"
                              ? "#FCE8F1"
                              : "#E6F0FC",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.onlyText,
                          {
                            color:
                              post.genderPreference === "female"
                                ? "#8A2754"
                                : "#205A91",
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {post.genderPreference === "female" ? "♀ " : "♂ "}
                        {audienceLabel(post.genderPreference)}
                      </Text>
                    </View>
                  )}
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
          </View>
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
              const wasSaved = bookmarked;
              void saved
                .toggle(post.id)
                .then(() =>
                  toast(
                    wasSaved
                      ? "Removed from saved plans"
                      : "Saved to your plans",
                    "bookmark",
                  ),
                )
                .catch((error) =>
                  Alert.alert("Couldn’t save plan", error.message),
                )
                .finally(() => setSaving(false));
            }}
          >
            <PopView trigger={bookmarked}>
              <Icon
                name="bookmark"
                size={18}
                color={bookmarked ? colors.onAccent : colors.ink}
              />
            </PopView>
          </MotionPressable>
        )}
        <PopView trigger={action}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={`${
              mine === "pending"
                ? "Request pending"
                : mine === "approved"
                  ? "You're in"
                  : action
            }: ${post.title}`}
            accessibilityHint={
              mine
                ? "Open the plan to see your request"
                : "Review the plan and request a place; the host approves requests"
            }
            onPress={onPress}
            style={[
              styles.cta,
              !status.accepting && styles.ctaQuiet,
              !cta && mine === "pending" && styles.ctaPending,
              !cta && mine === "approved" && styles.ctaIn,
            ]}
          >
            {!cta && mine && (
              <Icon
                name={mine === "pending" ? "clock" : "check"}
                size={15}
                color={mine === "pending" ? colors.textDim : colors.success}
              />
            )}
            <Text
              style={[
                styles.ctaText,
                !status.accepting && styles.ctaTextQuiet,
                !cta && mine === "pending" && styles.ctaTextPending,
                !cta && mine === "approved" && styles.ctaTextIn,
              ]}
            >
              {action}
            </Text>
          </MotionPressable>
        </PopView>
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
  cover: { position: "relative", overflow: "hidden" },
  coverRow: { flexDirection: "row" },
  coverSizer: { width: "100%", aspectRatio: 1.9 },
  coverContent: {
    width: "100%",
    marginLeft: "-100%",
    padding: 12,
    justifyContent: "space-between",
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    marginTop: 4,
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
  photoCopy: { paddingHorizontal: 2, gap: 3 },
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
  hostColumn: {
    flexShrink: 1,
    minWidth: 0,
    alignItems: "flex-start",
    gap: 6,
  },
  onlyTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  onlyText: { fontSize: 11, lineHeight: 15, ...weight("700") },
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
  ctaPending: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaIn: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    backgroundColor: colors.successSoft,
  },
  ctaText: {
    ...typography.label,
    fontSize: 14,
    color: colors.onAmber,
    ...weight("800"),
  },
  ctaTextQuiet: { color: colors.onAccent },
  ctaTextPending: { color: colors.textDim },
  ctaTextIn: { color: colors.success },
});

/**
 * A card only redraws when its plan, the minute or its distance changes;
 * a new tap handler for the same plan doesn't count.
 */
export const PostRow = React.memo(
  PostRowView,
  (prev, next) =>
    prev.cta === next.cta &&
    prev.distanceKm === next.distanceKm &&
    prev.distanceOrigin?.kind === next.distanceOrigin?.kind &&
    prev.distanceOrigin?.label === next.distanceOrigin?.label &&
    // Without a shared clock the card reads the time itself: always redraw.
    !!prev.now &&
    !!next.now &&
    prev.now.getTime() === next.now.getTime() &&
    samePost(prev.post, next.post),
);
