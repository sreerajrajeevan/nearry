import { test } from "node:test";
import assert from "node:assert/strict";
import { cropGeometry } from "../src/utils/photoCrop";
import {
  personalProfileReady,
  matchesPostAudience,
  validatePersonalDetails,
} from "../src/utils/profileReadiness";
import type { Profile } from "../src/services/mappers";
const complete = {
  displayName: "Neighbour",
  accountType: "personal",
  onboardingCompleted: true,
  roleSelected: true,
  gender: "female",
  age: 25,
  termsVersion: "2026-10-19",
} as Profile;
test("participation requires adult personal details and current agreement, not merely a Google session", () => {
  assert(personalProfileReady(complete));
  for (const patch of [
    { age: undefined },
    { gender: undefined },
    { age: 17 },
    { age: 25.5 },
    { onboardingCompleted: false },
    { roleSelected: false },
    { termsVersion: undefined },
    { displayName: "X" },
    { accountType: "business" },
  ])
    assert.equal(
      personalProfileReady({ ...complete, ...patch } as Profile),
      false,
    );
  assert.equal(
    validatePersonalDetails("Name", "female", "17")?.includes("18"),
    true,
  );
  assert.equal(
    validatePersonalDetails("Name", undefined, "25"),
    "Select your gender.",
  );
  assert.equal(validatePersonalDetails("Name", "other", "25"), null);
});
test("restricted audiences require the exact selected gender and Anyone includes every gender", () => {
  for (const gender of ["female", "male", "other", undefined] as const) {
    assert(matchesPostAudience({ genderPreference: "any" }, gender));
    assert(matchesPostAudience({}, gender));
    assert.equal(
      matchesPostAudience({ genderPreference: "female" }, gender),
      gender === "female",
    );
    assert.equal(
      matchesPostAudience({ genderPreference: "male" }, gender),
      gender === "male",
    );
  }
});
test("crop export follows the preview and clamps drags to image bounds for all aspect ratios", () => {
  const center = cropGeometry(
    { width: 4000, height: 2000 },
    { width: 300, height: 300 },
    1,
    { x: 0, y: 0 },
  );
  assert.deepEqual(center.crop, {
    originX: 1000,
    originY: 0,
    width: 2000,
    height: 2000,
  });
  assert.equal(
    cropGeometry(
      { width: 4000, height: 2000 },
      { width: 300, height: 300 },
      1,
      { x: 9999, y: 9999 },
    ).crop.originX,
    0,
  );
  for (const image of [
    { width: 4000, height: 2000 },
    { width: 600, height: 5000 },
    { width: 1, height: 1 },
  ])
    for (const ratio of [1, 4 / 3, 4 / 5])
      for (const zoom of [1, 2, 4])
        for (const x of [-9999, 0, 9999]) {
          const g = cropGeometry(
            image,
            { width: 240, height: 240 / ratio },
            zoom,
            { x, y: -x },
          );
          assert(g.crop.originX >= 0 && g.crop.originY >= 0);
          assert(g.crop.width >= 1 && g.crop.height >= 1);
          assert(g.crop.originX + g.crop.width <= image.width);
          assert(g.crop.originY + g.crop.height <= image.height);
        }
  assert.throws(
    () =>
      cropGeometry({ width: 0, height: 50 }, { width: 240, height: 240 }, 1, {
        x: 0,
        y: 0,
      }),
    /dimensions/,
  );
});
