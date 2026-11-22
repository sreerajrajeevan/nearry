type Reporter = (error: Error, where: string) => void;
let reporter: Reporter = () => {};
const last = new Map<string, number>();
export function configureDiagnostics(next: Reporter) {
  reporter = next;
}
/** Static categories only: no endpoint IDs, request bodies, user input or credentials. */
export function reportBackendFailure(kind: "timeout" | "server" | "query") {
  const now = Date.now();
  if (now - (last.get(kind) ?? 0) < 60_000) return;
  last.set(kind, now);
  try {
    reporter(new Error("Backend " + kind), "backend-" + kind);
  } catch {}
}
