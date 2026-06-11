import {
  useSyncExternalStore,
  type FC,
  type MouseEvent,
  type ReactNode,
} from 'react';

import type { RouteData } from '#router/internal/types';
import returnNoop from '@react-control/core/_shared/returnNoop';
import noop from 'lodash.noop';
import { INTERNALS } from '#internal/constants';
import { ROUTE_METHODS, ROUTE_PARAMS } from '#router/internal/constants';
import type { NavigationTarget } from '#router/types';

export type LinkProps = {
  to: NavigationTarget<true>;
  onClick?(e: MouseEvent<HTMLAnchorElement, any>): void;
  render(
    href: string,
    onClick: (e: MouseEvent<HTMLAnchorElement, any>) => void,
    isMatched: boolean
  ): ReactNode;
  ignoreBlock?: boolean;
  scrollToTop?: boolean;
  scrollRestoration?: boolean;
};

const useParams = (route: RouteData) => {
  const root = route._params!;

  if ('_errorControl' in root) {
    const errorInternals = root._errorControl[INTERNALS];

    if (errorInternals._value !== undefined) {
      throw errorInternals._value;
    }

    useSyncExternalStore(
      root._subscribeWithError,
      () =>
        ((errorInternals._valueToggler as any) << 1) |
        (root._valueToggler as any)
    );
  } else {
    useSyncExternalStore(root._subscribe, () => root._valueToggler);
  }
};

const useNoop = () => {
  useSyncExternalStore(returnNoop, noop);
};

const Link: FC<LinkProps> = ({
  to: {
    [ROUTE_METHODS]: { _navigate, _useHref, _isMatched },
    [ROUTE_PARAMS]: params,
  },
  render,
  onClick,
  ignoreBlock,
  scrollToTop,
  scrollRestoration,
}) =>
  render(
    _useHref(params, useParams, useNoop),
    params ||
      onClick ||
      ignoreBlock ||
      scrollToTop != null ||
      scrollRestoration != null
      ? (e) =>
          _navigate(
            e,
            params,
            false,
            ignoreBlock,
            scrollToTop,
            scrollRestoration,
            onClick
          )
      : _navigate,
    render.length < 3
      ? false
      : useSyncExternalStore(_isMatched._subscribe, () => _isMatched._value)
  );

export default Link;
