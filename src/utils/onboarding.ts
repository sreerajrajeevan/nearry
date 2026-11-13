export const ONBOARDING_DAYS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;
export const ONBOARDING_TIMES = [
  "Morning",
  "Afternoon",
  "Evening",
  "Night",
] as const;
export const ONBOARDING_RADII = [2, 5, 10, 25] as const;
export type OnboardingRadius = (typeof ONBOARDING_RADII)[number];
export type OnboardingArea = {
  label: string;
  latitude: number;
  longitude: number;
  source: string;
  acquiredAt: string;
};
export type OnboardingPreferences = {
  days: string[];
  times: string[];
  radiusKm: OnboardingRadius;
  area?: OnboardingArea;
};

/** Local calendar arithmetic only. A birthday is never sent to the server. */
export function ageFromBirthday(
  value: string,
  today = new Date(),
): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return null;
  const age =
    today.getFullYear() -
    year -
    (today.getMonth() < month - 1 ||
    (today.getMonth() === month - 1 && today.getDate() < day)
      ? 1
      : 0);
  return age >= 18 && age <= 100 ? age : null;
}
export function birthdayString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Owner-only preferences. Ignore malformed points and expired provider caches. */
export function onboardingPreferences(
  value: unknown,
  now = Date.now(),
): OnboardingPreferences {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const array = (key: string, allowed: readonly string[]) =>
    Array.isArray(raw[key])
      ? [
          ...new Set(
            raw[key].filter(
              (v): v is string => typeof v === "string" && allowed.includes(v),
            ),
          ),
        ]
      : [];
  const prefs: OnboardingPreferences = {
    days: array("days", ONBOARDING_DAYS),
    times: array("times", ONBOARDING_TIMES),
    radiusKm: ONBOARDING_RADII.includes(raw.radiusKm as OnboardingRadius)
      ? (raw.radiusKm as OnboardingRadius)
      : 5,
  };
  const area = raw.area as Partial<OnboardingArea> | undefined;
  if (
    area &&
    typeof area.label === "string" &&
    area.label.trim().length > 0 &&
    area.label.length <= 200 &&
    typeof area.latitude === "number" &&
    typeof area.longitude === "number" &&
    Number.isFinite(area.latitude) &&
    Number.isFinite(area.longitude) &&
    Math.abs(area.latitude) <= 90 &&
    Math.abs(area.longitude) <= 180 &&
    typeof area.source === "string" &&
    typeof area.acquiredAt === "string"
  ) {
    const acquired = Date.parse(area.acquiredAt);
    // All discovery points expire rather than keeping provider location data indefinitely.
    if (
      Number.isFinite(acquired) &&
      acquired <= now &&
      now - acquired < 29 * 86400000
    )
      prefs.area = area as OnboardingArea;
  }
  return prefs;
}

export function onboardingLane(
  role: "personal" | "business" | null,
  needed: boolean,
  deferred: boolean,
  celebration: boolean,
) {
  if (!role || (!celebration && (!needed || (role === "personal" && deferred))))
    return null;
  return role;
}
