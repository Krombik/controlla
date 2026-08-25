import type { INTERNALS } from '#internal/constants';
import type { ComponentType, JSX, PropsWithChildren } from 'react';
import type {
  AsyncControlOptions,
  ReadonlyAsyncControl,
  Scheduler,
} from '#types';
import type { PatchType } from '#internal/constants';

export type PendingItem = Pick<ControlInternals, '_commitSet' | '_level'>;

/** Pending items commit in ascending `_level` order, so deriveds commit after their sources. */
export type Lane = {
  readonly _scheduler: Scheduler;
  _canScheduleFlush: boolean;
  _minPendingLevel: number;
  _maxPendingLevel: number;
  /** Whether a commit on it tells anyone - a catch-up does not. */
  readonly _silent: boolean;
  readonly _patchByControl: Map<PendingItem, any>;
  readonly _beforeFlushHooks: Array<() => void>;
  readonly _pendingControlLevels: PendingItem[][];
};

/** @internal */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type Falsy = null | undefined | false | 0 | '';

export type ChangeListener<T = any> = (newValue: T, prevValue: T) => void;

/** `_type` UNSET: only the `_patchedKeys` subtrees apply; SET: `_value` replaces the whole node. */
export type PatchTreeNode = {
  _type: PatchType;
  _value: any;
  readonly _children: Map<string, PatchTreeNode>;
  readonly _patchedKeys: string[];
  /** Root node only: a loader's value or the address bar's, not a write. */
  _fromSource: boolean;
};

/** Invariant: `_indexMap` is null iff `_listeners` is the shared `EMPTY_ARR`. */
export type Listeners<T extends Function> = {
  _indexMap: Map<T, number> | undefined;
  readonly _listeners: T[];
};

export type Notifier = {
  _notify(this: Notifier, lane: Lane, value: any, prevValue: any): void;
  /** What the notification is for - a derived control, a `watchValues` subscription. */
  readonly _target: any;
  readonly _index: number;
  /** The `_dependents` it sits in, or `EMPTY_ARR` while it is not attached. */
  _attachedTo: Notifier[];
  /** What it listens to, kept for as long as it exists - reattaching needs it. */
  _source: any;
};

/** Everything a scope mounts and unmounts: controls, storage observers. */
export type Subscription = {
  _subscribe(): void;
  /** Announces the catch-up it will owe, so nothing reads its control stale. */
  _cleanup(): void;
  /** Catches up with what moved while nothing of it was attached. */
  _resync(): void;
};

export interface ControlInternalsBase extends Listeners<ChangeListener> {
  _get(): any;
  readonly _path: readonly string[] | undefined;
  readonly _dependents: Notifier[];
}

export interface Attachers {
  _attach(
    control: Listeners<ChangeListener> | undefined,
    listener: ChangeListener | undefined,
    isLoad: boolean
  ): void;
  _detach(
    control: Listeners<ChangeListener> | undefined,
    listener: ChangeListener | undefined,
    isLoad: boolean
  ): void;
  readonly _level: number;
  readonly _load: unknown;
}

export interface RootBase {
  _value: any;
  readonly _root: this;
  /**
   * The subscription owing a catch-up - nothing of it is attached, so its mount
   * runs that before anything of the commit can read it.
   */
  _pending: Subscription | undefined;
}

export type ReadonlyPrimitiveControlInternals = ControlInternalsBase & RootBase;

interface Settable {
  /** {@link fromSource} - the value comes from a loader or the address bar, not a write. */
  _enqueueSet(
    value: any,
    lane: Lane,
    fromSource: boolean,
    path?: readonly string[]
  ): void;
  _commitSet(value: any, lane: Lane): void;
}

type WithExternalStorage = {
  _setExternal(value: any): void;
};

export type PrimitiveControlInternals = Attachers &
  ControlInternalsBase &
  RootBase &
  Settable &
  WithExternalStorage;

export type ErrorControlInternals<Parent> = ReadonlyPrimitiveControlInternals &
  Attachers &
  Pick<Settable, '_enqueueSet'> & {
    readonly _parent: Parent;
  };

export interface ControlInternals extends PrimitiveControlInternals {
  _children:
    | Map<
        string,
        Pick<
          this,
          '_children' | '_storage' | '_root' | keyof ControlInternalsBase
        > & {
          readonly _boundData?: {
            readonly _selfNotifier: Notifier;
            _prevValue: any;
            _value: any;
          };
        }
      >
    | undefined;
  _storage: Map<string, any> | undefined;
}

export type ControlInternalsChild = ChildControlNode<ControlInternals>;

export type AsyncStatusControls<Parent> = {
  readonly _errorControl: {
    [INTERNALS]: ErrorControlInternals<Parent>;
  };
  readonly _loadingControl: {
    [INTERNALS]: ReadonlyPrimitiveControlInternals;
  };
  readonly _readyControl: {
    [INTERNALS]: ReadonlyPrimitiveControlInternals;
  };
  _promise:
    | {
        readonly _promise: Promise<any>;
        _resolve(value: any): void;
        _reject(err: any): void;
      }
    | undefined;
};

export interface AsyncControlInternals
  extends ControlInternals, AsyncStatusControls<AsyncControlInternals> {
  _isLoaded(nextValue: any, prevValue: any, attempt: number): boolean;
  _attempt: number;
  readonly _load:
    | {
        _activeCount: number;
        _canScheduleUnload: boolean;
        _cleanup: (() => void) | void | undefined;
        /** 0: load in flight; 1: loaded, staleness untracked; else: load end timestamp */
        _loadedAt: number;
        readonly _keys?: any[];
        readonly _options: AsyncControlOptions<any, any, any[]>;
        readonly _slowLoadMonitor:
          | (Listeners<() => void> & {
              _timerId: ReturnType<typeof setTimeout> | undefined;
              readonly _dependents: Notifier[];
            })
          | null;
      }
    | undefined;
}

export type AsyncControlInternalsChild =
  ChildControlNode<AsyncControlInternals>;

export type ChildControlNode<T extends ControlInternals> =
  NonNullable<T['_children']> extends Map<string, infer K> ? K : never;

type StringToNumber<T> = T extends `${infer K extends number}` ? K : never;

export type ToIndex<T> = [Exclude<T, keyof []>] extends [never]
  ? number
  : StringToNumber<T>;

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

export type PartialTuple<T extends unknown[]> = T extends [
  ...infer Rest,
  infer _,
]
  ? [] extends Rest
    ? never
    : Rest | PartialTuple<Rest>
  : never;

export type ContainerComponent =
  ComponentType<PropsWithChildren> | keyof JSX.IntrinsicElements;

export type RenderablePrimitives = string | number | null | undefined | boolean;
