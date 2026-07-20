import toKey from 'keyweaver';
import type { SyncExternalStorage } from '#types';
import type { PersistStorage } from '#persist/types';
import alwaysTrue from '#internal/alwaysTrue';

type Converter<T> = {
  parse(value: string): T;
  stringify(value: Exclude<T, undefined>): string;
};

type Options<T> = {
  /** The key the value is stored under (registry keys are appended to it). */
  name: string;
  /** The underlying storage, e.g. `safeLocalStorage`; `undefined` makes the control non-persistent. */
  storage: PersistStorage | undefined;
  /** Validates a stored value on read — an invalid one is treated as absent. */
  isValid?(value: T): boolean;
  /** Serializes the value to and from a string. @default JSON */
  converter?: Converter<T>;
  /** If `true` (and the storage supports it), the control picks up external changes — e.g. from another tab. */
  observable?: boolean;
};

/**
 * Creates a {@link SyncExternalStorage} that persists a control's value in
 * the given {@link Options.storage storage} under
 * {@link Options.name name} — pass it to `createControl` and the like.
 * Returns `undefined` when the storage is unavailable, leaving the control
 * non-persistent.
 *
 * @example
 * ```ts
 * const $theme = createControl(
 *   'light',
 *   getPersistStorage({ name: 'theme', storage: safeLocalStorage, observable: true })
 * );
 * ```
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
