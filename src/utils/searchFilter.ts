/** Quoted PostgREST regex value. All regex syntax becomes literal text.
 * imatch avoids PostgREST's special '*' alias in LIKE/ILIKE patterns. */
export function searchLiteral(query: string): string {
  return JSON.stringify(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}
