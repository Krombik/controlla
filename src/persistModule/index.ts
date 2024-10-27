import toKey from 'keyweaver';
import { StateInitializer } from '../types';
import alwaysTrue from '../utils/alwaysTrue';

type SafeStorage = {
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
  listen?(key: string, onChange: (value: string) => void): () => void;
};

type Converter<T> = {
  parse(value: string): T;
  stringify(value: T): string;
};

type Options<T> = {
  /** The key used to store and retrieve the value from storage. */
  name: string;
  storage: SafeStorage | undefined;
  isValid?(value: T): boolean;
  converter: Converter<T>;
  /** If `true`, enables observing storage changes */
  sharable?: boolean;
};

const isStorageAvailable = (key: 'local' | 'session') => {
  try {
    const storage = window[`${key}Storage`];

    const testKey = `__${key}Test__`;

    storage.setItem(testKey, '');

    storage.removeItem(testKey);

    return true;
  } catch {}
};

export const safeLocalStorage =
  isStorageAvailable('local') &&
  ({
    getItem(key) {
      return localStorage.getItem(key);
    },
    setItem(key, value) {
      localStorage.setItem(key, value);
    },
    removeItem(key) {
      localStorage.removeItem(key);
    },
    listen(key, onChange) {
      const listener = (e: StorageEvent) => {
        if (e.key == key && e.newValue != null) {
          onChange(e.newValue);
        }
      };

      window.addEventListener('storage', listener);

      return () => {
        window.removeEventListener('storage', listener);
      };
    },
  } satisfies SafeStorage);

export const safeSessionStorage =
  isStorageAvailable('session') && (sessionStorage satisfies SafeStorage);

/**
 * A utility for persisting state using a specified storage mechanism such as
 * {@link localStorage} or {@link sessionStorage}. It provides a customizable way to store,
 * retrieve, and observe state changes of provided persistent {@link Options.storage storage}
 */
const getPersistInitializer = <T>({
  name,
  storage,
  converter,
  isValid = alwaysTrue,
  sharable,
}: Options<T>): StateInitializer<T> | undefined =>
  storage &&
  ((keys) => {
    const key = keys ? toKey([name, keys]) : name;

    return {
      get() {
        const str = storage.getItem(key);

        if (str != null) {
          let value: T;

          try {
            value = converter.parse(str);
          } catch {
            return;
          }

          return isValid(value) ? value : undefined;
        }
      },
      set(value) {
        if (value !== undefined) {
          storage.setItem(key, converter.stringify(value));
        } else {
          storage.removeItem(key);
        }
      },
      observe:
        sharable && storage.listen
          ? (setState) =>
              storage.listen!(key, (value) => {
                let parsedValue: T;

                try {
                  parsedValue = converter.parse(value);
                } catch {
                  return;
                }

                if (isValid(parsedValue)) {
                  setState(parsedValue);
                }
              })
          : undefined,
    };
  });

export default getPersistInitializer;
