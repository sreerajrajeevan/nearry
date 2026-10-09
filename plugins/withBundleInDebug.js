const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Forces the JS bundle to be packaged into debug APKs.
 *
 * The react-native-gradle-plugin skips bundling for variants listed in
 * `debuggableVariants` (default: ["debug"]) — those APKs expect a running
 * Metro server and show "Unable to load script" without one. Clearing the
 * list makes the debug APK bundle JS and run standalone.
 *
 * Diagnostic: prints the patched react{} block to the prebuild log so a
 * mis-patch is visible in CI output ([withBundleInDebug]).
 */
function withBundleInDebug(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (!contents.includes("debuggableVariants")) {
      contents = contents.replace(
        /react\s*\{/,
        "react {\n    // withBundleInDebug: bundle JS even for debuggable variants\n    debuggableVariants = []"
      );
      cfg.modResults.contents = contents;
      console.log("[withBundleInDebug] inserted debuggableVariants = []");
    } else {
      console.log("[withBundleInDebug] debuggableVariants already present, skipping insert");
    }
    const block = cfg.modResults.contents.match(/react\s*\{[\s\S]*?\n\}/);
    console.log("[withBundleInDebug] react block now:\n" + (block ? block[0] : "(react block NOT FOUND)"));
    return cfg;
  });
}

module.exports = withBundleInDebug;
