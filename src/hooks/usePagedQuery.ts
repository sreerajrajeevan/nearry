import { useCallback, useRef, useState } from "react";
import { useLiveQuery } from "./useLiveQuery";
import { mergePage, type Page, type Cursor } from "../utils/pagination";
/** Older pages cannot append after an account/filter change or a fresh snapshot. */
export function usePagedQuery<T extends { id: string }>(
  key: string,
  fetcher: (cursor: Cursor | null) => Promise<Page<T>>,
  subscribe?: (refresh: () => void) => () => void,
) {
  const source = useRef(fetcher);
  source.current = fetcher;
  const first = useLiveQuery(key, () => source.current(null), subscribe);
  const current = useRef({ key, page: first.data });
  current.current = { key, page: first.data };
  const [extra, setExtra] = useState<{
    key: string;
    first: Page<T> | undefined;
    items: T[];
    cursor: Cursor | null;
  }>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  const valid = extra?.key === key && extra?.first === first.data;
  const items = mergePage(first.data?.items ?? [], valid ? extra!.items : []);
  const cursor = valid ? extra!.cursor : (first.data?.cursor ?? null);
  const loadMore = useCallback(async () => {
    if (!cursor || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const snapshot = current.current;
    try {
      const next = await source.current(cursor);
      if (
        current.current.key !== snapshot.key ||
        current.current.page !== snapshot.page
      )
        return;
      setExtra((old) => ({
        key: snapshot.key,
        first: snapshot.page,
        items: mergePage(
          old && old.first === snapshot.page && old.key === snapshot.key
            ? old.items
            : [],
          next.items,
        ),
        cursor: next.cursor,
      }));
    } catch {
      if (
        current.current.key === snapshot.key &&
        current.current.page === snapshot.page
      )
        setError("Could not load older results. Please try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [cursor, key, first.data]);
  return {
    ...first,
    items,
    cursor,
    loadMore,
    loadingMore: busy,
    moreError: error,
  };
}
