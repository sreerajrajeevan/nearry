export type Size = { width: number; height: number };
export type Offset = { x: number; y: number };
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
/** One geometry calculation drives both preview and exported pixel bounds. */
export function cropGeometry(
  image: Size,
  frame: Size,
  zoom: number,
  offset: Offset,
) {
  if (
    ![image.width, image.height, frame.width, frame.height, zoom].every(
      (n) => Number.isFinite(n) && n > 0,
    )
  )
    throw new Error("Photo dimensions are unavailable.");
  const scale =
    Math.max(frame.width / image.width, frame.height / image.height) *
    clamp(zoom, 1, 4);
  const width = image.width * scale,
    height = image.height * scale;
  const x = clamp(
    offset.x,
    -(width - frame.width) / 2,
    (width - frame.width) / 2,
  );
  const y = clamp(
    offset.y,
    -(height - frame.height) / 2,
    (height - frame.height) / 2,
  );
  const cropWidth = Math.min(
    image.width,
    Math.max(1, Math.round(frame.width / scale)),
  );
  const cropHeight = Math.min(
    image.height,
    Math.max(1, Math.round(frame.height / scale)),
  );
  return {
    width,
    height,
    x,
    y,
    crop: {
      originX: clamp(
        Math.round(((width - frame.width) / 2 - x) / scale),
        0,
        image.width - cropWidth,
      ),
      originY: clamp(
        Math.round(((height - frame.height) / 2 - y) / scale),
        0,
        image.height - cropHeight,
      ),
      width: cropWidth,
      height: cropHeight,
    },
  };
}
