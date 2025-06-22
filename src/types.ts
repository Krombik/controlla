import type { Primitive, PrimitiveOrNested } from 'keyweaver';
import type { ROOT } from './utils/constants';
import type { ComponentType, JSX, PropsWithChildren } from 'react';

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

type Nil = null | undefined;

export type Falsy = Nil | false | 0 | '';

export type ValueChangeCallbacks = Set<(value: any) => void>;

export type ScopeCallbackMap = Partial<
  Pick<InternalControl, '_callbacks' | '_children'>
>;

export interface InternalControl<T = any> {
  readonly [ROOT]?: this;
  _value: T;
  _subscribe(cb: (value: any) => void): () => void;
  _get(): any;
  _set(value: T, path?: readonly string[]): void;
  readonly _path?: readonly string[];
  readonly _callbacks: ValueChangeCallbacks;
  _children?: Map<string, ScopeCallbackMap>;
  /** storage of proxies */
  _storage?: Map<string, InternalControl>;
  _valueToggler: 0 | 1;
}

export interface InternalAsyncControl extends InternalControl {
  readonly [ROOT]: this;
  readonly _awaitOnly?: true;
  readonly _errorControl: Omit<ReadonlyControl, typeof CONTROL_MARKER> & {
    [ROOT]: { readonly _parent: InternalAsyncControl };
  };
  readonly _isLoadedControl: Omit<
    ReadonlyControl<boolean>,
    typeof CONTROL_MARKER
  >;
  _commonSet: InternalControl['_set'];
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

declare const CONTROL_MARKER: unique symbol;

declare const SETABLE_MARKER: unique symbol;

declare const ERROR_MARKER: unique symbol;

declare const LOADABLE_MARKER: unique symbol;

declare const LOADING_PROCESS_MARKER: unique symbol;

export type ReadonlyControl<Value = any> = {
  /** @internal */
  [ROOT]: InternalControl;
  [CONTROL_MARKER]: Value;
};

export type ReadonlyAsyncControl<
  Value = any,
  Error = any,
> = ReadonlyControl<Value> & AsyncControlBase<Error>;

/**
 * Represents a basic reactive control that holds a value.
 *
 * @example
 * ```ts
 * const control: Control<number> = createControl(0);
 * ```
 */
export type Control<Value = any> = ReadonlyControl<Value> & {
  [SETABLE_MARKER]: true;
};

type AsyncControlBase<Error> = {
  /** @internal */
  readonly [ROOT]: InternalAsyncControl;
  [ERROR_MARKER]: Error;
};

/**
 * Represents a control that manages an asynchronous value, including {@link AsyncControl.isLoaded loading} and {@link AsyncControl.error error} controls.
 * Extends {@link Control}.
 */
export type AsyncControl<Value = any, Error = any> = Control<Value> &
  AsyncControlBase<Error>;

type LoadableControlBase<LoadingProcess> = {
  [LOADABLE_MARKER]: true;
  [LOADING_PROCESS_MARKER]: LoadingProcess;
};

/**
 * Represents a control that supports loading functionality, extending {@link AsyncControl}
 * with a method to initiate and manage the loading process.
 */
export type LoadableControl<
  Value = any,
  Error = any,
  LoadingProcess = never,
> = AsyncControl<Value, Error> & LoadableControlBase<LoadingProcess>;

declare const SCOPE_MARKER: unique symbol;

type ScopeMarker<T = any> = {
  [SCOPE_MARKER]: T;
};

type ProcessScope<
  Value,
  S extends ReadonlyControl,
  M = Exclude<Value, Nil>,
  N = Extract<Value, Nil>,
> = (S extends LoadableControl<any, infer E, infer C>
  ? LoadableControl<Value, E, C>
  : S extends AsyncControl<any, infer E>
    ? AsyncControl<Value, E>
    : S extends Control
      ? Control<Value>
      : S extends ReadonlyAsyncControl<any, infer E>
        ? ReadonlyAsyncControl<Value, E>
        : ReadonlyControl<Value>) &
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

export type ReadonlyAsyncControlScope<Value = any, Error = any> = Scope &
  ProcessScope<Value, ReadonlyAsyncControl<any, Error>>;

export type ReadonlyControlScope<Value = any> = Scope &
  ProcessScope<Value, ReadonlyControl>;

export type ControlScope<Value = any> = Scope & ProcessScope<Value, Control>;

export type AsyncControlScope<Value = any, Error = any> = Scope &
  ProcessScope<Value, AsyncControl<any, Error>>;

export type LoadableControlScope<
  Value = any,
  Error = any,
  LoadingProcess = never,
> = Scope & ProcessScope<Value, LoadableControl<any, Error, LoadingProcess>>;

export type PollableControlScope<Value = any, Error = any> = Scope &
  LoadableControlScope<Value, Error, PollableMethods>;

export type StringToNumber<T> = T extends `${infer K extends number}`
  ? K
  : never;

export type ToIndex<T> = [Exclude<T, keyof []>] extends [never]
  ? number
  : StringToNumber<T>;

export type AnyAsyncControl<Value = any, Error = any> =
  | AsyncControl<Value, Error>
  | LoadableControl<Value, Error>
  | LoadableControl<Value, Error, any>;

export type ExtractValues<
  T extends Array<ReadonlyAsyncControl | Falsy>,
  Nullable extends boolean = false,
> = Readonly<{
  [index in keyof T]: T[index] extends ReadonlyAsyncControl<infer K>
    ? K | (Nullable extends false ? never : undefined)
    : undefined;
}>;

export type ExtractErrors<T extends Array<ReadonlyAsyncControl | Falsy>> =
  Readonly<{
    [index in keyof T]: T[index] extends ReadonlyAsyncControl<any, infer K>
      ? K | undefined
      : undefined;
  }>;

export type AsyncControlOptions<T, Keys extends PrimitiveOrNested[] = never> = {
  /** The initial value of the control or a function to resolve it using keys. */
  value?: T | ((...args: [Keys] extends [never] ? [] : [keys: Keys]) => T);
  /** A function to determine if the control is considered loaded, based on the {@link value current} and {@link prevValue previous} values and the number of loading {@link attempt attempts}. */
  isLoaded?(value: T, prevValue: T | undefined, attempt: number): boolean;
  /** The timeout in milliseconds for considering the loading process slow. */
  loadingTimeout?: number;
};

interface WithLoadingProcess<LoadingProcess, S> {
  LoadingProcess: new (
    options: Omit<this, 'load' | 'LoadingProcess'>,
    control: S
  ) => LoadingProcess;
}

export type LoadableControlOptions<
  T = any,
  E = any,
  LoadingProcess = never,
  Keys extends PrimitiveOrNested[] = never,
> = AsyncControlOptions<T, Keys> & {
  /**
   * A function to initiate the loading process. This method can optionally return
   * a cleanup function to be called when the loading is complete or canceled.
   */
  load(
    this: AsyncControl<T, E>,
    ...keys: [Keys] extends [never] ? [] : Keys
  ): void | (() => void);
  /**
   * The duration in milliseconds. If set, the control will reload
   * if accessed again after this time has passed since the last load.
   */
  reloadIfStale?: number;
  /**
   * The duration in milliseconds. If set, the control will reload
   * when the tab gains focus after this duration has passed since the last load.
   */
  reloadOnFocus?: number;
  revalidate?: boolean;
} & ([LoadingProcess] extends [never]
    ? {}
    : WithLoadingProcess<LoadingProcess, AsyncControl<T, E>>);

export type RequestableControlOptions<
  T,
  E = any,
  Keys extends PrimitiveOrNested[] = never,
> = Omit<LoadableControlOptions<T, E, never, Keys>, 'load' | 'isLoaded'> & {
  /**
   * A function that starts the loading process for the control and returns a promise
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

export type PollableControl<T, E = any> = LoadableControl<
  T,
  E,
  PollableMethods
>;

export type PollableControlOptions<
  T = any,
  E = any,
  Keys extends PrimitiveOrNested[] = never,
> = RequestableControlOptions<T, E, Keys> &
  Pick<AsyncControlOptions<T>, 'isLoaded'> & {
    /** The interval in milliseconds at which the control should poll for new data. */
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

export type StorageItem = Control | ScopeMarker | StorageRecord;
// | Omit<PaginatedStorage<any>, 'usePages'>;

declare const CONTROL_STORAGE_IDENTIFIER: unique symbol;

type StorageMarker<Keys extends PrimitiveOrNested[], Item> = {
  [CONTROL_STORAGE_IDENTIFIER]: [Keys, Item];
};

type PartialTuple<T extends unknown[]> = T extends [...infer Rest, infer _]
  ? [] extends Rest
    ? never
    : Rest | PartialTuple<Rest>
  : never;

/**
 * Represents a structured control storage system that allows retrieval and deletion
 * of control entries using specified keys.
 */
export type Storage<
  T extends StorageItem,
  Keys extends PrimitiveOrNested[],
> = StorageMarker<Keys, T> & {
  /**
   * Retrieves a control within the storage using the provided keys.
   *
   * @example
   * ```js
   * const control = storage.get('key', { some: { nested: ['key'] } });
   * ```
   */
  get(...keys: Keys): T;
  has(...keys: Keys | PartialTuple<Keys>): boolean;
  /**
   * Deletes a control entry from the storage associated with the given key.
   *
   * **Warning**: This is an unsafe method. It only removes the control entry from
   * the storage but does not clear or reset the control itself.
   */
  unsafe_delete(...keys: Keys | PartialTuple<Keys> | []): void;
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
} & (T extends AsyncControl
    ? {
        clear(...keys: Keys | PartialTuple<Keys> | []): void;
      }
    : {});

export type PaginatedStorageOptions<T> = {
  shouldRevalidate?:
    | boolean
    | ((
        ...args: T extends LoadableControl ? [control: T] : [scope: T]
      ) => boolean);
};

/**
 * Represents a paginated control storage system for managing control entries across multiple pages.
 */
export type PaginatedStorage<T extends LoadableControl | ScopeMarker> = {
  /** @internal */
  readonly _keys: any[] | undefined;
  readonly page: Control<number>;
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
  readonly _arg2: ControlInitializer | undefined;
  /** Retrieves a control entry for the specified page number within the paginated storage. */
  get(page: number): T;
  /**
   * Deletes a control entry for the specified page number from the paginated storage.
   *
   * **Warning**: This is an unsafe method. It only removes the control entry from
   * the storage but does not clear or reset the control itself.
   */
  delete(page: number): void;
} & (T extends ScopeMarker
  ? {
      /**
       * A hook that retrieves an array of items and errors for the current {@link PaginatedStorage.page page control value} in the paginated storage.
       *
       * @example
       * ```js
       * const [items, errors] = paginatedStorage.usePages();
       * ```
       */
      usePages<S extends LoadableControl>(
        getControl: (scope: T) => S
      ): S extends LoadableControl<infer V, infer E>
        ? readonly [
            items: ReadonlyArray<V | undefined>,
            errors: ReadonlyArray<E | undefined>,
          ]
        : never;
    }
  : {
      /**
       * A hook that retrieves an array of items and errors for the current {@link PaginatedStorage.page page control value} in the paginated storage.
       *
       * @example
       * ```js
       * const [items, errors] = paginatedStorage.usePages();
       * ```
       */
      usePages(): T extends LoadableControl<infer V, infer E>
        ? readonly [
            items: ReadonlyArray<V | undefined>,
            errors: ReadonlyArray<E | undefined>,
          ]
        : never;
    });

export type WithInitModule<T, Args extends any[]> = [
  ...Args,
  controlInitializer?: ControlInitializer<T>,
];

export type ControlInitializer<T = any> = (
  keys: PrimitiveOrNested[] | undefined
) => {
  set(value: T): void;
  get(): T | undefined;
  observe?(setControl: (value: T) => void): () => void;
};

export type ContainerType =
  | ComponentType<PropsWithChildren>
  | keyof JSX.IntrinsicElements;
