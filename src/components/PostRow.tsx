import React from "react";
import { NeedPost } from "../services/mappers";
import { formatWhen, formatDistance } from "../utils/format";
import { postState } from "../utils/flowState";
import { postCategory } from "../utils/discovery";
import { DiscoveryCard } from "./DiscoveryCard";
import { activityArtwork } from "../utils/activityArtwork";

type Props = {
  post: NeedPost;
  distanceKm?: number;
  cta?: string;
  onPress: () => void;
};
export function PostRow({
  post,
  distanceKm,
  cta = "View plan",
  onPress,
}: Props) {
  const status = postState(post);
  const category = postCategory(post);
  const spots = status.accepting
    ? `${post.spotsLeft} spot${post.spotsLeft === 1 ? "" : "s"}`
    : status.label;
  const price =
    post.costCents == null
      ? null
      : post.costCents === 0
        ? "Free"
        : `₹${(post.costCents / 100).toFixed(0)} / person`;
  return (
    <DiscoveryCard
      kind="Plan"
      artwork={activityArtwork(post)}
      imageUrl={post.coverPhotoUrl}
      icon={
        category === "Play"
          ? "dribbble"
          : category === "Meet"
            ? "coffee"
            : category === "Unwind"
              ? "sun"
              : "compass"
      }
      title={post.title}
      meta={[
        post.venueName,
        formatWhen(post.startsAt),
        distanceKm == null ? null : formatDistance(distanceKm),
      ]
        .filter(Boolean)
        .join(" · ")}
      detail={[spots, price].filter(Boolean).join(" · ")}
      action={status.accepting ? cta : "View plan"}
      onPress={onPress}
    />
  );
}
