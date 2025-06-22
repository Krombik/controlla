import toKey, { type PrimitiveOrNested } from 'keyweaver';
import type {
  AsyncControl,
  LoadableControl,
  Control,
  Storage,
  AsyncControlOptions,
  RequestableControlOptions,
  PollableControlOptions,
  LoadableControlOptions,
  WithInitModule,
  // PaginatedStorage,
  PollableControlScope,
  PollableControl,
  LoadableControlScope,
  AsyncControlScope,
  ControlScope,
  PollableMethods,
  StorageRecord,
} from '../types';
import type createControl from '../createControl';
import type createAsyncControl from '../createAsyncControl';
import type createControlScope from '../createControlScope';
import type createAsyncControlScope from '../createAsyncControlScope';
import type createRequestableControl from '../createRequestableControl';
import type createRequestableControlScope from '../createRequestableControlScope';
import type createPollableControl from '../createPollableControl';
import type createPollableControlScope from '../createPollableControlScope';
import { ROOT } from '../utils/constants';
// import type createPaginatedStorage from '../createPaginatedStorage';
// import type {
//   PaginatedPollableNestedStateArgs,
//   PaginatedPollableStateArgs,
//   PaginatedRequestableNestedStateArgs,
//   PaginatedRequestableStateArgs,
// } from '../createPaginatedStorage';

type ControlCreator = typeof createControl | typeof createControlScope;

type GetControlArgs<
  CreateControl extends ControlCreator,
  T,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithInitModule<
  T,
  [
    createControl: CreateControl,
    defaultValue?: T | ((keys: [...ParentKeys, ...Keys]) => T),
  ]
>;

type AsyncControlCreator =
  | typeof createAsyncControl
  | typeof createAsyncControlScope;

type AsyncGetControlArgs<
  CreateControl extends AsyncControlCreator,
  T,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithInitModule<
  T | undefined,
  [
    createControl: CreateControl,
    options?: AsyncControlOptions<T, [...ParentKeys, ...Keys]>,
  ]
>;

type LoadableControlArgs<
  CreateControl extends AsyncControlCreator,
  T,
  E,
  Control,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithInitModule<
  T | undefined,
  [
    createControl: CreateControl,
    options: LoadableControlOptions<T, E, Control, [...ParentKeys, ...Keys]>,
  ]
>;

type RequestableControlCreator =
  | typeof createRequestableControl
  | typeof createRequestableControlScope;

type RequestableControlArgs<
  CreateControl extends RequestableControlCreator,
  T,
  E,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithInitModule<
  T | undefined,
  [
    createControl: CreateControl,
    options: RequestableControlOptions<T, E, [...ParentKeys, ...Keys]>,
  ]
>;

type PollableControlCreator =
  | typeof createPollableControl
  | typeof createPollableControlScope;

type PollableControlArgs<
  CreateControl extends PollableControlCreator,
  T,
  E,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithInitModule<
  T | undefined,
  [
    createControl: CreateControl,
    options: PollableControlOptions<T, E, [...ParentKeys, ...Keys]>,
  ]
>;

type ControlCreationArguments<
  T extends Control,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[],
> = T extends
  | LoadableControl<infer V, infer E, infer C>
  | LoadableControlScope<infer V, infer E, infer C>
  ? C extends PollableMethods
    ? PollableControlArgs<
        T extends LoadableControl
          ? typeof createPollableControl
          : typeof createPollableControlScope,
        V,
        E,
        Keys,
        ParentKeys
      >
    : [C] extends [never]
      ?
          | RequestableControlArgs<
              T extends LoadableControl
                ? typeof createRequestableControl
                : typeof createRequestableControlScope,
              V,
              E,
              Keys,
              ParentKeys
            >
          | LoadableControlArgs<
              T extends LoadableControl
                ? typeof createAsyncControl
                : typeof createAsyncControlScope,
              V,
              E,
              never,
              Keys,
              ParentKeys
            >
      : LoadableControlArgs<
          T extends LoadableControl
            ? typeof createAsyncControl
            : typeof createAsyncControlScope,
          V,
          E,
          C,
          Keys,
          ParentKeys
        >
  : T extends AsyncControl<infer V>
    ? AsyncGetControlArgs<
        T extends AsyncControlScope
          ? typeof createAsyncControlScope
          : typeof createAsyncControl,
        V,
        Keys,
        ParentKeys
      >
    : T extends Control<infer V>
      ? GetControlArgs<
          T extends ControlScope
            ? typeof createControlScope
            : typeof createControl,
          V,
          Keys,
          ParentKeys
        >
      : never;

// type PaginatedStorageArgs<
//   T extends PaginatedStorage<any>,
//   Keys extends PrimitiveOrNested[],
//   ParentKeys extends PrimitiveOrNested[],
// > =
//   T extends PaginatedStorage<infer S>
//     ? WithCreatePaginatedStorage<
//         S extends PollableStateScope<infer V, infer E>
//           ? PaginatedPollableNestedStateArgs<V, E, [...ParentKeys, Keys]>
//           : S extends PollableState<infer V, infer E>
//             ? PaginatedPollableStateArgs<V, E, [...ParentKeys, Keys]>
//             : S extends LoadableStateScope<infer V, infer E>
//               ? PaginatedRequestableNestedStateArgs<V, E, [...ParentKeys, Keys]>
//               : S extends LoadableState<infer V, infer E>
//                 ? PaginatedRequestableStateArgs<V, E, [...ParentKeys, Keys]>
//                 : never
//       >
//     : never;

type StorageRecordArgs<
  T extends StorageRecord,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = {
  [key in keyof T]: T[key] extends Control
    ? ControlCreationArguments<T[key], Keys, ParentKeys>
    : T[key] extends Storage<infer S, infer K>
      ? S extends StorageRecord
        ? WithCreateControlStorage<
            [StorageRecordArgs<S, K, [...ParentKeys, ...Keys]>]
          >
        : S extends Control
          ? WithCreateControlStorage<
              ControlCreationArguments<S, K, [...ParentKeys, ...Keys]>
            >
          : // : S extends PaginatedStorage<any>
            //   ? WithCreateStateStorage<
            //       PaginatedStorageArgs<S, K, [...ParentKeys, ...Keys]>
            //     >
            never
      : never;
};

// type WithCreatePaginatedStorage<T extends any[]> = [
//   typeof createPaginatedStorage,
//   ...T,
// ];

type WithCreateControlStorage<T extends any[]> = [CreateStorage, ...T];

interface CreateStorage {
  <T, Keys extends PrimitiveOrNested[], E = any, Control = never>(
    ...args: LoadableControlArgs<
      typeof createAsyncControlScope,
      T,
      E,
      Control,
      Keys
    >
  ): Storage<LoadableControlScope<T, E, Control>, Keys>;
  <T, Keys extends PrimitiveOrNested[], E = any, Control = never>(
    ...args: LoadableControlArgs<typeof createAsyncControl, T, E, Control, Keys>
  ): Storage<LoadableControl<T, E, Control>, Keys>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: PollableControlArgs<typeof createPollableControlScope, T, E, Keys>
  ): Storage<PollableControlScope<T, E>, Keys>;
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: PollableControlArgs<typeof createPollableControl, T, E, Keys>
  ): Storage<PollableControl<T, E>, Keys>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: AsyncGetControlArgs<typeof createAsyncControlScope, T, Keys>
  ): Storage<AsyncControlScope<T, E>, Keys>;
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: AsyncGetControlArgs<typeof createAsyncControl, T, Keys>
  ): Storage<AsyncControl<T, E>, Keys>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: RequestableControlArgs<
      typeof createRequestableControlScope,
      T,
      E,
      Keys
    >
  ): Storage<LoadableControlScope<T, E>, Keys>;
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: RequestableControlArgs<typeof createRequestableControl, T, E, Keys>
  ): Storage<LoadableControl<T, E>, Keys>;

  <T, Keys extends PrimitiveOrNested[]>(
    ...args: GetControlArgs<typeof createControlScope, T, Keys>
  ): Storage<ControlScope<T>, Keys>;
  <T, Keys extends PrimitiveOrNested[]>(
    ...args: GetControlArgs<typeof createControl, T, Keys>
  ): Storage<ControlScope<T>, Keys>;

  <T extends StorageRecord, Keys extends PrimitiveOrNested[]>(
    obj: StorageRecordArgs<T, Keys>
  ): Storage<T, Keys>;

  // <T, Keys extends PrimitiveOrNested[], E = any>(
  //   ...args: WithCreatePaginatedStorage<
  //     PaginatedRequestableStateArgs<T, E, Keys>
  //   >
  // ): Storage<PaginatedStorage<LoadableState<T, E>>, Keys>;
  // <T, Keys extends PrimitiveOrNested[], E = any>(
  //   ...args: WithCreatePaginatedStorage<
  //     PaginatedRequestableNestedStateArgs<T, E, Keys>
  //   >
  // ): Storage<PaginatedStorage<LoadableStateScope<T, E>>, Keys>;
}

function _delete(this: Storage<any, any>, ...keys: PrimitiveOrNested[]) {
  let item = this._storage;

  const l = keys.length - 1;

  if (l < 0) {
    item.clear();

    return;
  }

  for (let i = 0; i < l; i++) {
    let key = keys[i];

    if (!item.has(key)) {
      if (key && typeof key == 'object') {
        const strKey = toKey(key);

        if (item.has(strKey)) {
          key = item.get(strKey)!;
        } else {
          return;
        }
      } else {
        return;
      }
    }

    item = item.get(key)!;
  }

  const key = keys[l];

  if (item.has(key)) {
    item.delete(key);
  } else if (key && typeof key == 'object') {
    const strKey = toKey(key);

    if (item.has(strKey)) {
      item.delete(item.get(strKey)!);

      item.delete(strKey);
    }
  }
}

function clear(this: Storage<any, any>, ...keys: PrimitiveOrNested[]) {
  let item = this._storage;

  const l = keys.length;

  for (let i = 0; i < l; i++) {
    let key = keys[i];

    if (!item.has(key)) {
      if (key && typeof key == 'object') {
        const strKey = toKey(key);

        if (item.has(strKey)) {
          key = item.get(strKey)!;
        } else {
          return;
        }
      } else {
        return;
      }
    }

    item = item.get(key)!;
  }

  if (item instanceof Map) {
    const queue: Map<any, any>[] = [item];

    const push = queue.push.bind(queue);

    const pop = queue.pop.bind(queue);

    while (queue.length) {
      const item = pop()!;

      let i = item.size;

      if (i) {
        const it = item.values();

        const next = it.next.bind(it);

        const first = next().value;

        if (first instanceof Map) {
          push(first);

          while (--i) {
            push(next().value);
          }
        } else {
          (first as Control)[ROOT]._set(undefined);

          while (--i) {
            (next().value as Control)[ROOT]._set(undefined);
          }
        }
      }
    }
  } else {
    (item as Control)[ROOT]._set(undefined);
  }
}

function has(this: Storage<any, any>, ...keys: PrimitiveOrNested[]) {
  let item = this._storage;

  const l = keys.length - 1;

  for (let i = 0; i < l; i++) {
    let key = keys[i];

    if (!item.has(key)) {
      if (key && typeof key == 'object') {
        const strKey = toKey(key);

        if (item.has(strKey)) {
          key = item.get(strKey)!;
        } else {
          return false;
        }
      } else {
        return false;
      }
    }

    item = item.get(key)!;
  }

  const lastKey = keys[l];

  return item.has(lastKey) || item.has(toKey(lastKey));
}

function get(this: Storage<any, any>, ...keys: any[]): any {
  const l = keys.length;

  const self = this;

  let item = self._storage;

  for (let i = 0; i < l; i++) {
    const key = keys[i];

    if (item.has(key)) {
      item = item.get(key)!;

      continue;
    }

    if (key && typeof key == 'object') {
      const strKey = toKey(key);

      if (item.has(strKey)) {
        const prevKey = item.get(strKey)!;

        const prevItem = item.get(prevKey)!;

        item.delete(prevKey);

        item.set(key, prevItem);

        item.set(strKey, key);

        item = prevItem;

        continue;
      }

      item.set(strKey, key);
    }

    const parentItem = item;

    if (i < l - 1) {
      item = new Map();
    } else if (self._getItem.length != 4) {
      item = self._getItem(
        self._arg1,
        self._arg2,
        self._keys ? self._keys.concat(keys) : keys
      );
    } else {
      item = self._getItem(
        self._arg1,
        self._arg2,
        self._arg3,
        self._keys ? self._keys.concat(keys) : keys
      );
    }

    parentItem.set(key, item);
  }

  return item;
}

const createStorageRecord = (
  obj: Record<string, any[]>,
  _: never,
  keys: PrimitiveOrNested[]
) =>
  Object.keys(obj).reduce((acc, key) => {
    const item = obj[key];

    const a0 = item[0];

    return {
      ...acc,
      [key]:
        a0 != createStorage
          ? (a0 as Function).length != 4
            ? a0(item[1], item[2], keys)
            : a0(item[1], item[2], item[3], keys)
          : a0(item[1], item[2], item[3], item[4], keys),
    };
  }, {});

const createStorage: CreateStorage = (
  arg1: any,
  arg2?: unknown,
  arg3?: any,
  arg4?: any,
  keys?: any[]
): any => {
  return (
    typeof arg1 != 'object'
      ? {
          _storage: new Map(),
          unsafe_delete: _delete,
          get,
          clear,
          has,
          _getItem: arg1,
          _arg1: arg2,
          _arg2: arg3,
          _arg3: arg4,
          _keys: keys,
        }
      : {
          _storage: new Map(),
          unsafe_delete: _delete,
          get,
          clear,
          has,
          _getItem: createStorageRecord,
          _arg1: arg1,
          _keys: keys,
        }
  ) as Storage<any, any>;
};

export type { Storage };

export default createStorage;
