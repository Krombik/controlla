export type PersistStorage = {
  /** Retrieves a value by key. */
  getItem(key: string): string | undefined | null;
  /** Stores a value with the given key. */
  setItem(key: string, value: string): void;
  /** Removes a value by key. */
  removeItem(key: string): void;
  /**
   * listener to observe storage changes
   * @returns a function to unsubscribe.
   */
  listen?(
    key: string,
    onChange: (value: string | undefined) => void
  ): () => void;
};
