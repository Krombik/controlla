import type { Primitive, PrimitiveOrNested } from 'keyweaver';
import type { ROOT, ROUTE_METHODS, ROUTE_PARAMS } from './utils/constants';
import type {
  ComponentType,
  JSX,
  MouseEvent as ReactMouseEvent,
  PropsWithChildren,
} from 'react';

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
  readonly _errorControl: Omit<Control, typeof CONTROL_MARKER> & {
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

export type IsUnion<T, U = T> = T extends any
  ? // isUnion check
    [U] extends [T]
    ? false
    : true
  : never;

export type HandleUnknown<T, Fallback> = 0 extends 1 & T
  ? T
  : unknown extends T
    ? [T] extends [unknown]
      ? Fallback
      : T
    : T;

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

export type PartialTuple<T extends unknown[]> = T extends [
  ...infer Rest,
  infer _,
]
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

export type UnionToIntersection<U> = (
  U extends any ? (x: U) => void : never
) extends (x: infer R) => void
  ? Required<R>
  : never;

declare const NAVIGATION_MARKER: unique symbol;

export type NavigationTarget<Navigable extends boolean> = {
  /** @internal */
  readonly [ROUTE_METHODS]: RouteMethods;
  /** @internal */
  readonly [ROUTE_PARAMS]?: RouteParamsData[];
  [NAVIGATION_MARKER]: Navigable;
};

export type Router<Paths extends AnyPaths> = {
  readonly navigationBlocker: {
    enable(): () => void;
    disable(): void;
    readonly isPendingNavigation: ReadonlyControl<boolean> & {
      allow(): void;
      deny(): void;
    };
  };
  readonly routes: {
    readonly [key in keyof Paths]: Paths[key] extends Path<
      infer C,
      infer P,
      any,
      infer A
    >
      ? Route<
          C,
          P,
          A,
          [P] extends [never]
            ? []
            : [
                A extends false
                  ? ReadonlyControlScope<P>
                  : ReadonlyAsyncControlScope<P>,
              ]
        >
      : never;
  };
  readonly navigation: {
    [key in keyof Paths]: Paths[key] extends Path<
      infer C,
      infer P,
      infer O,
      any
    >
      ? Navigation<C, P, O>
      : never;
  };
  readonly navigationState: ReadonlyControl<NavigationState>;
};

declare const IS_PAGE_MARKER: unique symbol;

declare const CONTROLS_MARKER: unique symbol;

export type RouteIsPage<IsPage extends boolean> = {
  [IS_PAGE_MARKER]: IsPage;
  /** @internal */
  _register(setComponents: () => void): void;
};

export type RouteControls<
  Controls extends Array<ReadonlyControlScope | ReadonlyAsyncControlScope>,
> = {
  [CONTROLS_MARKER]: Controls;
  /** @internal */
  [ROUTE_METHODS](
    load: (
      ...args: Array<ReadonlyControlScope | ReadonlyAsyncControlScope>
    ) => void | Array<() => void>
  ): void;
};

declare const PARAMS_MARKER: unique symbol;

export type RouteParams<Params, Async> = {
  /** @internal */
  [ROUTE_PARAMS]: ReadonlyControlScope;
  [PARAMS_MARKER]: [Params, Async];
};

export type Route<
  Paths = never,
  Params = never,
  Async extends boolean = false,
  Controls extends Array<
    ReadonlyControlScope | ReadonlyAsyncControlScope
  > = any[],
  IsPage extends boolean = [Paths] extends [never]
    ? true
    : Paths & 1 extends 0
      ? boolean
      : false,
> = RouteIsPage<IsPage> &
  RouteControls<Controls> &
  RouteParams<Params, Async> &
  ([Paths] extends [never]
    ? {}
    : {
        readonly [key in keyof Paths]: Paths[key] extends Path<
          infer C,
          infer P,
          any,
          infer A
        >
          ? Route<
              C,
              P,
              A,
              [P] extends [never]
                ? Controls
                : [
                    A extends false
                      ? ReadonlyControlScope<P>
                      : ReadonlyAsyncControlScope<P>,
                    ...Controls,
                  ]
            >
          : never;
      }) &
  ReadonlyControl<boolean>;

export type Navigation<
  Paths extends AnyPaths = never,
  Params = never,
  OptionalParams extends string = never,
  Children = [Paths] extends [never]
    ? {}
    : {
        [key in keyof Paths]: Paths[key] extends Path<
          infer C,
          infer P,
          infer O,
          any
        >
          ? Navigation<C, P, O>
          : never;
      },
> = ([Paths] extends [never]
  ? {}
  : {
      (): Children & NavigationTarget<false>;
    }) &
  ([Params] extends [never]
    ? [Paths] extends [never]
      ? { (): NavigationTarget<true> }
      : {}
    : {
        (
          params: ProcessParams<
            Partial<
              Pick<
                Params,
                OptionalParams extends keyof Params ? OptionalParams : never
              >
            > &
              Omit<Params, OptionalParams>
          >
        ): Children & NavigationTarget<true>;
        <
          StringifiedKeys extends keyof Params,
          StringifiedParams extends Partial<Record<keyof Params, any>> = {
            [key in keyof Params]:
              | (NonNullable<Params[key]> extends string ? Params[key] : string)
              | Extract<Params[key], undefined>;
          },
        >(
          params: ProcessParams<
            Partial<
              Pick<
                Params,
                OptionalParams extends keyof Params
                  ?
                      | OptionalParams
                      | (StringifiedKeys extends keyof Params
                          ? StringifiedKeys
                          : never)
                  : never
              >
            > &
              Omit<Params, OptionalParams | StringifiedKeys>,
            Params
          >,
          stringifiedParams: Pick<StringifiedParams, StringifiedKeys>
        ): Children & NavigationTarget<true>;
      });

export type NavigationState = {
  readonly action: 'none' | 'push' | 'replace' | 'pop';
  readonly delta: number;
};

export type ParamsUpdatedData = {
  readonly _route: RouteData;
  readonly _params: Record<string, any>;
  readonly _currentPath: string;
  readonly _currentSearch: string;
};

export type RouteData = {
  readonly _selfIndex: number;
  readonly _params: InternalControl | InternalAsyncControl | null;
  readonly _source: InternalAsyncControl | undefined;
  readonly _isMatched: InternalControl<boolean>;
  readonly _pathParamsCount: number;
  _getPath(
    params: Record<string, any>,
    stringifiedParams: Record<string, string>
  ): string;
  _getSearch(
    params: Record<string, any>,
    stringifiedParams: Record<string, string>
  ): string;
  _extractPathParams(
    target: Record<string, any>,
    params: Record<string, any>,
    stringifiedParams: Record<string, any>,
    source: any
  ): boolean;
  _extractQueryParams(
    target: Record<string, any>,
    params: Record<string, any>,
    stringifiedParams: Record<string, string>,
    source: any
  ): boolean;
  _replaceDeprecatedQueryParams(searchParams: Record<string, string>): boolean;
  _currentPath: string;
  _currentSearch: string;
  _load(): void;
  _unload(): void;
};

export type RouteParamsData = {
  readonly _route: RouteData;
  readonly _params: ProcessParams<Record<string, any>> | null;
  readonly _stringifiedParams?: Record<string, string>;
};

export type RouteMethods = {
  _useHref(
    params: RouteParamsData[] | undefined,
    useParams: (route: RouteData) => void,
    useNoop: () => void
  ): string;
  _navigate(
    event: ReactMouseEvent<HTMLAnchorElement, any> | null,
    params?: RouteParamsData[],
    replace?: boolean,
    ignoreBlock?: boolean,
    enableScrollToTop?: boolean,
    enableScrollRestoration?: boolean,
    onClick?: (event: ReactMouseEvent<HTMLAnchorElement, any>) => void
  ): void;
  readonly _isMatched: InternalControl<boolean>;
};

export type ProcessParams<O, P = O> = O | ((prev: P) => O);

declare const ROUTE_MARKER: unique symbol;

declare const PATH_PARAM_MARKER: unique symbol;

declare const QUERY_PARAM_MARKER: unique symbol;

declare const SOURCE: unique symbol;

export type HandleParse = (
  target: Record<string, any>,
  key: string,
  value: string | undefined,
  source: any
) => boolean;

export type HandleStringify = (value: any, key: string) => string;

export type ParamData<V, O extends boolean> = [V, O];

export type QueryParam<
  P extends Record<string, [value: any, optional: boolean]>,
  Source = never,
> = {
  /** @internal */
  (
    parsers: Map<string, HandleParse>,
    stringifies: Map<string, HandleStringify>,
    queryParams: string[]
  ): (searchParams: Record<string, string>) => boolean;
  [QUERY_PARAM_MARKER]: P;
  [SOURCE]: Source;
};

export type QueryParamWithReplace<
  P extends Record<string, [value: any, optional: boolean]>,
  Source = never,
> = QueryParam<P, Source> & {
  replace<const S extends string[]>(
    keys: S,
    mapper: (deprecatedValues: Partial<Record<S[number], string>>) => {
      [key in keyof P]?: string;
    }
  ): QueryParam<P, Source>;
};

export type PathParam<
  P extends Record<string, ParamData<any, boolean>>,
  Source = never,
> = {
  /** @internal */
  (
    parsers: Map<string, HandleParse>,
    stringifies: Map<string, HandleStringify>,
    pathParams: string[],
    path: string[]
  ): string;
  [PATH_PARAM_MARKER]: P;
  [SOURCE]: Source;
};

type FindChildren<P extends any[]> = P extends [...infer Head, infer Tail]
  ? Tail extends AnyPaths
    ? Tail
    : FindChildren<Head>
  : never;

type ValidatePath<T> = T extends `/${string}` | `${string}/` | '' ? never : T;

type AnyPathSegment<Source> = PathParam<Record<string, any>, Source> | string;

export type CreatePath<Source = never> = {
  <
    P extends [
      ...path: AnyPathSegment<Source>[],
      query: QueryParam<Record<string, any>, Source>,
    ],
  >(
    ...path: {
      [key in keyof P]: ValidatePath<P[key]>;
    }
  ): HandlePath<
    UnionToIntersection<
      {
        [key in keyof P]: P[key] extends PathParam<infer K, Source>
          ? K
          : P[key] extends QueryParam<infer K, Source>
            ? K
            : never;
      }[number]
    >,
    Source
  >;

  <
    P extends [
      ...path: AnyPathSegment<Source>[],
      query: QueryParam<Record<string, any>, Source>,
      children: AnyPaths,
    ],
  >(
    ...path: {
      [key in keyof P]: ValidatePath<P[key]>;
    }
  ): HandlePath<
    UnionToIntersection<
      {
        [key in keyof P]: P[key] extends PathParam<infer K, Source>
          ? K
          : P[key] extends QueryParam<infer K, Source>
            ? K
            : never;
      }[number]
    >,
    Source,
    FindChildren<P>
  >;

  <P extends AnyPathSegment<Source>[]>(
    ...path: {
      [key in keyof P]: ValidatePath<P[key]>;
    }
  ): HandlePath<
    UnionToIntersection<
      {
        [key in keyof P]: P[key] extends PathParam<infer K, Source> ? K : never;
      }[number]
    >,
    Source
  >;

  <
    P extends [
      ...path: [AnyPathSegment<Source>, ...AnyPathSegment<Source>[]],
      children: AnyPaths,
    ],
  >(
    ...path: {
      [key in keyof P]: ValidatePath<P[key]>;
    }
  ): HandlePath<
    UnionToIntersection<
      {
        [key in keyof P]: P[key] extends PathParam<infer K, Source> ? K : never;
      }[number]
    >,
    Source,
    FindChildren<P>
  >;
};

type HandlePath<
  P extends Record<string, ParamData<any, boolean>>,
  S,
  C extends AnyPaths = never,
> = Path<
  C,
  [keyof P] extends [never] ? never : { [key in keyof P]: P[key][0] },
  {
    [key in keyof P]: key extends string
      ? P[key][1] extends true
        ? key
        : never
      : never;
  }[keyof P],
  [S] extends [never] ? false : true
>;

export interface Path<
  Children extends AnyPaths = never,
  Params = never,
  OptionalParams extends string = never,
  Async extends boolean = false,
> {
  [ROUTE_MARKER]: [
    UnionToIntersection<Children>,
    Params,
    OptionalParams,
    Async,
  ];
  /** @internal */
  readonly _pathParams: string[];
  /** @internal */
  readonly _queryParams: string[];
  /** @internal */
  readonly _path: string[];
  /** @internal */
  readonly _regexStr: string;
  /** @internal */
  readonly _children: AnyPaths | undefined;
  /** @internal */
  readonly _source: InternalAsyncControl | undefined;
  /** @internal */
  _getParse(key: string): HandleParse;
  /** @internal */
  _getStringify(key: string): (value: any, key: string) => string | undefined;
  /** @internal */
  _replaceDeprecatedQueryParams(params: Record<string, string>): boolean;
}

export type AnyPaths = Record<string, Path<any, {}, any, boolean>>;

export type OneOfOptions<V extends string[], O> = {
  variants: V;
  optional?: O;
} & (O extends true ? { defaultValue?: V[number] } : {});

export type ArrayOptions<V> = {
  parse?(value: string[]): V;
  stringify?(value: NoInfer<V>): string[];
};

export type ParamOptions<Value, O = false, Source = never> = {
  parse?(value: string, source: Source): Value;
  stringify?(value: NoInfer<Value>): string;
  optional?: O;
  fallbackValue?:
    | ((
        incorrectValue: string | (O extends true ? never : undefined),
        source: Source
      ) => Value)
    | Value;
  isValid?(value: NoInfer<Value>, source: Source): boolean;
} & (O extends true
  ? {
      defaultValue?: Value | ((source: Source) => Value);
      // initialValue?: Value | ((source: Source) => Value);
    }
  : {});

export type ParamsOf<R extends RouteParams<any, any>> =
  R extends RouteParams<infer P, infer A>
    ? A extends false
      ? ReadonlyControlScope<P>
      : ReadonlyAsyncControlScope<P>
    : never;
