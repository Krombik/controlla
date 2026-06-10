import toKey from 'keyweaver';
import type { SyncExternalStorage } from '@react-control/core/types';
import type { PersistStorage } from '#types';
import alwaysTrue from '@react-control/core/shared-internal/alwaysTrue';

type Converter<T> = {
  parse(value: string): T;
  stringify(value: T): string;
};

type Options<T> = {
  /** The key used to store and retrieve the value from storage. */
  name: string;
  storage: PersistStorage | undefined;
  isValid?(value: T): boolean;
  /** @default JSON */
  converter?: Converter<T>;
  /** If `true`, enables observing storage changes */
  observable?: boolean;
};

/**
 * A utility for persisting control using a specified storage mechanism such as
 * {@link localStorage} or {@link sessionStorage}. It provides a customizable way to store,
 * retrieve, and observe control changes of provided persistent {@link Options.storage storage}
 */
const getPersistStorage = <T>({
  name,
  storage,
  converter = JSON,
  isValid = alwaysTrue,
  observable,
}: Options<T>): SyncExternalStorage<T> | undefined => {
  if (storage) {
    const fn: SyncExternalStorage<T> = (keys) => {
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
            const str = converter.stringify(value as any);

            if (storage.getItem(key) !== str) {
              storage.setItem(key, str);
            }
          } else {
            storage.removeItem(key);
          }
        },
        observe:
          observable && storage.listen
            ? (onChange) =>
                storage.listen!(key, (value) => {
                  if (value !== undefined) {
                    let parsedValue: T;

                    try {
                      parsedValue = converter.parse(value);
                    } catch {
                      return;
                    }

                    if (isValid(parsedValue)) {
                      onChange(parsedValue);
                    }
                  } else {
                    onChange(undefined);
                  }
                })
            : undefined,
      };
    };

    return fn;
  }
};

export default getPersistStorage;
