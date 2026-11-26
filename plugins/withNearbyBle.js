const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Plans around you (Bluetooth). Adds the Bluetooth permissions and the
 * plan-sharing service only to builds made with EXPO_PUBLIC_AROUND_YOU=1, so
 * store builds don't ask for Bluetooth until the feature is switched on.
 */
const PERMISSIONS = [
  { name: "android.permission.BLUETOOTH", maxSdkVersion: "30" },
  { name: "android.permission.BLUETOOTH_ADMIN", maxSdkVersion: "30" },
  { name: "android.permission.BLUETOOTH_SCAN", usesPermissionFlags: "neverForLocation" },
  { name: "android.permission.BLUETOOTH_ADVERTISE" },
  { name: "android.permission.FOREGROUND_SERVICE" },
  { name: "android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" },
];
const SERVICE = "expo.modules.nearbyble.PlanBeaconService";

function aroundYouEnabled() {
  return process.env.EXPO_PUBLIC_AROUND_YOU?.trim() === "1";
}

/** Adds the permissions, feature and service to a parsed AndroidManifest. */
function addNearbyBle(manifest) {
    manifest.$["xmlns:tools"] ??= "http://schemas.android.com/tools";
    manifest["uses-permission"] ??= [];
    for (const p of PERMISSIONS) {
      manifest["uses-permission"] = manifest["uses-permission"].filter(
        (u) => u.$["android:name"] !== p.name,
      );
      const attrs = { "android:name": p.name };
      if (p.maxSdkVersion) attrs["android:maxSdkVersion"] = p.maxSdkVersion;
      if (p.usesPermissionFlags) {
        attrs["android:usesPermissionFlags"] = p.usesPermissionFlags;
        attrs["tools:targetApi"] = "s";
      }
      manifest["uses-permission"].push({ $: attrs });
    }
    manifest["uses-feature"] ??= [];
    if (!manifest["uses-feature"].some((f) => f.$["android:name"] === "android.hardware.bluetooth_le"))
      manifest["uses-feature"].push({
        $: { "android:name": "android.hardware.bluetooth_le", "android:required": "false" },
      });
    const app = manifest.application[0];
    app.service ??= [];
    if (!app.service.some((s) => s.$["android:name"] === SERVICE))
      app.service.push({
        $: {
          "android:name": SERVICE,
          "android:exported": "false",
          "android:foregroundServiceType": "connectedDevice",
        },
      });
  return manifest;
}

function withNearbyBle(config) {
  if (!aroundYouEnabled()) return config;
  return withAndroidManifest(config, (cfg) => {
    addNearbyBle(cfg.modResults.manifest);
    return cfg;
  });
}

module.exports = withNearbyBle;
module.exports.aroundYouEnabled = aroundYouEnabled;
module.exports.addNearbyBle = addNearbyBle;
