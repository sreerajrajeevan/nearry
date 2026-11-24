/** Most people one offer slot can take (also enforced by the database). */
export const MAX_PLACES = 500;

/** While typing: digits only, no leading zeros, capped at the maximum. */
export function typedPlaces(text: string): string {
  const digits = text.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return Number(digits) > MAX_PLACES ? String(MAX_PLACES) : digits;
}

/** When the field loses focus: never empty or zero. */
export function settledPlaces(text: string): string {
  const n = Number(typedPlaces(text));
  return String(n >= 1 ? n : 1);
}
