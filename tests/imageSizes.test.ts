import { test } from "node:test";
import assert from "node:assert/strict";
import { IMAGE_SIZES, shrinkToFit } from "../src/utils/imageSizes";

test("uploads are stored small: avatar 512px, photo 1280px, thumbnail 480px, ~70% quality", () => {
  assert.deepEqual(IMAGE_SIZES.avatar, { max: 512, quality: 0.72 });
  assert.deepEqual(IMAGE_SIZES.photo, { max: 1280, quality: 0.72 });
  assert.deepEqual(IMAGE_SIZES.thumbnail, { max: 480, quality: 0.7 });
});

test("shrinkToFit scales the longer side down and never enlarges a small image", () => {
  assert.deepEqual(shrinkToFit(4000, 3000, 1280), [
    { resize: { width: 1280 } },
  ]);
  assert.deepEqual(shrinkToFit(3000, 4000, 1280), [
    { resize: { height: 1280 } },
  ]);
  assert.deepEqual(shrinkToFit(1080, 1080, 512), [{ resize: { width: 512 } }]);
  assert.deepEqual(shrinkToFit(400, 300, 512), []);
  assert.deepEqual(shrinkToFit(512, 512, 512), []);
});
