import type { PrimitiveOrNested } from 'keyweaver';
import type { INTERNALS } from '#shared-internal/constants';
import type {
  ComponentType,
  ContextType,
  JSX,
  PropsWithChildren,
  useSyncExternalStore,
} from 'react';
import type {
  AsyncControl,
  Control,
  LoadableControl,
  ReadonlyAsyncControl,
  SyncExternalStorage,
} from '#types';
import type SuspenseContext from '#internal/SuspenseContext';
import type ErrorBoundaryContext from '#internal/ErrorBoundaryContext';

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
  _isObject: boolean;
  _value: any;
  _prevValue: any;
  readonly _children: Map<string, PatchTreeNode>;
  readonly _patchedKeys: string[];
};

export interface ControlInternals {
  _subscribe(
    cb: (value: any, prevValue: any) => void,
    withoutLoad?: boolean
  ): () => void;
  _get(): any;
  readonly _listeners: ChangeListener[];
  /** toggler for {@link useSyncExternalStore} */
  _versionToggle: boolean;
}

export interface EnqueueablePrimitiveControlInternals extends ControlInternals {
  _value: any;
  _nextValue: any;
  _stale: boolean;
}

export interface ErrorControlInternals extends EnqueueablePrimitiveControlInternals {
  readonly _root: ErrorControlInternals;
  readonly _parent: AsyncRootNode;
  _enqueueSet(value?: any): void;
}

export interface ControlNode<T = any> extends ControlInternals {
  readonly _root: RootControlNode<T>;
  _children: Map<string, ChildControlNode> | undefined;
  /** storage of proxies */
  _storage: Map<string, ChildControlNode> | undefined;
}

/** @internal */
export interface ChildControlNode<T = any> extends ControlNode<T> {
  readonly _path: readonly string[];
}

export interface RootControlNode<T = any> extends ControlNode<T> {
  readonly _path: undefined;
  _value: T;
  _enqueueSet(value?: T, path?: readonly string[]): void;
  readonly _patchNode: PatchTreeNode;
  _stale: boolean;
  _unobserve: (() => void) | undefined;
}

export interface AsyncRootNode<T = any> extends RootControlNode<T> {
  readonly _root: AsyncRootNode<T>;
  readonly _errorControl: {
    [INTERNALS]: ErrorControlInternals;
  };
  readonly _loadingControl: {
    [INTERNALS]: ControlInternals;
  };
  readonly _readyControl: {
    [INTERNALS]: Pick<AsyncRootNode, '_root'> & ControlInternals;
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
  _loadPromise: Promise<any>;
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
