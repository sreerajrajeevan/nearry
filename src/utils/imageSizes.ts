/**
 * How big uploaded pictures are stored. Phones show a profile photo at most
 * ~170 px and a plan photo at screen width, so these keep them sharp at 3×
 * while cutting stored size roughly in half.
 */
export const IMAGE_SIZES = {
  avatar: { max: 512, quality: 0.72 },
  photo: { max: 1280, quality: 0.72 },
  thumbnail: { max: 480, quality: 0.7 },
} as const;

type Resize = { resize: { width: number } | { height: number } };

/** Resize so the longer side is at most `max`; never enlarges a small image. */
export function shrinkToFit(
  width: number,
  height: number,
  max: number,
): Resize[] {
  if (Math.max(width, height) <= max) return [];
  return [{ resize: width >= height ? { width: max } : { height: max } }];
}
