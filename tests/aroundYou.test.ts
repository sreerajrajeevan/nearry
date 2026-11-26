import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aroundYouEnabled,
  bluetoothProblem,
  heardCodes,
  shareHereAllowed,
  sharingUntilLabel,
} from "../src/utils/aroundYou";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addNearbyBle } = require("../plugins/withNearbyBle.js");

const now = Date.parse("2026-11-26T12:00:00Z");
const at = (min: number) => new Date(now + min * 60_000);

test("the feature only shows in builds made with EXPO_PUBLIC_AROUND_YOU=1", () => {
  assert.equal(aroundYouEnabled("1"), true);
  assert.equal(aroundYouEnabled(" 1 "), true);
  assert.equal(aroundYouEnabled(undefined), false);
  assert.equal(aroundYouEnabled("true"), false);
  assert.equal(aroundYouEnabled(""), false);
});

test("a plan can be shared right here from 2 hours before until 30 minutes after it starts", () => {
  assert.equal(shareHereAllowed(at(40), now), true);
  assert.equal(shareHereAllowed(at(120), now), true);
  assert.equal(shareHereAllowed(at(121), now), false);
  assert.equal(shareHereAllowed(at(-29), now), true);
  assert.equal(shareHereAllowed(at(-30), now), false);
  assert.equal(shareHereAllowed(null, now), false);
});

test("codes heard over several scans are kept once, strongest first, at most 64", () => {
  const heard = new Map<string, number>();
  heardCodes(heard, [
    { code: "aaaaaaaaaaaaaaaa", rssi: -80 },
    { code: "bbbbbbbbbbbbbbbb", rssi: -60 },
  ]);
  const list = heardCodes(heard, [
    { code: "aaaaaaaaaaaaaaaa", rssi: -50 },
    { code: "not-a-code", rssi: -40 },
  ]);
  assert.deepEqual(list, ["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb"]);
  const many = Array.from({ length: 80 }, (_, i) => ({
    code: i.toString(16).padStart(16, "0"),
    rssi: -i,
  }));
  assert.equal(heardCodes(new Map(), many).length, 64);
});

test("Bluetooth problems are explained in plain words", () => {
  assert.match(bluetoothProblem("BLUETOOTH_OFF"), /Turn on Bluetooth/);
  assert.match(bluetoothProblem("PERMISSION"), /Nearby devices/);
  assert.match(bluetoothProblem("NO_ADVERTISING"), /can't share/);
  assert.match(bluetoothProblem("SOMETHING_ELSE"), /try again/);
});

test("the host sees until when the plan is shared, in India time", () => {
  assert.equal(
    sharingUntilLabel(Date.parse("2026-11-26T14:00:00Z")),
    "Sharing until 7:30 pm",
  );
});

test("the Bluetooth permissions and service are added once to the Android manifest", () => {
  const manifest: any = {
    $: {},
    application: [{ $: {} }],
    "uses-permission": [
      { $: { "android:name": "android.permission.BLUETOOTH" } },
    ],
  };
  addNearbyBle(addNearbyBle(manifest));
  const names = manifest["uses-permission"].map(
    (p: any) => p.$["android:name"],
  );
  assert.deepEqual(names.sort(), [
    "android.permission.BLUETOOTH",
    "android.permission.BLUETOOTH_ADMIN",
    "android.permission.BLUETOOTH_ADVERTISE",
    "android.permission.BLUETOOTH_SCAN",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE",
  ]);
  const scan = manifest["uses-permission"].find(
    (p: any) => p.$["android:name"] === "android.permission.BLUETOOTH_SCAN",
  );
  assert.equal(scan.$["android:usesPermissionFlags"], "neverForLocation");
  assert.equal(manifest.application[0].service.length, 1);
  assert.equal(
    manifest.application[0].service[0].$["android:foregroundServiceType"],
    "connectedDevice",
  );
});
