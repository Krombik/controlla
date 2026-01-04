import type { PersistStorage } from '#types';
import isStorageAvailable from '#utils/isStorageAvailable';

const safeLocalStorage =
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
        if (e.key == key) {
          const value = e.newValue;

          onChange(value != null ? value : undefined);
        }
      };

      window.addEventListener('storage', listener);

      return () => {
        window.removeEventListener('storage', listener);
      };
    },
  } satisfies PersistStorage);

export default safeLocalStorage;
