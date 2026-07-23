import type { AsyncControlScope, Control, ControlScope } from '#types';
import type {
  Hash,
  RouteMethods,
  RouteParams,
  TargetParams,
} from '#router/internal/types';
import type {
  ROUTE_METHODS,
  ROUTE_PARAMS,
  ROUTE_HASH,
} from '#router/internal/constants';

declare const NAVIGATION_MARKER: unique symbol;

export type NavigationTarget<Navigable extends boolean = true> = {
  /** @internal */
  readonly [ROUTE_METHODS]: RouteMethods;
  /** @internal */
  readonly [ROUTE_PARAMS]?: TargetParams[];
  /** @internal */
  readonly [ROUTE_HASH]?: Hash;
  [NAVIGATION_MARKER]: Navigable;
};

export type AnchorScrollOptions = ScrollIntoViewOptions & {
  /** Distance in px to keep above the element (e.g. a sticky header height). */
  topOffset?: number;
  /** Distance in px to keep left of the element. */
  leftOffset?: number;
};

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

export type ArrayParamOptions<V> = {
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

export type SelectParams<R extends RouteParams<any, any, any>> =
  R extends RouteParams<infer P, infer A, any>
    ? A extends false
      ? ControlScope<P>
      : AsyncControlScope<P>
    : never;

export type SelectAnchor<R extends RouteParams<any, any, string>> =
  R extends RouteParams<any, any, infer A> ? Control<A | ''> : never;
