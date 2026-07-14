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

type Slot = {
  _component: ComponentType;
  _notify(): void;
};

const slots: Slot[] = [];

const routers: Array<() => ReactElement> = [];

const getRouter = (level: number) => {
  if (level < routers.length) {
    return routers[level];
  }

  const slot: Slot = { _component: noop as any, _notify: noop };

  const subscribe = (onValueChange: () => void) => {
    slot._notify = () => {
      batch(onValueChange);
    };

    return () => {
      slot._notify = noop;
    };
  };

  const getComponent = () => slot._component;

  const Router = () =>
    jsx(useSyncExternalStore(subscribe, getComponent), EMPTY_OBJECT);

  slots.push(slot);

  routers.push(Router);

  return Router;
};

const setSlot = (slot: Slot, Component: ComponentType) => {
  if (slot._component != Component) {
    slot._component = Component;

    slot._notify();
  }
};

const handleRouter = (
  level: number,
  routes: Array<Page | Container>,
  components: ComponentType[]
) => {
  const Router = getRouter(level);

  for (let i = 0; i < routes.length; i++) {
    const [arg1, arg2] = routes[i];

    if (Array.isArray(arg2)) {
      const Child = handleRouter(
        level + 1,
        arg2,
        append(components, () =>
          jsx(arg1 as ComponentType, { children: jsx(Child, EMPTY_OBJECT) })
        )
      );
    } else {
      const count = components.length;

      (arg1 as RouteIsPage<true>)._register(() => {
        for (let i = 0; i < count; i++) {
          setSlot(slots[i], components[i]);
        }

        setSlot(slots[count], arg2);
      });
    }
  }

  return Router;
};

const createRouterView = (routes: Array<Page | Container>) =>
  handleRouter(0, routes, EMPTY_ARR);

export default createRouterView;
