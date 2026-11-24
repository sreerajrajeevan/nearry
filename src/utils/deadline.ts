/** A deadline must reject even when a native operation ignores cancellation. */
export async function withDeadline<T>(
  operation: PromiseLike<T>,
  ms: number,
  message = "This took too long. Please try again.",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
