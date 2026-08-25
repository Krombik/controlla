import {
  type ComponentType,
  type PropsWithChildren,
  type ReactElement,
  useEffect,
  useSyncExternalStore,
} from 'react';

import type { PageRoute, RouterControlRoot } from '#router/internal/types';
import noop from '#internal/noop';
import { jsx } from 'react/jsx-runtime';
import { EMPTY_OBJECT } from '#router/internal/constants';
import { EMPTY_ARR, INTERNALS } from '#internal/constants';
import append from '#internal/append';
import type { Lane, PrimitiveControlInternals } from '#internal/types';
import { getSchedulerLane, scheduleFlush } from '#internal/flushQueue';
import syncScheduler from '#scheduler/syncScheduler';

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

const setSlot = (slot: Slot, Component: ComponentType) => {
  if (slot._component != Component) {
    slot._component = Component;

    slot._notify();
  }
};

const handleRouter = (
  level: number,
  routes: Array<RouterPage | RouterContainer>,
  components: ComponentType[],
  slots: Slot[],
  getRouter: (level: number) => () => ReactElement
) => {
  const Router = getRouter(level);

  for (let i = 0; i < routes.length; i++) {
    const [arg1, arg2] = routes[i];

    if (Array.isArray(arg2)) {
      const ContainerSlot = () =>
        jsx(arg1 as ComponentType<PropsWithChildren>, {
          children: jsx(Child, EMPTY_OBJECT),
        });

      const Child = handleRouter(
        level + 1,
        arg2,
        append(components, ContainerSlot),
        slots,
        getRouter
      );
    } else {
      const count = components.length;

      const clearParams = () => {
        // still the matched page: an `<Activity>` hide, a re-suspended
        // boundary, or a navigation back to it within the task, which has
        // already refilled these from the url
        if (
          ((arg1 as PageRoute<true>)[INTERNALS] as PrimitiveControlInternals)
            ._value
        ) {
          return;
        }

        const routes = (arg1 as PageRoute<true>)._routes;

        let i = routes.length - 1;

        let clearLane: Lane | undefined;

        routes[i]._anchor?._hash._set!(
          undefined,
          (clearLane ||= getSchedulerLane(syncScheduler)),
          true
        );

        do {
          (routes[i]._params as RouterControlRoot | null)?._set!(
            undefined,
            (clearLane ||= getSchedulerLane(syncScheduler)),
            true
          );
        } while (i-- && !routes[i]._isMatched._value);

        if (clearLane) {
          scheduleFlush(clearLane);
        }
      };

      // the params outlive the page by a task. React destroys the passive
      // effects of a deleted subtree parent-first, so this runs before the
      // cleanups inside the page - what a `watchValue` there opened is still
      // subscribed, and clearing here would hand it the params of a page on
      // its way out. Whether there is anything to clear by then is
      // `clearParams`' own question
      const effect = () => () => {
        setTimeout(clearParams);
      };

      const PageSlot = () => {
        useEffect(effect, EMPTY_ARR);

        return jsx(arg2, EMPTY_OBJECT);
      };

      (arg1 as PageRoute<true>)._register(() => {
        for (let i = 0; i < count; i++) {
          setSlot(slots[i], components[i]);
        }

        setSlot(slots[count], PageSlot);
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
 * Don't wrap it in `<Activity>` - hiding it leaves the pages inside unable to
 * update.
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
const createRouterView = (routes: Array<RouterPage | RouterContainer>) => {
  const routers: Array<() => ReactElement> = [];

  const slots: Slot[] = [];

  return handleRouter(0, routes, EMPTY_ARR, slots, (level) => {
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
  });
};

export default createRouterView;
