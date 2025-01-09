import type { Primitive, PrimitiveOrNested } from 'keyweaver';
import type { $tate } from './utils/constants';
import type { ComponentType, PropsWithChildren } from 'react';

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

type Nil = null | undefined;

export type Falsy = Nil | false | 0 | '';

export type ValueChangeCallbacks = Set<(value: any) => void>;

export type ScopeCallbackMap = Partial<
  Pick<StateBase, '_callbacks' | '_children'>
>;

declare const STATE_MARKER: unique symbol;

export declare class StateBase<T = any> {
  /** @internal */
  _value: any;
  [STATE_MARKER]: T;
  /** @internal */
  _onValueChange(cb: (value: any) => void): () => void;
  /** @internal */
  get(): any;
  /** @internal */
  readonly _path?: readonly string[];
  /** @internal */
  readonly _callbacks: ValueChangeCallbacks;
  /** @internal */
  _children?: Map<string, ScopeCallbackMap> | undefined;
  /** @internal */
  _valueToggler: 0 | 1;
}

/**
 * Represents a basic reactive state that holds a value.
 *
 * @example
 * ```ts
 * const state: State<number> = createState(0);
 * ```
 */
export interface State<Value = any> extends StateBase<Value> {
  /** @internal */
  readonly _root?: this;
  /** @internal */
  set(value: any, path?: readonly string[], isError?: boolean): void;
  set(value: Value): void;
  get(): Value;
}

export type ErrorState<Error> = StateBase<Error> & {
  set(error: Error | undefined): void;
  get(): Error | undefined;
  /** @internal */
  readonly _parent: AsyncState;
  /** @internal */
  _isExpectedError?(err: any): boolean;
};

export type IsLoadedState = StateBase<boolean> & {
  /** @internal */
  set(value: boolean): void;
  get(): boolean;
};

/**
 * Represents a state that manages an asynchronous value, including {@link AsyncState.isLoaded loading} and {@link AsyncState.error error} states.
 * Extends {@link State}.
 */
export interface AsyncState<Value = any, Error = any> extends StateBase<Value> {
  /** @internal */
  readonly _root: this;
  /** @internal */
  readonly _awaitOnly?: true;
  /** A state that holds the latest error, if one occurred during loading. */
  readonly error: ErrorState<Error>;
  /** A state that indicates whether the state has successfully loaded */
  readonly isLoaded: IsLoadedState;
  /** @internal */
  _commonSet: State['set'];
  get(): Value | undefined;
  /** @internal */
  set(value: any, path?: readonly string[], isError?: boolean): void;
  set(value: Value): void;
  /** @internal */
  _isLoaded(value: any, prevValue: any, attempt: number | undefined): boolean;
  /** @internal */
  readonly _slowLoading: {
    readonly _timeout: number;
    _timeoutId: ReturnType<typeof setTimeout> | undefined;
    readonly _callbacks: Set<() => void>;
  } | null;
  /** @internal */
  _counter: number;
  /** @internal */
  _isLoadable: boolean;
  /** @internal */
  _promise: {
    readonly _promise: Promise<any>;
    _resolve(value: any): void;
    _reject(error: any): void;
  } | null;
  /** @internal */
  _unload: (() => void) | void | undefined;
  /** @internal */
  _attempt: number | undefined;
  /** @internal */
  readonly _reloadIfStale: {
    readonly _timeout: number;
    _timeoutId: ReturnType<typeof setTimeout> | undefined;
  } | null;
  /** @internal */
  readonly _reloadOnFocus: {
    readonly _timeout: number;
    _timeoutId: ReturnType<typeof setTimeout> | undefined;
    _isLoadable: boolean;
    _focusListener: (() => void) | undefined;
  } | null;
  /** @internal */
  _isFetchInProgress: boolean;
  /** @internal */
  readonly _keys?: any[];
  /** @internal */
  _tickStart(): void;
  /** @internal */
  _tickEnd(): void;
  /** @internal */
  readonly _parent: PaginatedStorage<any> | undefined;
  /** @internal */
  _subscribeWithLoad?(cb: () => void): () => void;
  /** @internal */
  _subscribeWithError(cb: () => void): () => void;
  /** @internal */
  _load?(...args: any[]): (() => void) | void;
}

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
} & ([Control] extends [never] ? {} : { readonly control: Control });

declare const SCOPE_MARKER: unique symbol;

type ScopeMarker<T = any> = {
  [SCOPE_MARKER]: T;
};

type ProcessScope<
  Value,
  S extends State,
  M = Exclude<Value, Nil>,
  N = Extract<Value, Nil>,
> = (0 extends 1 & Value
  ? { readonly [key in string | number]: ProcessScope<any, S, any, any> }
  : M extends Primitive
    ? {}
    : M extends any[]
      ? {
          readonly [key in ToIndex<keyof M>]-?: ProcessScope<M[key] | N, S>;
        }
      : {
          readonly [key in keyof M]-?: ProcessScope<M[key] | N, S>;
        }) & {
  readonly [$tate]: S extends LoadableState<any, infer E, infer C>
    ? LoadableState<Value, E, C>
    : S extends AsyncState<any, infer E>
      ? AsyncState<Value, E>
      : State<Value>;
} & ScopeMarker<Value>;

declare class Scope {}

export type StateScope<Value = any> = Scope & ProcessScope<Value, State>;

export type AsyncStateScope<Value = any, Error = any> = Scope &
  ProcessScope<Value, AsyncState<any, Error>>;

export type LoadableStateScope<
  Value = any,
  Error = any,
  Control = never,
> = Scope & ProcessScope<Value, LoadableState<any, Error, Control>>;

export type PollableStateScope<Value = any, Error = any> = Scope &
  LoadableStateScope<Value, Error, PollableMethods>;

type StringToNumber<T> = T extends `${infer K extends number}` ? K : never;

export type ToIndex<T> = [Exclude<T, keyof []>] extends [never]
  ? number
  : StringToNumber<T>;

export type AnyAsyncState<Value = any, Error = any> =
  | AsyncState<Value, Error>
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

export type AsyncStateOptions<
  T,
  E = any,
  Keys extends PrimitiveOrNested[] = never,
> = {
  /** The initial value of the state or a function to resolve it using keys. */
  value?: T | ((...args: [Keys] extends [never] ? [] : [keys: Keys]) => T);
  /** A function to determine if the state is considered loaded, based on the {@link value current} and {@link prevValue previous} values and the number of loading {@link attempt attempts}. */
  isLoaded?(value: T, prevValue: T | undefined, attempt: number): boolean;
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

interface WithControl<Control, S> {
  Control: new (options: Omit<this, 'load' | 'Control'>, state: S) => Control;
}

export type LoadableStateOptions<
  T = any,
  E = any,
  Control = never,
  Keys extends PrimitiveOrNested[] = never,
> = AsyncStateOptions<T, E, Keys> & {
  /**
   * A function to initiate the loading process. This method can optionally return
   * a cleanup function to be called when the loading is complete or canceled.
   */
  load(
    this: AsyncState<T, E>,
    ...keys: [Keys] extends [never] ? [] : Keys
  ): void | (() => void);
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
} & ([Control] extends [never] ? {} : WithControl<Control, AsyncState<T, E>>);

export type RequestableStateOptions<
  T,
  E = any,
  Keys extends PrimitiveOrNested[] = never,
> = Omit<LoadableStateOptions<T, E, never, Keys>, 'load' | 'isLoaded'> & {
  /**
   * A function that starts the loading process for the state and returns a promise
   * that resolves with the loaded value.
   */
  fetch(...keys: [Keys] extends [never] ? [] : Keys): Promise<T>;
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
  Keys extends PrimitiveOrNested[] = never,
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

export type StorageRecord = {
  [key in string]: StorageItem | StorageMarker<any[], StorageItem>;
};

export type StorageItem =
  | State
  | ScopeMarker
  | StorageRecord
  | Omit<PaginatedStorage<any>, 'usePages'>;

declare const STATE_STORAGE_IDENTIFIER: unique symbol;

type StorageMarker<Keys extends PrimitiveOrNested[], Item> = {
  [STATE_STORAGE_IDENTIFIER]: [Keys, Item];
};

type PartialTuple<T extends unknown[]> = T extends [...infer Rest, infer _]
  ? [] extends Rest
    ? never
    : Rest | PartialTuple<Rest>
  : never;

/**
 * Represents a structured state storage system that allows retrieval and deletion
 * of state entries using specified keys.
 */
export type Storage<
  T extends StorageItem,
  Keys extends PrimitiveOrNested[],
> = StorageMarker<Keys, T> & {
  /**
   * Retrieves a state within the storage using the provided keys.
   *
   * @example
   * ```js
   * const state = storage.get('key', { some: { nested: ['key'] } });
   * ```
   */
  get(...keys: Keys): T;
  /**
   * Deletes a state entry from the storage associated with the given key.
   *
   * **Warning**: This is an unsafe method. It only removes the state entry from
   * the storage but does not clear or reset the state itself.
   */
  delete(...keys: Keys | PartialTuple<Keys>): void;
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

export type PaginatedStorageOptions<T> = {
  shouldRevalidate?:
    | boolean
    | ((...args: T extends LoadableState ? [state: T] : [scope: T]) => boolean);
};

/**
 * Represents a paginated state storage system for managing state entries across multiple pages.
 */
export type PaginatedStorage<T extends LoadableState | ScopeMarker> = {
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
  readonly _arg1: PaginatedStorageOptions<any>;
  /** @internal */
  readonly _arg2: StateInitializer | undefined;
  /** Retrieves a state entry for the specified page number within the paginated storage. */
  get(page: number): T;
  /**
   * Deletes a state entry for the specified page number from the paginated storage.
   *
   * **Warning**: This is an unsafe method. It only removes the state entry from
   * the storage but does not clear or reset the state itself.
   */
  delete(page: number): void;
} & (T extends ScopeMarker
  ? {
      /**
       * A hook that retrieves an array of items and errors for the current {@link PaginatedStorage.page page state value} in the paginated storage.
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
    }
  : {
      /**
       * A hook that retrieves an array of items and errors for the current {@link PaginatedStorage.page page state value} in the paginated storage.
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

export type Converter<T> = {
  /**
   * Serializes the specified value into a string.
   *
   * @param value - The value to be serialized.
   * @returns The serialized value as a string.
   */
  stringify(value: T): string;
  /**
   * Parses the specified string and returns the deserialized value.
   *
   * @param value - The string to be parsed.
   * @returns The deserialized value.
   */
  parse(value: string): T;
};
