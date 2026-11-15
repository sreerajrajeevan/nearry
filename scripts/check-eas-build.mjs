import { checkRelease } from "./check-release.mjs";

// Preview APKs can still run with demo data; store builds require real settings.
if (["production", "play-test"].includes(process.env.EAS_BUILD_PROFILE))
  checkRelease();
