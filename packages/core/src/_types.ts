import type { PrimitiveOrNested } from 'keyweaver';
import type { ROOT } from '#shared/constants';
import type { ComponentType, JSX, PropsWithChildren } from 'react';
import type {
  AsyncControl,
  Control,
  LoadableControl,
  ReadonlyAsyncControl,
  ReadonlyControl,
  SyncExternalStorage,
} from '#types';

/** @internal */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type Nil = null | undefined;

export type Falsy = Nil | false | 0 | '';

/** @internal */
export type ValueChangeCallbacks = Set<(value: any) => void>;

/** @internal */
export type ScopeCallbackMap = Partial<
  Pick<InternalControl, '_callbacks' | '_children'>
>;

/** @internal */
export interface InternalControl<T = any> {
  readonly [ROOT]?: this;
  _value: T;
  _subscribe(cb: (value: any) => void): () => void;
  _get(): any;
  _set(value?: T, path?: readonly string[]): void;
  readonly _path?: readonly string[];
  readonly _callbacks: ValueChangeCallbacks;
  _children?: Map<string, ScopeCallbackMap>;
  /** storage of proxies */
  _storage?: Map<string, InternalControl>;
  _valueToggler: 0 | 1;
  _unobserve: (() => void) | undefined;
}

/** @internal */
export interface InternalAsyncControl extends InternalControl {
  readonly [ROOT]: this;
  readonly _awaitOnly?: true;
  readonly _errorControl: Control & {
    [ROOT]: { readonly _parent: InternalAsyncControl };
  };
  readonly _isLoadedControl: ReadonlyControl<boolean>;
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
  _subscribeWithLoad?(cb: () => void): () => void;
  _subscribeWithError(cb: () => void): () => void;
  _load?(...args: any[]): (() => void) | void;
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
