import type { FC, MouseEvent, ReactNode } from 'react';
import type { RouteBase } from '../createRouter';
import { ROUTE_METHODS, ROUTE_PARAMS } from '../utils/constants';

export type LinkProps = {
  to: RouteBase<true>;
  onClick?(e: MouseEvent<HTMLAnchorElement, any>): void;
  render(
    href: string,
    onClick: (e: MouseEvent<HTMLAnchorElement, any>) => void
  ): ReactNode;
  ignoreBlock?: boolean;
};

const Link: FC<LinkProps> = ({
  to: {
    [ROUTE_METHODS]: { _navigate, _useHref },
    [ROUTE_PARAMS]: params,
  },
  render,
  onClick,
  ignoreBlock,
}) =>
  render(
    _useHref(params),
    params || onClick || ignoreBlock
      ? (e) => _navigate(e, params, false, ignoreBlock, onClick)
      : _navigate
  );

export default Link;
