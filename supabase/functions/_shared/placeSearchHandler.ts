import type { Place, PlaceProvider } from "./placeTypes.ts";
import { validPoint } from "./placeTypes.ts";
type Dependencies = {
  provider: PlaceProvider | null;
  authenticate: (authorization: string) => Promise<string | null>;
  reserve: (userId: string) => Promise<boolean>;
  now?: () => number;
};
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
export function createPlaceSearchHandler({
  provider,
  authenticate,
  reserve,
  now = Date.now,
}: Dependencies) {
  const cache = new Map<string, { expires: number; places: Place[] }>();
  const pending = new Map<string, Promise<Place[]>>();
  const json = (data: unknown, status = 200) =>
    Response.json(data, { status, headers });
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST")
      return json({ error: "Method not allowed." }, 405);
    try {
      const auth = req.headers.get("authorization") ?? "";
      if (!auth.startsWith("Bearer "))
        return json({ error: "Sign in to search places." }, 401);
      const userId = await authenticate(auth);
      if (!userId) return json({ error: "Sign in to search places." }, 401);
      if (!provider)
        return json({ error: "Place search is not configured yet." }, 503);
      if (Number(req.headers.get("content-length") ?? "0") > 2048)
        return json({ error: "Search is too long." }, 400);
      const text = await req.text();
      if (text.length > 2048)
        return json({ error: "Search is too long." }, 400);
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return json({ error: "Invalid search." }, 400);
      }
      if (
        !body ||
        typeof body.query !== "string" ||
        body.query.trim().length < 3 ||
        body.query.trim().length > 120 ||
        (body.bias !== undefined && !validPoint(body.bias))
      )
        return json(
          { error: "Enter 3–120 characters and a valid location." },
          400,
        );
      const query = body.query.trim();
      const bias =
        body.bias === undefined
          ? undefined
          : { latitude: body.bias.latitude, longitude: body.bias.longitude };
      const key = JSON.stringify([provider.id, query.toLowerCase(), bias]);
      const entry = cache.get(key);
      if (entry && entry.expires > now()) return json({ places: entry.places });
      let search = pending.get(key);
      if (!search) {
        // Reserve before the upstream request. Database quotas are shared across workers.
        if (!(await reserve(userId)))
          return json(
            { error: "Place search limit reached. Please try again later." },
            429,
          );
        // Another request may have entered while the quota call was pending.
        search = pending.get(key);
        if (!search) {
          search = provider
            .search(query, bias)
            .then((places) => {
              cache.delete(key);
              if (cache.size >= 100) cache.delete(cache.keys().next().value!);
              cache.set(key, { places, expires: now() + 5 * 60000 });
              return places;
            })
            .finally(() => pending.delete(key));
          pending.set(key, search);
        }
      }
      return json({ places: await search });
    } catch {
      // Never forward provider URLs, keys or raw upstream errors to clients/logs.
      return json({ error: "Could not search places. Please try again." }, 502);
    }
  };
}
