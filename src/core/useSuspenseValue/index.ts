import { useContext, useLayoutEffect } from 'react';
import type { Falsy } from '#internal/types';
import ErrorBoundaryContext from '#internal/ErrorBoundaryContext';
import SuspenseContext from '#internal/SuspenseContext';
import suspendOnControl from '#internal/suspendOnControl';
import { INTERNALS } from '#internal/constants';
import type { ReadonlyAsyncControl } from '#types';
import useForceRerender from '#internal/useForceRerender';
import useNoopLayoutEffect from '#internal/useNoopLayoutEffect';

const useSuspenseValue: {
  /**
   * Returns the value of the given async {@link control}, suspending while it
   * loads — requires this library's `Suspense` boundary above (not
   * `React.Suspense`). Using it starts the control's loading and subscribes
   * to changes.
   *
   * By default an errored control throws its error to the nearest error
   * boundary; pass {@link safeReturn} as `true` to get a `[value, error]`
   * tuple instead. The {@link control} may be falsy — the hook returns
   * `undefined`.
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
  const errorBoundaryCtx = useContext(ErrorBoundaryContext);

  const suspenseCtx = useContext(SuspenseContext);

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

    throw suspendOnControl(root, errorBoundaryCtx, suspenseCtx);
  }

  useNoopLayoutEffect();

  if (safeReturn) {
    return [undefined, undefined];
  }
};

export default useSuspenseValue;
