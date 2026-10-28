import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
// Node-only release helpers intentionally do not depend on native modules.
// @ts-expect-error JavaScript build helper
import {
  releaseProblems,
  firebaseProblems,
} from "../scripts/check-release.mjs";
const require = createRequire(import.meta.url);
const {
  stripDebugReleaseSigning,
} = require("../plugins/withReleaseSigning.js");
const valid = {
  EXPO_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_testfixture",
  EXPO_PUBLIC_EAS_PROJECT_ID: "12345678-1234-1234-1234-123456789abc",
  EXPO_PUBLIC_LEGAL_OWNER: "Nearry operator",
  EXPO_PUBLIC_SUPPORT_EMAIL: "support@nearry.app",
};

test("Android release requires Firebase configuration for this package", () => {
  assert.equal(firebaseProblems(undefined).length, 1);
  assert.equal(
    firebaseProblems({ project_info: { project_number: "123" }, client: [] })
      .length,
    1,
  );
  assert.deepEqual(
    firebaseProblems({
      project_info: { project_number: "123" },
      client: [
        {
          client_info: {
            android_client_info: { package_name: "com.nearry.app" },
          },
        },
      ],
    }),
    [],
  );
});

test("release preflight rejects missing configuration and absent generated images", () => {
  assert.equal(releaseProblems({}, () => false).length, 6);
  assert.deepEqual(
    releaseProblems(valid, () => true),
    [],
  );
  assert.equal(releaseProblems(valid, () => false).length, 1);
});
test("release preflight rejects private Supabase keys without exposing them", () => {
  for (const key of [
    "sb_secret_privatefixture",
    `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`,
  ]) {
    const problems = releaseProblems(
      { ...valid, EXPO_PUBLIC_SUPABASE_ANON_KEY: key },
      () => true,
    );
    assert.equal(problems.length, 1);
    assert.ok(!problems.join().includes(key));
  }
  const anon = `header.${Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url")}.signature`;
  assert.deepEqual(
    releaseProblems(
      { ...valid, EXPO_PUBLIC_SUPABASE_ANON_KEY: anon },
      () => true,
    ),
    [],
  );
});
test("release preflight rejects placeholder contacts and insecure backend URLs", () => {
  assert.equal(
    releaseProblems(
      {
        ...valid,
        EXPO_PUBLIC_SUPABASE_URL: "http://localhost:54321",
        EXPO_PUBLIC_SUPPORT_EMAIL: "support@example.com",
      },
      () => true,
    ).length,
    2,
  );
});
test("release never inherits the shared debug key; debug builds keep it", () => {
  const input = `android {
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}`;
  const output = stripDebugReleaseSigning(input);
  assert.match(output, /debug\s*\{\s*signingConfig signingConfigs.debug/);
  assert.doesNotMatch(output, /release\s*\{\s*signingConfig/);
  assert.equal(stripDebugReleaseSigning(output), output);
  assert.throws(
    () => stripDebugReleaseSigning("android {}"),
    /Release build type missing/,
  );
});
