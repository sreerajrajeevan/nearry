const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Forces the JS bundle to be packaged into debug APKs.
 * Without this, `assembleDebug` produces an APK that expects a running
 * Metro server ("Unable to load script" red screen) instead of running
 * standalone from the APK.
 */
function withBundleInDebug(config) {
  return withAppBuildGradle(config, (cfg) => {
    const contents = cfg.modResults.contents;
    if (!contents.includes("bundleInDebug")) {
      cfg.modResults.contents = contents.replace(
        /react\s*\{/,
        "react {\n    // withBundleInDebug: package JS so the debug APK runs without Metro\n    bundleInDebug = true"
      );
    }
    return cfg;
  });
}

module.exports = withBundleInDebug;
