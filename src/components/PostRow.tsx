import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { colors, typography, spacing } from "../theme";
import { NeedPost } from "../services/mappers";
import { formatWhen, formatDistance } from "../utils/format";

type Props = {
  post: NeedPost;
  distanceKm?: number;
  cta?: string;
  onPress: () => void;
};

export function PostRow({
  post,
  distanceKm,
  cta = "I’m interested",
  onPress,
}: Props) {
  const spots =
    post.status === "cancelled"
      ? "Cancelled"
      : post.status === "closed"
        ? "Closed"
        : post.spotsLeft <= 0
          ? "Full"
          : `${post.spotsLeft} spot${post.spotsLeft === 1 ? "" : "s"}`;
  const price =
    post.costCents == null
      ? null
      : post.costCents === 0
        ? "Free"
        : `₹${(post.costCents / 100).toFixed(0)} each`;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${post.title}. ${spots}. View plan`}
      activeOpacity={0.65}
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.topLine}>
        <Avatar name={post.authorName} size={24} />
        <Text style={styles.asking}>{post.authorName} is asking</Text>
        {distanceKm !== undefined && (
          <Text style={styles.distance}>{formatDistance(distanceKm)} away</Text>
        )}
      </View>
      <Text style={styles.title}>{post.title}</Text>
      <View style={styles.metaLine}>
        <Icon name="map-pin" size={12} />
        <Text style={styles.meta}>
          {[post.venueName, formatWhen(post.startsAt)]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <View style={styles.bottomLine}>
        <View style={styles.spotLine}>
          <Icon name="users" size={13} color={colors.accent} />
          <Text style={styles.spots}>
            {[spots, price].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <View style={styles.link}>
          <Text style={styles.cta}>
            {post.status !== "open" || post.spotsLeft <= 0 ? "View plan" : cta}
          </Text>
          <Icon name="arrow-up-right" size={14} color={colors.accent} />
        </View>
      </View>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  topLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  asking: { ...typography.bodySmall, color: colors.text, flex: 1 },
  distance: {
    ...typography.caption,
    color: colors.textDim,
    flexShrink: 1,
    textAlign: "right",
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginTop: 13,
    marginBottom: 9,
  },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { ...typography.bodySmall, color: colors.textDim, flex: 1 },
  bottomLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    flexWrap: "wrap",
    marginTop: spacing.sm,
  },
  spotLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 1,
  },
  spots: { ...typography.bodySmall, color: colors.text },
  link: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36 },
  cta: { ...typography.bodySmall, color: colors.accent },
});
