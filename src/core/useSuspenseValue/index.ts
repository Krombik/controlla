import { useLayoutEffect } from 'react';
import type { Falsy } from '#internal/types';
import suspendOnControl from '#internal/suspendOnControl';
import { releaseLoad } from '#internal/suspenseHolds';
import { INTERNALS } from '#internal/constants';
import type { ReadonlyAsyncControl } from '#types';
import useForceRerender from '#internal/useForceRerender';
import useNoopLayoutEffect from '#internal/useNoopLayoutEffect';

const useSuspenseValue: {
  /**
   * Returns the value of the given async {@link control}, suspending while it
   * loads — needs a `Suspense` boundary above. Using it starts the control's
   * loading and subscribes to changes.
   *
   * By default an errored control throws its error to the nearest error
   * boundary; pass {@link safeReturn} as `true` to get a `[value, error]`
   * tuple instead. The {@link control} may be falsy — the hook returns
   * `undefined`.
   *
   * The {@link control} has to come from outside the component that suspends
   * on it — one a creation hook made in this very component never arrives, and
   * the fallback stays up for good. Create it above the boundary and read it in
   * a child.
   *
   * @example
   * ```tsx
   * const user = useSuspenseValue($user);
   * ```
   */
  <S extends ReadonlyAsyncControl | Falsy, SafeReturn extends boolean = false>(
    control: S,
    safeReturn?: SafeReturn
  ): S extends ReadonlyAsyncControl<infer T, infer E>
    ? SafeReturn extends false
      ? T
      : Readonly<[value: T, error: undefined] | [value: undefined, error: E]>
    : SafeReturn extends false
      ? undefined
      : Readonly<[value: undefined, error: undefined]>;
} = (control, safeReturn) => {
  const forceRerender = useForceRerender();

  if (control) {
    const internals = control[INTERNALS];

    const root = internals._root;

    const errInternals = root._errorControl[INTERNALS];

    const err = errInternals._value;

    const isError = err !== undefined;

    if (isError && !safeReturn) {
      throw err;
    }

    if (root._value !== undefined || isError) {
      const value = internals._get();

      useLayoutEffect(() => {
        root._attach(internals, forceRerender, true);

        // the mount is the hold from now on, so the suspended render's one goes
        releaseLoad(root);

        errInternals._attach(errInternals, forceRerender, false);

        // the value may have changed between render and subscription
        if (value !== internals._get() || err !== errInternals._value) {
          forceRerender();
        }

        return () => {
          root._detach(internals, forceRerender, true);

          errInternals._detach(errInternals, forceRerender, false);
        };
      }, [internals]);

      return safeReturn ? [value, err] : value;
    }

    throw suspendOnControl(root);
  }

  useNoopLayoutEffect();

  return safeReturn ? [undefined, undefined] : undefined;
};

export default useSuspenseValue;
