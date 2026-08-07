import {
  type ComponentType,
  type PropsWithChildren,
  type ReactElement,
  useEffect,
  useSyncExternalStore,
} from 'react';
import DisposeContext from '#internal/DisposeContext';

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

const DisposeProvider = DisposeContext.Provider;

const setSlot = (slot: Slot, Component: ComponentType) => {
  if (slot._component != Component) {
    slot._component = Component;

    slot._notify();
  }
};

const disposeAll = (disposables: Array<() => void>) => {
  for (let i = 0, l = disposables.length; i < l; i++) {
    disposables[i]();
  }

  disposables.length = 0;
};

const handleRouter = (
  level: number,
  routes: Array<RouterPage | RouterContainer>,
  components: ComponentType[],
  slots: Slot[],
  unmounting: { _value: boolean },
  getRouter: (level: number) => () => ReactElement
) => {
  const Router = getRouter(level);

  // `components.length == level`, so this level's slot holds every container
  // declared here and the page slot of every page declared here
  const slot = slots[level];

  for (let i = 0; i < routes.length; i++) {
    const [arg1, arg2] = routes[i];

    const disposables: Array<() => void> = [];

    if (Array.isArray(arg2)) {
      const effect = () => () => {
        // still this slot's component, with the view up: an <Activity> hide or
        // a re-suspended boundary, not a navigation out of the layout
        if (slot._component != ContainerSlot || unmounting._value) {
          disposeAll(disposables);
        }
      };

      const ContainerSlot = () => {
        useEffect(effect, EMPTY_ARR);

        return jsx(DisposeProvider, {
          value: disposables,
          children: jsx(arg1 as ComponentType<PropsWithChildren>, {
            children: jsx(Child, EMPTY_OBJECT),
          }),
        });
      };

      const Child = handleRouter(
        level + 1,
        arg2,
        append(components, ContainerSlot),
        slots,
        unmounting,
        getRouter
      );
    } else {
      const count = components.length;

      const effect = () => () => {
        const isMatched = (
          (arg1 as PageRoute<true>)[INTERNALS] as PrimitiveControlInternals
        )._value;

        if (isMatched) {
          if (unmounting._value) {
            disposeAll(disposables);
          }

          return;
        }

        disposeAll(disposables);

        const routes = (arg1 as PageRoute<true>)._routes;

        let i = routes.length - 1;

        let clearLane: Lane | undefined;

        routes[i]._anchor?._hash._set!(
          undefined,
          (clearLane ||= getSchedulerLane(syncScheduler))
        );

        do {
          (routes[i]._params as RouterControlRoot | null)?._set!(
            undefined,
            (clearLane ||= getSchedulerLane(syncScheduler))
          );
        } while (i-- && !routes[i]._isMatched._value);

        if (clearLane) {
          scheduleFlush(clearLane);
        }
      };

      const PageSlot = () => {
        useEffect(effect, EMPTY_ARR);

        return jsx(DisposeProvider, {
          value: disposables,
          children: jsx(arg2, EMPTY_OBJECT),
        });
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

  // deletion tears effects down parent-first and the root router is above
  // every slot, so this is already set when a page's cleanup reads it
  const unmounting = { _value: false };

  const onUnmount = () => {
    unmounting._value = false;

    return () => {
      unmounting._value = true;
    };
  };

  return handleRouter(0, routes, EMPTY_ARR, slots, unmounting, (level) => {
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

    const Router = level
      ? () => jsx(useSyncExternalStore(subscribe, getComponent), EMPTY_OBJECT)
      : () => {
          useEffect(onUnmount, EMPTY_ARR);

          return jsx(
            useSyncExternalStore(subscribe, getComponent),
            EMPTY_OBJECT
          );
        };

    slots.push(slot);

    routers.push(Router);

    return Router;
  });
};

export default createRouterView;
