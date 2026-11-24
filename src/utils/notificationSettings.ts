import type { NotificationCategory } from "../services/safety";

export type NotificationSwitch = {
  key: NotificationCategory;
  label: string;
  hint: string;
};

/** One switch per kind of push, in the order the settings screen shows them. */
export const NOTIFICATION_SWITCHES: NotificationSwitch[] = [
  { key: "messages", label: "Messages", hint: "Business and plan chats" },
  {
    key: "plans",
    label: "Plan requests and updates",
    hint: "Requests, approvals, changes and day-of reminders",
  },
  { key: "bookings", label: "Bookings", hint: "New, confirmed and cancelled" },
  {
    key: "nearby",
    label: "Nearby players needed",
    hint: "When a plan near your area is short of people",
  },
];

/** Businesses don't join plans, so they only see messages and bookings. */
export function switchesFor(
  accountType: "personal" | "business",
): NotificationSwitch[] {
  return accountType === "business"
    ? NOTIFICATION_SWITCHES.filter(
        (s) => s.key === "messages" || s.key === "bookings",
      )
    : NOTIFICATION_SWITCHES;
}

export const AREA_SIGNUP_HINT =
  "Add your area to hear when nearby players are needed.";
