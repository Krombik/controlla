import {
  type ComponentType,
  type FC,
  type PropsWithChildren,
  useSyncExternalStore,
} from 'react';

import type { Route } from '../createRouter/types';
import noop from 'lodash.noop';
import { jsx } from 'react/jsx-runtime';
import { EMPTY_ARR, EMPTY_OBJECT } from '../utils/constants';
import { postBatchCallbacksPush, scheduleBatch } from '../utils/batching';
import concat from '../utils/concat';

type Page = {
  route: Route;
  Component: ComponentType;
  Container?: undefined;
  children?: undefined;
};

type Container = {
  Container: ComponentType<PropsWithChildren>;
  children: Array<Page | Container>;
  route?: undefined;
  Component?: undefined;
};

const handleRouter = (
  level: number,
  routes: Array<Page | Container>,
  components: ComponentType[],
  setComponentsArr: Array<(Component: ComponentType) => void>,
  routers: FC[]
) => {
  let Router: FC;

  if (level < setComponentsArr.length) {
    Router = routers[level];
  } else {
    let onValueChange: () => void = noop;

    let CurrentComponent: ComponentType = noop as any;

    const subscribe = (_onValueChange: () => void) => {
      onValueChange = () => {
        postBatchCallbacksPush(() => {
          _onValueChange();
        });

        scheduleBatch();
      };

      return () => {
        _onValueChange = onValueChange = noop;
      };
    };

    const getComponent = () => CurrentComponent;

    Router = () =>
      jsx(useSyncExternalStore(subscribe, getComponent), EMPTY_OBJECT);

    setComponentsArr.push((component) => {
      CurrentComponent = component;

      onValueChange();
    });

    routers.push(Router);
  }

  for (let i = 0; i < routes.length; i++) {
    const { Component, Container, children, route } = routes[i];

    if (route) {
      const l = components.length;

      const last = setComponentsArr[l];

      route._register(
        l
          ? () => {
              for (let i = 0; i < l; i++) {
                setComponentsArr[i](components[i]);
              }

              last(Component);
            }
          : () => {
              last(Component);
            }
      );
    } else {
      const Router = handleRouter(
        level + 1,
        children,
        concat(components, () =>
          jsx(Container, { children: jsx(Router, EMPTY_OBJECT) })
        ),
        setComponentsArr,
        routers
      );
    }
  }

  return Router;
};

const createRouterView = (routes: Array<Page | Container>) =>
  handleRouter(0, routes, EMPTY_ARR, [], []);

export default createRouterView;
