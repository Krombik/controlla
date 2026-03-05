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
  AsyncControl,
  Control,
  LoadableControl,
  ReadonlyAsyncControl,
  Scheduler,
  SyncExternalStorage,
} from '#types';
import type SuspenseContext from '#internal/SuspenseContext';
import type ErrorBoundaryContext from '#internal/ErrorBoundaryContext';

export type Lane = {
  _canScheduleFlush: boolean;
  readonly _patchByControl: Map<RootControlNode, PatchTreeNode> &
    Map<PrimitiveControlInternals, any>;
  readonly _afterFlushHooks: Array<() => void>;
  readonly _pendingControls: Array<RootControlNode | PrimitiveControlInternals>;
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

export interface ControlInternals {
  _subscribe(cb: ChangeListener, withoutLoad?: boolean): () => void;
  _get(): any;
  readonly _listeners: ChangeListener[];
  _useSubscribeWithLoad(
    useSyncExternalStore: typeof _useSyncExternalStore
  ): any;
}

export interface ReadonlyPrimitiveControlInternals extends ControlInternals {
  _value: any;
}

interface Settable {
  _enqueueSet(value: any, scheduler: Scheduler | undefined): void;
  _commitSet(value: any): void;
}

export interface PrimitiveControlInternals
  extends ReadonlyPrimitiveControlInternals, Settable {}

export interface ErrorControlInternals extends PrimitiveControlInternals {
  readonly _root: ErrorControlInternals;
  readonly _parent: AsyncRootNode;
}

export interface ControlNode<T = any> extends ControlInternals {
  readonly _root: RootControlNode<T>;
  _version: number;
  _children: Map<string, ChildControlNode> | undefined;
  /** storage of proxies */
  _storage: Map<string, ChildControlNode> | undefined;
}

/** @internal */
export interface ChildControlNode<T = any> extends ControlNode<T> {
  readonly _path: readonly string[];
}

export interface RootControlNode<T = any> extends ControlNode<T>, Settable {
  readonly _path: undefined;
  _value: T;
  _enqueueSet(value: T, scheduler: Scheduler, path?: readonly string[]): void;
  _useCleanup(useEffect: typeof _useEffect): void;
}

export interface AsyncRootNode<T = any> extends RootControlNode<T> {
  readonly _root: AsyncRootNode<T>;
  readonly _errorControl: {
    [INTERNALS]: ErrorControlInternals;
  };
  readonly _loadingControl: {
    [INTERNALS]: ReadonlyPrimitiveControlInternals;
  };
  readonly _readyControl: {
    [INTERNALS]: Pick<AsyncRootNode, '_root'> &
      ReadonlyPrimitiveControlInternals;
  };
  readonly _slowLoadMonitor: {
    readonly _timeoutMs: number;
    _timerId: ReturnType<typeof setTimeout> | undefined;
    readonly _listeners: Array<() => void>;
    readonly _listenerIndex: Map<() => void, number>;
  } | null;
  _activeLoadCount: number;
  _canScheduleUnload: boolean;
  _canLoad: boolean;
  _attempt: number;
  _promise: {
    _promise: Promise<any>;
    _resolve(value: any): void;
    _reject(err: any): void;
  };
  _cleanup: (() => void) | void | undefined;
  readonly _reloadIfStale: {
    readonly _timeoutMs: number;
    _timerId: ReturnType<typeof setTimeout> | undefined;
  } | null;
  readonly _reloadOnFocus: {
    readonly _timeoutMs: number;
    _timerId: ReturnType<typeof setTimeout> | undefined;
    _canLoad: boolean;
    _visibilityChangeListener: (() => void) | undefined;
  } | null;
  _isFetchInProgress: boolean;
  _isLoaded(nextValue: any, prevValue: any, attempt: number): boolean;
  _load: (...args: any[]) => (() => void) | void;
  _attachLoad(reload?: boolean): () => void;
  readonly _loadProcess: any;
}

declare const SCOPE_MARKER: unique symbol;

export type ScopeMarker<T = any> = {
  [SCOPE_MARKER]: T;
};

type StringToNumber<T> = T extends `${infer K extends number}` ? K : never;

export type ToIndex<T> = [Exclude<T, keyof []>] extends [never]
  ? number
  : StringToNumber<T>;

/** @internal */
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
    suspenseCtx: ContextType<typeof SuspenseContext>,
    errorBoundaryCtx: ContextType<typeof ErrorBoundaryContext>
  ): Promise<any>;
} & AsyncRootNode;

export type RenderablePrimitives = string | number | null | undefined;
