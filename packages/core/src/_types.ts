import type { PrimitiveOrNested } from 'keyweaver';
import type { ROOT } from '#shared/constants';
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
import type SuspenseContext from '#utils/SuspenseContext';
import type ErrorBoundaryContext from '#utils/ErrorBoundaryContext';

/** @internal */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type Nil = null | undefined;

export type Falsy = Nil | false | 0 | '';

export type OnValueChange<T = any> = (newValue: T, prevValue: T) => void;

/** @internal */
export type PatchNode = {
  _set: boolean;
  _isObject: boolean;
  _value: any;
  _prevValue: any;
  readonly _children: Map<string, PatchNode>;
  readonly _childrenKeys: string[];
};

interface SharedUtils {
  _subscribe(
    cb: (value: any, prevValue: any) => void,
    withoutLoad?: boolean
  ): () => void;
  _get(): any;
  readonly _callbacks: OnValueChange[];
  /** toggler for {@link useSyncExternalStore} */
  _valueToggler: boolean;
}

export interface SharedPrimitiveControl extends SharedUtils {
  _value: any;
}

export interface EnqueueblePrimitive extends SharedPrimitiveControl {
  _nextValue: any;
  _stale: boolean;
}

export interface ErrorUtils extends EnqueueblePrimitive {
  readonly _root: ErrorUtils;
  readonly _parent: AsyncControlRoot;
  _enqueueSet(value?: any): void;
}

export interface ControlBase<T = any> extends SharedUtils {
  readonly _root: ControlRoot<T>;
  _children: Map<string, ControlChild> | undefined;
  /** storage of proxies */
  _storage: Map<string, ControlChild> | undefined;
}

/** @internal */
export interface ControlChild<T = any> extends ControlBase<T> {
  readonly _path: readonly string[];
}

export interface ControlRoot<T = any> extends ControlBase<T> {
  readonly _path: undefined;
  _value: T;
  _enqueueSet(value?: T, path?: readonly string[]): void;
  readonly _patchNode: PatchNode;
  _stale: boolean;
  _unobserve: (() => void) | undefined;
}

export interface AsyncControlRoot<T = any> extends ControlRoot<T> {
  readonly _root: AsyncControlRoot<T>;
  readonly _watchValueChanges: boolean;
  readonly _errorControl: {
    [ROOT]: ErrorUtils;
  };
  readonly _isLoadedControl: { [ROOT]: SharedPrimitiveControl };
  readonly _slowLoading: {
    readonly _timeout: number;
    _timeoutId: ReturnType<typeof setTimeout> | undefined;
    readonly _callbacks: Array<() => void>;
    readonly _indexMap: Map<() => void, number>;
  } | null;
  _counter: number;
  _isUnloadNotSchedule: boolean;
  _isLoadable: boolean;
  _promise: Promise<any>;
  _unload: (() => void) | void | undefined;
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
  _load(reload?: boolean): () => void;
  readonly _loadingProcess: any;
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

export type StorageRecord = {
  [key in string]: StorageItem | StorageMarker<any[], StorageItem>;
};

export type StorageItem = Control | ScopeMarker | StorageRecord;

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

export type ContainerType =
  | ComponentType<PropsWithChildren>
  | keyof JSX.IntrinsicElements;

/** @internal */
export type SkeletonControl = {
  _fakeSuspense(
    suspenseCtx: ContextType<typeof SuspenseContext>,
    errorBoundaryCtx: ContextType<typeof ErrorBoundaryContext>
  ): Promise<any>;
} & ControlRoot;
