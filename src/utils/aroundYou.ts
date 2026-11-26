/**
 * Plans around you: hosts share a plan over Bluetooth with people in the
 * same place; others tap Look around. See docs/plans-around-you.md.
 */

/** Sharing is allowed from 2 hours before a plan starts... */
export const SHARE_BEFORE_MS = 2 * 60 * 60 * 1000;
/** ...until 30 minutes after it started (the database uses the same window). */
export const SHARE_AFTER_MS = 30 * 60 * 1000;
/** The database accepts at most this many codes per look. */
export const MAX_CODES = 64;

/** Only builds made with EXPO_PUBLIC_AROUND_YOU=1 show the feature. */
export function aroundYouEnabled(
  flag: string | undefined = process.env.EXPO_PUBLIC_AROUND_YOU,
): boolean {
  return flag?.trim() === "1";
}

export function shareHereAllowed(
  startsAt: Date | null,
  now = Date.now(),
): boolean {
  if (!startsAt) return false;
  const lead = startsAt.getTime() - now;
  return lead <= SHARE_BEFORE_MS && lead > -SHARE_AFTER_MS;
}

export type HeardCode = { code: string; rssi: number };

/**
 * Adds one scan's codes to everything heard so far (keeping each code's
 * strongest signal) and returns the codes to look up, strongest first.
 */
export function heardCodes(
  heard: Map<string, number>,
  found: HeardCode[],
): string[] {
  for (const { code, rssi } of found) {
    if (!/^[0-9a-f]{16}$/.test(code)) continue;
    const best = heard.get(code);
    if (best === undefined || rssi > best) heard.set(code, rssi);
  }
  return [...heard.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CODES)
    .map(([code]) => code);
}

/** Plain words for the Bluetooth module's error codes. */
export function bluetoothProblem(code: string | undefined): string {
  switch (code) {
    case "BLUETOOTH_OFF":
      return "Turn on Bluetooth and try again.";
    case "PERMISSION":
      return "Allow Nearby devices for Nearry in your phone's Settings, then try again.";
    case "NO_ADVERTISING":
      return "This phone can't share plans over Bluetooth.";
    default:
      return "Bluetooth didn't respond. Please try again.";
  }
}

export function sharingUntilLabel(endsMs: number): string {
  const time = new Date(endsMs)
    .toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    })
    .toLowerCase()
    .replace(/\s+/g, " ");
  return `Sharing until ${time}`;
}
