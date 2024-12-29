import toKey, { type PrimitiveOrNested } from 'keyweaver';
import type {
  AsyncState,
  LoadableState,
  State,
  Storage,
  AsyncStateOptions,
  RequestableStateOptions,
  PollableStateOptions,
  LoadableStateOptions,
  WithInitModule,
  PaginatedStorage,
  PollableStateScope,
  PollableState,
  LoadableStateScope,
  AsyncStateScope,
  StateScope,
  PollableMethods,
  StorageRecord,
} from '../types';
import type createState from '../createState';
import type createAsyncState from '../createAsyncState';
import type createStateScope from '../createStateScope';
import type createAsyncStateScope from '../createAsyncStateScope';
import type createRequestableState from '../createRequestableState';
import type createRequestableStateScope from '../createRequestableStateScope';
import type createPollableState from '../createPollableState';
import type createPollableStateScope from '../createPollableStateScope';
import type createPaginatedStorage from '../createPaginatedStorage';
import type {
  PaginatedPollableNestedStateArgs,
  PaginatedPollableStateArgs,
  PaginatedRequestableNestedStateArgs,
  PaginatedRequestableStateArgs,
} from '../createPaginatedStorage';

type StateCreator = typeof createState | typeof createStateScope;

type GetStateArgs<
  CreateState extends StateCreator,
  T,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithInitModule<
  T,
  [
    createState: CreateState,
    defaultValue?: T | ((keys: [...ParentKeys, ...Keys]) => T),
  ]
>;

type AsyncStateCreator = typeof createAsyncState | typeof createAsyncStateScope;

type AsyncGetStateArgs<
  CreateState extends AsyncStateCreator,
  T,
  E,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithInitModule<
  T,
  [
    createState: CreateState,
    options?: AsyncStateOptions<T, E, [...ParentKeys, ...Keys]>,
  ]
>;

type LoadableStateArgs<
  CreateState extends AsyncStateCreator,
  T,
  E,
  Control,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithInitModule<
  T,
  [
    createState: CreateState,
    options: LoadableStateOptions<T, E, Control, [...ParentKeys, ...Keys]>,
  ]
>;

type RequestableStateCreator =
  | typeof createRequestableState
  | typeof createRequestableStateScope;

type RequestableStateArgs<
  CreateState extends RequestableStateCreator,
  T,
  E,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithInitModule<
  T,
  [
    createState: CreateState,
    options: RequestableStateOptions<T, E, [...ParentKeys, ...Keys]>,
  ]
>;

type PollableStateCreator =
  | typeof createPollableState
  | typeof createPollableStateScope;

type PollableStateArgs<
  CreateState extends PollableStateCreator,
  T,
  E,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithInitModule<
  T,
  [
    createState: CreateState,
    options: PollableStateOptions<T, E, [...ParentKeys, ...Keys]>,
  ]
>;

type StateCreationArguments<
  T extends State,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[],
> = T extends
  | LoadableState<infer V, infer E, infer C>
  | LoadableStateScope<infer V, infer E, infer C>
  ? C extends PollableMethods
    ? PollableStateArgs<
        T extends LoadableState
          ? typeof createPollableState
          : typeof createPollableStateScope,
        V,
        E,
        Keys,
        ParentKeys
      >
    : [C] extends [never]
      ?
          | RequestableStateArgs<
              T extends LoadableState
                ? typeof createRequestableState
                : typeof createRequestableStateScope,
              V,
              E,
              Keys,
              ParentKeys
            >
          | LoadableStateArgs<
              T extends LoadableState
                ? typeof createAsyncState
                : typeof createAsyncStateScope,
              V,
              E,
              never,
              Keys,
              ParentKeys
            >
      : LoadableStateArgs<
          T extends LoadableState
            ? typeof createAsyncState
            : typeof createAsyncStateScope,
          V,
          E,
          C,
          Keys,
          ParentKeys
        >
  : T extends AsyncState<infer V, infer E>
    ? AsyncGetStateArgs<
        T extends AsyncStateScope
          ? typeof createAsyncStateScope
          : typeof createAsyncState,
        V,
        E,
        Keys,
        ParentKeys
      >
    : T extends State<infer V>
      ? GetStateArgs<
          T extends StateScope ? typeof createStateScope : typeof createState,
          V,
          Keys,
          ParentKeys
        >
      : never;

type PaginatedStorageArgs<
  T extends PaginatedStorage<any>,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[],
> =
  T extends PaginatedStorage<infer S>
    ? WithCreatePaginatedStorage<
        S extends PollableStateScope<infer V, infer E>
          ? PaginatedPollableNestedStateArgs<V, E, [...ParentKeys, Keys]>
          : S extends PollableState<infer V, infer E>
            ? PaginatedPollableStateArgs<V, E, [...ParentKeys, Keys]>
            : S extends LoadableStateScope<infer V, infer E>
              ? PaginatedRequestableNestedStateArgs<V, E, [...ParentKeys, Keys]>
              : S extends LoadableState<infer V, infer E>
                ? PaginatedRequestableStateArgs<V, E, [...ParentKeys, Keys]>
                : never
      >
    : never;

type StorageRecordArgs<
  T extends StorageRecord,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = {
  [key in keyof T]: T[key] extends State
    ? StateCreationArguments<T[key], Keys, ParentKeys>
    : T[key] extends Storage<infer S, infer K>
      ? S extends StorageRecord
        ? WithCreateStateStorage<
            [StorageRecordArgs<S, K, [...ParentKeys, ...Keys]>]
          >
        : S extends State
          ? WithCreateStateStorage<
              StateCreationArguments<S, K, [...ParentKeys, ...Keys]>
            >
          : S extends PaginatedStorage<any>
            ? WithCreateStateStorage<
                PaginatedStorageArgs<S, K, [...ParentKeys, ...Keys]>
              >
            : never
      : never;
};

type WithCreatePaginatedStorage<T extends any[]> = [
  typeof createPaginatedStorage,
  ...T,
];

type WithCreateStateStorage<T extends any[]> = [CreateStorage, ...T];

interface CreateStorage {
  <T, Keys extends PrimitiveOrNested[], E = any, Control = never>(
    ...args: LoadableStateArgs<
      typeof createAsyncStateScope,
      T,
      E,
      Control,
      Keys
    >
  ): Storage<LoadableStateScope<T, E, Control>, Keys>;
  <T, Keys extends PrimitiveOrNested[], E = any, Control = never>(
    ...args: LoadableStateArgs<typeof createAsyncState, T, E, Control, Keys>
  ): Storage<LoadableState<T, E, Control>, Keys>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: PollableStateArgs<typeof createPollableStateScope, T, E, Keys>
  ): Storage<PollableStateScope<T, E>, Keys>;
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: PollableStateArgs<typeof createPollableState, T, E, Keys>
  ): Storage<PollableState<T, E>, Keys>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: AsyncGetStateArgs<typeof createAsyncStateScope, T, E, Keys>
  ): Storage<AsyncStateScope<T, E>, Keys>;
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: AsyncGetStateArgs<typeof createAsyncState, T, E, Keys>
  ): Storage<AsyncState<T, E>, Keys>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: RequestableStateArgs<
      typeof createRequestableStateScope,
      T,
      E,
      Keys
    >
  ): Storage<LoadableStateScope<T, E>, Keys>;
  <T, const Keys extends PrimitiveOrNested[], E = any>(
    ...args: RequestableStateArgs<typeof createRequestableState, T, E, Keys>
  ): Storage<LoadableState<T, E>, Keys>;

  <T, Keys extends PrimitiveOrNested[]>(
    ...args: GetStateArgs<typeof createStateScope, T, Keys>
  ): Storage<StateScope<T>, Keys>;
  <T, Keys extends PrimitiveOrNested[]>(
    ...args: GetStateArgs<typeof createState, T, Keys>
  ): Storage<StateScope<T>, Keys>;

  <T extends StorageRecord, Keys extends PrimitiveOrNested[]>(
    obj: StorageRecordArgs<T, Keys>
  ): Storage<T, Keys>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: WithCreatePaginatedStorage<
      PaginatedRequestableStateArgs<T, E, Keys>
    >
  ): Storage<PaginatedStorage<LoadableState<T, E>>, Keys>;
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: WithCreatePaginatedStorage<
      PaginatedRequestableNestedStateArgs<T, E, Keys>
    >
  ): Storage<PaginatedStorage<LoadableStateScope<T, E>>, Keys>;
}

function _delete(this: Storage<any, any>, ...keys: PrimitiveOrNested[]) {
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
          delete: _delete,
          get,
          _getItem: arg1,
          _arg1: arg2,
          _arg2: arg3,
          _arg3: arg4,
          _keys: keys,
        }
      : {
          _storage: new Map(),
          delete: _delete,
          get,
          _getItem: createStorageRecord,
          _arg1: arg1,
          _keys: keys,
        }
  ) as Storage<any, any>;
};

export type { Storage };

export default createStorage;
