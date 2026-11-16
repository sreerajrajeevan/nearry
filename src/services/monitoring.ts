import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { scrubBreadcrumb, scrubEvent } from "../utils/crashScrub";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

/** Crash reporting runs only in phone builds that were given a Sentry DSN. */
export const monitoringEnabled = !!dsn && Platform.OS !== "web";

export function initMonitoring() {
  if (!monitoringEnabled) return;
  Sentry.init({
    dsn,
    environment:
      process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT?.trim() ||
      (__DEV__ ? "development" : "production"),
    release: `nearry@${Constants.expoConfig?.version ?? "unknown"}`,
    // Privacy: no IP, user, screenshots or view trees; no performance tracing.
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    tracesSampleRate: 0,
    enableAutoSessionTracking: true,
    maxBreadcrumbs: 40,
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
    beforeSend: (event) => scrubEvent(event),
  });
}

/** Report a caught error that should not happen. Never includes the user. */
export function reportError(error: unknown, where: string) {
  if (!monitoringEnabled) return;
  Sentry.withScope((scope) => {
    scope.setTag("where", where);
    Sentry.captureException(error);
  });
}

/** Personal or business only, so crashes can be grouped by app side. */
export function setMonitoringAccount(type: "personal" | "business" | null) {
  if (monitoringEnabled) Sentry.setTag("account", type ?? "signed-out");
}

/** Screen names only (never route params), for the trail before a crash. */
export function trackScreen(name: string | undefined) {
  if (monitoringEnabled && name)
    Sentry.addBreadcrumb({ category: "navigation", message: name });
}
