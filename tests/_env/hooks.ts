import * as React from 'react';

/**
 * Renders a hook repeatedly with its slots kept between calls — enough of a
 * renderer for the hooks here, which only ever ask for a ref, a context or a
 * layout effect.
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

export const renderHook = <T>(hook: () => T) => {
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
  };

  const render = () => {
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

  return { render, result: render() };
};
