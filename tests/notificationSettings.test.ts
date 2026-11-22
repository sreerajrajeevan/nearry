import { test } from "node:test";
import assert from "node:assert/strict";
import { toDbNewPost } from "../src/services/mappers";

const base = {
  title: "Football tonight",
  description: "Need two players",
  startsAt: "2026-11-17T13:30:00.000Z",
  vacancies: 2,
  tags: [],
};

test("urgent and auto-accept are sent only when switched on", () => {
  const plain = toDbNewPost("u1", base);
  assert.equal("urgent" in plain, false);
  assert.equal("auto_accept" in plain, false);
  const urgent = toDbNewPost("u1", { ...base, urgent: true, autoAccept: true });
  assert.equal(urgent.urgent, true);
  assert.equal(urgent.auto_accept, true);
});

test("demo notification preferences: all on by default, switches and area stick", async () => {
  const { setDemoMode } = await import("../src/services/supabase");
  const { notificationPreferences, setNotificationCategory, setAlertArea } =
    await import("../src/services/safety");
  setDemoMode(true);
  try {
    const first = await notificationPreferences();
    assert.deepEqual(
      [first.messages, first.plans, first.bookings, first.nearby],
      [true, true, true, true],
    );
    assert.equal(first.alertArea?.label, "Kakkanad");
    await setNotificationCategory("nearby", false);
    assert.equal((await notificationPreferences()).nearby, false);
    await setAlertArea(null);
    assert.equal((await notificationPreferences()).alertArea, null);
    await setAlertArea({
      label: "Edappally",
      latitude: 10.02,
      longitude: 76.3,
      source: "google",
      acquiredAt: new Date().toISOString(),
    });
    assert.equal(
      (await notificationPreferences()).alertArea?.label,
      "Edappally",
    );
  } finally {
    setDemoMode(false);
  }
});

test("older servers without the new keys read as everything on", async () => {
  const { normalizeNotificationPreferences } =
    await import("../src/services/safety");
  assert.deepEqual(normalizeNotificationPreferences({ pushEnabled: true }), {
    pushEnabled: true,
    messages: true,
    plans: true,
    bookings: true,
    nearby: true,
    alertArea: null,
  });
  assert.equal(normalizeNotificationPreferences(null).pushEnabled, false);
});

test("settings list the four switches in order; businesses only see two", async () => {
  const { NOTIFICATION_SWITCHES, switchesFor, AREA_SIGNUP_HINT } = await import(
    "../src/utils/notificationSettings"
  );
  assert.deepEqual(
    NOTIFICATION_SWITCHES.map((s: { label: string }) => s.label),
    ["Messages", "Plan requests and updates", "Bookings", "Nearby players needed"],
  );
  assert.deepEqual(
    switchesFor("business").map((s: { key: string }) => s.key),
    ["messages", "bookings"],
  );
  assert.equal(switchesFor("personal").length, 4);
  assert.equal(
    AREA_SIGNUP_HINT,
    "Add your area to hear when nearby players are needed.",
  );
});
