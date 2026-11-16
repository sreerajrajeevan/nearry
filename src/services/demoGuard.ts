import { isDemoMode } from "./supabase";
import { demoBlockedMessage, isDemoBlockedMessage } from "./demoMessage";
import { Alert } from "./appAlert";

/**
 * The demo shows sample data only. Anything that would post, contact people,
 * book, edit or report is refused here, before any mock data changes.
 */
export class DemoBlockedError extends Error {
  constructor(action: string) {
    super(demoBlockedMessage(action));
    this.name = "DemoBlockedError";
  }
}

export function assertLive(action: string) {
  if (!isDemoMode()) return;
  const error = new DemoBlockedError(action);
  // Shown here so every blocked action explains itself, even where a screen
  // only shows errors inline. The alert queue drops the screen's duplicate.
  Alert.alert("", error.message);
  throw error;
}

export function isDemoBlocked(error: unknown) {
  return (
    error instanceof DemoBlockedError ||
    (error instanceof Error && isDemoBlockedMessage(error.message))
  );
}
