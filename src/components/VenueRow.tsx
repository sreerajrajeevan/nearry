import React from "react";
import { Venue } from "../services/mappers";
import { venueCategory } from "../utils/discovery";
import { formatDistance } from "../utils/format";
import { DiscoveryCard } from "./DiscoveryCard";
import { activityArtwork } from "../utils/activityArtwork";

export function VenueRow({
  venue,
  onPress,
}: {
  venue: Venue;
  onPress: () => void;
}) {
  const category = venueCategory(venue);
  return (
    <DiscoveryCard
      kind="Place"
      artwork={activityArtwork({ title: `${venue.name} ${venue.category}` })}
      icon={
        category === "Play"
          ? "dribbble"
          : category === "Meet"
            ? "coffee"
            : category === "Unwind"
              ? "sun"
              : "map-pin"
      }
      title={venue.name}
      meta={[
        venue.category,
        venue.area,
        venue.distanceKm == null ? null : formatDistance(venue.distanceKm),
      ]
        .filter(Boolean)
        .join(" · ")}
      action="View place"
      onPress={onPress}
    />
  );
}
