import type { Offer } from "../services/mappers";
import { DiscoveryCategory, postCategory } from "./discovery";
export type OfferCategory = "all" | "fitness" | "sports" | "food" | "wellness";
export const OFFER_CATEGORIES: {
  key: OfferCategory;
  label: string;
  emoji: string;
}[] = [
  { key: "all", label: "All", emoji: "✨" },
  { key: "fitness", label: "Fitness", emoji: "🏋️" },
  { key: "sports", label: "Sports", emoji: "⚽" },
  { key: "food", label: "Food", emoji: "🥗" },
  { key: "wellness", label: "Wellness", emoji: "🧘" },
];
/** Derived from published copy; these tabs never invent a business classification. */
export function offerCategory(
  offer: Pick<Offer, "title" | "description" | "businessName">,
): OfferCategory {
  const text = `${offer.title} ${offer.description} ${offer.businessName}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (
    /\b(gym|fitness|workout|training|strength|pilates|crossfit)\b/i.test(text)
  )
    return "fitness";
  if (
    /\b(football|cricket|badminton|tennis|sports?|turf|court|swimming|cycling)\b/i.test(
      text,
    )
  )
    return "sports";
  if (
    /\b(food|cafe|coffee|restaurant|dining|lunch|dinner|brunch|meal|pizza|biriyani|biryani)\b/i.test(
      text,
    )
  )
    return "food";
  if (
    /\b(wellness|yoga|salon|spa|haircut|massage|meditation|unwind|relax)\b/i.test(
      text,
    )
  )
    return "wellness";
  return "all";
}
export function discoverOffers(
  offers: Offer[],
  category: OfferCategory,
  now = new Date(),
) {
  return offers.filter(
    (offer) =>
      offer.status === "live" &&
      Date.parse(offer.endsAt) > now.getTime() &&
      (offer.maxRedemptions == null ||
        offer.redemptions < offer.maxRedemptions) &&
      (category === "all" || offerCategory(offer) === category),
  );
}

const SHARED_CATEGORY: Record<
  Exclude<OfferCategory, "all">,
  DiscoveryCategory
> = {
  fitness: "Play",
  sports: "Play",
  food: "Meet",
  wellness: "Unwind",
};

/**
 * Places an offer in Home's shared category row (Play, Meet, Explore, Unwind).
 * Uses the offer classifier, which also reads the business name, and only
 * falls back to the plan classifier when the offer copy names no category.
 */
export function offerDiscoveryCategory(
  offer: Pick<Offer, "title" | "description" | "businessName">,
): DiscoveryCategory {
  const category = offerCategory(offer);
  return category === "all"
    ? postCategory({
        title: `${offer.title} ${offer.description} ${offer.businessName}`,
        tags: [],
      })
    : SHARED_CATEGORY[category];
}
