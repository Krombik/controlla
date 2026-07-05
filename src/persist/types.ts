/**
 * A key-value string storage usable by `getPersistStorage` — the
 * `localStorage` interface plus an optional change listener (see
 * `safeLocalStorage`/`safeSessionStorage` for ready-made ones).
 */
export type PersistStorage = {
  /** Returns the value stored under the key, or `null`/`undefined` if there is none. */
  getItem(key: string): string | undefined | null;
  /** Stores the value under the key. */
  setItem(key: string, value: string): void;
  /** Removes the value stored under the key. */
  removeItem(key: string): void;
  /**
   * Subscribes to external changes of the value stored under the key (e.g.
   * from another tab). The {@link onChange} callback receives `undefined`
   * when the value was removed. Returns an unsubscribe function. Optional —
   * without it the storage isn't observable.
   */
  listen?(
    key: string,
    onChange: (value: string | undefined) => void
  ): () => void;
};
