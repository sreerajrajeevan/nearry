import { test } from "node:test";
import assert from "node:assert/strict";
import { beginCropGesture, moveCropGesture } from "../src/utils/cropGesture";
import { cropGeometry } from "../src/utils/photoCrop";

test("dragging an avatar moves the photo and exports the same square region", () => {
  const image = { width: 1600, height: 800 };
  const frame = { width: 300, height: 300 };
  const g = cropGeometry(image, frame, 1, { x: 0, y: 0 });
  const start = beginCropGesture(
    [{ x: 120, y: 170 }],
    1,
    g,
    { x: 0, y: 0 },
    frame,
  )!;
  const next = moveCropGesture(start, [{ x: 270, y: 170 }])!;
  const moved = cropGeometry(image, frame, next.zoom, next.offset);
  assert.equal(next.zoom, 1);
  assert.deepEqual(moved.crop, {
    originX: 0,
    originY: 0,
    width: 800,
    height: 800,
  });
  // Dragging past the edge cannot expose a blank strip in the circular preview.
  const edge = moveCropGesture(start, [{ x: 9999, y: -9999 }])!;
  assert.deepEqual(
    cropGeometry(image, frame, edge.zoom, edge.offset).crop,
    moved.crop,
  );
});

test("pinching preserves the image point under the fingers while also panning", () => {
  const start = beginCropGesture(
    [
      { x: 100, y: 90 },
      { x: 200, y: 90 },
    ],
    2,
    { x: 20, y: -10 },
    { x: 0, y: 0 },
    { width: 300, height: 300 },
  )!;
  const next = moveCropGesture(start, [
    { x: 80, y: 60 },
    { x: 280, y: 60 },
  ])!;
  assert.equal(next.zoom, 4);
  assert.deepEqual(next.offset, { x: 70, y: 10 });
  assert.equal((30 - next.offset.x) / 2, start.anchor.x - start.offset.x);
  assert.equal((-90 - next.offset.y) / 2, start.anchor.y - start.offset.y);
});

test("lifting a finger rebases the gesture, and zoom stays within 1–4", () => {
  const frame = { width: 240, height: 240 };
  const start = beginCropGesture(
    [
      { x: 100, y: 120 },
      { x: 140, y: 120 },
    ],
    2,
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    frame,
  )!;
  assert.equal(moveCropGesture(start, [{ x: 120, y: 120 }]), null);
  const rebased = beginCropGesture(
    [{ x: 120, y: 120 }],
    2,
    { x: 30, y: 10 },
    { x: 0, y: 0 },
    frame,
  )!;
  assert.deepEqual(moveCropGesture(rebased, [{ x: 125, y: 120 }]), {
    zoom: 2,
    offset: { x: 35, y: 10 },
  });
  assert.equal(
    moveCropGesture(start, [
      { x: -1000, y: 120 },
      { x: 1000, y: 120 },
    ])!.zoom,
    4,
  );
  assert.equal(
    moveCropGesture(start, [
      { x: 119, y: 120 },
      { x: 121, y: 120 },
    ])!.zoom,
    1,
  );
  assert.equal(
    beginCropGesture([], 1, { x: 0, y: 0 }, { x: 0, y: 0 }, frame),
    null,
  );
});
