import type { Primitive, PrimitiveOrNested } from 'keyweaver';

import type { INTERNALS } from '#shared-internal/constants';
import type {
  ControlInternalsChild,
  Nil,
  PartialTuple,
  ScopeMarker,
  StorageItem as RegistryItem,
  StorageMarker as RegistryMarker,
  ToIndex,
  ControlInternals,
  AsyncControlInternals,
  AsyncControlInternalsChild,
} from '#internal/types';
import type { ControlType } from '#internal/constants';
import type { AggregateControlError } from '#internal/AggregateControlError';

declare const CONTROL_MARKER: unique symbol;

declare const SETTABLE_MARKER: unique symbol;

declare const ERROR_MARKER: unique symbol;

export type { AggregateControlError };

export type ReadonlyControl<Value = any> = {
  /** @internal */
  [INTERNALS]: ControlInternals | ControlInternalsChild;
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
  [SETTABLE_MARKER]: true;
};

type AsyncControlBase<Error> = {
  /** @internal */
  readonly [INTERNALS]: AsyncControlInternals | AsyncControlInternalsChild;
  [ERROR_MARKER]: Error;
};

/**
 * Represents a control that manages an asynchronous value, including {@link AsyncControl.isLoaded loading} and {@link AsyncControl.error error} controls.
 * Extends {@link Control}.
 */
export type AsyncControl<Value = any, Error = any> = Control<Value> &
  AsyncControlBase<Error>;

type ProcessScope<
  Value,
  S extends ReadonlyControl,
  M = Exclude<Value, Nil>,
  N = Extract<Value, Nil>,
> = (S extends AsyncControl<any, infer E>
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

export type LoadHandle<T = any, E = any> = {
  setValue(value: T, scheduler?: Scheduler): boolean;
  getValue(): T | undefined;
  setError(error: E, scheduler?: Scheduler): void;
  stillLoading(): boolean;
};

export type AsyncControlOptions<
  T = any,
  E = any,
  Keys extends PrimitiveOrNested[] = [],
> = {
  /** The initial value of the control or a function to resolve it using keys. */
  value?: T | ((...args: Keys) => T);
  /** A function to determine if the control is considered loaded, based on the {@link value current} and {@link prevValue previous} values and the number of loading {@link attempt attempts}. */
  isLoaded?(value: T, prevValue: T | undefined, attempt: number): boolean;
  /**
   * A function to initiate the loading process. This method can optionally return
   * a cleanup function to be called when the loading is complete or canceled.
   */
  load?(
    handle: LoadHandle<T, E>,
    ...args: [Keys] extends [[]] ? [] : [keys: Keys]
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
  /** The timeout in milliseconds for considering the loading process slow. */
  loadingTimeout?: number;
};

type MixedKey<K> = K | ReadonlyControl<K | undefined>;

type MixedKeys<Keys extends PrimitiveOrNested[]> = {
  [I in keyof Keys]: MixedKey<Keys[I]>;
};

type GetAggregateControlError<Errors, Error = never> = Errors extends any[]
  ? AggregateControlError<[...Errors, target: Error]>
  : never;

type CombineErrors<T extends RegistryItem, Errors> =
  T extends AsyncControlScope<infer V, infer E>
    ? AsyncControlScope<V, GetAggregateControlError<Errors, E>>
    : T extends ControlScope<infer V>
      ? AsyncControlScope<
          Exclude<V, undefined>,
          GetAggregateControlError<Errors>
        >
      : T extends Control<infer V>
        ? AsyncControl<Exclude<V, undefined>, GetAggregateControlError<Errors>>
        : never;

type BoundControl<T extends RegistryItem, K extends any[]> = CombineErrors<
  T,
  {
    [index in keyof K]: K[index] extends ReadonlyAsyncControl<any, infer E>
      ? E
      : never;
  }
>;

export type Registry<
  T extends RegistryItem,
  Keys extends Exclude<PrimitiveOrNested, undefined>[],
> = RegistryMarker<Keys, T> & {
  get(...keys: Keys): T;
  bind<const K extends MixedKeys<Keys>>(
    ...keys: K
  ): [Extract<K[number], ReadonlyAsyncControl>] extends [never]
    ? T extends AsyncControl
      ? BoundControl<T, K>
      : Extract<K[number], ReadonlyControl> extends ReadonlyControl<infer V>
        ? [Extract<V, undefined>] extends [never]
          ? T
          : T extends ControlScope<infer V>
            ? ControlScope<V | undefined>
            : T extends Control<infer V>
              ? Control<V | undefined>
              : never
        : never
    : BoundControl<T, K>;
  has(...keys: MixedKeys<Keys> | PartialTuple<MixedKeys<Keys>>): boolean;
  /**
   * Deletes a control entry from the storage associated with the given key.
   *
   * **Warning**: This only removes the control entry from
   * the storage but does not clear or reset the control itself.
   */
  delete(...keys: MixedKeys<Keys> | PartialTuple<MixedKeys<Keys>>): boolean;
  clear(): void;
  /** @internal */
  _bounded: WeakMap<any, any> | undefined;
  /** @internal */
  _storage: Map<any, any>;
  /** @internal */
  readonly _depth: number;
  /** @internal */
  _getItem(
    arg1: any,
    syncExternalStorage: SyncExternalStorage | undefined,
    keys: any[] | undefined
  ): Control | ControlScope | AsyncControlScope;
  /** @internal */
  readonly _arg1: any;
  /** @internal */
  readonly _syncExternalStorage: SyncExternalStorage | undefined;
  /** @internal */
  _type: ControlType;
} & (T extends AsyncControl
    ? {
        invalidate(...keys: Keys | PartialTuple<Keys> | []): void;
      }
    : {});

export type ExternalStorageInstance<T = any> = {
  get(): T | undefined;
  set(value: T): void;
  /**
   * Subscribes to external changes of the stored value (e.g. another browser
   * tab). The {@link onChange} callback receives `undefined` when the value
   * was removed. Returns an unsubscribe function.
   */
  observe?(onChange: (value: T | undefined) => void): () => void;
};

export type SyncExternalStorage<T = any> = (
  keys?: PrimitiveOrNested[]
) => ExternalStorageInstance<T>;

export type Scheduler = (cb: () => void) => any;
