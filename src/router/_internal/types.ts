import type { ROUTE_HASH, ROUTE_PARAMS } from '#router/internal/constants';
import type {
  AsyncControlScope,
  Control,
  ControlScope,
  ReadonlyControl,
} from '#types';
import type {
  ControlInternals,
  AsyncControlInternals,
  Lane,
  PendingItem,
  PrimitiveControlInternals,
} from '#internal/types';
import type { NavigationTarget } from '#router/types';
import type { AnchorParam } from '#router/internal/anchor';
import type { DerivedControlInternals } from '#internal/derivedControlUtils';

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

export type Route<
  Paths = never,
  Params = never,
  Async extends boolean = false,
  Anchor extends string = never,
  IsPage extends boolean = [Paths] extends [never]
    ? true
    : Paths & 1 extends 0
      ? boolean
      : false,
> = RouteIsPage<IsPage> &
  RouteParams<Params, Async> &
  ([Paths] extends [never]
    ? {}
    : {
        readonly [key in keyof Paths]: Paths[key] extends Path<
          infer C,
          infer P,
          any,
          infer A,
          infer H
        >
          ? Route<C, P, A, H>
          : never;
      }) &
  ([Anchor] extends [never]
    ? {}
    : { [ROUTE_HASH]: ReadonlyControl<Anchor | ''> }) &
  ReadonlyControl<boolean>;

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
      infer A,
      infer H
    >
      ? Route<C, P, A, H>
      : never;
  };
  readonly navigation: {
    [key in keyof Paths]: Paths[key] extends Path<
      infer C,
      infer P,
      infer O,
      infer A,
      infer H
    >
      ? Navigation<C, P, O, A, H>
      : never;
  };
  readonly navigationState: ReadonlyControl<NavigationState>;
};

declare const IS_PAGE_MARKER: unique symbol;

export type RouteIsPage<IsPage extends boolean> = {
  [IS_PAGE_MARKER]: IsPage;
  /** @internal */
  _register(setComponents: () => void): void;
  /** @internal */
  readonly _anchor: AnchorParam | undefined;
};

declare const PARAMS_MARKER: unique symbol;

export type RouteParams<Params, Async> = {
  /** @internal */
  [ROUTE_PARAMS]: ControlScope;
  [PARAMS_MARKER]: [Params, Async];
};

export type Navigation<
  Paths extends AnyPaths = never,
  Params = never,
  OptionalParams extends string = never,
  Async extends boolean = false,
  Anchor extends string = never,
  Children = [Paths] extends [never]
    ? {}
    : {
        [key in keyof Paths]: Paths[key] extends Path<
          infer C,
          infer P,
          infer O,
          infer A,
          infer H
        >
          ? Navigation<C, P, O, A, H>
          : never;
      },
> = ([Paths] extends [never]
  ? {}
  : {
      (): Children & NavigationTarget<false>;
    }) &
  ([Params] extends [never]
    ? [Paths] extends [never]
      ? {
          (
            ...args: [Anchor] extends [never] ? [] : [anchor?: Anchor]
          ): NavigationTarget<true>;
        }
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
              Omit<Params, OptionalParams>,
            Async extends true ? undefined : never
          >,
          ...args: [Anchor] extends [never] ? [] : [anchor?: Anchor]
        ): Children & NavigationTarget<true>;
      });

export type Hash = ProcessParams<string>;

export type NavigationState = {
  readonly action: 'none' | 'push' | 'replace' | 'pop';
  readonly delta: number;
};

/** @internal */
export type RouteData = {
  readonly _params: ControlInternals | DerivedControlInternals | null;
  readonly _isMatched: PrimitiveControlInternals;
  readonly _anchor: AnchorParam | undefined;
  _handlePath<T extends boolean>(
    params: Record<string, any>,
    typed: boolean,
    peek: T
  ): T extends true ? string : void;
  _handleSearch<T extends boolean>(
    params: Record<string, any>,
    typed: boolean,
    peek: T
  ): T extends true ? string : void;
  _extractPathParams(
    target: Record<string, any>,
    stringifiedParams: Record<string, string | undefined>,
    source: any,
    initial: boolean
  ): void;
  _extractQueryParams(
    target: Record<string, any>,
    stringifiedParams: Record<string, string | undefined>,
    source: any,
    initial: boolean
  ): void;
  /** one-shot boot mark for async params — their first parse runs later */
  _initial?: boolean;
  _currentPath: string;
  _currentSearch: string;
};

/** @internal a navigation target's param entry */
export type RouterParamUpdates = {
  readonly _route: RouteData;
  readonly _params: ProcessParams<Record<string, any>>;
};

/** @internal accumulated router write (`setValue`/`replaceValue` on a params control) */
export type RouterUpdateEntry = {
  /** the written control's root */
  readonly _root: RouterControlRoot;
  /** the value as resolved at call time */
  readonly _params: any;
  /** the written control's path — scopes the patch to its slice */
  readonly _path: readonly string[] | undefined;
};

/** @internal `navigate` payload stored in the lane — wins over accumulated `setValue`/`replaceValue` */
export type RouterNavigation = {
  /** the navigation target — its chain, queue index and page setter */
  readonly _methods: RouteMethods;
  /** stamped by the params handler when the chain changes */
  _isNewPage: boolean;
  /** popstate/init matching — skips the `navigationState` write */
  readonly _isHistoryEvent: boolean;
  /**
   * skips the navigation blocker; stamped when the payload is parked so the
   * allowed re-dispatch passes the still-enabled blocker
   */
  _ignoreBlock: boolean | undefined;
  readonly _enableScrollToTop: boolean | undefined;
  readonly _enableScrollRestoration: boolean | undefined;
};

/**
 * @internal the params handler's pending patch in a lane's `_patchByControl`
 * — `setValue`/`replaceValue` accumulates one per lane (each scheduler commits its own
 * batch), a navigation patch always lives in the microtask lane; handed to
 * the finalizer once committed
 */
export type RouterPatch = {
  /** navigation payload — wins over accumulated `_paramUpdates` */
  _navigation: RouterNavigation | undefined;
  /** accumulated `setValue`/`replaceValue` entries */
  readonly _paramUpdates: RouterUpdateEntry[];
  /** history replace — only if every update in the flush asked for it (navigate overwrites) */
  _replace: boolean;
  /**
   * a hash write happened — the finalizer takes the URL hash from the anchor
   * control and scrolls to it when it's non-empty
   */
  _toAnchor: boolean;
};

/** @internal the params handler node carrying the router's cross-lane state */
export type RouterPendingItem = PendingItem & {
  /** lanes holding accumulated `setValue`/`replaceValue` patches */
  readonly _updateLanes: Lane[];
  /** a navigation is queued and not yet committed — updates are ignored */
  _hasNavigation: boolean;
};

/** @internal a control root wired to the router via `_route` */
export type RouterControlRoot = (
  | ControlInternals
  | AsyncControlInternals
  | PrimitiveControlInternals
) & {
  _route?: RouteData;
  /** the raw `_enqueueSet` — internal router writes bypass the patch */
  _set?: PrimitiveControlInternals['_enqueueSet'];
};

/** @internal */
export type RouteMethods = {
  /** the target's current route chain */
  _routes(): RouteData[];
  /** `useLink`'s hook-slot budget — the length of the longest route chain */
  _maxSlots(): number;
  /**
   * the chain's index in the router's queue; `-1` for current-chain targets
   * (never read — their chain diff is empty)
   */
  _index: number;
  /** the leaf page's component setter (`noop` until the page registers) */
  _setComponents(): void;
};

export type ProcessParams<O, P = never> = O | ((prev: O | P) => O);

declare const ROUTE_MARKER: unique symbol;

declare const PATH_PARAM_MARKER: unique symbol;

declare const QUERY_PARAM_MARKER: unique symbol;

declare const SOURCE: unique symbol;

/** @internal */
export type HandleParse = (
  value: string | undefined,
  source: any,
  initial: boolean
) => any;

/** @internal */
export type HandleStringify = (value: any, key: string) => string;

type ParamData<V, O extends boolean> = [V, O];

export type QueryParam<
  P extends Record<string, [value: any, optional: boolean]>,
  Source = never,
> = {
  /** @internal */
  (
    parsers: Record<string, HandleParse>,
    stringifies: Record<string, HandleStringify>,
    queryParams: string[]
  ): void;
  [QUERY_PARAM_MARKER]: P;
  [SOURCE]: Source;
};

export type PathParam<
  P extends Record<string, ParamData<any, boolean>>,
  Source = never,
> = {
  /** @internal */
  (
    parsers: Record<string, HandleParse>,
    stringifies: Record<string, HandleStringify>,
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
      anchor: AnchorParam<any>,
    ],
  >(
    ...path: {
      [key in keyof P]: ValidatePath<P[key]>;
    }
  ): HandlePath<
    {
      [key in keyof P]: P[key] extends PathParam<infer K, Source>
        ? K
        : P[key] extends QueryParam<infer K, Source>
          ? K
          : never;
    }[number],
    Source
  >;

  <P extends [...path: AnyPathSegment<Source>[], anchor: AnchorParam<any>]>(
    ...path: {
      [key in keyof P]: ValidatePath<P[key]>;
    }
  ): HandlePath<
    {
      [key in keyof P]: P[key] extends PathParam<infer K, Source> ? K : never;
    }[number],
    Source
  >;

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
    {
      [key in keyof P]: P[key] extends PathParam<infer K, Source>
        ? K
        : P[key] extends QueryParam<infer K, Source>
          ? K
          : never;
    }[number],
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
    {
      [key in keyof P]: P[key] extends PathParam<infer K, Source>
        ? K
        : P[key] extends QueryParam<infer K, Source>
          ? K
          : never;
    }[number],
    Source,
    FindChildren<P>
  >;

  <P extends AnyPathSegment<Source>[]>(
    ...path: {
      [key in keyof P]: ValidatePath<P[key]>;
    }
  ): HandlePath<
    {
      [key in keyof P]: P[key] extends PathParam<infer K, Source> ? K : never;
    }[number],
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
    {
      [key in keyof P]: P[key] extends PathParam<infer K, Source> ? K : never;
    }[number],
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
  Anchor extends string = never,
> {
  [ROUTE_MARKER]: [Children, Params, OptionalParams, Async, Anchor];
  /** @internal */
  readonly _pathParams: string[];
  /** @internal */
  readonly _queryParams: string[];
  /** @internal */
  readonly _path: string[];
  /** @internal */
  readonly _regexStr: string;
  /** @internal */
  readonly _anchor: AnchorParam | undefined;
  /** @internal */
  readonly _children: AnyPaths | undefined;
  /** @internal */
  readonly _source: Control | undefined;
  /** @internal */
  _createControlScope(
    isMatchedRoot: PrimitiveControlInternals,
    source: Control,
    routeData: RouteData,
    strings: Record<string, string | undefined>
  ): ControlScope | AsyncControlScope;
  /** @internal */
  readonly _parsers: Record<string, HandleParse>;
  /** @internal */
  readonly _stringifies: Record<string, HandleStringify>;
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
  ? // mutually exclusive: a default keeps the param out of the URL, an
      // initial one is applied (and written to the URL) only on the boot parse
      | {
          defaultValue?: Value | ((source: Source) => Value);
          initialValue?: never;
        }
      | {
          initialValue?: Value | ((source: Source) => Value);
          defaultValue?: never;
        }
  : {});

export type ValidateParams<P> = keyof P extends {
  [key in keyof P]: P[key] extends boolean | ParamOptions<any, any, any>
    ? key
    : never;
}[keyof P]
  ? unknown
  : never;
