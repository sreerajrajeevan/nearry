import { test } from "node:test";
import assert from "node:assert/strict";

test("demo feed: plans anywhere come back nearest first, with no distance limit", async () => {
  const { setDemoMode } = await import("../src/services/supabase");
  const { listPostsPage } = await import("../src/services/posts");
  setDemoMode(true);
  try {
    const point = { latitude: 9.9312, longitude: 76.2673 };
    const near = await listPostsPage(
      { nearby: { ...point, radiusM: 100 }, sort: "nearest" },
      null,
      80,
    );
    const anywhere = await listPostsPage(
      { anywhere: point, sort: "nearest" },
      null,
      80,
    );
    assert.ok(anywhere.items.length > near.items.length);
    const km = anywhere.items.map((p) => p.distanceKm ?? Infinity);
    assert.ok(km.every((d) => Number.isFinite(d)));
    assert.deepEqual(
      km,
      [...km].sort((a, b) => a - b),
    );
  } finally {
    setDemoMode(false);
  }
});
