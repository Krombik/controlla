import type { ROUTE_PARAMS } from '#router/internal/constants';
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
import type { DerivedControlInternals } from '#internal/derivedControlUtils';

export type IsUnion<T, U = T> = T extends any
  ? [U] extends [T]
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

type UnionToIntersection<U> = (
  U extends any ? (arg: U) => void : never
) extends (arg: infer I) => void
  ? I
  : never;

/**
 * Conditionally spread path records (`...(flag ? { a } : { b })`) infer as a
 * union - merge it so every branch's routes are reachable. Kept as a default
 * type parameter at each use site: the mapped types over it stay homomorphic,
 * preserving rename/go-to-definition links to the path declarations.
 */
type MergePaths<Paths> = UnionToIntersection<Paths> & Paths;

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
  MergedPaths = MergePaths<Paths>,
> = PageRoute<IsPage> &
  RouteParams<Params, Async, Anchor> &
  ([Paths] extends [never]
    ? {}
    : {
        readonly [key in keyof MergedPaths]: MergedPaths[key] extends Path<
          infer C,
          infer P,
          any,
          infer A,
          infer H
        >
          ? Route<C, P, A, H>
          : never;
      }) &
  ReadonlyControl<boolean>;

export type Router<
  Paths extends AnyPaths,
  MergedPaths extends AnyPaths = MergePaths<Paths>,
> = {
  /**
   * Blocks navigations while enabled (e.g. over an unsaved form): an
   * attempted navigation is parked instead of applied and
   * `isPendingNavigation` becomes `true`: `allow()` lets it proceed,
   * `deny()` drops it. Closing the tab is guarded via `beforeunload`.
   */
  readonly navigationBlocker: {
    /** Enables the blocker; returns `disable`. */
    enable(): () => void;
    disable(): void;
    /** Whether a navigation is parked awaiting `allow()`/`deny()`. */
    readonly isPendingNavigation: ReadonlyControl<boolean> & {
      allow(): void;
      deny(): void;
    };
  };
  /**
   * The route tree mirroring the paths: every route is a readonly boolean
   * control of whether it's matched, and the argument for `selectParams`,
   * `selectAnchor` and `createRouterView`.
   */
  readonly routes: {
    readonly [key in keyof MergedPaths]: MergedPaths[key] extends Path<
      infer C,
      infer P,
      any,
      infer A,
      infer H
    >
      ? Route<C, P, A, H>
      : never;
  };
  /**
   * Builders of navigation targets for `navigate`/`Link`: call a route's
   * path with its params (and anchor) to get a target:
   * `navigation.product({ id: '42' })`.
   */
  readonly navigation: {
    [key in keyof MergedPaths]: MergedPaths[key] extends Path<
      infer C,
      infer P,
      infer O,
      infer A,
      infer H
    >
      ? Navigation<C, P, O, A, H>
      : never;
  };
  /** The last history action: `push`, `replace` or `pop` (with its delta). */
  readonly navigationState: ReadonlyControl<NavigationState>;
};

declare const IS_PAGE_MARKER: unique symbol;

export type PageRoute<IsPage extends boolean> = {
  [IS_PAGE_MARKER]: IsPage;
  /** @internal */
  _register(setComponents: () => void): void;
  /** @internal */
  readonly _anchor: AnchorParam | undefined;
};

declare const PARAMS_MARKER: unique symbol;

export type RouteParams<Params, Async, Anchor> = {
  /** @internal */
  [ROUTE_PARAMS]: ControlScope;
  [PARAMS_MARKER]: [Params, Async, Anchor];
};

export type AnchorRoute<A extends string> = [A] extends [never]
  ? never
  : PageRoute<true> & RouteParams<any, any, A>;

/**
 * A navigation target builder for one route in the tree: call it with the
 * route's params (and, at the leaf, an anchor) to get a `navigate`/`Link`
 * target. Calling a chained segment with no arguments (or the anchor with
 * `undefined`) leaves that segment's params, or the anchor, as currently
 * set instead of changing them.
 */
export type Navigation<
  Paths extends AnyPaths = never,
  Params = never,
  OptionalParams extends string = never,
  Async extends boolean = false,
  Anchor extends string = never,
  MergedPaths = MergePaths<Paths>,
  Children = [Paths] extends [never]
    ? {}
    : {
        [key in keyof MergedPaths]: MergedPaths[key] extends Path<
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
          params: ValueOrUpdater<
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

export type Hash = ValueOrUpdater<string>;

export type NavigationState = {
  readonly action: 'none' | 'push' | 'replace' | 'pop';
  readonly delta: number;
};

/** @internal */
export type RouteData = {
  readonly _params: ControlInternals | DerivedControlInternals | null;
  readonly _isMatched: PrimitiveControlInternals;
  readonly _anchor: AnchorParam | undefined;
  _buildPath<T extends boolean>(
    params: Record<string, any>,
    typed: boolean,
    peek: T
  ): T extends true ? string : void;
  _buildSearch<T extends boolean>(
    params: Record<string, any>,
    typed: boolean,
    peek: T
  ): T extends true ? string : void;
  _parsePath(
    target: Record<string, any>,
    stringifiedParams: Record<string, string | undefined>,
    source: any,
    initial: boolean
  ): void;
  _parseQuery(
    target: Record<string, any>,
    stringifiedParams: Record<string, string | undefined>,
    source: any,
    initial: boolean
  ): void;
  _initial?: boolean;
  _currentPath: string;
  _currentSearch: string;
};

/** @internal */
export type TargetParams = {
  readonly _params: ValueOrUpdater<Record<string, any>>;
  readonly _route: RouteData;
};

/** @internal */
export type RouterWrite = {
  readonly _root: RouterControlRoot;
  readonly _params: any;
  readonly _path: readonly string[] | undefined;
};

/** @internal */
export type RouterNavigation = {
  readonly _methods: RouteMethods;
  _isNewPage: boolean;
  readonly _isHistoryEvent: boolean;
  _ignoreBlock: boolean | undefined;
  readonly _scrollToTop: boolean | undefined;
  readonly _scrollRestoration: boolean | undefined;
};

/** @internal */
export type RouterPatch = {
  _navigation: RouterNavigation | undefined;
  readonly _updates: RouterWrite[];
  _replace: boolean;
  _hashChanged: boolean;
};

/** @internal */
export type RouterHandler = PendingItem & {
  readonly _lanes: Lane[];
  _hasNavigation: boolean;
};

/** @internal */
export type RouterControlRoot = (
  ControlInternals | AsyncControlInternals | PrimitiveControlInternals
) & {
  _set?: PrimitiveControlInternals['_enqueueSet'];
};

/** @internal */
export type RouteMethods = {
  _routes(): RouteData[];
  _maxSlots(): number;
  _index: number;
  _setComponents(): void;
};

export type ValueOrUpdater<O, P = never> = O | ((prev: O | P) => O);

declare const ROUTE_MARKER: unique symbol;

declare const PATH_PARAM_MARKER: unique symbol;

declare const QUERY_PARAM_MARKER: unique symbol;

declare const SOURCE: unique symbol;

/** @internal */
export type ParamParser = (
  value: string | undefined,
  source: any,
  initial: boolean
) => any;

/** @internal */
export type ParamStringifier = (value: any, key: string) => string;

type ParamData<V, O extends boolean> = [V, O];

export type QueryParam<
  P extends Record<string, ParamData<any, boolean>>,
  Source = never,
> = {
  /** @internal */
  (
    parsers: Record<string, ParamParser>,
    stringifies: Record<string, ParamStringifier>,
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
    parsers: Record<string, ParamParser>,
    stringifies: Record<string, ParamStringifier>,
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
    Source,
    never,
    P extends [...unknown[], AnchorParam<infer A>] ? A : never
  >;

  <P extends [...path: AnyPathSegment<Source>[], anchor: AnchorParam<any>]>(
    ...path: {
      [key in keyof P]: ValidatePath<P[key]>;
    }
  ): HandlePath<
    {
      [key in keyof P]: P[key] extends PathParam<infer K, Source> ? K : never;
    }[number],
    Source,
    never,
    P extends [...unknown[], AnchorParam<infer A>] ? A : never
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

type OptionalKeysOf<P extends Record<string, ParamData<any, boolean>>> = {
  [key in keyof P]: P[key][1] extends true ? key : never;
}[keyof P];

type HandlePath<
  U extends Record<string, ParamData<any, boolean>>,
  S,
  C extends AnyPaths = never,
  A extends string = never,
  // each `param`/`query` declarator contributes its own record - merge them
  P extends Record<string, ParamData<any, boolean>> = MergePaths<U>,
> = Path<
  C,
  [U] extends [never]
    ? never
    : [keyof P] extends [never]
      ? never
      : // a key is optional only when its value can actually be `undefined`:
        // an optional param with a `defaultValue` always holds a value
        {
            [
              key in keyof P as undefined extends P[key][0] ? never : key
            ]: P[key][0];
          } & {
            [
              key in keyof P as undefined extends P[key][0] ? key : never
            ]?: P[key][0];
          } extends infer Params
        ? { [key in keyof Params]: Params[key] }
        : never,
  OptionalKeysOf<P> & string,
  [S] extends [never] ? false : true,
  A
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
  readonly _parsers: Record<string, ParamParser>;
  /** @internal */
  readonly _stringifies: Record<string, ParamStringifier>;
}

export type AnyPaths = Record<string, Path<any, {}, any, boolean, string>>;

export type OneOfOptions<V extends string[], O> = {
  /** The allowed values of the segment. */
  variants: V;
  /** Marks the segment as optional: the URL may omit it. */
  optional?: O;
} & (O extends true
  ? {
      /** Stands in for a missing segment, on parse and when writing the URL too. */
      defaultValue?: V[number];
    }
  : {});

export type ArrayOptions<V> = {
  parse?(value: string[]): V;
  stringify?(value: NoInfer<V>): string[];
};

export type ParamOptions<Value, O = false, Source = never> = {
  /** Parses the raw URL string into the typed value (identity by default). */
  parse?(value: string, source: Source): Value;
  /** Turns the value back into its URL string (identity by default). */
  stringify?(value: NoInfer<Value>): string;
  /** Marks the param as optional: the URL may omit it. */
  optional?: O;
  /**
   * Replaces a value that failed to parse or didn't pass {@link isValid};
   * without it such a value makes the route not match.
   */
  fallbackValue?:
    | ((
        incorrectValue: string | (O extends true ? never : undefined),
        source: Source
      ) => Value)
    | Value;
  /**
   * Validates the parsed value: a failing one falls back or unmatches. Only
   * guards the URL-to-value direction - building a navigation target skips
   * it, trusting whatever value TypeScript's types let through.
   */
  isValid?(value: NoInfer<Value>, source: Source): boolean;
} & (O extends true
  ? | {
        /**
         * Stands in for a missing param, on parse and when writing the
         * URL too - the param can't actually be cleared while this is
         * set. Mutually exclusive with {@link initialValue}.
         */
        defaultValue?: Value | ((source: Source) => Value);
        initialValue?: never;
      }
    | {
        /**
         * Applied to an absent param only on the very first load of the
         * session, then written into the URL like a real value - unlike
         * {@link defaultValue}, it can be cleared normally afterward.
         * Mutually exclusive with `defaultValue`.
         */
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

declare const ANCHOR_IDS: unique symbol;

/** @internal */
export type AnchorEntry = {
  _id: string;
  _el: HTMLElement;
};

/** A cached `registerAnchor` handle: spread it onto the target element. */
export type AnchorHandle = {
  id: string;
  ref(el: HTMLElement | null): void;
};

export type AnchorScrollOptions = ScrollIntoViewOptions & {
  /** Distance in px to keep above the element (e.g. a sticky header height). */
  topOffset?: number;
  /** Distance in px to keep left of the element. */
  leftOffset?: number;
};

export type AnchorParam<Ids extends string = string> = {
  /** @internal */
  _anchor: true;
  /** @internal */
  _onScrollStart(id: string, options: AnchorScrollOptions): void;
  /** @internal */
  _hash: PrimitiveControlInternals & {
    _set?: PrimitiveControlInternals['_enqueueSet'];
  };
  /** @internal */
  _hashControl: Control<string>;
  /** @internal */
  _registered: ControlScope<Record<string, 'active' | true | undefined>>;
  /** @internal */
  _activeId: string | undefined;
  /** @internal */
  _getOptions(el: HTMLElement | null): AnchorScrollOptions;
  /** @internal */
  _offsetEl: HTMLElement | null;
  /** @internal */
  _offsetRef: ((el: HTMLElement | null) => void) | undefined;
  /** @internal */
  _entries: AnchorEntry[];
  /** @internal */
  _handles: Map<string, AnchorHandle>;
  /** @internal */
  _isPending: boolean;
  /** @internal */
  _activate(): void;
  /** @internal */
  _startTrack(): void;
  /** @internal */
  _clear(): void;
  /** @internal */
  _scrollTo(id: string, instant?: boolean): void;
  [ANCHOR_IDS]: Ids;
};
