/** Match specific activities before broad category tags; never choose randomly. */
export type ActivityArtwork =
  | "football"
  | "badminton"
  | "cricket"
  | "coffee"
  | "games"
  | "food"
  | "kayak"
  | "cycling"
  | "cinema"
  | "music"
  | "wellness"
  | "gathering";
export function activityArtwork(item: {
  title: string;
  description?: string;
  tags?: string[];
}): ActivityArtwork {
  const text =
    `${item.title} ${item.description ?? ""} ${(item.tags ?? []).join(" ")}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const subjects: [ActivityArtwork, RegExp][] = [
    ["badminton", /\b(badminton|shuttle|shuttlecock)\b/i],
    ["cricket", /\b(cricket|wicket|batting)\b/i],
    ["football", /\b(football|soccer|futsal|turf)\b/i],
    ["kayak", /\b(kayak\w*|canoe\w*|paddl\w*|backwater\w*)\b/i],
    ["cycling", /\b(cycl\w*|bicycl\w*|bik\w*)\b/i],
    ["cinema", /\b(cinema|movies?|film|screening)\b/i],
    ["music", /\b(music|guitar|concert|sing\w*|jam|karaoke)\b/i],
    [
      "wellness",
      /\b(yoga|meditation|salon|spa|massage|wellness|haircut|unwind)\b/i,
    ],
    ["games", /\b(chess|board\s*games?|games?|carrom|cards)\b/i],
    ["coffee", /\b(coffee|cafe|tea|chaya|chai|brunch)\b/i],
    ["food", /\b(food|dining|restaurant|lunch|dinner|noodles|meal|eat\w*)\b/i],
  ];
  // A precise title should win over a generic tag such as "sports" or "food".
  const title = item.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (
    subjects.find(([, pattern]) => pattern.test(title))?.[0] ??
    subjects.find(([, pattern]) => pattern.test(text))?.[0] ??
    (/\bsports?\b/i.test(text) ? "football" : "gathering")
  );
}
