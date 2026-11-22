import { CardLocation } from "./CardLocation";
import { useCardDistance } from "../store/CardDistanceContext";
import type { DistanceOrigin } from "../utils/cardDistance";
import React from "react";
import { useMyOfferStatus } from "../store/MyRequestsContext";
import { Offer } from "../services/mappers";
import { formatWhen } from "../utils/format";
import { postCategory } from "../utils/discovery";
import { DiscoveryCard } from "./DiscoveryCard";
import { activityArtwork } from "../utils/activityArtwork";
import { offerPriceShort } from "../utils/offerPrice";

type Props = {
  offer: Offer;
  distanceKm?: number;
  distanceOrigin?: DistanceOrigin;
  onPress: () => void;
};
export function OfferRow({
  offer,
  distanceKm,
  distanceOrigin,
  onPress,
}: Props) {
  const distance = useCardDistance(offer.venueId, undefined, {
    km: distanceKm,
    origin: distanceOrigin,
  });
  // After booking, say so instead of inviting another booking.
  const mine = useMyOfferStatus(offer.id);
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
      meta={[offer.businessName, formatWhen(offer.startsAt)]
        .filter(Boolean)
        .join(" · ")}
      locationLabel={[distance.venueName, distance.label]
        .filter(Boolean)
        .join(". ")}
      location={
        <CardLocation name={distance.venueName} distance={distance.label} />
      }
      detail={offerPriceShort(offer.priceCents)}
      action={
        mine === "booked"
          ? "Booked"
          : mine === "requested"
            ? "Requested"
            : "Choose a time"
      }
      onPress={onPress}
    />
  );
}
