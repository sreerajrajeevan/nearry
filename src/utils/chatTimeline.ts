/**
 * Turns a chat's messages (and, for plan chats, its join/leave log) into the
 * rows the chat screen draws: day chips, centred event lines, and messages
 * marked with where they sit in a run from the same person.
 */
export type TimelineMessage = {
  id: string;
  senderId: string;
  senderName?: string;
  body: string;
  createdAt: string;
  mine: boolean;
};

export type MembershipEvent = {
  id: string;
  userId: string;
  name: string;
  kind: "joined" | "left" | "removed";
  createdAt: string;
};

export type TimelineItem<M extends TimelineMessage = TimelineMessage> =
  | { type: "day"; key: string; label: string }
  | { type: "event"; key: string; text: string }
  | {
      type: "message";
      key: string;
      message: M;
      /** First of a run: show the avatar and name (group chats). */
      firstInRun: boolean;
      /** Last of a run: show the time and the bubble's tail. */
      lastInRun: boolean;
      emojiOnly: boolean;
    };

/** Messages from one person within this gap stay in one run. */
export const RUN_GAP_MS = 5 * 60 * 1000;

/** Name colours for group chats; each is at least 4.5:1 on white. */
export const NAME_COLOURS = [
  "#B42318",
  "#1D4ED8",
  "#047857",
  "#7C3AED",
  "#B45309",
  "#BE185D",
  "#0E7490",
  "#4D7C0F",
];

export function nameColour(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return NAME_COLOURS[hash % NAME_COLOURS.length];
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function dayLabel(date: Date, now: Date): string {
  if (dayKey(date) === dayKey(now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return "Yesterday";
  const dm = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear()
    ? `${DAYS[date.getDay()]}, ${dm}`
    : `${dm} ${date.getFullYear()}`;
}

export function eventText(event: MembershipEvent, myId: string): string {
  const who = event.userId === myId ? "You" : event.name;
  if (event.kind === "joined") return `${who} joined`;
  if (event.kind === "left") return `${who} left`;
  return event.userId === myId
    ? "You are no longer in the plan"
    : `${who} is no longer in the plan`;
}

// Built on first use so an engine without Unicode property support shows
// emoji in a normal bubble instead of failing to load the chat.
let patterns: { pictograph: RegExp; parts: RegExp } | null | undefined;
function emojiPatterns() {
  if (patterns === undefined) {
    try {
      patterns = {
        pictograph: new RegExp("\\p{Extended_Pictographic}", "gu"),
        // Joiners, variation selectors, skin tones and flags ride along with emoji.
        parts: new RegExp(
          "[\\u200d\\ufe0f\\s]|\\p{Emoji_Modifier}|\\p{Regional_Indicator}",
          "gu",
        ),
      };
    } catch {
      patterns = null;
    }
  }
  return patterns;
}

/** Up to 6 emoji and nothing else: shown large, without a bubble. */
export function isEmojiOnly(text: string): boolean {
  const p = emojiPatterns();
  if (!p) return false;
  const pictographs = text.match(p.pictograph)?.length ?? 0;
  if (pictographs === 0 || pictographs > 6) return false;
  return text.replace(p.parts, "").replace(p.pictograph, "") === "";
}

export function buildTimeline<M extends TimelineMessage>(
  messages: M[],
  events: MembershipEvent[],
  options: { now: Date; myId: string },
): TimelineItem<M>[] {
  type Entry =
    | { at: number; kind: "message"; message: M }
    | { at: number; kind: "event"; event: MembershipEvent };
  const entries: Entry[] = [
    ...messages.map((message) => ({
      at: Date.parse(message.createdAt),
      kind: "message" as const,
      message,
    })),
    ...events.map((event) => ({
      at: Date.parse(event.createdAt),
      kind: "event" as const,
      event,
    })),
  ].sort((a, b) => a.at - b.at);

  const items: TimelineItem<M>[] = [];
  let lastDay = "";
  let previous: Entry | null = null;
  entries.forEach((entry, index) => {
    const date = new Date(entry.at);
    const day = dayKey(date);
    const newDay = day !== lastDay;
    if (newDay) {
      items.push({
        type: "day",
        key: `day-${day}`,
        label: dayLabel(date, options.now),
      });
      lastDay = day;
    }
    if (entry.kind === "event") {
      items.push({
        type: "event",
        key: `event-${entry.event.id}`,
        text: eventText(entry.event, options.myId),
      });
      previous = entry;
      return;
    }
    const next = entries[index + 1];
    const continues = (a: Entry | null | undefined, b: Entry | undefined) =>
      !!a &&
      !!b &&
      a.kind === "message" &&
      b.kind === "message" &&
      a.message.senderId === b.message.senderId &&
      dayKey(new Date(a.at)) === dayKey(new Date(b.at)) &&
      b.at - a.at <= RUN_GAP_MS;
    items.push({
      type: "message",
      key: entry.message.id,
      message: entry.message,
      firstInRun: newDay || !continues(previous, entry),
      lastInRun: !continues(entry, next),
      emojiOnly: isEmojiOnly(entry.message.body),
    });
    previous = entry;
  });
  return items;
}
