import { reportBackendFailure } from "./diagnostics";
/** Bound backend reads/writes so a stalled connection cannot leave buttons busy forever. */
export function createSignInFetch(
  baseUrl: string,
  fetcher: typeof fetch = (...args) => fetch(...args),
  timeoutMs = 20_000,
): typeof fetch {
  const origin = new URL(baseUrl).origin;
  return async (input, init) => {
    const address = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
    if (address.origin !== origin) return fetcher(input, init);
    const deadlineMs = address.pathname.startsWith("/storage/v1/")
      ? timeoutMs * 3
      : address.pathname.endsWith("/logout")
        ? Math.min(timeoutMs, 5_000)
        : timeoutMs;
    const controller = new AbortController();
    const upstream =
      init?.signal ??
      (typeof Request !== "undefined" && input instanceof Request
        ? input.signal
        : undefined);
    const abort = () => controller.abort();
    if (upstream?.aborted) abort();
    else upstream?.addEventListener("abort", abort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reportBackendFailure("timeout");
        // Reject first: a fetch abort may otherwise obscure the useful timeout message.
        reject(
          new Error(
            "The connection took too long. Check your connection and try again.",
          ),
        );
        controller.abort();
      }, deadlineMs);
    });
    const request = (async () => {
      const response = await fetcher(input, {
        ...init,
        signal: controller.signal,
      });
      if (response.status >= 500) reportBackendFailure("server");
      // Include a stalled response body in the deadline, not just its headers.
      // Native JSON upload responses use text; only actual file downloads need
      // ArrayBuffers (which are expensive on some React Native fetch polyfills).
      const body = /^(image\/|application\/(octet-stream|pdf))/i.test(
        response.headers?.get("content-type") ?? "",
      )
        ? await response.arrayBuffer()
        : await response.text();
      return new Response(
        [204, 205, 304].includes(response.status) ? null : body,
        {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        },
      );
    })();
    try {
      return await Promise.race([request, deadline]);
    } finally {
      clearTimeout(timer);
      upstream?.removeEventListener("abort", abort);
    }
  };
}
