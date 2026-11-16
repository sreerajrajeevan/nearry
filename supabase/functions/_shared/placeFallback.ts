import type {
  PlaceBias,
  PlaceSuggestion,
  PlaceSuggestionProvider,
} from "./placeTypes.ts";

/**
 * Use a backup search when the main provider is out of quota or down.
 * Backup results are complete places (with coordinates and their own
 * attribution), so choosing one never calls the main provider again.
 * Rejected requests (bad input, auth) are not retried on the backup.
 */
export function withSearchFallback(
  primary: PlaceSuggestionProvider,
  backup: (query: string, bias?: PlaceBias) => Promise<PlaceSuggestion[]>,
): PlaceSuggestionProvider {
  return {
    ...primary,
    async suggest(query, bias, sessionToken) {
      try {
        return await primary.suggest(query, bias, sessionToken);
      } catch (error) {
        const e = error as { quota?: boolean; retryable?: boolean };
        if (!e?.quota && !e?.retryable) throw error;
        console.error("place-autocomplete using backup provider");
        return backup(query, bias);
      }
    },
  };
}
