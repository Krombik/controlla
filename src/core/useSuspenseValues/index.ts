import { useContext, useLayoutEffect } from 'react';
import type {
  Falsy,
  ExtractValues,
  ExtractErrors,
  AsyncControlInternals,
} from '#internal/types';
import ErrorBoundaryContext from '#internal/ErrorBoundaryContext';
import suspendOnControl from '#internal/suspendOnControl';
import SuspenseContext from '#internal/SuspenseContext';
import { INTERNALS } from '#internal/constants';
import type { ReadonlyAsyncControl } from '#types';
import useForceRerender from '#internal/useForceRerender';
import useNoopLayoutEffect from '#internal/useNoopLayoutEffect';

/**
 * Returns the values of multiple async {@link controls}, suspending until all
 * of them are ready — requires this library's `Suspense` boundary above (not
 * `React.Suspense`). Using it starts the controls' loading and subscribes to
 * changes.
 *
 * By default an errored control throws its error to the nearest error
 * boundary; pass {@link safeReturn} as `true` to get a `[values, errors]`
 * pair instead (both positional). An entry may be falsy — its value is
 * `undefined` — but the array length must stay constant across renders.
 *
 * @example
 * ```tsx
 * const [user, cart] = useSuspenseValues([$user, $cart]);
 *
 * const [[user, cart], errors] = useSuspenseValues([$user, $cart], true);
 * ```
 */
const useSuspenseValues = <
  const S extends Array<ReadonlyAsyncControl | Falsy>,
  SafeReturn extends boolean = false,
>(
  controls: S,
  safeReturn?: SafeReturn
): SafeReturn extends false
  ? ExtractValues<S>
  : Readonly<
      | [
          values: ExtractValues<S>,
          errors: Readonly<{
            [index in keyof S]: undefined;
          }>,
        ]
      | [values: ExtractValues<S, true>, errors: ExtractErrors<S>]
    > => {
  const l = controls.length;

  const values = Array(l);

  const errors = safeReturn && Array(l);

  const errorBoundaryCtx = useContext(ErrorBoundaryContext);

  const suspenseCtx = useContext(SuspenseContext);

  const forceRerender = useForceRerender();

  for (let i = 0; i < l; i++) {
    const control = controls[i];

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

          if (value !== internals._get() || err !== errInternals._value) {
            forceRerender();
          }

          return () => {
            root._detach(internals, forceRerender, true);

            errInternals._detach(errInternals, forceRerender, false);
          };
        }, [internals]);

        values[i] = value;

        if (safeReturn) {
          errors![i] = err;
        }
      } else {
        useNoopLayoutEffect();

        const unloadedControls: AsyncControlInternals[] = [root];

        while (++i < l) {
          const control = controls[i];

          if (control) {
            const root = control[INTERNALS]._root;

            const err = root._errorControl[INTERNALS]._value;

            if (err === undefined) {
              if (root._value === undefined) {
                unloadedControls.push(root);
              }
            } else if (!safeReturn) {
              throw err;
            }
          }

          useNoopLayoutEffect();
        }

        throw new Promise<void>((res) => {
          const l = unloadedControls.length;

          let inProgressCount = l;

          const onResolve = () => {
            if (!--inProgressCount) {
              res();
            }
          };

          const rej = safeReturn ? onResolve : res;

          for (let i = 0; i < l; i++) {
            suspendOnControl(
              unloadedControls[i],
              errorBoundaryCtx,
              suspenseCtx
            ).then(onResolve, rej);
          }
        });
      }
    } else {
      useNoopLayoutEffect();
    }
  }

  return (safeReturn ? [values, errors] : values) as any;
};

export default useSuspenseValues;
