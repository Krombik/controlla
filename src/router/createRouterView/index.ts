import {
  type ComponentType,
  type PropsWithChildren,
  type ReactElement,
  useSyncExternalStore,
} from 'react';

import type { PageRoute } from '#router/internal/types';
import noop from '#internal/noop';
import { jsx } from 'react/jsx-runtime';
import { EMPTY_OBJECT } from '#router/internal/constants';
import { EMPTY_ARR } from '#internal/constants';
import append from '#internal/append';

/** A leaf of the view tree: the page route and the component it renders. */
export type RouterPage = [route: PageRoute<true>, Component: ComponentType];

/**
 * A layout node of the view tree: the wrapper component (rendering
 * `children`) and the pages or containers inside it.
 */
export type RouterContainer = [
  Container: ComponentType<PropsWithChildren>,
  children: Array<RouterPage | RouterContainer>,
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
    slot._notify = onValueChange;

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
  routes: Array<RouterPage | RouterContainer>,
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

      (arg1 as PageRoute<true>)._register(() => {
        for (let i = 0; i < count; i++) {
          setSlot(slots[i], components[i]);
        }

        setSlot(slots[count], arg2);
      });
    }
  }

  return Router;
};

/**
 * Builds the component that renders the matched route's page inside its
 * containers. On navigation only the slots whose component actually changed
 * re-render: switching between pages under the same layout never re-renders
 * the layout.
 *
 * @example
 * ```tsx
 * const RouterView = createRouterView([
 *   [router.routes.home, HomePage],
 *   [MainLayout, [
 *     [router.routes.product, ProductPage],
 *     [router.routes.catalog, CatalogPage],
 *   ]],
 * ]);
 *
 * createRoot(document.getElementById('root')!).render(<RouterView />);
 * ```
 */
const createRouterView = (routes: Array<RouterPage | RouterContainer>) =>
  handleRouter(0, routes, EMPTY_ARR);

export default createRouterView;
