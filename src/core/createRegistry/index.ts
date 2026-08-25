import type { PrimitiveOrNested } from 'keyweaver';
import type {
  Registry,
  AsyncControlOptions,
  AsyncControlScope,
  ControlScope,
  Control,
  RegistryOptions,
} from '#types';
import type _createControl from '#core/createControl';
import type _createAsyncControl from '#core/createAsyncControl';
import type _createPrimitiveControl from '#core/createPrimitiveControl';
import invalidate from '#core/invalidate';
import { ControlType } from '#internal/constants';
import getStorageKey from '#internal/getStorageKey';
import {
  cleanupItems,
  createItem,
  getRegistryDepth,
} from '#internal/registryHelpers';

function registryDelete(this: Registry<any, any>, ...keys: any[]) {
  const registryDepth = this._depth;

  if (registryDepth == 0) {
    return false;
  }

  const depth = keys.length;

  const endIndex = depth - 1;

  let storage = this._storage;

  for (let i = 0; ; i++) {
    const storageKey = getStorageKey(keys[i]);

    const nextStorage = storage.get(storageKey);

    if (nextStorage === undefined) {
      return false;
    }

    if (i == endIndex) {
      if (this._isObserved) {
        cleanupItems(nextStorage, registryDepth - depth);
      }

      return storage.delete(storageKey);
    }

    storage = nextStorage;
  }
}

function clear(this: Registry<any, any[]>) {
  const depth = this._depth;

  if (this._isObserved) {
    cleanupItems(this._storage, depth);
  }

  this._storage.clear();
}

function registryInvalidate(
  this: Registry<any, any>,
  ...keys: PrimitiveOrNested[]
) {
  const registryDepth = this._depth;

  if (registryDepth != 0) {
    const depth = keys.length;

    let storage = this._storage;

    for (let i = 0; i < depth; i++) {
      storage = storage.get(getStorageKey(keys[i]))!;

      if (storage === undefined) {
        return;
      }
    }

    if (registryDepth == depth) {
      invalidate(storage as any);
    } else {
      const levels = registryDepth - depth - 1;

      let queue: Map<any, any>[] = [storage];

      for (let i = 0; i < levels; i++) {
        const nextQueue: Map<any, any>[] = [];

        for (let i = 0, l = queue.length; i < l; i++) {
          const storage = queue[i];

          const it = storage.values();

          for (let i = storage.size; i--;) {
            nextQueue.push(it.next().value);
          }
        }

        queue = nextQueue;
      }

      for (let i = 0, l = queue.length; i < l; i++) {
        const storage = queue[i];

        const it = storage.values();

        for (let i = storage.size; i--;) {
          invalidate(it.next().value);
        }
      }
    }
  }
}

function get(this: Registry<any, any>, ...keys: any[]): any {
  const self = this;

  const endIndex = getRegistryDepth(self, keys) - 1;

  let storage = self._storage;

  for (let i = 0; i < endIndex; i++) {
    const storageKey = getStorageKey(keys[i]);

    const nextStorage = storage.get(storageKey);

    if (nextStorage) {
      storage = nextStorage;
    } else {
      storage.set(storageKey, (storage = new Map()));

      while (++i < endIndex) {
        storage.set(getStorageKey(keys[i]), (storage = new Map()));
      }

      break;
    }
  }

  const storageKey = getStorageKey(keys[endIndex]);

  let control = storage.get(storageKey);

  return control === undefined
    ? createItem(self, storage, storageKey, keys)
    : control;
}

const createRegistry: {
  /**
   * Creates a {@link Registry registry} of {@link AsyncControlScope async
   * controls} keyed by tuples: `get(...keys)` lazily creates (and caches) one
   * control per distinct key set, passing the keys to the
   * {@link AsyncControlOptions options} (`value`, a loader's `fetch`, etc).
   *
   * Keys are compared structurally, so objects and arrays are valid keys.
   * `invalidate(...keys)` resets all items under the given key prefix. To key
   * an item by controls rather than values, see `createBoundControl` — the
   * {@link registryOptions} `keepPrev` option is what it shows while the item
   * it retargeted to loads.
   *
   * @example
   * ```ts
   * const userRegistry = createRegistry(createAsyncControl, {
   *   ...requestLoader((id: number) =>
   *     fetch(`/api/users/${id}`).then((r) => r.json())
   *   ),
   * });
   *
   * const $user = userRegistry.get(42);
   * ```
   */
  <T, Keys extends Exclude<PrimitiveOrNested, undefined>[], E = any>(
    create: typeof _createAsyncControl,
    options?: AsyncControlOptions<T, E, Keys>,
    registryOptions?: RegistryOptions<T | undefined, Keys>
  ): Registry<AsyncControlScope<T, E>, Keys>;
  /**
   * Creates a {@link Registry registry} of sync {@link ControlScope controls}
   * keyed by tuples: `get(...keys)` lazily creates (and caches) one control
   * per distinct key set, resolving {@link defaultValue} with the keys.
   *
   * @example
   * ```ts
   * const draftRegistry = createRegistry(createControl, (chatId: string) => '');
   *
   * const $draft = draftRegistry.get('chat-1');
   * ```
   */
  <T, Keys extends Exclude<PrimitiveOrNested, undefined>[]>(
    create: typeof _createControl,
    defaultValue?: T | ((...keys: Keys) => T),
    registryOptions?: RegistryOptions<T, Keys>
  ): Registry<ControlScope<T>, Keys>;
  /**
   * Creates a {@link Registry registry} of primitive {@link Control controls}
   * keyed by tuples: `get(...keys)` lazily creates (and caches) one control
   * per distinct key set, resolving {@link defaultValue} with the keys. Items
   * skip the scope proxy — values are opaque (no nested-path access), making
   * this the cheapest registry flavor for simple values.
   *
   * @example
   * ```ts
   * const expandedRegistry = createRegistry(
   *   createPrimitiveControl,
   *   (sectionId: string) => false
   * );
   *
   * const $expanded = expandedRegistry.get('intro');
   * ```
   */
  <T, Keys extends Exclude<PrimitiveOrNested, undefined>[]>(
    create: typeof _createPrimitiveControl,
    defaultValue?: T | ((...keys: Keys) => T),
    registryOptions?: RegistryOptions<T, Keys>
  ): Registry<Control<T>, Keys>;
} = (createControl: any, arg1?: unknown, options?: RegistryOptions): any =>
  ({
    _storage: new Map(),
    delete: registryDelete,
    get,
    invalidate: registryInvalidate,
    clear,
    _createControl: createControl,
    _initArg: arg1,
    _externalStorage: options && options.externalStorage,
    _isObserved: false,
    _type: ControlType.UNDEFINED,
    _depth: 0,
    _keepPrev: (options && options.keepPrev) || false,
    _suppressError: (options && options.suppressError) || false,
  }) as Registry<any, any[]>;

export default createRegistry;
