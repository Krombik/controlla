import {
  type ComponentType,
  type PropsWithChildren,
  type ReactElement,
  useSyncExternalStore,
} from 'react';

import type { RouteIsPage } from '#router/internal/types';
import noop from 'lodash.noop';
import { jsx } from 'react/jsx-runtime';
import { EMPTY_OBJECT } from '#router/internal/constants';
import { EMPTY_ARR } from '#internal/constants';
import batch from '#core/batch';
import append from '#internal/append';

export type Page = [route: RouteIsPage<true>, Component: ComponentType];

export type Container = [
  Container: ComponentType<PropsWithChildren>,
  children: Array<Page | Container>,
];

const handleRouter = (
  level: number,
  routes: Array<Page | Container>,
  components: ComponentType[],
  setComponentsArr: Array<(Component: ComponentType) => void>,
  routers: Array<() => ReactElement>
) => {
  let Router: () => ReactElement;

  if (level < setComponentsArr.length) {
    Router = routers[level];
  } else {
    let onValueChange: () => void = noop;

    let CurrentComponent: ComponentType = noop as any;

    const subscribe = (_onValueChange: () => void) => {
      onValueChange = () => {
        batch(() => {
          _onValueChange;
        });
      };

      return () => {
        _onValueChange = onValueChange = noop;
      };
    };

    const getComponent = () => CurrentComponent;

    Router = () =>
      jsx(useSyncExternalStore(subscribe, getComponent), EMPTY_OBJECT);

    setComponentsArr.push((Component) => {
      CurrentComponent = Component;

      onValueChange();
    });

    routers.push(Router);
  }

  for (let i = 0; i < routes.length; i++) {
    const [arg1, arg2] = routes[i];

    if (Array.isArray(arg2)) {
      const Router = handleRouter(
        level + 1,
        arg2,
        append(components, () =>
          jsx(arg1 as ComponentType, { children: jsx(Router, EMPTY_OBJECT) })
        ),
        setComponentsArr,
        routers
      );
    } else {
      const l = components.length;

      const last = setComponentsArr[l];

      (arg1 as RouteIsPage<true>)._register(
        l
          ? () => {
              for (let i = 0; i < l; i++) {
                setComponentsArr[i](components[i]);
              }

              last(arg2);
            }
          : () => {
              last(arg2);
            }
      );
    }
  }

  return Router;
};

const createRouterView = (routes: Array<Page | Container>) =>
  handleRouter(0, routes, EMPTY_ARR, [], []);

export default createRouterView;
