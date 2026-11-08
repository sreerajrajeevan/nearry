import type { PlaceSuggestionProvider } from "./placeTypes.ts";
import {
  validPoint,
  validSuggestion,
  validPlaceSession,
} from "./placeTypes.ts";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
export function createPlaceAutocompleteHandler(deps: {
  provider: PlaceSuggestionProvider | null;
  authenticate: (authorization: string) => Promise<string | null>;
  reserve: (userId: string) => Promise<boolean>;
}) {
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers });
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST")
      return json({ error: "Method not allowed." }, 405);
    try {
      const authorization = req.headers.get("authorization") ?? "";
      const user = authorization.startsWith("Bearer ")
        ? await deps.authenticate(authorization)
        : null;
      if (!user) return json({ error: "Sign in to search places." }, 401);
      if (!deps.provider)
        return json({ error: "Place search is not configured yet." }, 503);
      if (Number(req.headers.get("content-length") ?? 0) > 4096)
        return json({ error: "Search is too long." }, 400);
      const text = await req.text();
      if (text.length > 4096)
        return json({ error: "Search is too long." }, 400);
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return json({ error: "Invalid search." }, 400);
      }
      if (!body || typeof body !== "object" || Array.isArray(body))
        return json({ error: "Invalid search." }, 400);
      if (
        body.sessionToken !== undefined &&
        !validPlaceSession(body.sessionToken)
      )
        return json({ error: "Invalid search session." }, 400);
      if (body.action === "resolve") {
        if (
          !validSuggestion(body.place) ||
          body.place.provider !== deps.provider.id
        )
          return json(
            { error: "Choose a place from the current results." },
            400,
          );
        if (!(await deps.reserve(user)))
          return json(
            {
              error:
                "Place search is busy. Please wait a moment and try again.",
            },
            429,
          );
        return json({
          place: await deps.provider.resolve(body.place, body.sessionToken),
          requestedId: body.place.id,
        });
      }
      if (body.action !== undefined && body.action !== "suggest")
        return json({ error: "Invalid search." }, 400);
      if (
        typeof body.query !== "string" ||
        body.query.trim().length < 3 ||
        body.query.trim().length > 120 ||
        (body.bias !== undefined && !validPoint(body.bias))
      )
        return json(
          { error: "Enter 3–120 characters and a valid location." },
          400,
        );
      if (!(await deps.reserve(user)))
        return json(
          {
            error: "Place search is busy. Please wait a moment and try again.",
          },
          429,
        );
      // Google results and sessions are intentionally not cached or persisted.
      return json({
        places: await deps.provider.suggest(
          body.query.trim(),
          body.bias,
          body.sessionToken,
        ),
      });
    } catch {
      return json({ error: "Could not search places. Please try again." }, 502);
    }
  };
}
