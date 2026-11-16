import type { NeedPost } from "../services/mappers";

/** Same content? Fresh copies of the same plan after a reload count as same. */
export function samePost(a: NeedPost, b: NeedPost) {
  if (a === b) return true;
  const keys = Object.keys(a) as (keyof NeedPost)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => {
    const x = a[key],
      y = b[key];
    if (x === y) return true;
    return (
      typeof x === "object" &&
      typeof y === "object" &&
      x !== null &&
      y !== null &&
      JSON.stringify(x) === JSON.stringify(y)
    );
  });
}
