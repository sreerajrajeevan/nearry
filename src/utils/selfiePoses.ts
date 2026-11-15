/** Pictures for the server's pose ids (wording comes from the server). */
const POSE_EMOJI: Record<string, string> = {
  thumbs_up: "👍",
  peace: "✌️",
  ok: "👌",
  point_up: "☝️",
  open_palm: "✋",
  call_me: "🤙",
  thinking: "🤔",
  wave: "👋",
};
export const poseEmoji = (pose: string) => POSE_EMOJI[pose] ?? "🙂";

/** "9:41" until the pose expires, then null. */
export function poseTimeLeft(expiresAt: string, now = new Date()) {
  const seconds = Math.ceil((Date.parse(expiresAt) - now.getTime()) / 1000);
  if (!(seconds > 0)) return null;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
