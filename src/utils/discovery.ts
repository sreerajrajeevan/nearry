import type { NeedPost, Venue } from "../services/mappers";

export type DiscoveryCategory = "Play" | "Meet" | "Unwind" | "Explore";
const play =
  /\b(football|cricket|sports?|games?|turf|match|badminton|tennis|running|run|cycling|swimming|swim|volleyball|basketball)\b/i;
const meet =
  /\b(coffee|cafe|restaurant|dining|meet|chat|dinner|lunch|drinks?|social|movie|tea|chaya|food|brunch)\b/i;
const unwind =
  /\b(salon|haircut|spa|massage|wellness|yoga|meditation|relax|unwind)\b/i;

export function postCategory(
  post: Pick<NeedPost, "title" | "tags">,
): DiscoveryCategory {
  const text = `${post.title} ${post.tags.join(" ")}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return play.test(text)
    ? "Play"
    : meet.test(text)
      ? "Meet"
      : unwind.test(text)
        ? "Unwind"
        : "Explore";
}
export function venueCategory(
  venue: Pick<Venue, "name" | "category">,
): DiscoveryCategory {
  return postCategory({ title: `${venue.name} ${venue.category}`, tags: [] });
}
