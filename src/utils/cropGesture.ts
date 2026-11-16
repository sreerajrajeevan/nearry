import type { Offset, Size } from "./photoCrop";

type Point = { x: number; y: number };
export type CropGesture = {
  count: number;
  center: Point;
  anchor: Point;
  distance: number;
  zoom: number;
  offset: Offset;
};

function sample(touches: Point[]) {
  const first = touches[0];
  if (!first) return null;
  const second = touches[1];
  return {
    count: second ? 2 : 1,
    center: second
      ? { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
      : first,
    distance: second ? Math.hypot(first.x - second.x, first.y - second.y) : 0,
  };
}

export function beginCropGesture(
  touches: Point[],
  zoom: number,
  offset: Offset,
  frameOrigin: Point,
  frame: Size,
): CropGesture | null {
  const current = sample(touches);
  if (!current) return null;
  return {
    ...current,
    zoom,
    offset,
    anchor: {
      x: current.center.x - frameOrigin.x - frame.width / 2,
      y: current.center.y - frameOrigin.y - frame.height / 2,
    },
  };
}

/** Keep the image point under the fingers steady while pinching and panning. */
export function moveCropGesture(start: CropGesture, touches: Point[]) {
  const current = sample(touches);
  if (!current || current.count !== start.count) return null;
  const zoom = Math.min(
    4,
    Math.max(
      1,
      start.count === 2 && start.distance > 0
        ? (start.zoom * current.distance) / start.distance
        : start.zoom,
    ),
  );
  const factor = zoom / start.zoom;
  return {
    zoom,
    offset: {
      x:
        start.offset.x * factor +
        current.center.x -
        start.center.x +
        start.anchor.x * (1 - factor),
      y:
        start.offset.y * factor +
        current.center.y -
        start.center.y +
        start.anchor.y * (1 - factor),
    },
  };
}
