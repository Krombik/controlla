import type { Primitive, PrimitiveOrNested } from 'keyweaver';
import type { ROOT } from './utils/constants';
import type { ComponentType, PropsWithChildren } from 'react';

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

type Nil = null | undefined;

export type Falsy = Nil | false | 0 | '';

export type ValueChangeCallbacks = Set<(value: any) => void>;

export type ScopeCallbackMap = Partial<
  Pick<InternalState, '_callbacks' | '_children'>
>;

export interface InternalState {
  readonly [ROOT]?: this;
  _value: any;
  _onValueChange(cb: (value: any) => void): () => void;
  _get(): any;
  _set(value: any, path?: readonly string[]): void;
  readonly _path?: readonly string[];
  readonly _callbacks: ValueChangeCallbacks;
  _children?: Map<string, ScopeCallbackMap>;
  /** storage of proxies */
  _storage?: Map<string, InternalState>;
  _valueToggler: 0 | 1;
}

export interface InternalAsyncState extends InternalState {
  readonly [ROOT]: this;
  readonly _awaitOnly?: true;
  readonly _errorState: Omit<ReadonlyState, typeof STATE_MARKER> & {
    [ROOT]: { readonly _parent: InternalAsyncState };
  };
  readonly _isLoadedState: Omit<ReadonlyState<boolean>, typeof STATE_MARKER>;
  _commonSet: InternalState['_set'];
  _set(value: any, path?: readonly string[], isError?: boolean): void;
  _isLoaded(value: any, prevValue: any, attempt: number | undefined): boolean;
  readonly _slowLoading: {
    readonly _timeout: number;
    _timeoutId: ReturnType<typeof setTimeout> | undefined;
    readonly _callbacks: Set<() => void>;
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
  readonly _keys?: any[];
  _tickStart(): void;
  _tickEnd(): void;
  readonly _parent: PaginatedStorage<any> | undefined;
  _subscribeWithLoad?(cb: () => void): () => void;
  _subscribeWithError(cb: () => void): () => void;
  _load?(...args: any[]): (() => void) | void;
  readonly _loadingProcess: any;
}

declare const STATE_MARKER: unique symbol;

declare const SETABLE_MARKER: unique symbol;

declare const ERROR_MARKER: unique symbol;

declare const LOADABLE_MARKER: unique symbol;

declare const LADING_PROCESS_MARKER: unique symbol;

declare class _Base {}

export type ReadonlyState<T = any> = _Base & {
  /** @internal */
  readonly [ROOT]: InternalState;
  [STATE_MARKER]: T;
};

/**
 * Represents a basic reactive state that holds a value.
 *
 * @example
 * ```ts
 * const state: State<number> = createState(0);
 * ```
 */
export type State<Value = any> = ReadonlyState<Value> & {
  [SETABLE_MARKER]: true;
};

/**
 * Represents a state that manages an asynchronous value, including {@link AsyncState.isLoaded loading} and {@link AsyncState.error error} states.
 * Extends {@link State}.
 */
export type AsyncState<Value = any, Error = any> = State<Value> & {
  /** @internal */
  readonly [ROOT]: InternalAsyncState;
  [ERROR_MARKER]: Error;
};

/**
 * Represents a state that supports loading functionality, extending {@link AsyncState}
 * with a method to initiate and manage the loading process.
 */
export type LoadableState<
  Value = any,
  Error = any,
  LoadingProcess = never,
> = AsyncState<Value, Error> & {
  [LOADABLE_MARKER]: true;
  [LADING_PROCESS_MARKER]: LoadingProcess;
};

declare const SCOPE_MARKER: unique symbol;

type ScopeMarker<T = any> = {
  [SCOPE_MARKER]: T;
};

type ProcessScope<
  Value,
  S extends ReadonlyState,
  M = Exclude<Value, Nil>,
  N = Extract<Value, Nil>,
> = (S extends LoadableState<any, infer E, infer C>
  ? LoadableState<Value, E, C>
  : S extends AsyncState<any, infer E>
    ? AsyncState<Value, E>
    : S extends State
      ? State<Value>
      : ReadonlyState<Value>) &
  (0 extends 1 & Value
    ? { readonly [key in string | number]: ProcessScope<any, S, any, any> }
    : M extends Primitive
      ? {}
      : M extends any[]
        ? {
            readonly [key in ToIndex<keyof M>]-?: ProcessScope<M[key] | N, S>;
          }
        : {
            readonly [key in keyof M]-?: ProcessScope<M[key] | N, S>;
          }) &
  ScopeMarker<Value>;

declare class Scope {}

export type ReadonlyStateScope<Value = any> = Scope &
  ProcessScope<Value, ReadonlyState>;

export type StateScope<Value = any> = Scope & ProcessScope<Value, State>;

export type AsyncStateScope<Value = any, Error = any> = Scope &
  ProcessScope<Value, AsyncState<any, Error>>;

export type LoadableStateScope<
  Value = any,
  Error = any,
  LoadingProcess = never,
> = Scope & ProcessScope<Value, LoadableState<any, Error, LoadingProcess>>;

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

export type AsyncStateOptions<T, Keys extends PrimitiveOrNested[] = never> = {
  /** The initial value of the state or a function to resolve it using keys. */
  value?: T | ((...args: [Keys] extends [never] ? [] : [keys: Keys]) => T);
  /** A function to determine if the state is considered loaded, based on the {@link value current} and {@link prevValue previous} values and the number of loading {@link attempt attempts}. */
  isLoaded?(value: T, prevValue: T | undefined, attempt: number): boolean;
  /** The timeout in milliseconds for considering the loading process slow. */
  loadingTimeout?: number;
};

interface WithControl<Control, S> {
  Control: new (options: Omit<this, 'load' | 'Control'>, state: S) => Control;
}

export type LoadableStateOptions<
  T = any,
  E = any,
  Control = never,
  Keys extends PrimitiveOrNested[] = never,
> = AsyncStateOptions<T, Keys> & {
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
