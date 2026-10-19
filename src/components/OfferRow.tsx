import React from "react";
import { Offer } from "../services/mappers";
import { formatDistance, formatWhen } from "../utils/format";
import { postCategory } from "../utils/discovery";
import { DiscoveryCard } from "./DiscoveryCard";
import { activityArtwork } from "../utils/activityArtwork";

type Props = { offer: Offer; distanceKm?: number; onPress: () => void };
export function OfferRow({ offer, distanceKm, onPress }: Props) {
  const category = postCategory({
    title: `${offer.title} ${offer.description}`,
    tags: [],
  });
  return (
    <DiscoveryCard
      imageUrl={offer.coverPhotoUrl}
      kind="Offer"
      artwork={activityArtwork(offer)}
      icon={
        category === "Unwind"
          ? "scissors"
          : category === "Play"
            ? "dribbble"
            : category === "Meet"
              ? "coffee"
              : "tag"
      }
      title={offer.title}
      meta={[
        offer.businessName,
        formatWhen(offer.startsAt),
        distanceKm == null ? null : formatDistance(distanceKm),
      ]
        .filter(Boolean)
        .join(" · ")}
      detail={
        offer.priceCents == null
          ? undefined
          : offer.priceCents === 0
            ? "Free"
            : `₹${(offer.priceCents / 100).toFixed(0)}`
      }
      action="Choose a time"
      onPress={onPress}
    />
  );
}
