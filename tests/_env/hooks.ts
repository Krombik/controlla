import * as React from 'react';

/**
 * Renders a hook repeatedly with its slots kept between calls — enough of a
 * renderer for the hooks here, which only ever ask for a ref, a context, a
 * reducer or a layout effect.
 *
 * It drives React's own dispatcher slot, so a hook reaching for anything else
 * fails loudly right here instead of being quietly stubbed.
 */
const internals = (React as any)
  .__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

type EffectSlot = {
  current:
    { _deps: unknown[] | undefined; _cleanup: (() => void) | void } | undefined;
};

const sameDeps = (a: unknown[] | undefined, b: unknown[] | undefined) => {
  if (a === undefined || b === undefined || a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
};

export const renderHook = <T>(
  hook: () => T,
  /** Wraps every render, including the ones a dispatch drives - the provider. */
  wrap?: (run: () => T) => T
) => {
  const slots: Array<{ current: any }> = [];

  let index = 0;

  let queued: Array<[EffectSlot, () => (() => void) | void, unknown[]?]> = [];

  const dispatcher = {
    useRef<V>(initial: V) {
      return (slots[index++] ||= { current: initial });
    },
    useContext(context: any) {
      return context._currentValue;
    },
    useLayoutEffect(effect: () => (() => void) | void, deps?: unknown[]) {
      queued.push([(slots[index++] ||= { current: undefined }), effect, deps]);
    },
    // what `useValue` rerenders through: dispatching renders again, right here
    useReducer(reducer: (state: any, action: any) => any, initial: any) {
      const at = index++;

      let slot = slots[at];

      if (slot === undefined) {
        const created: { current: any } = { current: undefined };

        created.current = [
          initial,
          (action: any) => {
            created.current = [
              reducer(created.current[0], action),
              created.current[1],
            ];

            render();
          },
        ];

        slots[at] = slot = created;
      }

      return slot.current;
    },
  };

  const renderOnce = () => {
    index = 0;

    queued = [];

    const previous = internals.H;

    internals.H = dispatcher;

    let result: T;

    try {
      result = hook();
    } finally {
      internals.H = previous;
    }

    // the commit: an effect re-runs only once its deps stop matching, and its
    // cleanup goes first when it does
    for (let i = 0; i < queued.length; i++) {
      const [slot, effect, deps] = queued[i];

      const previousRun = slot.current;

      if (previousRun === undefined || !sameDeps(previousRun._deps, deps)) {
        if (previousRun && previousRun._cleanup) {
          previousRun._cleanup();
        }

        slot.current = { _deps: deps, _cleanup: effect() };
      }
    }

    return result;
  };

  const render = () => (wrap ? wrap(renderOnce) : renderOnce());

  /** Runs every cleanup the last render left behind, and forgets the runs. */
  const unmount = () => {
    for (let i = 0; i < queued.length; i++) {
      const slot = queued[i][0];

      if (slot.current) {
        if (slot.current._cleanup) {
          slot.current._cleanup();
        }

        slot.current = undefined;
      }
    }
  };

  /**
   * Mounts the effects again without rendering - which is what an `Activity`
   * coming back does, since nothing about the tree changed while it was hidden.
   */
  const remount = () => {
    for (let i = 0; i < queued.length; i++) {
      const [slot, effect, deps] = queued[i];

      slot.current = { _deps: deps, _cleanup: effect() };
    }
  };

  return { render, unmount, remount, result: render() };
};
