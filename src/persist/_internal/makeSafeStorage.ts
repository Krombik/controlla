import type { PersistStorage } from '#persist/types';
import removeFromArray from '#internal/removeFromArray';

type Listener = (value: string | undefined) => void;

/**
 * Wraps {@link localStorage} or {@link sessionStorage} into an observable
 * {@link PersistStorage}, or returns `undefined` if the storage is unavailable
 * (e.g. blocked by privacy settings or running outside a browser).
 *
 * All subscriptions share a single `storage` event listener, attached while at
 * least one key is observed.
 */
const makeSafeStorage = (storage: Storage) => {
  try {
    const testKey = '__storage_test__';

    storage.setItem(testKey, '');

    storage.removeItem(testKey);
  } catch {
    return;
  }

  const subscriptions = new Map<string, Listener[]>();

  const storageListener = (e: StorageEvent) => {
    if (e.storageArea === storage) {
      const key = e.key;

      if (key !== null) {
        const listeners = subscriptions.get(key);

        if (listeners) {
          let storageValue: string | undefined | null = e.newValue;

          if (storageValue === null) {
            storageValue = undefined;
          }

          for (let i = 0; i < listeners.length; i++) {
            listeners[i](storageValue);
          }
        }
      } else {
        for (let i = subscriptions.size, it = subscriptions.values(); i--; ) {
          const listeners = it.next().value!;

          for (let i = 0; i < listeners.length; i++) {
            listeners[i](undefined);
          }
        }
      }
    }
  };

  return {
    getItem(key) {
      return storage.getItem(key);
    },
    setItem(key, value) {
      storage.setItem(key, value);
    },
    removeItem(key) {
      storage.removeItem(key);
    },
    listen(key, onChange) {
      let isActive = true;

      let listeners = subscriptions.get(key);

      if (listeners) {
        listeners.push(onChange);
      } else {
        if (!subscriptions.size) {
          window.addEventListener('storage', storageListener);
        }

        subscriptions.set(key, (listeners = [onChange]));
      }

      return () => {
        if (isActive) {
          isActive = false;

          removeFromArray(listeners, onChange);

          if (!listeners.length) {
            subscriptions.delete(key);

            if (!subscriptions.size) {
              window.removeEventListener('storage', storageListener);
            }
          }
        }
      };
    },
  } satisfies PersistStorage;
};

export default makeSafeStorage;
