import type { PrimitiveOrNested } from 'keyweaver';
import type { INTERNALS } from '#shared-internal/constants';
import type {
  ComponentType,
  ContextType,
  JSX,
  PropsWithChildren,
  useEffect as _useEffect,
  useSyncExternalStore as _useSyncExternalStore,
} from 'react';
import type {
  AsyncSource,
  Control,
  ReadonlyAsyncControl,
  SyncExternalStorage,
} from '#types';
import type SuspenseContext from '#internal/SuspenseContext';

export type Lane = {
  _canScheduleFlush: boolean;
  _minPendingLevel: number;
  _maxPendingLevel: number;
  readonly _patchByControl: Map<ControlInternals, PatchTreeNode> &
    Map<PrimitiveControlInternals, any>;
  readonly _beforeFlushHooks: Array<() => void>;
  readonly _pendingControlLevels: Array<
    ControlInternals | PrimitiveControlInternals
  >[];
};

/** @internal */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type Nil = null | undefined;

export type Falsy = Nil | false | 0 | '';

export type ChangeListener<T = any> = (newValue: T, prevValue: T) => void;

/** @internal */
export type PatchTreeNode = {
  _hasValuePatch: boolean;
  _value: any;
  readonly _children: Map<string, PatchTreeNode>;
  readonly _patchedKeys: string[];
};

/**
 * INVARIANT: `_listeners === EMPTY_ARR` iff `_indexMap == null`.
 * Mutate only via flushQueue's addListener / removeListener.
 */
export type Listeners<T extends Function> = {
  _indexMap: Map<T, number> | undefined;
  readonly _listeners: T[];
};

export type Notifier = {
  _notify(lane: Lane, item: any, value: any, prevValue: any): void;
  readonly _ref: WeakRef<any>;
  readonly _index: number;
  _current: Notifier[];
};

export interface ControlInternalsBase extends Listeners<ChangeListener> {
  _get(): any;
  readonly _path: readonly string[] | undefined;
  readonly _dependents: Notifier[];
}

interface Attachers {
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
}

export interface RootBase extends Attachers {
  _value: any;
  readonly [INTERNALS]: this;
  readonly _level: number;
  readonly _load: unknown;
}

export type ReadonlyPrimitiveControlInternals = ControlInternalsBase & RootBase;

interface Settable {
  _enqueueSet(value: any, lane: Lane, path?: readonly string[]): void;
  _commitSet(value: any, lane: Lane): void;
}

export type WithExternalStorage = {
  readonly _externalStorage?: ReturnType<SyncExternalStorage>;
};

export type PrimitiveControlInternals = ReadonlyPrimitiveControlInternals &
  Settable &
  WithExternalStorage;

export type ErrorControlInternals<Parent> = ReadonlyPrimitiveControlInternals &
  Settable & {
    readonly _parent: Parent;
  };

export interface ControlInternals
  extends ControlInternalsBase, RootBase, Settable, WithExternalStorage {
  _children:
    | Map<
        string,
        Pick<
          this,
          | '_children'
          | '_storage'
          | typeof INTERNALS
          | keyof ControlInternalsBase
        > & {
          readonly _data?: {
            readonly _selfNotifier: Notifier;
            _prevValue: any;
            _value: any;
          };
        }
      >
    | undefined;
  /** storage of proxies */
  _storage: Map<string, any> | undefined;
}

export type ControlInternalsChild = ChildControlNode<ControlInternals>;

export type AsyncThings<Parent> = {
  readonly _errorControl: {
    [INTERNALS]: ErrorControlInternals<Parent>;
  };
  readonly _loadingControl: {
    [INTERNALS]: Omit<ReadonlyPrimitiveControlInternals, keyof Attachers>;
  };
  readonly _readyControl: {
    [INTERNALS]: Omit<ReadonlyPrimitiveControlInternals, keyof Attachers>;
  };
  _promise:
    | {
        readonly _promise: Promise<any>;
        _resolve(value: any): void;
        _reject(err: any): void;
      }
    | undefined;
  readonly _load: unknown;
};

export interface AsyncControlInternals
  extends ControlInternals, AsyncThings<AsyncControlInternals> {
  _isLoaded(nextValue: any, prevValue: any, attempt: number): boolean;
  _attempt: number;
  readonly _load:
    | {
        _activeCount: number;
        _canScheduleUnload: boolean;
        _cleanup: (() => void) | void | undefined;
        _loadedAt: number;
        readonly _keys?: any[];
        readonly _source: AsyncSource<any, any, any>;
        readonly _slowLoadMonitor:
          | ({
              _timerId: ReturnType<typeof setTimeout> | undefined;
            } & Listeners<() => void>)
          | null;
      }
    | undefined;
}

export type AsyncControlInternalsChild =
  ChildControlNode<AsyncControlInternals>;

export type ChildControlNode<T extends ControlInternals> =
  NonNullable<T['_children']> extends Map<string, infer K> ? K : never;

declare const SCOPE_MARKER: unique symbol;

export type ScopeMarker<T = any> = {
  [SCOPE_MARKER]: T;
};

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

export interface PollableMethods {
  /** Pauses the current polling process. */
  pause(): void;
  /** Resumes a polling process. */
  resume(): void;
  /** Resets the loading process, starting it from the beginning. */
  reset(): void;
}

export type StorageItem = Control | ScopeMarker;

declare const CONTROL_STORAGE_IDENTIFIER: unique symbol;

export type StorageMarker<Keys extends PrimitiveOrNested[], Item> = {
  [CONTROL_STORAGE_IDENTIFIER]: [Keys, Item];
};

export type PartialTuple<T extends unknown[]> = T extends [
  ...infer Rest,
  infer _,
]
  ? [] extends Rest
    ? never
    : Rest | PartialTuple<Rest>
  : never;

export type WithInitModule<T, Args extends any[]> = [
  ...Args,
  syncExternalStorage?: SyncExternalStorage<T>,
];

export type ContainerComponent =
  | ComponentType<PropsWithChildren>
  | keyof JSX.IntrinsicElements;

/** @internal */
export type PendingControl = {
  _fakeSuspense(
    suspenseCtx: NonNullable<ContextType<typeof SuspenseContext>>
  ): Promise<any>;
} & AsyncControlInternals;

export type RenderablePrimitives = string | number | null | undefined;

export const enum ControlType {
  UNDEFINED = 0,
  SYNC = 1,
  ASYNC = 2,
  LOADABLE = 3,
}
