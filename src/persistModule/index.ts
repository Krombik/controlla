import toKey from 'keyweaver';
import { InitModule } from '../types';

type SafeStorage = {
  getItem(key: string): string | undefined | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  listen?(key: string, onChange: (value: string) => void): () => void;
};

type Converter<T> = {
  parse(value: string): T;
  stringify(value: T): string;
};

type Options<T> = {
  name: string;
  storage: SafeStorage | undefined;
  isValid?(value: T): boolean;
  converter: Converter<T>;
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

const createPersistModule = <T>({
  name,
  storage,
  converter,
  isValid,
  sharable,
}: Options<T>): InitModule<T> | undefined =>
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

          return !isValid || isValid(value) ? value : undefined;
        }
      },
      set(value) {
        if (value !== undefined) {
          storage.setItem(key, converter.stringify(value));
        } else {
          storage.removeItem(key);
        }
      },
      register:
        sharable && storage.listen
          ? (setState) =>
              storage.listen!(key, (value) => {
                let parsedValue: T;

                try {
                  parsedValue = converter.parse(value);
                } catch {
                  return;
                }

                if (!isValid || isValid(parsedValue)) {
                  setState(parsedValue);
                }
              })
          : undefined,
    };
  });

export default createPersistModule;
