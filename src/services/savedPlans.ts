export type BookmarkStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
};
type Snapshot = {
  ids: readonly string[];
  status: "loading" | "ready" | "error";
};
/** Device-local bookmarks are scoped to the account and never contain private post content. */
export class SavedPlansStore {
  private state: Snapshot = { ids: [], status: "loading" };
  private listeners = new Set<() => void>();
  private loading: Promise<readonly string[]> | null = null;
  private writes: Promise<unknown> = Promise.resolve();
  private key: string;
  constructor(
    private storage: BookmarkStorage,
    accountId: string,
  ) {
    this.key = `nearry.saved-plans.v1:${accountId}`;
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: Snapshot) {
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }
  load = (): Promise<readonly string[]> => {
    if (this.state.status === "ready") return Promise.resolve(this.state.ids);
    if (this.loading) return this.loading;
    this.publish({ ...this.state, status: "loading" });
    this.loading = (async () => {
      try {
        const raw = await this.storage.getItem(this.key);
        const data: unknown = raw == null ? [] : JSON.parse(raw);
        if (
          !Array.isArray(data) ||
          !data.every(
            (id) => typeof id === "string" && id.length > 0 && id.length < 200,
          )
        )
          throw new Error("Invalid saved plans");
        const ids = [...new Set(data as string[])];
        this.publish({ ids, status: "ready" });
        return ids;
      } catch {
        this.publish({ ids: [], status: "error" });
        throw new Error("Could not load saved plans. Please try again.");
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  };
  toggle = (id: string): Promise<void> => {
    const write = this.writes.then(async () => {
      const ids = await this.load();
      const next = ids.includes(id)
        ? ids.filter((saved) => saved !== id)
        : [...ids, id];
      try {
        await this.storage.setItem(this.key, JSON.stringify(next));
      } catch {
        throw new Error("Could not save this plan. Please try again.");
      }
      this.publish({ ids: next, status: "ready" });
    });
    this.writes = write.catch(() => {});
    return write;
  };
}
