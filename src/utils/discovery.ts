import type { NeedPost, Venue } from "../services/mappers";

export type DiscoveryCategory = "Play" | "Meet" | "Explore";
const play =
  /\b(football|cricket|sports?|games?|turf|match|badminton|tennis|running|run|cycling|swimming|swim|volleyball|basketball)\b/i;
const meet =
  /\b(coffee|cafe|restaurant|dining|meet|chat|dinner|lunch|drinks?|social|movie|tea|food|brunch)\b/i;

export function postCategory(
  post: Pick<NeedPost, "title" | "tags">,
): DiscoveryCategory {
  const text = `${post.title} ${post.tags.join(" ")}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return play.test(text) ? "Play" : meet.test(text) ? "Meet" : "Explore";
}
export function venueCategory(
  venue: Pick<Venue, "name" | "category">,
): DiscoveryCategory {
  return postCategory({ title: `${venue.name} ${venue.category}`, tags: [] });
}
