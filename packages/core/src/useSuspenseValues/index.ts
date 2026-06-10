import { useContext, useLayoutEffect, useReducer } from 'react';
import type {
  Falsy,
  ExtractValues,
  ExtractErrors,
  AsyncControlInternals,
} from '#internal/types';
import noop from 'lodash.noop';
import ErrorBoundaryContext from '#internal/ErrorBoundaryContext';
import suspendOnControl from '#internal/suspendOnControl';
import SuspenseContext from '#internal/SuspenseContext';
import { INTERNALS } from '#shared-internal/constants';
import type { ReadonlyAsyncControl } from '#types';
import forceRerenderReducer from '#internal/forceRerenderReducer';

/**
 * A hook to retrieve the current values and errors from multiple {@link controls}.
 * If any of {@link controls} isn't loaded, the component using this hook suspends.
 * Ensure the component is wrapped in a <Suspense> component to handle the loading control.
 * If any of {@link controls} fails and {@link safeReturn} is not enabled, an error is thrown.
 *
 * @example
 * ```jsx
 * const DataComponent = () => {
 *   const [data1, data2] = useAll([asyncControl1, asyncControl2]);
 *
 *   return (
 *     <div>
 *       <div>Data: {JSON.stringify(data1)}</div>
 *       <div>Data: {JSON.stringify(data2)}</div>
 *     </div>
 *   );
 * };
 *
 * const SafeComponent = () => {
 *   const [[data1, data2], errors] = useAll([asyncControl1, asyncControl2], true);
 *
 *   if (errors.some((error) => error)) {
 *     return <div>Error occurred</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <div>Data: {JSON.stringify(data1)}</div>
 *       <div>Data: {JSON.stringify(data2)}</div>
 *     </div>
 *   );
 * };
 *
 * const App = () => (
 *   <>
 *     <Suspense fallback={<div>Loading...</div>}>
 *       <DataComponent />
 *     </Suspense>
 *     <Suspense fallback={<div>Loading...</div>}>
 *       <SafeComponent />
 *     </Suspense>
 *   </>
 * );
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

  const forceRerender = useReducer(forceRerenderReducer, 0)[1];

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
        useLayoutEffect(noop, [0]);

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

          useLayoutEffect(noop, [0]);
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
      useLayoutEffect(noop, [0]);
    }
  }

  return (safeReturn ? [values, errors] : values) as any;
};

export default useSuspenseValues;
