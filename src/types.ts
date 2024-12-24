import type { Primitive, PrimitiveOrNested } from 'keyweaver';
import type { $tate } from './utils/constants';
import type { ComponentType, PropsWithChildren } from 'react';

declare const PENDING: unique symbol;

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type ResolvedValue<Value> = Exclude<Value, typeof PENDING>;

export type HandlePending<Value> = [Extract<Value, typeof PENDING>] extends [
  never,
]
  ? Value
  : ResolvedValue<Value> | undefined;

type Nil = null | undefined;

export type Falsy = Nil | false | 0 | '';

export type ValueChangeCallbacks = Set<(value: any) => void>;

export type StateCallbackMap = {
  _root: ValueChangeCallbacks | null;
  _children: Map<string, StateCallbackMap> | null;
  readonly _parent?: StateCallbackMap;
};

export type Internal<T> = {
  /** @internal */
  readonly _internal: T;
};

export type SetData<D> = {
  readonly _setData: D;
};

export declare class StateBase<Value = any> {
  get(): HandlePending<Value>;
  /** @internal */
  _onValueChange(cb: (value: any) => void): () => void;
}

/**
 * Represents a basic reactive state that holds a value.
 *
 * @example
 * ```ts
 * const state: State<number> = createState(0);
 * ```
 */
export type State<Value = any> = StateBase<Value> &
  /** @internal */
  Internal<{
    _value: any;
  }> &
  /** @internal */
  InternalPathBase & {
    /** @internal */
    set(nextValue: any, isError?: boolean): void;
    set(nextValue: ResolvedValue<Value>): void;
    /** @internal */
    _anchor?: object;
  };

export type AsyncStateProperties = {
  _value: any;
  _isLoaded(value: any, prevValue: any, attempt: number | undefined): boolean;
  readonly _slowLoading: {
    readonly _timeout: number;
    _timeoutId: ReturnType<typeof setTimeout> | undefined;
    readonly _callbackSet: Set<() => void>;
  } | null;
  _counter: number;
  _isLoadable: boolean;
  _promise: {
    readonly _promise: Promise<any>;
    _resolve(value: any): void;
    _reject(error: any): void;
  } | null;
  _unload: (() => void) | void | undefined;
  _attempt: number | undefined;
  readonly _reloadIfStale: {
    readonly _timeout: number;
    _timeoutId: ReturnType<typeof setTimeout> | undefined;
  } | null;
  readonly _reloadOnFocus: {
    readonly _timeout: number;
    _timeoutId: ReturnType<typeof setTimeout> | undefined;
    _isLoadable: boolean;
    _focusListener: (() => void) | undefined;
  } | null;
  _isFetchInProgress: boolean;
  readonly _keys: any[] | undefined;
  _tickStart(): void;
  _tickEnd(): void;
  readonly _parent: PaginatedStateStorage<any> | undefined;
};

export type ErrorState<Error> =
  /** @internal */
  SetData<ValueChangeCallbacks> & {
    set(error: Error | undefined): void;
    get(): Error | undefined;
    /** @internal */
    _onValueChange(cb: (value: any) => void): () => void;
    /** @internal */
    _value: any;
    /** @internal */
    readonly _parent: AsyncState;
    /** @internal */
    _isExpectedError?(err: any): boolean;
  };

export type IsLoadedState =
  /** @internal */
  SetData<ValueChangeCallbacks> & {
    /** @internal */
    _set(nextValue: boolean): void;
    get(): boolean;
    /** @internal */
    _onValueChange(cb: (value: any) => void): () => void;
    /** @internal */
    _value: boolean;
  };

/**
 * Represents a state that manages an asynchronous value, including {@link AsyncState.isLoaded loading} and {@link AsyncState.error error} states.
 * Extends {@link State}.
 */
export type AsyncState<Value = any, Error = any> = State<
  Value | typeof PENDING
> &
  /** @internal */
  Internal<AsyncStateProperties> & {
    /** @internal */
    readonly _withoutLoading?: true;
    /** @internal */
    readonly _awaitOnly?: true;
    /** A state that holds the latest error, if one occurred during loading. */
    readonly error: ErrorState<Error>;
    /** A state that indicates whether the state has successfully loaded */
    readonly isLoaded: IsLoadedState;
    /** @internal */
    _commonSet: State['set'];
    /** @internal */
    _load?(...args: any[]): (() => void) | void;
  };

/**
 * Represents a state that supports loading functionality, extending {@link AsyncState}
 * with a method to initiate and manage the loading process.
 */
export type LoadableState<
  Value = any,
  Error = any,
  Control = never,
> = AsyncState<Value, Error> & {
  /**
   * Initiates the loading process for the state if it has not already started.
   * If the loading process is already active, it increases the load listener count.
   *
   * The returned function decreases the load listener count, and the loading process
   * will only be canceled if there are no remaining load listeners.
   *
   * @param {boolean} [force=false] - If `true`, forces the loading process to reload,
   * even if it has previously completed or is in progress.
   * @returns - A function to decrease the load listener count. The loading
   * process is only marked as cancelable when all listeners have been removed.
   *
   * @example
   * ```ts
   * const decreaseLoadListener = state.load();
   *
   * // Call decreaseLoadListener to decrease the load listener count.
   * // The loading process is only canceled if no other listeners remain.
   * decreaseLoadListener();
   * ```
   */
  load(force?: boolean): () => void;
  /** @internal */
  _load(...args: any[]): (() => void) | void;
} & ([Control] extends [never] ? {} : { readonly control: Control });

type ProcessScope<
  Value,
  S extends State,
  M = Exclude<Value, Nil>,
  N = Extract<Value, Nil>,
> = (IsAny<Value> extends false
  ? M extends Primitive
    ? {}
    : M extends any[]
      ? {
          readonly [key in ToIndex<keyof M>]-?: ProcessScope<M[key] | N, S>;
        }
      : {
          readonly [key in keyof M]-?: ProcessScope<M[key] | N, S>;
        }
  : { readonly [key in number | string]: ProcessScope<any, S> }) &
  EndOfScope<
    S extends LoadableState<any, infer E, infer C>
      ? LoadableState<Value, E, C>
      : S extends AsyncState<any, infer E>
        ? AsyncState<Value, E>
        : State<Value>
  >;

export type StateScope<Value = any> = ProcessScope<Value, State>;

export type AsyncStateScope<Value = any, Error = any> = ProcessScope<
  Value,
  AsyncState<any, Error>
>;

export type LoadableStateScope<
  Value = any,
  Error = any,
  Control = never,
> = ProcessScope<Value, LoadableState<any, Error, Control>>;

export type PollableStateScope<Value = any, Error = any> = LoadableStateScope<
  Value,
  Error,
  PollableMethods
>;

export type InternalPathBase = {
  /** @internal */
  readonly _path?: readonly string[];
};

type EndOfScope<T> = {
  readonly [$tate]: T;
};

type StringToNumber<T> = T extends `${infer K extends number}` ? K : never;

type ToIndex<T> = [Exclude<T, keyof []>] extends [never]
  ? number
  : StringToNumber<T>;

type IsAny<T> = 0 extends 1 & T ? true : false;

export type AnyAsyncState<Value = any, Error = any> =
  | AsyncState<Value, Error>
  | AnyLoadableState<Value, Error>;

export type AnyLoadableState<Value = any, Error = any> =
  | LoadableState<Value, Error>
  | LoadableState<Value, Error, any>;

export type ExtractValues<
  T extends Array<AsyncState | Falsy>,
  Nullable extends boolean = false,
> = Readonly<{
  [index in keyof T]: T[index] extends AsyncState<infer K>
    ? K | (Nullable extends false ? never : undefined)
    : undefined;
}>;

export type ExtractErrors<T extends Array<AsyncState | Falsy>> = Readonly<{
  [index in keyof T]: T[index] extends AsyncState<any, infer K>
    ? K | undefined
    : undefined;
}>;

export type ArrayOfUndefined<T extends any[]> = Readonly<{
  [index in keyof T]: undefined;
}>;

export type AsyncStateOptions<
  T,
  E = any,
  Keys extends PrimitiveOrNested[] = any[],
> = {
  /** The initial value of the state or a function to resolve it using keys. */
  value?: ResolvedValue<T> | ((...keys: Keys) => ResolvedValue<T>);
  /** A function to determine if the state is considered loaded, based on the {@link value current} and {@link prevValue previous} values and the number of loading {@link attempt attempts}. */
  isLoaded?(
    value: ResolvedValue<T>,
    prevValue: ResolvedValue<T> | undefined,
    attempt: number
  ): boolean;
  /** The timeout in milliseconds for considering the loading process slow. */
  loadingTimeout?: number;
  /**
   * A type guard function used to determine if an error is considered an expected error.
   *
   * If `isExpectedError` returns `false` for an error, subsequent attempts to retrieve
   * the value of the associated error state using `getValue` or any hook will throw the error.
   * This ensures that unexpected errors are surfaced when accessing the error state.
   */
  isExpectedError?(error: any): error is E;
};

interface Kek<Control, S> {
  Control: new (options: Omit<this, 'load' | 'Control'>, state: S) => Control;
}

export type LoadableStateOptions<
  T = any,
  E = any,
  Control = never,
  Keys extends PrimitiveOrNested[] = [],
> = AsyncStateOptions<T, E, Keys> & {
  /**
   * A function to initiate the loading process. This method can optionally return
   * a cleanup function to be called when the loading is complete or canceled.
   */
  load(this: AsyncState<T, E>, ...keys: Keys): void | (() => void);
  /**
   * The duration in milliseconds. If set, the state will reload
   * if accessed again after this time has passed since the last load.
   */
  reloadIfStale?: number;
  /**
   * The duration in milliseconds. If set, the state will reload
   * when the tab gains focus after this duration has passed since the last load.
   */
  reloadOnFocus?: number;
  revalidate?: boolean;
} & ([Control] extends [never] ? {} : Kek<Control, AsyncState<T, E>>);

export type RequestableStateOptions<
  T,
  E = any,
  Keys extends PrimitiveOrNested[] = [],
> = Pick<
  LoadableStateOptions<T, E, Keys>,
  | 'value'
  | 'loadingTimeout'
  | 'reloadIfStale'
  | 'reloadOnFocus'
  | 'isExpectedError'
> & {
  /**
   * A function that starts the loading process for the state and returns a promise
   * that resolves with the loaded value.
   */
  load(...args: Keys): Promise<ResolvedValue<T>>;
  /**
   * A function that determines whether the loading process should be retried after an error occurs.
   * @param err - The error encountered during the loading attempt.
   * @param attempt - The number of loading attempts made so far.
   * @returns The delay in milliseconds before retrying, or `0` to stop retrying.
   */
  shouldRetryOnError?(err: E, attempt: number): number;
};

export interface PollableMethods {
  /** Pauses the current polling process. */
  pause(): void;
  /** Resumes a polling process. */
  resume(): void;
  /** Resets the loading process, starting it from the beginning. */
  reset(): void;
}

export type PollableState<T, E = any> = LoadableState<T, E, PollableMethods>;

export type PollableStateOptions<
  T = any,
  E = any,
  Keys extends PrimitiveOrNested[] = [],
> = RequestableStateOptions<T, E, Keys> &
  Pick<AsyncStateOptions<T>, 'isLoaded'> & {
    /** The interval in milliseconds at which the state should poll for new data. */
    interval: number;
    /**
     * The interval in milliseconds for polling when the document is hidden (e.g., when the tab is not in focus).
     * If set to `0`, polling is disabled while the tab is hidden.
     */
    hiddenInterval?: number;
  };

type KeysOfStorage<T, Acc extends PrimitiveOrNested[] = []> =
  T extends StateStorageMarker<infer Key extends PrimitiveOrNested, infer Item>
    ? KeysOfStorage<Item, [...Acc, Key]>
    : Acc;

type StorageItem = State | StateStorageMarker<PrimitiveOrNested, any>;

type ProcessState<S extends State | StateScope, V> =
  S extends LoadableStateScope<any, infer E, infer C>
    ? LoadableStateScope<V, E, C>
    : S extends AsyncStateScope<any, infer E>
      ? AsyncStateScope<V, E>
      : S extends StateScope
        ? StateScope<V>
        : S extends LoadableState<any, infer E, infer C>
          ? LoadableState<V, E, C>
          : S extends AsyncState<any, infer E>
            ? AsyncState<V, E>
            : State<V>;

type ProcessStorageItem<T extends StorageItem> =
  T extends State<ResolvedValue<infer V>>
    ? ProcessState<T, V>
    : T extends StateStorage<infer K, infer Keys>
      ? StateStorage<K, Keys>
      : T;

type StateWithNestedStorageKeys<T> = T extends StorageItem
  ? ProcessStorageItem<T>
  : T extends Record<string, StorageItem>
    ? {
        [key in keyof T]: ProcessStorageItem<T[key]>;
      }
    : never;

type RetrieveChildState<T, Keys extends PrimitiveOrNested[]> = Keys extends [
  any,
  ...infer Tail extends PrimitiveOrNested[],
]
  ? T extends StateStorageMarker<any, infer Item>
    ? RetrieveChildState<Item, Tail>
    : T
  : T;

type RetrieveState<T> =
  T extends StateStorageMarker<any, infer Child> ? RetrieveState<Child> : T;

// export type RetrieveStateOrPaginatedStorage<T> =
//   T extends PaginatedStateStorage<any>
//     ? T
//     : T extends StateStorageMarker<any, infer Child>
//       ? RetrieveStateOrPaginatedStorage<Child>
//       : T;

export declare const STATE_STORAGE_IDENTIFIER: unique symbol;

type StateStorageMarker<Keys extends PrimitiveOrNested[], Item> = {
  [STATE_STORAGE_IDENTIFIER]: [Keys, Item];
};

type StorageUtilsBase = {
  // _get(key: PrimitiveOrNested, keys: readonly PrimitiveOrNested[]): any;
  _getItem(arg1: any, arg2: any, arg3: any, utils?: Record<string, any>): any;
  readonly _storage: Map<any, any>;
  readonly _arg1: any;
  readonly _arg2: any;
  readonly _arg3?: any;
};

export type StorageUtils = StorageUtilsBase & {
  _keyStorage?: Map<string, any>;
};

export type PaginatedStorageUtils = StorageUtilsBase & {
  readonly _pages: Set<number>;
  _resolvePage(page: number): void;
  _promise: Promise<void>;
  _resolve(): void;
  _shouldRevalidate(state: LoadableState): boolean;
};

// type UnNestedState<S> =
//   S extends ControllableLoadableState<any, infer E>
//     ? ControllableLoadableState<any, E>
//     : S extends LoadableState<any, infer E>
//       ? LoadableState<any, E>
//       : S extends AsyncState<any, infer E>
//         ? AsyncState<any, E>
//         : S extends State
//           ? State
//           : never;

/**
 * Represents a structured state storage system that allows retrieval and deletion
 * of state entries using specified keys.
 */
export type StateStorage<
  T,
  Keys extends PrimitiveOrNested[] = any[],
> = StateStorageMarker<Keys, T> & {
  /**
   * Retrieves a state within the storage using the provided keys.
   *
   * @example
   * ```js
   * const state = storage.get('key', { some: { nested: ['key'] } });
   * ```
   */
  get(...keys: Keys): StateWithNestedStorageKeys<T>;
  /**
   * Deletes a state entry from the storage associated with the given key.
   *
   * **Warning**: This is an unsafe method. It only removes the state entry from
   * the storage but does not clear or reset the state itself.
   */
  delete(...keys: Partial<Keys>): void;
  /** @internal */
  readonly _keys: any[] | undefined;
  /** @internal */
  readonly _storage: Map<any, any>;
  /** @internal */
  readonly _getItem: (...args: any[]) => any;
  /** @internal */
  readonly _arg1: any;
  /** @internal */
  readonly _arg2?: any;
  /** @internal */
  readonly _arg3?: any;
};

/**
 * Represents a paginated state storage system for managing state entries across multiple pages.
 */
export type PaginatedStateStorage<T extends LoadableState | StateScope> =
  /** @internal */
  InternalPathBase & {
    /** @internal */
    readonly _keys: any[] | undefined;
    readonly page: State<number>;
    /** @internal */
    readonly _storage: Map<number, T>;
    /** @internal */
    readonly _stableStorage: Map<number, any>;
    /** @internal */
    _promise: Promise<void> | undefined;
    /** @internal */
    _resolve: () => void;
    /** @internal */
    readonly _pages: Set<number>;
    /** @internal */
    readonly _getItem: (...args: any[]) => any;
    /** @internal */
    readonly _arg1: any;
    /** @internal */
    readonly _arg2: StateInitializer | undefined;
    /** @internal */
    _shouldRevalidate(state: LoadableState): boolean;
    /** Retrieves a state entry for the specified page number within the paginated storage. */
    get(page: number): T;
    /**
     * Deletes a state entry for the specified page number from the paginated storage.
     *
     * **Warning**: This is an unsafe method. It only removes the state entry from
     * the storage but does not clear or reset the state itself.
     */
    delete(page: number): void;
  } & (T extends LoadableState
      ? {
          /**
           * A hook that retrieves an array of items and errors for the current {@link PaginatedStateStorage.page page state value} in the paginated storage.
           *
           * @example
           * ```js
           * const [items, errors] = paginatedStorage.usePages();
           * ```
           */
          usePages(): T extends LoadableState<infer V, infer E>
            ? readonly [
                items: ReadonlyArray<V | undefined>,
                errors: ReadonlyArray<E | undefined>,
              ]
            : never;
        }
      : {
          /**
           * A hook that retrieves an array of items and errors for the current {@link PaginatedStateStorage.page page state value} in the paginated storage.
           *
           * @example
           * ```js
           * const [items, errors] = paginatedStorage.usePages();
           * ```
           */
          usePages<S extends LoadableState>(
            getState: (scope: T) => S
          ): S extends LoadableState<infer V, infer E>
            ? readonly [
                items: ReadonlyArray<V | undefined>,
                errors: ReadonlyArray<E | undefined>,
              ]
            : never;
        });

export type WithInitModule<T, Args extends any[]> = [
  ...Args,
  stateInitializer?: StateInitializer<T>,
];

export type StateInitializer<T = any> = (
  keys: PrimitiveOrNested[] | undefined
) => {
  set(value: T): void;
  get(): T | undefined;
  observe?(setState: (value: T) => void): () => void;
};

export type ContainerType =
  | ComponentType<PropsWithChildren>
  | keyof JSX.IntrinsicElements;
