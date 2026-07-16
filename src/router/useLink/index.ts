import type { MouseEvent } from 'react';

import type { Hash } from '#router/internal/types';
import type { NavigationTarget } from '#router/types';
import {
  ROUTE_METHODS,
  ROUTE_PARAMS,
  ROUTE_HASH,
} from '#router/internal/constants';
import navigateRoute from '#router/internal/navigateRoute';
import useForceRerender from '#internal/useForceRerender';
import useNoopLayoutEffect from '#internal/useNoopLayoutEffect';
import useInternalsValue from '#internal/useInternalsValue';
import throwNotMatched from '#router/internal/throwNotMatched';

export type LinkOptions = {
  /** The navigation target. */
  to: NavigationTarget<true>;
  /** Runs before the navigation on every click. */
  onClick?(e: MouseEvent<HTMLAnchorElement, any>): void;
  /**
   * Computes {@link LinkHandle.isMatched isMatched}, subscribing to changes:
   * `true` whether the target route is matched; `'exact'` whether it's
   * matched with exactly the params and anchor this link navigates to.
   */
  trackMatch?: boolean | 'exact';
  /** Bypasses an enabled `navigationBlocker`. */
  ignoreBlock?: boolean;
  /** Scrolls to the top after the navigation (default: only on a new page). */
  scrollToTop?: boolean;
  /** Saves the scroll position for the back navigation (default: only on a new page). */
  scrollRestoration?: boolean;
};

export type LinkHandle = {
  /** The current href of the target route. */
  href: string;
  /** Click handler performing the navigation (respects modifier keys, `target`, `event.preventDefault()`). */
  onClick(e: MouseEvent<HTMLAnchorElement, any>): void;
  /**
   * Whether the target route is currently matched (exactly, with
   * {@link LinkOptions.trackMatch trackMatch}: `'exact'`); always `false` when {@link LinkOptions.trackMatch trackMatch} isn't set.
   */
  isMatched: boolean;
};

/**
 * Headless link primitive: subscribes to the target route's state and returns
 * everything needed to render an anchor: use it to build your own `Link`.
 *
 * @example
 * ```tsx
 * const { href, onClick, isMatched } = useLink({ to: navigationRoot.home() });
 *
 * return <a href={href} onClick={onClick} className={isMatched ? 'active' : ''} />;
 * ```
 */
const useLink = ({
  to,
  trackMatch,
  ignoreBlock,
  scrollToTop,
  scrollRestoration,
  onClick,
}: LinkOptions): LinkHandle => {
  // the hook count must stay identical for any target: useNoopLayoutEffect fills unused slots
  const forceRerender = useForceRerender();

  const methods = to[ROUTE_METHODS];

  const targetParams = to[ROUTE_PARAMS];

  const routes = methods._routes();

  const routesCount = routes.length;

  const targetParamsCount = targetParams ? targetParams.length : 0;

  const lastRoute = routes[routesCount - 1];

  const anchorParam = lastRoute._anchor;

  const exact = trackMatch === 'exact';

  const isMatched =
    !!trackMatch && useInternalsValue(lastRoute._isMatched, forceRerender);

  let exactMatch = exact && isMatched;

  let path = '';

  let search = '';

  let anchorValue = '';

  let targetIndex = 0;

  let hash: Hash | undefined;

  for (
    let i = 0, targetParam = targetParams && targetParams[0];
    i < routesCount;
    i++
  ) {
    const route = routes[i];

    let pathChunk: string;

    let searchChunk: string;

    if (targetIndex < targetParamsCount && targetParam!._route == route) {
      const { _params } = targetParam!;

      const params =
        typeof _params == 'function'
          ? _params(useInternalsValue(route._params!, forceRerender))
          : (exact
              ? useInternalsValue(route._params!, forceRerender)
              : useNoopLayoutEffect(),
            _params);

      pathChunk = route._buildPath(params, true, true);

      searchChunk = route._buildSearch(params, true, true);

      if (
        exactMatch &&
        (pathChunk != route._currentPath || searchChunk != route._currentSearch)
      ) {
        exactMatch = false;
      }

      targetParam = targetParams![++targetIndex];
    } else {
      const paramsRoot = route._params;

      if (paramsRoot) {
        if (!route._isMatched._value) {
          throwNotMatched();
        }

        useInternalsValue(paramsRoot, forceRerender);
      } else {
        useNoopLayoutEffect();
      }

      pathChunk = route._currentPath;

      searchChunk = route._currentSearch;
    }

    if (pathChunk) {
      path += pathChunk;
    }

    if (searchChunk) {
      if (search) {
        search += '&' + searchChunk;
      } else {
        search = '?' + searchChunk;
      }
    }
  }

  if (targetIndex != targetParamsCount) {
    throwNotMatched();
  }

  for (let fillerCount = methods._maxSlots() - routesCount; fillerCount--; ) {
    useNoopLayoutEffect();
  }

  if (anchorParam) {
    hash = to[ROUTE_HASH];

    if (hash === undefined) {
      anchorValue = useInternalsValue(anchorParam._hash, forceRerender);
    } else if (exact) {
      const prev = useInternalsValue(anchorParam._hash, forceRerender);

      const next = typeof hash == 'function' ? hash(prev) : hash;

      if (exactMatch && prev !== next) {
        exactMatch = false;
      }

      anchorValue = next;
    } else {
      anchorValue =
        typeof hash == 'function'
          ? hash(useInternalsValue(anchorParam._hash, forceRerender))
          : (useNoopLayoutEffect(), hash);
    }
  } else {
    useNoopLayoutEffect();
  }

  return {
    href: (path || '/') + search + (anchorValue && '#' + anchorValue),
    onClick(event) {
      if (onClick) {
        onClick(event);
      }

      const { target } = event.currentTarget;

      if (
        (target && target != '_self') ||
        event.button ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.defaultPrevented
      ) {
        return;
      }

      event.preventDefault();

      navigateRoute(
        methods,
        targetParams,
        hash,
        false,
        ignoreBlock,
        scrollToTop,
        scrollRestoration
      );
    },
    isMatched: exact ? exactMatch : isMatched,
  };
};

export default useLink;
