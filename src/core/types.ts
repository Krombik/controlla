import type { Primitive, PrimitiveOrNested } from 'keyweaver';

import type { INTERNALS } from '#internal/constants';
import type {
  ControlInternalsChild,
  PartialTuple,
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

/** A control whose value can be read and subscribed to, but not set. */
export type ReadonlyControl<Value = any> = {
  /** @internal */
  [INTERNALS]: ControlInternals | ControlInternalsChild;
  [CONTROL_MARKER]: Value;
};

/** A readonly control over an asynchronously arriving value (`undefined` until it loads), with loading/ready/error statuses. */
export type ReadonlyAsyncControl<
  Value = any,
  Error = any,
> = ReadonlyControl<Value> & AsyncControlBase<Error>;

/**
 * A settable control holding a value as an opaque whole (no nested-path
 * access) — what `createPrimitiveControl` returns; control scopes are
 * assignable to it as well.
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
 * A settable async control: the value arrives asynchronously (`undefined`
 * until ready), with loading/ready/error statuses readable via
 * `selectLoading`/`selectReady`/`selectError`.
 */
export type AsyncControl<Value = any, Error = any> = Control<Value> &
  AsyncControlBase<Error>;

type _ReadonlyControlScope<
  Value,
  Nested = Exclude<Value, Primitive>,
  Absent = [Value] extends [Nested] ? never : undefined,
> = ReadonlyControl<Value> &
  (0 extends 1 & Value
    ? { readonly [key in string | number]: ReadonlyControlScope<any> }
    : [Nested] extends [never]
      ? {}
      : Nested extends any[]
        ? {
            readonly length: ReadonlyControl<Nested['length'] | Absent>;
          } & {
            readonly [key in ToIndex<keyof Nested>]-?: ReadonlyControlScope<
              Nested[key] | Absent
            >;
          }
        : {
            readonly [key in keyof Nested]-?: ReadonlyControlScope<
              Nested[key] | Absent
            >;
          });

type _ReadonlyAsyncControlScope<
  Value,
  Error,
  Nested = Exclude<Value, Primitive>,
  Absent = [Value] extends [Nested] ? never : undefined,
> = ReadonlyAsyncControl<Value, Error> &
  (0 extends 1 & Value
    ? {
        readonly [key in string | number]: ReadonlyAsyncControlScope<
          any,
          Error
        >;
      }
    : [Nested] extends [never]
      ? {}
      : Nested extends any[]
        ? {
            readonly length: ReadonlyAsyncControl<
              Nested['length'] | Absent,
              Error
            >;
          } & {
            readonly [
              key in ToIndex<keyof Nested>
            ]-?: ReadonlyAsyncControlScope<Nested[key] | Absent, Error>;
          }
        : {
            readonly [key in keyof Nested]-?: ReadonlyAsyncControlScope<
              Nested[key] | Absent,
              Error
            >;
          });

type _ControlScope<
  Value,
  Nested = Exclude<Value, Primitive>,
  Absent = [Value] extends [Nested] ? never : undefined,
> = Control<Value> &
  (0 extends 1 & Value
    ? {
        readonly [key in string | number]: ControlScope<any>;
      }
    : [Nested] extends [never]
      ? {}
      : Nested extends any[]
        ? {
            readonly length: ReadonlyControl<Nested['length'] | Absent>;
          } & {
            readonly [key in ToIndex<keyof Nested>]-?: ControlScope<
              Nested[key] | Absent
            >;
          }
        : {
            readonly [key in keyof Nested]-?: ControlScope<
              Nested[key] | Absent
            >;
          });

type _AsyncControlScope<
  Value,
  Error,
  Nested = Exclude<Value, Primitive>,
  Absent = [Value] extends [Nested] ? never : undefined,
> = AsyncControl<Value, Error> &
  (0 extends 1 & Value
    ? {
        readonly [key in string | number]: AsyncControlScope<any, Error>;
      }
    : [Nested] extends [never]
      ? {}
      : Nested extends any[]
        ? {
            readonly length: ReadonlyAsyncControl<
              Nested['length'] | Absent,
              Error
            >;
          } & {
            readonly [key in ToIndex<keyof Nested>]-?: AsyncControlScope<
              Nested[key] | Absent,
              Error
            >;
          }
        : {
            readonly [key in keyof Nested]-?: AsyncControlScope<
              Nested[key] | Absent,
              Error
            >;
          });

/** A readonly {@link ControlScope}. */
export type ReadonlyControlScope<Value = any> = _ReadonlyControlScope<Value>;

/**
 * A control with granular reactivity over its value: nested fields are
 * reachable as controls of their own via property access (`$user.profile.name`),
 * and a change notifies only the touched paths — what `createControl` returns.
 */
export type ControlScope<Value = any> = _ControlScope<Value>;

/** An async {@link ControlScope} — what `createAsyncControl` returns. */
export type AsyncControlScope<Value = any, Error = any> = _AsyncControlScope<
  Value,
  Error
>;

/** A readonly {@link AsyncControlScope}. */
export type ReadonlyAsyncControlScope<
  Value = any,
  Error = any,
> = _ReadonlyAsyncControlScope<Value, Error>;

/** The handle a {@link AsyncControlOptions.load loader} reports its results through. */
export type LoadHandle<T = any, E = any> = {
  /**
   * Commits a fetched {@link value} (batched via the {@link scheduler},
   * microtask by default). Ends the inner loading state when the value is
   * {@link AsyncControlOptions.isLoaded loaded}.
   *
   * @returns `true` if the control is still loading after the set — e.g. to
   * decide whether to keep polling.
   */
  setValue(value: T, scheduler?: Scheduler): boolean;
  /** Returns the control's current value. */
  getValue(): T | undefined;
  /** Commits a loading {@link error} (batched via the {@link scheduler}) and ends the loading. */
  setError(error: E, scheduler?: Scheduler): void;
  /** Returns whether the control is still loading. */
  stillLoading(): boolean;
};

export type AsyncControlOptions<
  T = any,
  E = any,
  Keys extends PrimitiveOrNested[] = [],
> = {
  /** The initial value of the control or a function to resolve it using keys. */
  initialValue?: T | ((...args: Keys) => T);
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
  /** If `true`, the control reloads on use even when it already has a value (e.g. one restored from external storage). */
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

type CombineErrors<T extends Control, Errors> =
  T extends AsyncControlScope<infer Value, infer Error>
    ? AsyncControlScope<Value, GetAggregateControlError<Errors, Error>>
    : T extends ControlScope<infer Value>
      ? AsyncControlScope<
          Exclude<Value, undefined>,
          GetAggregateControlError<Errors>
        >
      : T extends Control<infer Value>
        ? AsyncControl<
            Exclude<Value, undefined>,
            GetAggregateControlError<Errors>
          >
        : never;

type BoundControl<T extends Control, K extends any[]> = CombineErrors<
  T,
  {
    [index in keyof K]: K[index] extends ReadonlyAsyncControl<any, infer Error>
      ? Error
      : never;
  }
>;

export type Registry<
  T extends Control,
  Keys extends Exclude<PrimitiveOrNested, undefined>[],
> = {
  /** Returns the item for the given keys, creating and caching it on first access. */
  get(...keys: Keys): T;
  /**
   * Returns a control bound to the given keys, where keys can be controls:
   * it mirrors the registry item under the keys' current values and rebinds
   * to another item when a key control's value changes. While the new item
   * has no value yet, it shows `undefined` — or keeps the previous value if
   * the registry was created with the {@link RegistryOptions.keepPrev
   * keepPrev} option ({@link RegistryOptions.suppressError suppressError}
   * additionally holds it through errors).
   */
  bind<const K extends MixedKeys<Keys>>(
    ...keys: K
  ): [Extract<K[number], ReadonlyAsyncControl>] extends [never]
    ? T extends AsyncControl
      ? BoundControl<T, K>
      : Extract<K[number], ReadonlyControl> extends ReadonlyControl<infer Value>
        ? [Extract<Value, undefined>] extends [never]
          ? T
          : T extends ControlScope<infer Value>
            ? ControlScope<Value | undefined>
            : T extends Control<infer Value>
              ? Control<Value | undefined>
              : never
        : never
    : BoundControl<T, K>;
  /**
   * Deletes a control entry from the storage associated with the given key.
   *
   * **Warning**: This only removes the control entry from
   * the storage but does not clear or reset the control itself.
   */
  delete(...keys: MixedKeys<Keys> | PartialTuple<MixedKeys<Keys>>): boolean;
  /** Removes all entries from the registry (does not reset the controls themselves). */
  clear(): void;
  /** @internal */
  _bound: WeakMap<any, any> | undefined;
  /** @internal */
  readonly _storage: Map<any, any>;
  /** @internal */
  readonly _depth: number;
  /** @internal */
  _createControl(
    arg1: any,
    externalStorage: SyncExternalStorage | undefined,
    keys: any[] | undefined
  ): Control | ControlScope | AsyncControlScope;
  /** @internal */
  readonly _initArg: any;
  /** @internal */
  readonly _externalStorage: SyncExternalStorage | undefined;
  /** @internal */
  _type: ControlType;
  /** @internal */
  readonly _keepPrev: boolean | readonly boolean[];
  /** @internal */
  readonly _suppressError: boolean;
} & (T extends AsyncControl
  ? {
      /** Resets all items under the given keys or key prefix (every item when called with no keys), triggering reloads for those in use. */
      invalidate(...keys: Keys | PartialTuple<Keys> | []): void;
    }
  : {});

/** A per-control instance of a {@link SyncExternalStorage}. */
export type ExternalStorageInstance<T = any> = {
  /** Returns the stored value, or `undefined` if there is none. */
  get(): T | undefined;
  /** Stores the given value. */
  set(value: T): void;
  /**
   * Subscribes to external changes of the stored value (e.g. another browser
   * tab). The {@link onChange} callback receives `undefined` when the value
   * was removed. Returns an unsubscribe function.
   */
  observe?(onChange: (value: T | undefined) => void): () => void;
};

/**
 * A factory creating a storage instance for a control — the control takes
 * its initial value from the storage and writes every change back to it.
 * Any storage with sync reads works; persisting to `localStorage` (see the
 * persist module) is one use of it. Receives the control's registry keys,
 * if any.
 */
export type SyncExternalStorage<T = any> = (
  keys?: PrimitiveOrNested[]
) => ExternalStorageInstance<T>;

/**
 * Schedules a flush of batched control updates — all updates sharing a
 * scheduler are committed together when it fires (microtask by default;
 * pass a custom one to throttle or align commits).
 */
export type Scheduler = {
  (cb: () => void): any;
  /** @internal */
  _debounce?(): void;
  /** @internal */
  _sync?: boolean;
};

export type RegistryOptions<T = any, Keys extends any[] = any[]> = {
  /**
   * External storage backing each item's value — any storage with sync reads
   * (persisting is one use of it). Receives the item's keys.
   */
  externalStorage?: SyncExternalStorage<T>;
  /**
   * For bound controls: keep showing the previous value while a re-targeted
   * item loads, instead of blanking to `undefined`. Pass an array to decide
   * per key — e.g. `[false, true]` keeps the value on the second key's
   * changes but blanks on the first's; when several keys change at once,
   * every changed key must allow keeping. The held value is replaced as
   * soon as the current item produces one.
   */
  keepPrev?: boolean | { [index in keyof Keys]: boolean };
  /**
   * For bound controls: swallow an error while there is a previous value to
   * show — it surfaces only when there is nothing to hold. On re-targets it
   * applies only where {@link keepPrev} holds.
   */
  suppressError?: boolean;
};
