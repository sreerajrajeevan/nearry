/** Shared by the demo guard and the alert queue; no app imports so tests stay light. */
export const DEMO_MARKER = "This is a demo with sample data";

export function demoBlockedMessage(action: string) {
  return `${DEMO_MARKER}, so you can't ${action} here. Create a free account to do it for real.`;
}

export function isDemoBlockedMessage(message?: string | null) {
  return !!message && message.startsWith(DEMO_MARKER);
}

/** Set by the demo bar so alerts can take people to sign-up. */
let leaveDemo: (() => void) | null = null;
export function setLeaveDemoHandler(handler: (() => void) | null) {
  leaveDemo = handler;
}
export function leaveDemoNow() {
  leaveDemo?.();
}
