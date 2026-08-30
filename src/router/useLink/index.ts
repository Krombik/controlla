import type { Hash, LinkClickEvent } from '#router/internal/types';
import type { LinkHandle, LinkOptions, UseLink } from '~platform/link';
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
import fillDefaults from '#router/internal/fillDefaults';

export type * from '~platform/link';

/** Both halves of them, since the branch this target drops still has to compile. */
type AnyLinkOptions = LinkOptions & {
  onClick?(e?: LinkClickEvent): void;
  onPress?(): void;
  scrollToTop?: boolean;
  scrollRestoration?: boolean;
};

type AnyLinkHandle = Omit<LinkHandle, 'onClick' | 'onPress'> & {
  onClick?(e: LinkClickEvent): void;
  onPress?(): void;
};

const useLink = (props: AnyLinkOptions): AnyLinkHandle => {
  const { to, trackMatch, ignoreBlock } = props;

  // the hook count must stay identical for any target: useNoopLayoutEffect fills unused slots
  const forceRerender = useForceRerender();

  const methods = to[ROUTE_METHODS];

  const targetParams = to[ROUTE_PARAMS];

  const routes = methods._routes();

  const routesCount = routes.length;

  const targetParamsCount = targetParams ? targetParams.length : 0;

  const lastRoute = routes[routesCount - 1];

  const anchorParam = __NATIVE__ ? undefined : lastRoute._anchor;

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

      const params = fillDefaults(
        route,
        typeof _params == 'function'
          ? _params(useInternalsValue(route._params!, forceRerender))
          : (exact
              ? useInternalsValue(route._params!, forceRerender)
              : useNoopLayoutEffect(),
            _params)
      );

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
      search = search ? search + '&' + searchChunk : '?' + searchChunk;
    }
  }

  if (targetIndex != targetParamsCount) {
    throwNotMatched();
  }

  for (let fillerCount = methods._maxSlots() - routesCount; fillerCount--;) {
    useNoopLayoutEffect();
  }

  if (!__NATIVE__) {
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
  }

  const href = (path || '/') + search + (anchorValue ? '#' + anchorValue : '');

  const matched = exact ? exactMatch : isMatched;

  // destructured per branch, not in the parameter: a pattern cannot differ
  // between the builds, and what the handler closes over is what it keeps alive
  if (__NATIVE__) {
    const { onPress } = props;

    return {
      href,
      onPress() {
        if (onPress) {
          onPress();
        }

        navigateRoute(methods, targetParams, false, ignoreBlock);
      },
      isMatched: matched,
    };
  } else {
    const { scrollToTop, scrollRestoration, onClick } = props;

    return {
      href,
      onClick(event: LinkClickEvent) {
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
          false,
          ignoreBlock,
          hash,
          scrollToTop,
          scrollRestoration
        );
      },
      isMatched: matched,
    };
  }
};

export default useLink as UseLink;
