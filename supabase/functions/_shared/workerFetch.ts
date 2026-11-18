/** Bounded worker I/O, including a response whose headers arrive but body stalls. */
export function deadlineFetch(
  fetcher: typeof fetch = fetch,
  ms = 8_000,
): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController(),
      upstream =
        init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const abort = () => controller.abort();
    if (upstream?.aborted) abort();
    else upstream?.addEventListener("abort", abort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("Worker connection timed out"));
        controller.abort();
      }, ms);
    });
    const request = (async () => {
      const response = await fetcher(input, {
        ...init,
        signal: controller.signal,
      });
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
