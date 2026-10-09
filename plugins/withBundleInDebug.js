const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Forces the JS bundle to be packaged into debug APKs.
 *
 * The react-native-gradle-plugin skips bundling for variants listed in
 * `debuggableVariants` (default: ["debug"]) — those APKs expect a running
 * Metro server and show "Unable to load script" without one. Clearing the
 * list makes the debug APK bundle JS and run standalone.
 *
 * NOTE: Expo's template ships a COMMENTED-OUT debuggableVariants line, so
 * a naive "already present" check skips patching. We strip any existing
 * assignment (commented or not) and insert ours.
 */
function withBundleInDebug(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    contents = contents.replace(/^[ \t]*(\/\/[ \t]*)?debuggableVariants\s*=[^\n]*\r?$/gm, "");
    const patched = contents.replace(
      /react\s*\{/,
      "react {\n    // withBundleInDebug: bundle JS even for debuggable variants\n    debuggableVariants = []"
    );
    if (patched === contents) {
      throw new Error("[withBundleInDebug] react{} block not found in app/build.gradle");
    }
    cfg.modResults.contents = patched;
    console.log("[withBundleInDebug] debuggableVariants = [] applied");
    return cfg;
  });
}

module.exports = withBundleInDebug;
