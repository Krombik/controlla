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
> = PageRoute<IsPage> &
  RouteParams<Params, Async, Anchor> &
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
  ReadonlyControl<boolean>;

export type Router<Paths extends AnyPaths> = {
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
  /**
   * Builders of navigation targets for `navigate`/`Link`: call a route's
   * path with its params (and anchor) to get a target:
   * `navigation.product({ id: '42' })`.
   */
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

/** @internal a route typed as owning an anchor with the given ids; `never` (uncallable) otherwise */
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
  /** one-shot boot mark for async params: their first parse runs later */
  _initial?: boolean;
  _currentPath: string;
  _currentSearch: string;
};

/** @internal a navigation target's param entry */
export type TargetParams = {
  readonly _params: ValueOrUpdater<Record<string, any>>;
  readonly _route: RouteData;
};

/** @internal accumulated router write (`setValue`/`replaceValue` on a params control) */
export type RouterWrite = {
  /** the written control's root */
  readonly _root: RouterControlRoot;
  /** the value as resolved at call time */
  readonly _params: any;
  /** the written control's path: scopes the patch to its slice */
  readonly _path: readonly string[] | undefined;
};

/** @internal `navigate` payload stored in the lane, wins over accumulated `setValue`/`replaceValue` */
export type RouterNavigation = {
  /** the navigation target: its chain, queue index and page setter */
  readonly _methods: RouteMethods;
  /** stamped by the params handler when the chain changes */
  _isNewPage: boolean;
  /** popstate/init matching: skips the `navigationState` write */
  readonly _isHistoryEvent: boolean;
  /**
   * skips the navigation blocker; stamped when the payload is parked so the
   * allowed re-dispatch passes the still-enabled blocker
   */
  _ignoreBlock: boolean | undefined;
  readonly _scrollToTop: boolean | undefined;
  readonly _scrollRestoration: boolean | undefined;
};

/**
 * @internal the params handler's pending patch in a lane's `_patchByControl`.
 * `setValue`/`replaceValue` accumulates one per lane (each scheduler commits its own
 * batch), a navigation patch always lives in the microtask lane; handed to
 * the finalizer once committed
 */
export type RouterPatch = {
  /** navigation payload: wins over accumulated `_updates` */
  _navigation: RouterNavigation | undefined;
  /** accumulated `setValue`/`replaceValue` entries */
  readonly _updates: RouterWrite[];
  /** history replace: only if every update in the flush asked for it (navigate overwrites) */
  _replace: boolean;
  /**
   * a hash write happened: the finalizer takes the URL hash from the anchor
   * control and scrolls to it when it's non-empty
   */
  _hashChanged: boolean;
};

/** @internal the params handler node carrying the router's cross-lane state */
export type RouterHandler = PendingItem & {
  /** lanes holding accumulated `setValue`/`replaceValue` patches */
  readonly _lanes: Lane[];
  /** a navigation is queued and not yet committed: updates are ignored */
  _hasNavigation: boolean;
};

/** @internal a control root wired to the router via `_route` */
export type RouterControlRoot = (
  | ControlInternals
  | AsyncControlInternals
  | PrimitiveControlInternals
) & {
  /** the raw `_enqueueSet`: internal router writes bypass the patch */
  _set?: PrimitiveControlInternals['_enqueueSet'];
};

/** @internal */
export type RouteMethods = {
  /** the target's current route chain */
  _routes(): RouteData[];
  /** `useLink`'s hook-slot budget: the length of the longest route chain */
  _maxSlots(): number;
  /**
   * the chain's index in the router's queue; `-1` for current-chain targets
   * (never read, their chain diff is empty)
   */
  _index: number;
  /** the leaf page's component setter (`noop` until the page registers) */
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
  P extends Record<string, [value: any, optional: boolean]>,
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

type HandlePath<
  P extends Record<string, ParamData<any, boolean>>,
  S,
  C extends AnyPaths = never,
  A extends string = never,
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
  ?
      | {
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

/** @internal a mounted `registerAnchor` element */
export type AnchorEntry = {
  _id: string;
  _el: HTMLElement;
};

/** @internal a cached `registerAnchor` handle */
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
  /** @internal called right before a scroll-to actually happens */
  _onScrollStart(id: string, options: AnchorScrollOptions): void;
  /** @internal */
  _hash: PrimitiveControlInternals & {
    _set?: PrimitiveControlInternals['_enqueueSet'];
  };
  /** @internal public anchor control */
  _hashControl: Control<string>;
  /** @internal reactive set of mounted anchor ids, `'active'` for the current one */
  _registered: ControlScope<Record<string, 'active' | true | undefined>>;
  /** @internal the id `trackScroll` last marked `'active'` in `_registered` */
  _activeId: string | undefined;
  /** @internal the anchor's scroll-options resolver */
  _getOptions(el: HTMLElement | null): AnchorScrollOptions;
  /** @internal the element `registerAnchorOffset` last registered */
  _offsetEl: HTMLElement | null;
  /** @internal cached `registerAnchorOffset` ref, stable across renders */
  _offsetRef: ((el: HTMLElement | null) => void) | undefined;
  /** @internal mounted elements, unordered: the spy works on positions */
  _entries: AnchorEntry[];
  /** @internal cached `registerAnchor` handles, keyed by id */
  _handles: Map<string, AnchorHandle>;
  /**
   * @internal armed on `_activate`; the next `registerAnchor` mount gets one
   * try at scrolling to the current hash. Cleared by that mount or by the
   * user's first scroll, whichever comes first
   */
  _isPending: boolean;
  /** @internal becomes the active anchor: (re)arms `_isPending`, starts the
   * spy when tracking */
  _activate(): void;
  /** @internal starts the spy; noop unless wrapped with `trackScroll` */
  _startTrack(): void;
  /** @internal clears the hash, stops the spy */
  _clear(): void;
  /**
   * @internal scrolls to the id if its element is registered, otherwise a
   * no-op; {@link instant} forces non-smooth (used for the mount-time retry)
   */
  _scrollTo(id: string, instant?: boolean): void;
  [ANCHOR_IDS]: Ids;
};
