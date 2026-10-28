const { withAppBuildGradle } = require("@expo/config-plugins");

/** EAS injects the private upload key after prebuild. Never inherit debug signing. */
function stripDebugReleaseSigning(contents) {
  let found = false;
  const result = contents.replace(
    /(\brelease\s*\{)([\s\S]*?)(^\s*\})/m,
    (_, start, body, end) => {
      found = true;
      return (
        start +
        body.replace(/^\s*signingConfig\s+signingConfigs\.debug\s*$/gm, "") +
        end
      );
    },
  );
  if (!found)
    throw new Error(
      "Release build type missing; review Android signing before building.",
    );
  return result;
}

module.exports = (config) =>
  withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = stripDebugReleaseSigning(cfg.modResults.contents);
    return cfg;
  });
module.exports.stripDebugReleaseSigning = stripDebugReleaseSigning;
