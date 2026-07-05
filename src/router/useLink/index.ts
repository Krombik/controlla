import { useLayoutEffect, useReducer, type MouseEvent } from 'react';

import type { RouteData } from '#router/internal/types';
import type { NavigationTarget } from '#router/types';
import type {
  AsyncControlInternals,
  ControlInternals,
  ErrorControlInternals,
  PrimitiveControlInternals,
} from '#internal/types';
import { INTERNALS } from '#internal/constants';
import {
  ROUTE_METHODS,
  ROUTE_PARAMS,
  ROUTE_HASH,
} from '#router/internal/constants';
import forceRerenderReducer from '#internal/forceRerenderReducer';

const useInternalsSubscription = (
  forceRerender: () => void,
  internals: ControlInternals | PrimitiveControlInternals | undefined,
  errorInternals?: ErrorControlInternals<any>
) => {
  useLayoutEffect(() => {
    if (internals) {
      internals._attach(internals, forceRerender, false);

      if (errorInternals) {
        errorInternals._attach(errorInternals, forceRerender, false);
      }

      return () => {
        internals._detach(internals, forceRerender, false);

        if (errorInternals) {
          errorInternals._detach(errorInternals, forceRerender, false);
        }
      };
    }
  }, [internals]);
};

function useParams(this: () => void, route: RouteData) {
  const root = route._params!;

  let errorInternals: ErrorControlInternals<any> | undefined;

  if ('_errorControl' in root) {
    errorInternals = (root as AsyncControlInternals)._errorControl[INTERNALS];

    if (errorInternals._value !== undefined) {
      throw errorInternals._value;
    }
  }

  useInternalsSubscription(this, root, errorInternals);
}

function useNoop(this: () => void) {
  useInternalsSubscription(this, undefined);
}

export type Link = {
  /** The current href of the target route. */
  href: string;
  /** Click handler performing the navigation (respects modifier keys, `target`, `event.preventDefault()`). */
  onClick(e: MouseEvent<HTMLAnchorElement, any>): void;
  /** Whether the target route is currently matched. */
  isMatched: boolean;
};

/**
 * Headless link primitive: subscribes to the target route's state and returns
 * everything needed to render an anchor — use it to build your own `Link`.
 *
 * @example
 * ```tsx
 * const { href, onClick, isMatched } = useLink(navigationRoot.home());
 *
 * return <a href={href} onClick={onClick} className={isMatched ? 'active' : ''} />;
 * ```
 */
const useLink = (
  to: NavigationTarget<true>,
  ignoreBlock?: boolean,
  scrollToTop?: boolean,
  scrollRestoration?: boolean,
  onClick?: (e: MouseEvent<HTMLAnchorElement, any>) => void
): Link => {
  const forceRerender = useReducer(forceRerenderReducer, 0)[1];

  const methods = to[ROUTE_METHODS];

  const params = to[ROUTE_PARAMS];

  const isMatchedInternals = methods._isMatched;

  useInternalsSubscription(forceRerender, isMatchedInternals);

  return {
    href: methods._useHref(
      params,
      useParams.bind(forceRerender),
      useNoop.bind(forceRerender)
    ),
    onClick: (e) =>
      methods._navigate(
        e,
        params,
        false,
        ignoreBlock,
        scrollToTop,
        scrollRestoration,
        onClick,
        to[ROUTE_HASH]
      ),
    isMatched: isMatchedInternals._value as boolean,
  };
};

export default useLink;
