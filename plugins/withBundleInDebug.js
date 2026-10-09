const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Forces the JS bundle to be packaged into debug APKs.
 *
 * The react-native-gradle-plugin skips bundling for variants listed in
 * `debuggableVariants` (default: ["debug"]) — those APKs expect a running
 * Metro server and show "Unable to load script" without one. Clearing the
 * list makes the debug APK bundle JS and run standalone.
 */
function withBundleInDebug(config) {
  return withAppBuildGradle(config, (cfg) => {
    const contents = cfg.modResults.contents;
    if (!contents.includes("debuggableVariants")) {
      cfg.modResults.contents = contents.replace(
        /react\s*\{/,
        "react {\n    // withBundleInDebug: bundle JS even for debuggable variants\n    debuggableVariants = []"
      );
    }
    return cfg;
  });
}

module.exports = withBundleInDebug;
