type Store = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
type Manifest = { version: 1; generation: string; count: number };
/** Tokens live only in the encrypted store. Chunking avoids native per-item size limits. */
export function createChunkedAuthStorage(
  secure: Store,
  legacy: Store,
  random: () => string,
) {
  const queues = new Map<string, Promise<unknown>>();
  const enqueue = <T>(key: string, run: () => Promise<T>): Promise<T> => {
    const next = (queues.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(run);
    queues.set(key, next);
    void next
      .finally(() => {
        if (queues.get(key) === next) queues.delete(key);
      })
      .catch(() => {});
    return next;
  };
  const prefix = (key: string) =>
    `nearry.auth.${Array.from(key)
      .map((c) => c.codePointAt(0)!.toString(16))
      .join("-")}`;
  const readManifest = async (key: string): Promise<Manifest | null> => {
    const raw = await secure.getItem(prefix(key));
    if (!raw) return null;
    const m = JSON.parse(raw);
    if (
      m?.version !== 1 ||
      !/^[a-zA-Z0-9-]{8,80}$/.test(m.generation) ||
      !Number.isInteger(m.count) ||
      m.count < 1 ||
      m.count > 256
    )
      throw new Error("Saved sign-in is unavailable. Please sign in again.");
    return m;
  };
  const clean = async (key: string, m: Manifest | null) => {
    if (m)
      await Promise.all(
        Array.from({ length: m.count }, (_, i) =>
          secure
            .removeItem(`${prefix(key)}.${m.generation}.${i}`)
            .catch(() => {}),
        ),
      );
  };
  const write = async (key: string, value: string) => {
    const chunks: string[] = [];
    const chars = Array.from(value);
    for (let i = 0; i < chars.length; i += 450)
      chunks.push(chars.slice(i, i + 450).join(""));
    if (!chunks.length) chunks.push("");
    if (chunks.length > 256)
      throw new Error("Saved sign-in is too large for this device.");
    const old = await readManifest(key),
      m: Manifest = { version: 1, generation: random(), count: chunks.length };
    try {
      for (let i = 0; i < chunks.length; i++)
        await secure.setItem(`${prefix(key)}.${m.generation}.${i}`, chunks[i]);
      await secure.setItem(prefix(key), JSON.stringify(m));
    } catch (e) {
      await clean(key, m);
      throw e;
    }
    // A successful migration must not leave the previous plaintext token behind.
    await legacy.removeItem(key);
    await legacy.removeItem(`${prefix(key)}.removed`);
    await clean(key, old);
  };
  return {
    getItem: (key: string) =>
      enqueue(key, async () => {
        if (await legacy.getItem(`${prefix(key)}.removed`)) return null;
        const m = await readManifest(key);
        if (m) {
          let value = "";
          for (let i = 0; i < m.count; i++) {
            const part = await secure.getItem(
              `${prefix(key)}.${m.generation}.${i}`,
            );
            if (part === null)
              throw new Error(
                "Saved sign-in is incomplete. Please sign in again.",
              );
            value += part;
          }
          await legacy.removeItem(key);
          return value;
        }
        const value = await legacy.getItem(key);
        if (value !== null) await write(key, value);
        return value;
      }),
    setItem: (key: string, value: string) =>
      enqueue(key, () => write(key, value)),
    removeItem: (key: string) =>
      enqueue(key, async () => {
        // The non-sensitive tombstone prevents restoration even if encrypted deletion fails.
        await legacy.setItem(`${prefix(key)}.removed`, "1");
        await legacy.removeItem(key).catch(() => {});
        const m = await readManifest(key).catch(() => null);
        await secure.removeItem(prefix(key)).catch(() => {});
        await clean(key, m);
      }),
  };
}
