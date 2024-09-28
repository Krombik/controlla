import toKey, { type PrimitiveOrNested } from 'keyweaver';
import type {
  AnyState,
  AsyncNestedState,
  AsyncState,
  LoadableNestedState,
  LoadableState,
  NestedState,
  NestedStateStorage,
  ControllableNestedState,
  ControllableState,
  State,
  StateStorage,
  AsyncStateOptions,
  RequestableStateOptions,
  PollableStateOptions,
  RetrieveState,
  StorageKeys,
  STATE_STORAGE_MARKER,
  LoadableStateOptions,
  ControllableStateOptions,
  StorageUtils,
} from '../types';
import { EMPTY_ARR } from '../utils/constants';
import path from '../utils/path';
import type createState from '../createState';
import type createAsyncState from '../createAsyncState';
import type createNestedState from '../createNestedState';
import type createAsyncNestedState from '../createAsyncNestedState';
import type createRequestableState from '../createRequestableState';
import type createRequestableNestedState from '../createRequestableNestedState';
import type createPollableState from '../createPollableState';
import type createPollableNestedState from '../createPollableNestedState';

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

type WithDeepness<T extends any[], K extends PrimitiveOrNested[] | number> = [
  ...T,
  ...(K extends number
    ? K extends 1
      ? [deepness?: K]
      : [deepness: K]
    : [deepness?: LengthOf<K>]),
];

type OriginalStateCreator = typeof createState | typeof createNestedState;

type OriginalStateArgs<CreateState extends OriginalStateCreator, T> = [
  createState: CreateState,
  defaultValue?: T,
];

type OriginalStateArgsWithDeepness<
  CreateState extends OriginalStateCreator,
  T,
  C extends number,
> = WithDeepness<OriginalStateArgs<CreateState, T>, C>;

type OriginalGetStateArgs<
  CreateState extends OriginalStateCreator,
  T,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = [
  createState: CreateState,
  getDefaultValue: (...args: [...ParentKeys, ...Keys]) => T,
];

type OriginalGetStateArgsWithDeepness<
  CreateState extends OriginalStateCreator,
  T,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithDeepness<OriginalGetStateArgs<CreateState, T, Keys, ParentKeys>, Keys>;

type OriginalAsyncStateCreator =
  | typeof createAsyncState
  | typeof createAsyncNestedState;

type OriginalAsyncGetStateArgs<
  CreateState extends OriginalAsyncStateCreator,
  T,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = [
  createState: CreateState,
  options: Omit<AsyncStateOptions<T>, 'value'> & {
    value: (...keys: [...ParentKeys, ...Keys]) => T;
  },
];

type OriginalAsyncGetStateArgsWithDeepness<
  CreateState extends OriginalAsyncStateCreator,
  T,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithDeepness<
  OriginalAsyncGetStateArgs<CreateState, T, Keys, ParentKeys>,
  Keys
>;

type OriginalAsyncStateArgs<
  CreateState extends OriginalAsyncStateCreator,
  T,
> = [
  createState: CreateState,
  options?: Omit<AsyncStateOptions<T>, 'value'> & {
    value?: T;
  },
];

type OriginalAsyncStateArgsWithDeepness<
  CreateState extends OriginalAsyncStateCreator,
  T,
  C extends number,
> = WithDeepness<OriginalAsyncStateArgs<CreateState, T>, C>;

type OriginalLoadableStateArgs<
  CreateState extends OriginalAsyncStateCreator,
  T,
  E,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = [
  createState: CreateState,
  options: LoadableStateOptions<T, E, [...ParentKeys, ...Keys]>,
];

type OriginalLoadableStateArgsWithDeepness<
  CreateState extends OriginalAsyncStateCreator,
  T,
  E,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithDeepness<
  OriginalLoadableStateArgs<CreateState, T, E, Keys, ParentKeys>,
  Keys
>;

type OriginalControllableStateArgs<
  CreateState extends OriginalAsyncStateCreator,
  T,
  E,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = [
  createState: CreateState,
  options: ControllableStateOptions<T, E, [...ParentKeys, ...Keys]>,
];

type OriginalControllableStateArgsWithDeepness<
  CreateState extends OriginalAsyncStateCreator,
  T,
  E,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithDeepness<
  OriginalControllableStateArgs<CreateState, T, E, Keys, ParentKeys>,
  Keys
>;

type OriginalRequestableStateCreator =
  | typeof createRequestableState
  | typeof createRequestableNestedState;

type OriginalRequestableStateArgs<
  CreateState extends OriginalRequestableStateCreator,
  T,
  E,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = [
  createState: CreateState,
  options: RequestableStateOptions<T, E, [...ParentKeys, ...Keys]>,
];

type OriginalRequestableStateArgsWithDeepness<
  CreateState extends OriginalRequestableStateCreator,
  T,
  E,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithDeepness<
  OriginalRequestableStateArgs<CreateState, T, E, Keys, ParentKeys>,
  Keys
>;

type OriginalPollableStateCreator =
  | typeof createPollableState
  | typeof createPollableNestedState;

type OriginalPollableStateArgs<
  CreateState extends OriginalPollableStateCreator,
  T,
  E,
  Keys extends any[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = [
  createState: CreateState,
  options: PollableStateOptions<T, E, [...ParentKeys, ...Keys]>,
];

type OriginalPollableStateArgsWithDeepness<
  CreateState extends OriginalPollableStateCreator,
  T,
  E,
  Keys extends any[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = WithDeepness<
  OriginalPollableStateArgs<CreateState, T, E, Keys, ParentKeys>,
  Keys
>;

type Lll =
  | StorageRecord
  | State<any>
  | {
      [STATE_STORAGE_MARKER]: [PrimitiveOrNested, Lll];
    };

type StorageRecord = {
  [key: string]: State<any> | StateStorage<PrimitiveOrNested, Lll>;
};

type Bek<
  T extends State<any>,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[],
> =
  T extends State<infer V>
    ? T extends ControllableState<any, infer E>
      ?
          | OriginalPollableStateArgsWithDeepness<
              T extends ControllableNestedState<any>
                ? typeof createPollableNestedState
                : typeof createPollableState,
              V,
              E,
              Keys,
              ParentKeys
            >
          | OriginalControllableStateArgsWithDeepness<
              T extends ControllableNestedState<any>
                ? typeof createAsyncNestedState
                : typeof createAsyncState,
              V,
              E,
              Keys,
              ParentKeys
            >
      : T extends LoadableState<any, infer E>
        ?
            | OriginalRequestableStateArgsWithDeepness<
                T extends LoadableNestedState<any>
                  ? typeof createRequestableNestedState
                  : typeof createRequestableState,
                V,
                E,
                Keys,
                ParentKeys
              >
            | OriginalLoadableStateArgsWithDeepness<
                T extends LoadableNestedState<any>
                  ? typeof createAsyncNestedState
                  : typeof createAsyncState,
                V,
                E,
                Keys,
                ParentKeys
              >
        : T extends AsyncState<any>
          ?
              | OriginalAsyncGetStateArgsWithDeepness<
                  T extends AsyncNestedState<any>
                    ? typeof createAsyncNestedState
                    : typeof createAsyncState,
                  V,
                  Keys,
                  ParentKeys
                >
              | OriginalAsyncStateArgsWithDeepness<
                  T extends AsyncNestedState<any>
                    ? typeof createAsyncNestedState
                    : typeof createAsyncState,
                  V,
                  LengthOf<Keys>
                >
          :
              | OriginalGetStateArgsWithDeepness<
                  T extends NestedState<any>
                    ? typeof createNestedState
                    : typeof createState,
                  V,
                  Keys,
                  ParentKeys
                >
              | OriginalStateArgsWithDeepness<
                  T extends NestedState<any>
                    ? typeof createNestedState
                    : typeof createState,
                  V,
                  LengthOf<Keys>
                >
    : never;

type RemoveLast<T extends any[]> = T extends [...infer Head, any?]
  ? Head
  : never;

type Jjj<
  Item,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[],
> =
  Item extends State<any>
    ? RemoveLast<Bek<Item, Keys, ParentKeys>>
    : Item extends StateStorage<any, Lll>
      ? RetrieveState<Item> extends infer S
        ? StorageKeys<Item> extends infer K extends PrimitiveOrNested[]
          ? S extends StorageRecord
            ? WithDeepness<
                WithCreateStateStorage<[Kek<S, K, [...ParentKeys, ...Keys]>]>,
                LengthOf<K>
              >
            : S extends State<any>
              ? WithCreateStateStorage<Bek<S, K, [...ParentKeys, ...Keys]>>
              : never
          : never
        : never
      : never;

type Kek<
  T extends StorageRecord,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = {
  [key in keyof T]: Jjj<T[key], Keys, ParentKeys>;
};

type Oi<
  Keys extends PrimitiveOrNested[] = PrimitiveOrNested[],
  J extends Record<string, number> = Record<string, number>,
  Prefix extends string = '',
> = {
  [key in keyof J]:
    | OriginalStateArgs<OriginalStateCreator, any>
    | OriginalAsyncStateArgs<OriginalAsyncStateCreator, any>
    | OriginalGetStateArgs<OriginalStateCreator, any, Keys>
    | OriginalControllableStateArgs<OriginalAsyncStateCreator, any, any, Keys>
    | OriginalLoadableStateArgs<OriginalAsyncStateCreator, any, any, Keys>
    | OriginalAsyncGetStateArgs<OriginalAsyncStateCreator, any, Keys>
    | OriginalRequestableStateArgs<
        OriginalRequestableStateCreator,
        any,
        any,
        Keys
      >
    | OriginalPollableStateArgs<OriginalPollableStateCreator, any, any, Keys>
    | WithCreateStateStorage<
        | OriginalControllableStateArgsWithDeepness<
            OriginalAsyncStateCreator,
            any,
            any,
            Keys
          >
        | OriginalLoadableStateArgsWithDeepness<
            OriginalAsyncStateCreator,
            any,
            any,
            Keys
          >
        | OriginalGetStateArgsWithDeepness<
            OriginalStateCreator,
            any,
            PrimitiveOrNested[]
          >
        | OriginalAsyncGetStateArgsWithDeepness<
            OriginalAsyncStateCreator,
            any,
            PrimitiveOrNested[]
          >
        | OriginalRequestableStateArgsWithDeepness<
            OriginalRequestableStateCreator,
            any,
            any,
            PrimitiveOrNested[]
          >
        | OriginalPollableStateArgsWithDeepness<
            OriginalPollableStateCreator,
            any,
            any,
            PrimitiveOrNested[]
          >
        | [...OriginalStateArgs<OriginalStateCreator, any>, J[key]?]
        | [...OriginalAsyncStateArgs<OriginalAsyncStateCreator, any>, J[key]?]
      >
    | WithCreateStateStorage<
        [
          Oi<
            PrimitiveOrNested[],
            J,
            `${Prefix}.${key extends string ? key : never}`
          >,
          J[key],
        ]
      >;
};

type WithCreateStateStorage<T extends any[]> = [CreateStateStorage, ...T];

type DetectState<T, V, E = any> = T extends typeof createState
  ? State<V>
  : T extends typeof createNestedState
    ? NestedState<V>
    : T extends typeof createAsyncState
      ? AsyncState<V, E>
      : T extends typeof createAsyncNestedState
        ? AsyncNestedState<V, E>
        : T extends typeof createRequestableState
          ? LoadableState<V, E>
          : T extends typeof createRequestableNestedState
            ? LoadableNestedState<V, E>
            : T extends typeof createPollableState
              ? ControllableState<V, E>
              : T extends typeof createPollableNestedState
                ? ControllableNestedState<V, E>
                : never;

type Io<T extends Oi, ParentKeys extends PrimitiveOrNested[] = []> = {
  [key in keyof T]: T[key] extends OriginalGetStateArgs<
    infer CreateState,
    infer V,
    PrimitiveOrNested[],
    ParentKeys
  >
    ? DetectState<CreateState, V>
    : T[key] extends OriginalStateArgs<infer CreateState, infer V>
      ? DetectState<CreateState, V>
      : T[key] extends OriginalControllableStateArgs<
            infer CreateState,
            infer V,
            infer E,
            PrimitiveOrNested[],
            ParentKeys
          >
        ? CreateState extends typeof createAsyncState
          ? ControllableState<V, E>
          : ControllableNestedState<V, E>
        : T[key] extends OriginalLoadableStateArgs<
              infer CreateState,
              infer V,
              infer E,
              PrimitiveOrNested[],
              ParentKeys
            >
          ? CreateState extends typeof createAsyncState
            ? LoadableState<V, E>
            : LoadableNestedState<V, E>
          : T[key] extends OriginalAsyncGetStateArgs<
                infer CreateState,
                infer V,
                PrimitiveOrNested[],
                ParentKeys
              >
            ? DetectState<CreateState, V>
            : T[key] extends OriginalAsyncStateArgs<infer CreateState, infer V>
              ? DetectState<CreateState, V>
              : T[key] extends OriginalRequestableStateArgs<
                    infer CreateState,
                    infer V,
                    infer E,
                    PrimitiveOrNested[],
                    ParentKeys
                  >
                ? DetectState<CreateState, V, E>
                : T[key] extends OriginalPollableStateArgs<
                      infer CreateState,
                      infer V,
                      infer E,
                      PrimitiveOrNested[],
                      ParentKeys
                    >
                  ? DetectState<CreateState, V, E>
                  : T[key] extends WithCreateStateStorage<
                        OriginalPollableStateArgsWithDeepness<
                          infer CreateState,
                          infer V,
                          infer E,
                          infer K,
                          ParentKeys
                        >
                      >
                    ? NestedStateStorage<K, DetectState<CreateState, V, E>>
                    : T[key] extends WithCreateStateStorage<
                          OriginalRequestableStateArgsWithDeepness<
                            infer CreateState,
                            infer V,
                            infer E,
                            infer K,
                            ParentKeys
                          >
                        >
                      ? NestedStateStorage<K, DetectState<CreateState, V, E>>
                      : T[key] extends WithCreateStateStorage<
                            OriginalControllableStateArgs<
                              infer CreateState,
                              infer V,
                              infer E,
                              infer K,
                              ParentKeys
                            >
                          >
                        ? NestedStateStorage<
                            K,
                            CreateState extends typeof createAsyncState
                              ? ControllableState<V, E>
                              : ControllableNestedState<V, E>
                          >
                        : T[key] extends WithCreateStateStorage<
                              OriginalLoadableStateArgs<
                                infer CreateState,
                                infer V,
                                infer E,
                                infer K,
                                ParentKeys
                              >
                            >
                          ? NestedStateStorage<
                              K,
                              CreateState extends typeof createAsyncState
                                ? LoadableState<V, E>
                                : LoadableNestedState<V, E>
                            >
                          : T[key] extends WithCreateStateStorage<
                                OriginalAsyncGetStateArgsWithDeepness<
                                  infer CreateState,
                                  infer V,
                                  infer K,
                                  ParentKeys
                                >
                              >
                            ? NestedStateStorage<K, DetectState<CreateState, V>>
                            : T[key] extends WithCreateStateStorage<
                                  OriginalAsyncStateArgsWithDeepness<
                                    infer CreateState,
                                    infer V,
                                    infer C
                                  >
                                >
                              ? NestedStateStorage<
                                  GenerateArr<C>,
                                  DetectState<CreateState, V>
                                >
                              : T[key] extends WithCreateStateStorage<
                                    OriginalAsyncStateArgs<
                                      infer CreateState,
                                      infer V
                                    >
                                  >
                                ? NestedStateStorage<
                                    [PrimitiveOrNested],
                                    DetectState<CreateState, V>
                                  >
                                : T[key] extends WithCreateStateStorage<
                                      OriginalGetStateArgsWithDeepness<
                                        infer CreateState,
                                        infer V,
                                        infer K,
                                        ParentKeys
                                      >
                                    >
                                  ? NestedStateStorage<
                                      K,
                                      DetectState<CreateState, V>
                                    >
                                  : T[key] extends WithCreateStateStorage<
                                        OriginalStateArgsWithDeepness<
                                          infer CreateState,
                                          infer V,
                                          infer C
                                        >
                                      >
                                    ? NestedStateStorage<
                                        GenerateArr<C>,
                                        DetectState<CreateState, V>
                                      >
                                    : T[key] extends WithCreateStateStorage<
                                          OriginalStateArgs<
                                            infer CreateState,
                                            infer V
                                          >
                                        >
                                      ? NestedStateStorage<
                                          [PrimitiveOrNested],
                                          DetectState<CreateState, V>
                                        >
                                      : T[key] extends WithCreateStateStorage<
                                            [
                                              infer W extends Oi,
                                              infer K extends number,
                                            ]
                                          >
                                        ? GenerateArr<K> extends infer K extends
                                            PrimitiveOrNested[]
                                          ? NestedStateStorage<
                                              K,
                                              Io<W, [...ParentKeys, ...K]>
                                            >
                                          : never
                                        : T[key] extends WithCreateStateStorage<
                                              [infer W extends Oi]
                                            >
                                          ? NestedStateStorage<
                                              [PrimitiveOrNested],
                                              Io<
                                                W,
                                                [
                                                  ...ParentKeys,
                                                  PrimitiveOrNested,
                                                ]
                                              >
                                            >
                                          : never;
};

interface CreateStateStorage {
  <
    J extends Record<keyof T, number>,
    T extends Oi<Keys, J>,
    Keys extends GenerateArr<C>,
    C extends number = LengthOf<Keys>,
  >(
    ...args: WithDeepness<[obj: T], C>
  ): NestedStateStorage<Keys, Io<T, Keys>>;

  <
    T extends StorageRecord,
    Keys extends GenerateArr<C>,
    C extends number = LengthOf<Keys>,
  >(
    ...args: WithDeepness<[obj: Kek<T, Keys>], C>
  ): NestedStateStorage<Keys, T>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: OriginalControllableStateArgsWithDeepness<
      typeof createAsyncNestedState,
      T,
      E,
      Keys
    >
  ): NestedStateStorage<Keys, ControllableNestedState<T, E, Keys>>;
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: OriginalControllableStateArgsWithDeepness<
      typeof createAsyncState,
      T,
      E,
      Keys
    >
  ): NestedStateStorage<Keys, ControllableState<T, E, Keys>>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: OriginalLoadableStateArgsWithDeepness<
      typeof createAsyncNestedState,
      T,
      E,
      Keys
    >
  ): NestedStateStorage<Keys, LoadableNestedState<T, E, Keys>>;
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: OriginalLoadableStateArgsWithDeepness<
      typeof createAsyncState,
      T,
      E,
      Keys
    >
  ): NestedStateStorage<Keys, LoadableState<T, E, Keys>>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: OriginalAsyncGetStateArgsWithDeepness<
      typeof createAsyncNestedState,
      T,
      Keys
    >
  ): NestedStateStorage<Keys, AsyncNestedState<T, E, Keys>>;
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: OriginalAsyncGetStateArgsWithDeepness<
      typeof createAsyncState,
      T,
      Keys
    >
  ): NestedStateStorage<Keys, AsyncState<T, E, Keys>>;

  <T, Keys extends GenerateArr<C>, E = any, C extends number = LengthOf<Keys>>(
    ...args: OriginalAsyncStateArgsWithDeepness<
      typeof createAsyncNestedState,
      T,
      C
    >
  ): NestedStateStorage<Keys, AsyncNestedState<T, E, Keys>>;
  <T, Keys extends GenerateArr<C>, E = any, C extends number = LengthOf<Keys>>(
    ...args: OriginalAsyncStateArgsWithDeepness<typeof createAsyncState, T, C>
  ): NestedStateStorage<Keys, AsyncState<T, E, Keys>>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: OriginalRequestableStateArgsWithDeepness<
      typeof createRequestableNestedState,
      T,
      E,
      Keys
    >
  ): NestedStateStorage<Keys, LoadableNestedState<T, E, Keys>>;
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: OriginalRequestableStateArgsWithDeepness<
      typeof createRequestableState,
      T,
      E,
      Keys
    >
  ): NestedStateStorage<Keys, LoadableState<T, E, Keys>>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: OriginalPollableStateArgsWithDeepness<
      typeof createPollableNestedState,
      T,
      E,
      Keys
    >
  ): NestedStateStorage<Keys, ControllableNestedState<T, E, Keys>>;
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: OriginalPollableStateArgsWithDeepness<
      typeof createPollableState,
      T,
      E,
      Keys
    >
  ): NestedStateStorage<Keys, ControllableState<T, E, Keys>>;

  <T, Keys extends PrimitiveOrNested[]>(
    ...args: OriginalGetStateArgsWithDeepness<typeof createNestedState, T, Keys>
  ): NestedStateStorage<Keys, NestedState<T, Keys>>;
  <T, Keys extends PrimitiveOrNested[]>(
    ...args: OriginalGetStateArgsWithDeepness<typeof createState, T, Keys>
  ): NestedStateStorage<Keys, State<T, Keys>>;

  <T, Keys extends GenerateArr<C>, C extends number = LengthOf<Keys>>(
    ...args: OriginalStateArgsWithDeepness<typeof createNestedState, T, C>
  ): NestedStateStorage<Keys, NestedState<T, Keys>>;
  <T, Keys extends GenerateArr<C>, C extends number = LengthOf<Keys>>(
    ...args: OriginalStateArgsWithDeepness<typeof createState, T, C>
  ): NestedStateStorage<Keys, State<T, Keys>>;
}

const getStorageUtils = (
  getItem: any,
  options: any,
  depth: number
): StorageUtils => ({
  _storage: new Map(),
  _keyStorage: undefined,
  _get,
  _getItem: getItem,
  _options: options,
  _depth: depth - 1,
});

const toStorage = (utils: StorageUtils, keys: PrimitiveOrNested[]) =>
  ({
    _internal: utils,
    get,
    delete: _delete,
    keys,
    path,
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
  type Item = AnyState | StateStorage<any, any> | { [key: string]: Item };

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
    ? getStorageUtils(this._getItem, this._options, this._depth)
    : this._getItem(this._options, keys);

  storage.set(key, item);

  return item;
}

const createStorageRecord = (
  obj: Record<string, any[]>,
  keys: PrimitiveOrNested[]
) =>
  Object.keys(obj).reduce((acc, key) => {
    const item = obj[key];

    const [a0, a1] = item;

    return {
      ...acc,
      [key]: a0 != createStateStorage ? a0(a1, keys) : a0(a1, item[2], item[3]),
    };
  }, {});

const createStateStorage: CreateStateStorage = (
  arg1: any,
  arg2?: any,
  arg3?: number
): any => {
  if (typeof arg1 == 'object') {
    return toStorage(
      getStorageUtils(createStorageRecord, arg1, arg2 || 1),
      EMPTY_ARR
    );
  }

  let depth = arg3 || 1;

  if (arg2) {
    const typeofArg2 = typeof arg2;

    if (typeofArg2 == 'function') {
      depth = Math.max((arg2 as Function).length, depth);
    } else if (typeofArg2 == 'object') {
      const { load, value } = arg2 as Partial<LoadableStateOptions<unknown>>;

      depth = Math.max(
        typeof load == 'function' ? load.length : 1,
        typeof value == 'function' ? value.length : 1,
        depth
      );
    }
  }

  return toStorage(getStorageUtils(arg1, arg2, depth), EMPTY_ARR);
};

export default createStateStorage;
