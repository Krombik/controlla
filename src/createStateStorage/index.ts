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
      ? OriginalPollableStateArgsWithDeepness<
          T extends ControllableNestedState<any>
            ? typeof createPollableNestedState
            : typeof createPollableState,
          V,
          E,
          Keys,
          ParentKeys
        >
      : T extends LoadableState<any, infer E>
        ? OriginalRequestableStateArgsWithDeepness<
            T extends LoadableNestedState<any>
              ? typeof createRequestableNestedState
              : typeof createRequestableState,
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
                [
                  typeof createStateStorage,
                  Kek<S, K, [...ParentKeys, ...Keys]>,
                ],
                LengthOf<K>
              >
            : S extends State<any>
              ? [
                  typeof createStateStorage,
                  ...Bek<S, K, [...ParentKeys, ...Keys]>,
                ]
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
  J extends U<string> = U<string>,
> = {
  [key in keyof J]:
    | OriginalStateArgs<OriginalStateCreator, any>
    | OriginalAsyncStateArgs<OriginalAsyncStateCreator, any>
    | OriginalGetStateArgs<OriginalStateCreator, any, Keys>
    | OriginalAsyncGetStateArgs<OriginalAsyncStateCreator, any, Keys>
    | OriginalRequestableStateArgs<
        OriginalRequestableStateCreator,
        any,
        any,
        Keys
      >
    | OriginalPollableStateArgs<OriginalPollableStateCreator, any, any, Keys>
    | [
        typeof createStateStorage,
        ...(
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
          | [...OriginalStateArgs<OriginalStateCreator, any>, number?]
          | [...OriginalAsyncStateArgs<OriginalAsyncStateCreator, any>, number?]
        ),
      ]
    | readonly [() => void, Oi<PrimitiveOrNested[], J[key][1]>, J[key][0]];
};

type Io<
  T extends Oi,
  Keys extends PrimitiveOrNested[],
  ParentKeys extends PrimitiveOrNested[] = [],
> = {
  [key in keyof T]: T[key] extends OriginalGetStateArgs<
    infer CreateState,
    infer V,
    PrimitiveOrNested[]
  >
    ? CreateState extends typeof createState
      ? State<V>
      : NestedState<V>
    : T[key] extends OriginalStateArgs<infer CreateState, infer V>
      ? CreateState extends typeof createState
        ? State<V>
        : NestedState<V>
      : T[key] extends OriginalAsyncGetStateArgs<
            infer CreateState,
            infer V,
            PrimitiveOrNested[]
          >
        ? CreateState extends typeof createAsyncState
          ? AsyncState<V>
          : AsyncNestedState<V>
        : T[key] extends OriginalAsyncStateArgs<infer CreateState, infer V>
          ? CreateState extends typeof createAsyncState
            ? AsyncState<V>
            : AsyncNestedState<V>
          : T[key] extends OriginalRequestableStateArgs<
                infer CreateState,
                infer V,
                infer E,
                PrimitiveOrNested[]
              >
            ? CreateState extends typeof createRequestableState
              ? LoadableState<V, E>
              : LoadableNestedState<V, E>
            : T[key] extends OriginalPollableStateArgs<
                  infer CreateState,
                  infer V,
                  infer E,
                  PrimitiveOrNested[]
                >
              ? CreateState extends typeof createPollableState
                ? ControllableState<V, E>
                : ControllableNestedState<V, E>
              : T[key] extends [
                    () => void,
                    infer W extends Oi,
                    infer K extends number,
                  ]
                ? K
                : never;
};

type U<Keys extends string> = {
  [key in Keys]: [number, U<string>];
};

const createStateStorage: {
  <
    J extends U<keyof T extends string ? keyof T : never>,
    T extends Oi<Keys, J>,
    Keys extends GenerateArr<C>,
    C extends number = LengthOf<Keys>,
  >(
    ...args: WithDeepness<[obj: T], C>
  ): Io<T, Keys>;

  <
    T extends StorageRecord,
    Keys extends GenerateArr<C>,
    C extends number = LengthOf<Keys>,
  >(
    ...args: WithDeepness<[obj: Kek<T, Keys>], C>
  ): NestedStateStorage<Keys, T>;

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
} = (
  createState: (arg?: any, args?: any[]) => AnyState,
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
    bek: [() => {}, { l: [createState, () => 'wda'] }, 3],
    // sek: [createStateStorage, createState, 'wda'],
  },
  1
).bek;

// createStateStorage(createState, (a: number, b: string) => 25);

export default createStateStorage;
