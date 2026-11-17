import React from "react";
import { useMyOfferStatus } from "../store/MyRequestsContext";
import { Offer } from "../services/mappers";
import { formatDistance, formatWhen } from "../utils/format";
import { postCategory } from "../utils/discovery";
import { DiscoveryCard } from "./DiscoveryCard";
import { activityArtwork } from "../utils/activityArtwork";
import { offerPriceShort } from "../utils/offerPrice";

type Props = { offer: Offer; distanceKm?: number; onPress: () => void };
export function OfferRow({ offer, distanceKm, onPress }: Props) {
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
      meta={[
        offer.businessName,
        formatWhen(offer.startsAt),
        distanceKm == null ? null : formatDistance(distanceKm),
      ]
        .filter(Boolean)
        .join(" · ")}
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
