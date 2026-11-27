/**
 * Uploads a plan photo in the background as soon as the host picks it, so
 * publishing doesn't wait on (or ask about) photo uploads. A photo the host
 * replaces or removes is deleted from storage, even if it was still uploading.
 */
export type UploadStatus = "uploading" | "done" | "failed";

type Job = {
  status: UploadStatus;
  url?: string;
  cancelled: boolean;
  run: Promise<string | null>;
};

export type UploadQueue = {
  /** Start uploading this photo (no-op if it's already uploading or done). */
  start(uri: string): void;
  /** The host dropped this photo: forget it and delete what was uploaded. */
  cancel(uri: string): void;
  status(uri: string): UploadStatus | undefined;
  /**
   * Wait for these photos. A photo that failed (or was never started) gets one
   * more round of tries. Resolves to each photo's URL, or null if it failed.
   */
  settle(uris: string[]): Promise<Map<string, string | null>>;
  subscribe(listener: () => void): () => void;
};

export function createUploadQueue(
  upload: (uri: string) => Promise<string>,
  discard: (url: string) => Promise<void>,
  {
    retries = 2,
    retryDelayMs = 1500,
  }: { retries?: number; retryDelayMs?: number } = {},
): UploadQueue {
  const jobs = new Map<string, Job>();
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((l) => l());
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const begin = (uri: string): Job => {
    const job: Job = {
      status: "uploading",
      cancelled: false,
      run: Promise.resolve(null),
    };
    job.run = (async () => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (attempt > 0) await wait(retryDelayMs * attempt);
        if (job.cancelled) return null;
        try {
          const url = await upload(uri);
          if (job.cancelled) {
            void discard(url).catch(() => undefined);
            return null;
          }
          job.url = url;
          job.status = "done";
          changed();
          return url;
        } catch {
          // Try again, then report the failure below.
        }
      }
      if (!job.cancelled) {
        job.status = "failed";
        changed();
      }
      return null;
    })();
    jobs.set(uri, job);
    changed();
    return job;
  };

  return {
    start(uri) {
      const job = jobs.get(uri);
      if (!job || job.status === "failed") begin(uri);
    },
    cancel(uri) {
      const job = jobs.get(uri);
      if (!job) return;
      job.cancelled = true;
      jobs.delete(uri);
      if (job.url) void discard(job.url).catch(() => undefined);
      changed();
    },
    status: (uri) => jobs.get(uri)?.status,
    async settle(uris) {
      const result = new Map<string, string | null>();
      await Promise.all(
        uris.map(async (uri) => {
          let job = jobs.get(uri);
          if (!job || job.status === "failed") job = begin(uri);
          result.set(uri, await job.run);
        }),
      );
      return result;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
