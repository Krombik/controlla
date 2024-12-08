import toKey, { type PrimitiveOrNested } from 'keyweaver';
import type {
  AsyncState,
  LoadableState,
  NestedStateStorage,
  State,
  StateStorage,
  AsyncStateOptions,
  RequestableStateOptions,
  PollableStateOptions,
  STATE_STORAGE_IDENTIFIER,
  LoadableStateOptions,
  StorageUtils,
  StateInitializer,
  WithInitModule,
  PaginatedStateStorage,
  RetrieveStateOrPaginatedStorage,
  StorageKeysWithoutPagination,
  ResolvedValue,
} from '../types';
import { EMPTY_ARR } from '../utils/constants';
import scope from '../utils/scope';
import type createState from '../createState';
import type createAsyncState from '../createAsyncState';
import type createStateScope from '../createStateScope';
import type createAsyncStateScope from '../createAsyncStateScope';
import type createRequestableState from '../createRequestableState';
import type createRequestableStateScope from '../createRequestableStateScope';
import type createPollableState from '../createPollableState';
import type createPollableStateScope from '../createPollableStateScope';
import type createPaginatedStorage from '../createPaginatedStorage';
import {
  PaginatedPollableNestedStateArgs,
  PaginatedPollableStateArgs,
  PaginatedRequestableNestedStateArgs,
  PaginatedRequestableStateArgs,
} from '../createPaginatedStorage';

type GenerateArr<
  Length extends number,
  Result extends PrimitiveOrNested[] = [],
> = Result['length'] extends Length
  ? Result
  : GenerateArr<Length, [...Result, PrimitiveOrNested]>;

type LengthOf<Keys> = Keys extends any[]
  ? Keys['length'] extends 0
    ? 1
    : Keys['length']
  : 1;

type WithDepth<T extends any[], K extends number> = [
  ...T,
  ...(K extends 1 ? [depth?: K] : [depth: K]),
];

type StateCreator = typeof createState | typeof createStateScope;

type StateArgsBase<CreateState extends StateCreator, T> = [
  createState: CreateState,
  defaultValue?: T,
];

type StateArgs<CreateState extends StateCreator, T> = WithInitModule<
  T,
  StateArgsBase<CreateState, T>
>;

type StateArgsWithDeepness<
  CreateState extends StateCreator,
  T,
  C extends number,
> =
  | WithDepth<StateArgs<CreateState, T>, C>
  | WithDepth<StateArgsBase<CreateState, T>, C>;

type GetStateArgs<
  CreateState extends StateCreator,
  T,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithInitModule<
  T,
  [
    createState: CreateState,
    getDefaultValue: (...args: [...ParentKeys, ...Keys]) => T,
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
    options: Omit<AsyncStateOptions<T, E>, 'value'> & {
      value: (...keys: [...ParentKeys, ...Keys]) => T;
    },
  ]
>;

type AsyncStateArgsBase<CreateState extends AsyncStateCreator, T, E> = [
  createState: CreateState,
  options?: Omit<AsyncStateOptions<T, E>, 'value'> & {
    value?: T;
  },
];

type AsyncStateArgs<
  CreateState extends AsyncStateCreator,
  T,
  E,
> = WithInitModule<T, AsyncStateArgsBase<CreateState, T, E>>;

type AsyncStateArgsWithDeepness<
  CreateState extends AsyncStateCreator,
  T,
  E,
  C extends number,
> =
  | WithDepth<AsyncStateArgs<CreateState, T, E>, C>
  | WithDepth<AsyncStateArgsBase<CreateState, T, E>, C>;

type LoadableStateArgs<
  CreateState extends AsyncStateCreator,
  T,
  E,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithInitModule<
  T,
  [
    createState: CreateState,
    options: LoadableStateOptions<T, E, [...ParentKeys, ...Keys]>,
  ]
>;

type ControllableStateArgs<
  CreateState extends AsyncStateCreator,
  T,
  E,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithInitModule<
  T,
  [
    createState: CreateState,
    options: ControllableLoadableStateOptions<T, E, [...ParentKeys, ...Keys]>,
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

type StateStorageItem =
  | StorageRecord
  | PaginatedStateStorage<any>
  | State
  | {
      [STATE_STORAGE_IDENTIFIER]: [PrimitiveOrNested, StateStorageItem];
    };

type StorageRecord = {
  [key: string]:
    | State
    | PaginatedStateStorage<any>
    | StateStorage<PrimitiveOrNested, StateStorageItem>;
};

type StateCreationArguments<
  T extends State,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[],
> =
  T extends ControllableLoadableState<infer V, infer E>
    ?
        | PollableStateArgs<
            T extends ControllableLoadableNestedState
              ? typeof createPollableStateScope
              : typeof createPollableState,
            V,
            E,
            Keys,
            ParentKeys
          >
        | ControllableStateArgs<
            T extends ControllableLoadableNestedState
              ? typeof createAsyncStateScope
              : typeof createAsyncState,
            V,
            E,
            Keys,
            ParentKeys
          >
    : T extends LoadableState<infer V, infer E>
      ?
          | RequestableStateArgs<
              T extends LoadableNestedState
                ? typeof createRequestableStateScope
                : typeof createRequestableState,
              V,
              E,
              Keys,
              ParentKeys
            >
          | LoadableStateArgs<
              T extends LoadableNestedState
                ? typeof createAsyncStateScope
                : typeof createAsyncState,
              V,
              E,
              Keys,
              ParentKeys
            >
      : T extends AsyncState<infer V, infer E>
        ?
            | AsyncGetStateArgs<
                T extends AsyncNestedState
                  ? typeof createAsyncStateScope
                  : typeof createAsyncState,
                V,
                E,
                Keys,
                ParentKeys
              >
            | AsyncStateArgsWithDeepness<
                T extends AsyncNestedState
                  ? typeof createAsyncStateScope
                  : typeof createAsyncState,
                V,
                E,
                LengthOf<Keys>
              >
        : T extends State<infer V>
          ?
              | GetStateArgs<
                  T extends NestedState
                    ? typeof createStateScope
                    : typeof createState,
                  V,
                  Keys,
                  ParentKeys
                >
              | StateArgsWithDeepness<
                  T extends NestedState
                    ? typeof createStateScope
                    : typeof createState,
                  V,
                  LengthOf<Keys>
                >
          : never;

type PaginatedStorageArgs<
  T extends PaginatedStateStorage<any>,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[],
> =
  T extends PaginatedStateStorage<infer S>
    ? WithCreatePaginatedStorage<
        S extends ControllableLoadableNestedState<infer V, infer E>
          ? PaginatedPollableNestedStateArgs<
              ResolvedValue<V>,
              E,
              Keys,
              ParentKeys
            >
          : S extends ControllableLoadableState<infer V, infer E>
            ? PaginatedPollableStateArgs<ResolvedValue<V>, E, Keys, ParentKeys>
            : S extends LoadableNestedState<infer V, infer E>
              ? PaginatedRequestableNestedStateArgs<
                  ResolvedValue<V>,
                  E,
                  Keys,
                  ParentKeys
                >
              : S extends LoadableState<infer V, infer E>
                ? PaginatedRequestableStateArgs<
                    ResolvedValue<V>,
                    E,
                    Keys,
                    ParentKeys
                  >
                : never
      >
    : never;

type RemoveDepth<T extends any[]> = T extends [...infer Head, number?]
  ? Head
  : T;

type StorageRecordArgs<
  T extends StorageRecord,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = {
  [key in keyof T]: T[key] extends PaginatedStateStorage<any>
    ? PaginatedStorageArgs<T[key], Keys, ParentKeys>
    : T[key] extends State
      ? RemoveDepth<StateCreationArguments<T[key], Keys, ParentKeys>>
      : T[key] extends StateStorage<any, StateStorageItem>
        ? RetrieveStateOrPaginatedStorage<T[key]> extends infer S
          ? StorageKeysWithoutPagination<T[key]> extends infer K extends
              PrimitiveOrNested[]
            ? S extends StorageRecord
              ? WithDepth<
                  WithCreateStateStorage<
                    [StorageRecordArgs<S, K, [...ParentKeys, ...Keys]>]
                  >,
                  LengthOf<K>
                >
              : S extends State
                ? WithCreateStateStorage<
                    StateCreationArguments<S, K, [...ParentKeys, ...Keys]>
                  >
                : S extends PaginatedStateStorage<any>
                  ? WithCreateStateStorage<
                      PaginatedStorageArgs<S, K, [...ParentKeys, ...Keys]>
                    >
                  : never
            : never
          : never
        : never;
};

type WithCreatePaginatedStorage<T extends any[]> = [
  typeof createPaginatedStorage,
  ...T,
];

type WithCreateStateStorage<T extends any[]> = [CreateStateStorage, ...T];

interface CreateStateStorage {
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: WithCreatePaginatedStorage<
      PaginatedRequestableStateArgs<T, E, Keys>
    >
  ): NestedStateStorage<Keys, PaginatedStateStorage<LoadableState<T, E>>>;
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: WithCreatePaginatedStorage<
      PaginatedRequestableNestedStateArgs<T, E, Keys>
    >
  ): NestedStateStorage<Keys, PaginatedStateStorage<LoadableNestedState<T, E>>>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: WithCreatePaginatedStorage<PaginatedPollableStateArgs<T, E, Keys>>
  ): NestedStateStorage<
    Keys,
    PaginatedStateStorage<ControllableLoadableState<T, E>>
  >;
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: WithCreatePaginatedStorage<
      PaginatedPollableNestedStateArgs<T, E, Keys>
    >
  ): NestedStateStorage<
    Keys,
    PaginatedStateStorage<ControllableLoadableNestedState<T, E>>
  >;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: ControllableStateArgs<typeof createAsyncStateScope, T, E, Keys>
  ): NestedStateStorage<Keys, ControllableLoadableNestedState<T, E, Keys>>;
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: ControllableStateArgs<typeof createAsyncState, T, E, Keys>
  ): NestedStateStorage<Keys, ControllableLoadableState<T, E, Keys>>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: LoadableStateArgs<typeof createAsyncStateScope, T, E, Keys>
  ): NestedStateStorage<Keys, LoadableNestedState<T, E, Keys>>;
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: LoadableStateArgs<typeof createAsyncState, T, E, Keys>
  ): NestedStateStorage<Keys, LoadableState<T, E, Keys>>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: AsyncGetStateArgs<typeof createAsyncStateScope, T, E, Keys>
  ): NestedStateStorage<Keys, AsyncNestedState<T, E, Keys>>;
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: AsyncGetStateArgs<typeof createAsyncState, T, E, Keys>
  ): NestedStateStorage<Keys, AsyncState<T, E, Keys>>;

  <T, Keys extends GenerateArr<C>, E = any, C extends number = LengthOf<Keys>>(
    ...args: AsyncStateArgsWithDeepness<typeof createAsyncStateScope, T, E, C>
  ): NestedStateStorage<Keys, AsyncNestedState<T, E, Keys>>;
  <T, Keys extends GenerateArr<C>, E = any, C extends number = LengthOf<Keys>>(
    ...args: AsyncStateArgsWithDeepness<typeof createAsyncState, T, E, C>
  ): NestedStateStorage<Keys, AsyncState<T, E, Keys>>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: PollableStateArgs<typeof createPollableStateScope, T, E, Keys>
  ): NestedStateStorage<Keys, ControllableLoadableNestedState<T, E, Keys>>;
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: PollableStateArgs<typeof createPollableState, T, E, Keys>
  ): NestedStateStorage<Keys, ControllableLoadableState<T, E, Keys>>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: RequestableStateArgs<
      typeof createRequestableStateScope,
      T,
      E,
      Keys
    >
  ): NestedStateStorage<Keys, LoadableNestedState<T, E, Keys>>;
  <T, const Keys extends PrimitiveOrNested[], E = any>(
    ...args: RequestableStateArgs<typeof createRequestableState, T, E, Keys>
  ): NestedStateStorage<Keys, LoadableState<T, E, Keys>>;

  <T, Keys extends PrimitiveOrNested[]>(
    ...args: GetStateArgs<typeof createStateScope, T, Keys>
  ): NestedStateStorage<Keys, NestedState<T, Keys>>;
  <T, Keys extends PrimitiveOrNested[]>(
    ...args: GetStateArgs<typeof createState, T, Keys>
  ): NestedStateStorage<Keys, State<T, Keys>>;

  <T, Keys extends GenerateArr<C>, C extends number = LengthOf<Keys>>(
    ...args: StateArgsWithDeepness<typeof createStateScope, T, C>
  ): NestedStateStorage<Keys, NestedState<T, Keys>>;
  <T, Keys extends GenerateArr<C>, C extends number = LengthOf<Keys>>(
    ...args: StateArgsWithDeepness<typeof createState, T, C>
  ): NestedStateStorage<Keys, State<T, Keys>>;

  <
    T extends StorageRecord,
    Keys extends GenerateArr<C>,
    C extends number = LengthOf<Keys>,
  >(
    ...args: WithDepth<[obj: StorageRecordArgs<T, Keys>], C>
  ): NestedStateStorage<Keys, T>;
}

const getStorageUtils = (
  getItem: any,
  arg1: any,
  arg2: any,
  arg3: any,
  depth: number
): StorageUtils => ({
  _storage: new Map(),
  _keyStorage: undefined,
  _get,
  _getItem: getItem,
  _arg1: arg1,
  _arg2: arg2,
  _arg3: arg3,
  _depth: depth - 1,
});

const toStorage = (utils: StorageUtils, keys: PrimitiveOrNested[]) =>
  ({
    _internal: utils,
    get,
    delete: _delete,
    keys,
    scope,
    _path: EMPTY_ARR,
  }) as Partial<StateStorage<any, any, any[]>> as StateStorage<any, any, any[]>;

function _delete(this: StateStorage<any, any, any[]>, key: PrimitiveOrNested) {
  const { _keyStorage: keyStorage } = this._internal;

  if (keyStorage && key && typeof key == 'object') {
    const strKey = toKey(key);

    if (keyStorage.has(strKey)) {
      key = keyStorage.get(strKey)!;

      keyStorage.delete(strKey);
    }
  }

  this._internal._storage.delete(key);
}

function get(this: StateStorage<any, any, any[]>, ...keys: any[]): any {
  type Item = State<any, any[]> | StorageUtils;

  type Container = Record<string, Item>;

  let item: Item | Container = this._internal;

  const allKeys = this.keys.length ? this.keys.concat(keys) : keys;

  for (let i = 0; i < keys.length; i++) {
    item = (item as StorageUtils)._get(keys[i], allKeys);
  }

  return '_internal' in item
    ? ({ ...item, keys: allKeys } as State)
    : '_depth' in item
      ? toStorage(item as StorageUtils, allKeys)
      : Object.keys(item).reduce<Container>(
          (acc, key) => ({
            ...acc,
            [key]: { ...(item as Container)[key], keys: allKeys },
          }),
          {}
        );
}

function _get(
  this: StorageUtils,
  key: PrimitiveOrNested,
  keys: PrimitiveOrNested[]
) {
  type Item = State | StateStorage<any, any> | { [key: string]: Item };

  const storage = this._storage;

  if (storage.has(key)) {
    return storage.get(key)!;
  }

  if (key && typeof key == 'object') {
    if (!this._keyStorage) {
      this._keyStorage = new Map();
    }

    const keyStorage = this._keyStorage;

    const strKey = toKey(key);

    if (keyStorage.has(strKey)) {
      const prevKey = keyStorage.get(strKey)!;

      const item = storage.get(prevKey)!;

      storage.delete(prevKey);

      storage.set(key, item);

      keyStorage.set(strKey, key);

      return item;
    }

    keyStorage.set(strKey, key);
  }

  const item: Item = this._depth
    ? getStorageUtils(
        this._getItem,
        this._arg1,
        this._arg2,
        this._arg3,
        this._depth
      )
    : this._getItem(
        this._arg1,
        this._arg2,
        this._arg3 === null ? keys : this._arg3
      );

  storage.set(key, item);

  return item;
}

const createStorageRecord = (
  obj: Record<string, any[]>,
  parentDepth: number,
  keys: PrimitiveOrNested[]
) =>
  Object.keys(obj).reduce((acc, key) => {
    const item = obj[key];

    const [a0] = item;

    return {
      ...acc,
      [key]:
        a0 != createStateStorage
          ? (a0 as Function).length == 4
            ? a0(item[1], item[2], keys)
            : a0(item[1], item[2], item[3])
          : a0(item[1], item[2], item[3], item[4], parentDepth),
    };
  }, {});

const createStateStorage: CreateStateStorage = (
  arg1: unknown,
  arg2?: unknown,
  arg3?: unknown,
  arg4?: number | StateInitializer,
  parentDepth?: number
): any => {
  parentDepth ||= 0;

  if (typeof arg1 == 'object') {
    return toStorage(
      getStorageUtils(
        createStorageRecord,
        arg1,
        parentDepth + ((arg2 as number) || 1),
        null,
        (arg2 as number) || 1
      ),
      EMPTY_ARR
    );
  }

  let depth: number | undefined;

  if (arg2) {
    if (typeof arg2 == 'function') {
      if (typeof arg3 == 'object') {
        return toStorage(
          getStorageUtils(
            arg1,
            arg2,
            arg3,
            arg4,
            (arg3 as LoadableStateOptions<unknown>).load.length - 1
          ),
          EMPTY_ARR
        );
      }

      depth = arg2.length - parentDepth;
    } else if (typeof arg2 == 'object') {
      const { load, value } = arg2 as Partial<LoadableStateOptions<unknown>>;

      if (typeof load == 'function') {
        depth = load.length - parentDepth;
      } else if (typeof value == 'function') {
        depth = value.length - parentDepth;
      }
    }
  }

  if (depth == null) {
    depth =
      (typeof arg3 == 'number' ? arg3 : (arg4 as number | undefined)) || 1;
  }

  if (depth > 0) {
    return toStorage(
      getStorageUtils(
        arg1,
        arg2,
        typeof arg3 != 'number' ? arg3 : undefined,
        null,
        depth
      ),
      EMPTY_ARR
    );
  }

  throw new Error('depth should be > 0');
};

export type { StateStorage, NestedStateStorage };

export default createStateStorage;
