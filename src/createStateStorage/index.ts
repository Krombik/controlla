import toKey, {
  NestedArray,
  NestedObject,
  type PrimitiveOrNested,
} from 'keyweaver';
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
  Nesting,
  AsyncStateOptions,
  RequestableStateOptions,
  PollableStateOptions,
  RetrieveState,
  StorageKeys,
  STATE_STORAGE_MARKER,
  LoadableStateOptions,
  ControllableStateOptions,
} from '../types';
import { EMPTY_ARR } from '../utils/constants';
import path from '../utils/path';
import createState from '../createState';
import createAsyncState from '../createAsyncState';
import createNestedState from '../createNestedState';
import createAsyncNestedState from '../createAsyncNestedState';
import createRequestableState from '../createRequestableState';
import createRequestableNestedState from '../createRequestableNestedState';
import createPollableState from '../createPollableState';
import createPollableNestedState from '../createPollableNestedState';

function get(this: StateStorage<any, any, any[]>, ...args: any[]) {
  type Item = State<any, any[]> | StateStorage<any, any>;

  type Container = Record<string, Item>;

  let item: Item | Container = this._get(args, 0);

  for (let i = 1; i < args.length; i++) {
    item = (item as StateStorage<any, any>)._get(args, i);
  }

  if (this.keys.length) {
    args = this.keys.concat(args);
  }

  return '_internal' in item || '_get' in item
    ? ({
        ...item,
        keys: args,
      } as Item)
    : Object.keys(item).reduce<Container>(
        (acc, key) => ({
          ...acc,
          [key]: {
            ...(item as Container)[key],
            a: args,
          },
        }),
        {}
      );
}

const recursiveWrap = (
  getItem: (args?: any[]) => any,
  count: number
): (() => NestedStateStorage<any[], any>) =>
  count
    ? recursiveWrap((): StateStorage<any, any, any[]> => {
        type Item = AnyState | StateStorage<any, any>;

        const storage = new Map<any, Item>();

        let keyStorage: Map<string, any>;

        return {
          get: get as any,
          path,
          keys: EMPTY_ARR,
          _path: EMPTY_ARR,
          _get(args, index) {
            const arg = args[index];

            if (storage.has(arg)) {
              return storage.get(arg)!;
            }

            if (arg && typeof arg == 'object') {
              keyStorage ||= new Map();

              const key = toKey(arg);

              if (keyStorage.has(key)) {
                const prevArg = keyStorage.get(key)!;

                const item = storage.get(prevArg)!;

                storage.delete(prevArg);

                storage.set(arg, item);

                keyStorage.set(key, arg);

                return item;
              }

              keyStorage.set(key, arg);
            }

            const item: Item = getItem(args);

            storage.set(arg, item);

            return item;
          },
        };
      }, count - 1)
    : getItem;

type GenerateArr<
  Length extends number,
  Result extends PrimitiveOrNested[] = [],
> = Result['length'] extends Length
  ? Result
  : GenerateArr<Length, [...Result, PrimitiveOrNested]>;

type AnyAsyncOptions = { value?(...args: any): any };

type AnyOptions = { load(...args: any[]): any } & AnyAsyncOptions;

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

type l = OriginalStateArgs<OriginalStateCreator, any>;

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

type WithCreateStateStorage<T extends any[]> = [KAwdl, ...T];

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

interface KAwdl {
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

const createStateStorage: KAwdl = (
  arg1: ((...arg: any[]) => AnyState) | Oi | typeof createStateStorage,
  arg2?: AnyOptions | ((...args: any[]) => any) | number | unknown,
  arg3?: number
) => {
  let fn: undefined | ((...args: any[]) => any);

  let count: number | undefined;

  const l = createState.length;

  const typeofArg2 = typeof arg2;

  if (!l) {
    fn = createState;

    if (typeofArg2 == 'number') {
      count = arg2 as number;
    }
  } else if (typeofArg2 == 'function') {
    count = (arg2 as Function).length;

    if (l == 1) {
      fn = (args) => createState((arg2 as Function)(...args));
    }
  } else if (arg2 && typeofArg2 == 'object') {
    const { load, value } = arg2 as Partial<AnyOptions>;

    if (load) {
      count = load.length;
    }

    if (typeof value == 'function') {
      count ||= value.length;

      if (l == 1) {
        fn = (args) => createState({ ...arg2, value: value(...args) });
      }
    }
  }

  return recursiveWrap(
    fn || createState.bind(null, arg2),
    count || arg3 || 1
  )();
};

createStateStorage(
  {
    // kek: [createNestedState, 2],
    // trr: [
    //   createRequestableState,
    //   {
    //     async load(a, b, c) {
    //       return 'wad';
    //     },
    //   },
    // ],
    // bek: [() => {}, { w: [() => {}, createState, 2] }, 2],
    bek: [
      createStateStorage,
      {
        w: [createState, (a: string, b: string) => 'wda'],
      },
      2,
    ],
    // bek: [() => {}, createState, 2, 2],

    // sek: [createStateStorage, createState, 'wda'],
  },
  1
)
  .get(1)
  .bek.get(1, 2).w;

// createStateStorage(createState, (a: number, b: string) => 25);

export default createStateStorage;
