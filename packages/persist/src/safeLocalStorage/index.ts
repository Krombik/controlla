import type { PersistStorage } from '#types';
import isStorageAvailable from '#utils/isStorageAvailable';

type Listener = (value: string | undefined) => void;

const subscriptions = new Map<string, Set<Listener>>();

const storageListener = (e: StorageEvent) => {
  if (e.storageArea === localStorage) {
    const key = e.key;

    if (key !== null) {
      const listeners = subscriptions.get(key);

      if (listeners) {
        const value = e.newValue !== null ? e.newValue : undefined;

        listeners.forEach((listener) => listener(value));
      }
    } else {
      // storage.clear() was called in another tab
      subscriptions.forEach((listeners) =>
        listeners.forEach((listener) => listener(undefined))
      );
    }
  }
};

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
      let listeners = subscriptions.get(key);

      if (!listeners) {
        if (!subscriptions.size) {
          window.addEventListener('storage', storageListener);
        }

        subscriptions.set(key, (listeners = new Set()));
      }

      listeners.add(onChange);

      return () => {
        listeners.delete(onChange);

        if (!listeners.size) {
          subscriptions.delete(key);

          if (!subscriptions.size) {
            window.removeEventListener('storage', storageListener);
          }
        }
      };
    },
  } satisfies PersistStorage);

export default safeLocalStorage;
