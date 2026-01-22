import type { Primitive, PrimitiveOrNested } from 'keyweaver';

import type { ROOT } from '#shared/constants';
import type {
  AsyncControlRoot,
  ControlChild,
  ControlRoot,
  Nil,
  PartialTuple,
  PollableMethods,
  ScopeMarker,
  StorageItem,
  StorageMarker,
  ToIndex,
} from '#_types';

declare const CONTROL_MARKER: unique symbol;

declare const SETABLE_MARKER: unique symbol;

declare const ERROR_MARKER: unique symbol;

declare const LOADABLE_MARKER: unique symbol;

declare const LOADING_PROCESS_MARKER: unique symbol;

export type ReadonlyControl<Value = any> = {
  /** @internal */
  [ROOT]: ControlChild | ControlRoot;
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
  readonly [ROOT]: AsyncControlRoot;
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

export type PollableControl<T, E = any> = LoadableControl<
  T,
  E,
  PollableMethods
>;

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
  Keys extends PrimitiveOrNested[] = never,
> = Omit<LoadableControlOptions<T, any, never, Keys>, 'load' | 'isLoaded'> & {
  /**
   * A function that starts the loading process for the control and returns a promise
   * that resolves with the loaded value.
   */
  fetch(...keys: [Keys] extends [never] ? [] : Keys): Promise<T>;
};

export type PollableControlOptions<
  T = any,
  Keys extends PrimitiveOrNested[] = never,
> = RequestableControlOptions<T, Keys> &
  Pick<AsyncControlOptions<T>, 'isLoaded'> & {
    /** The interval in milliseconds at which the control should poll for new data. */
    interval: number;
    /**
     * The interval in milliseconds for polling when the document is hidden (e.g., when the tab is not in focus).
     * If set to `0`, polling is disabled while the tab is hidden.
     */
    hiddenInterval?: number;
  };

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
   * **Warning**: This only removes the control entry from
   * the storage but does not clear or reset the control itself.
   */
  delete(...keys: Keys | PartialTuple<Keys> | []): boolean;
  /** @internal */
  readonly _storage: Map<any, any>;
  /** @internal */
  readonly _getItem: (...args: any[]) => any;
  /** @internal */
  readonly _arg1: any;
  /** @internal */
  readonly _syncExternalStorage: SyncExternalStorage | undefined;
} & (T extends AsyncControl
    ? {
        clear(...keys: Keys | PartialTuple<Keys> | []): void;
      }
    : {});

export type SyncExternalStorage<T = any> = {
  (keys: PrimitiveOrNested[] | undefined): {
    set(value: T): void;
    get(): T | undefined;
    observe?(setControl: (value: T) => void): () => void;
  };
  /** @internal */
  _observable?: true;
};
