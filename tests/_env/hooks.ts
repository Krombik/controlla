import * as React from 'react';

/**
 * Renders a hook repeatedly with its slots kept between calls — enough of a
 * renderer for the hooks here, which only ever ask for a ref, a context, a
 * reducer or a layout effect.
 *
 * It drives React's own dispatcher slot, so a hook reaching for anything else
 * fails loudly right here instead of being quietly stubbed.
 *
 * Insertion, layout and passive effects are three walks, in that order, as
 * React runs them - though a real passive one lands after the paint.
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

  /** The last of each entry is the walk it belongs to: insertion before layout. */
  let queued: Array<
    [EffectSlot, () => (() => void) | void, unknown[] | undefined, number]
  > = [];

  /** Whether the effect walks are running - a render dispatched in one waits. */
  let committing = false;

  let rerender = false;

  const dispatcher = {
    useRef<V>(initial: V) {
      return (slots[index++] ||= { current: initial });
    },
    useContext(context: any) {
      return context._currentValue;
    },
    useInsertionEffect(effect: () => (() => void) | void, deps?: unknown[]) {
      queued.push([
        (slots[index++] ||= { current: undefined }),
        effect,
        deps,
        0,
      ]);
    },
    useLayoutEffect(effect: () => (() => void) | void, deps?: unknown[]) {
      queued.push([
        (slots[index++] ||= { current: undefined }),
        effect,
        deps,
        1,
      ]);
    },
    useEffect(effect: () => (() => void) | void, deps?: unknown[]) {
      queued.push([
        (slots[index++] ||= { current: undefined }),
        effect,
        deps,
        2,
      ]);
    },
    // what `useValue` rerenders through: dispatching renders again, right here -
    // after the walks, if one of them is what dispatched it, since React flushes
    // the effects of a commit before it starts the render one of them queued
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

            if (committing) {
              rerender = true;
            } else {
              render();
            }
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
    commit(() => {
      for (let walk = 0; walk < 3; walk++) {
        for (let i = 0; i < queued.length; i++) {
          const [slot, effect, deps, kind] = queued[i];

          if (kind != walk) {
            continue;
          }

          const previousRun = slot.current;

          if (previousRun === undefined || !sameDeps(previousRun._deps, deps)) {
            if (previousRun && previousRun._cleanup) {
              previousRun._cleanup();
            }

            slot.current = { _deps: deps, _cleanup: effect() };
          }
        }
      }
    });

    return result;
  };

  const render = () => (wrap ? wrap(renderOnce) : renderOnce());

  /** Runs the walks, then whatever render they dispatched. */
  const commit = (walks: () => void) => {
    committing = true;

    try {
      walks();
    } finally {
      committing = false;
    }

    if (rerender) {
      rerender = false;

      render();
    }
  };

  /**
   * Runs every cleanup the last render left behind, and forgets the runs - the
   * passive ones last, as React tears them down.
   */
  const unmount = () => {
    for (let walk = 0; walk < 3; walk++) {
      for (let i = 0; i < queued.length; i++) {
        const [slot, , , kind] = queued[i];

        if (kind == walk && slot.current) {
          if (slot.current._cleanup) {
            slot.current._cleanup();
          }

          slot.current = undefined;
        }
      }
    }
  };

  /**
   * Mounts the effects again without rendering - which is what an `Activity`
   * coming back does, since nothing about the tree changed while it was hidden.
   */
  const remount = () => {
    commit(() => {
      for (let walk = 0; walk < 3; walk++) {
        for (let i = 0; i < queued.length; i++) {
          const [slot, effect, deps, kind] = queued[i];

          if (kind == walk) {
            slot.current = { _deps: deps, _cleanup: effect() };
          }
        }
      }
    });
  };

  return { render, unmount, remount, result: render() };
};
