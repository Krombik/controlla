import {
  useSyncExternalStore,
  type FC,
  type MouseEvent,
  type ReactNode,
} from 'react';

import type { RouteData } from '#_types';
import alwaysNoop from '@react-control/core/_shared/alwaysNoop';
import noop from 'lodash.noop';
import { ROOT } from '@react-control/core/_shared/constants';
import { ROUTE_METHODS, ROUTE_PARAMS } from '#utils/constants';
import type { NavigationTarget } from '#types';

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
  const control = route._params!;

  if ('_subscribeWithError' in control) {
    const errorControl = control._errorControl[ROOT];

    if (errorControl._value !== undefined) {
      throw errorControl._value;
    }

    useSyncExternalStore(
      control._subscribeWithError,
      () =>
        ((errorControl._valueToggler as any) << 1) |
        (control._valueToggler as any)
    );
  } else {
    useSyncExternalStore(control._subscribe, () => control._valueToggler);
  }
};

const useNoop = () => {
  useSyncExternalStore(alwaysNoop, noop);
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
