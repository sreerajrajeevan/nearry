/** Bound sign-in/profile reads so a stalled connection cannot leave buttons busy forever. */
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
    if (
      address.origin !== origin ||
      !(
        address.pathname.startsWith("/auth/v1/") ||
        address.pathname === "/rest/v1/rpc/get_my_profile" ||
        address.pathname === "/rest/v1/rpc/select_account_type" ||
        address.pathname === "/rest/v1/rpc/finish_personal_onboarding"
      )
    )
      return fetcher(input, init);
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
        // Reject first: a fetch abort may otherwise obscure the useful timeout message.
        reject(
          new Error(
            "The connection took too long. Check your connection and try again.",
          ),
        );
        controller.abort();
      }, timeoutMs);
    });
    const request = (async () => {
      const response = await fetcher(input, {
        ...init,
        signal: controller.signal,
      });
      // Include a stalled response body in the deadline, not just its headers.
      const body = await response.text();
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
