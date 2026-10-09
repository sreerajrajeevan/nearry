const { withAppBuildGradle, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Uses one shared debug keystore for every CI build so test APKs install
 * as updates instead of demanding an uninstall each time.
 *
 * The keystore is committed as base64 text (ci/debug.keystore.b64) and
 * decoded into android/app/debug.keystore during prebuild. The debug
 * signing config is pointed at it (added only if the template lacks one).
 *
 * NOTE: this is a throwaway CI debug key, not a release/upload key.
 */
function withSharedDebugKeystore(config) {
  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const b64Path = path.join(cfg.modRequest.projectRoot, "ci", "debug.keystore.b64");
      const dest = path.join(cfg.modRequest.platformProjectRoot, "app", "debug.keystore");
      const b64 = fs.readFileSync(b64Path, "utf8").replace(/\s+/g, "");
      fs.writeFileSync(dest, Buffer.from(b64, "base64"));
      return cfg;
    },
  ]);

  config = withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    const hasDebugBlock = /signingConfigs\s*\{[\s\S]*?debug\s*\{/.test(contents);
    if (!hasDebugBlock) {
      const debugBlock = [
        "        debug {",
        "            storeFile file('debug.keystore')",
        "            storeType 'PKCS12'",
        "            storePassword 'android'",
        "            keyAlias 'androiddebugkey'",
        "            keyPassword 'android'",
        "        }",
      ].join("\n");
      contents = contents.replace(/(signingConfigs\s*\{)/, `$1\n${debugBlock}`);
    }
    cfg.modResults.contents = contents;
    return cfg;
  });

  return config;
}

module.exports = withSharedDebugKeystore;
