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

export type LinkOptions = {
  /** The navigation target. */
  to: NavigationTarget<true>;
  /** Runs before the navigation on every click. */
  onClick?(e: MouseEvent<HTMLAnchorElement, any>): void;
  /**
   * Computes `isMatched`, subscribing to changes: `true` — whether the
   * target route is matched; `'exact'` — whether it's matched with exactly
   * the params and anchor this link navigates to.
   */
  trackMatch?: boolean | 'exact';
  ignoreBlock?: boolean;
  scrollToTop?: boolean;
  scrollRestoration?: boolean;
};

export type LinkHandle = {
  /** The current href of the target route. */
  href: string;
  /** Click handler performing the navigation (respects modifier keys, `target`, `event.preventDefault()`). */
  onClick(e: MouseEvent<HTMLAnchorElement, any>): void;
  /**
   * Whether the target route is currently matched (exactly, with
   * `trackMatch: 'exact'`); always `false` when `trackMatch` isn't set.
   */
  isMatched: boolean;
};

const throwNotMatched = () => {
  throw new Error('route not mounted');
};

/**
 * Headless link primitive: subscribes to the target route's state and returns
 * everything needed to render an anchor — use it to build your own `Link`.
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
  const forceRerender = useForceRerender();

  const methods = to[ROUTE_METHODS];

  const updatedParams = to[ROUTE_PARAMS];

  const routes = methods._routes();

  const routesCount = routes.length;

  const updatedParamsCount = updatedParams ? updatedParams.length : 0;

  const lastRoute = routes[routesCount - 1];

  const anchorParam = lastRoute._anchor;

  const exact = trackMatch === 'exact';

  const isMatched =
    !!trackMatch && useInternalsValue(lastRoute._isMatched, forceRerender);

  let exactMatch = exact && isMatched;

  let path = '';

  let search = '';

  let anchorValue = '';

  let updatedIndex = 0;

  let hash: Hash | undefined;

  for (
    let i = 0, updatedParam = updatedParams && updatedParams[0];
    i < routesCount;
    i++
  ) {
    const route = routes[i];

    let pathChunk: string;

    let searchChunk: string;

    if (updatedIndex < updatedParamsCount && updatedParam!._route == route) {
      const { _params } = updatedParam!;

      const params =
        typeof _params == 'function'
          ? _params(useInternalsValue(route._params!, forceRerender))
          : (exact
              ? useInternalsValue(route._params!, forceRerender)
              : useNoopLayoutEffect(),
            _params);

      pathChunk = route._handlePath(params, true, true);

      searchChunk = route._handleSearch(params, true, true);

      if (
        exactMatch &&
        (pathChunk != route._currentPath || searchChunk != route._currentSearch)
      ) {
        exactMatch = false;
      }

      updatedParam = updatedParams![++updatedIndex];
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

  if (updatedIndex != updatedParamsCount) {
    throwNotMatched();
  }

  for (let maxControls = methods._maxSlots() - routesCount; maxControls--; ) {
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
        updatedParams,
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
