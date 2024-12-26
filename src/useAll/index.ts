import { useContext, useLayoutEffect } from 'react';
import type {
  AnyAsyncState,
  Falsy,
  ExtractValues,
  AsyncState,
  ExtractErrors,
} from '../types';
import noop from 'lodash.noop';
import ErrorBoundaryContext from '../utils/ErrorBoundaryContext';
import handleSuspense from '../utils/handleSuspense';
import SuspenseContext from '../utils/SuspenseContext';
import useForceRerender from 'react-helpful-utils/useForceRerender';
import useHandleSuspenseValue from '../utils/useHandleSuspenseValue';

/**
 * A hook to retrieve the current values and errors from multiple {@link states}.
 * If any of {@link states} isn't loaded, the component using this hook suspends.
 * Ensure the component is wrapped in a <Suspense> component to handle the loading state.
 * If any of {@link states} fails and {@link safeReturn} is not enabled, an error is thrown.
 *
 * @example
 * ```jsx
 * const DataComponent = () => {
 *   const [data1, data2] = useAll([asyncState1, asyncState2]);
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
 *   const [[data1, data2], errors] = useAll([asyncState1, asyncState2], true);
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
const useAll = <
  const S extends Array<AsyncState | Falsy>,
  SafeReturn extends boolean = false,
>(
  states: S,
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
  const l = states.length;

  const values = new Array(l);

  const errors = new Array(l);

  const errorBoundaryCtx = useContext(ErrorBoundaryContext);

  const suspenseCtx = useContext(SuspenseContext);

  const forceRerender = useForceRerender();

  for (let i = 0; i < l; i++) {
    const state = states[i];

    if (state) {
      const err = state.error.get();

      const isError = err !== undefined;

      if (isError && !safeReturn) {
        throw err;
      }

      if (state._root._value !== undefined || isError) {
        values[i] = useHandleSuspenseValue(state, forceRerender);

        errors[i] = err;
      } else {
        const unloadedStates: AnyAsyncState[] = [state];

        while (++i < l) {
          const state = states[i];

          if (state) {
            const err = state.error.get();

            if (err === undefined) {
              if (state._root._value === undefined) {
                unloadedStates.push(state);
              }
            } else if (!safeReturn) {
              throw err;
            }
          }
        }

        throw new Promise<void>((res) => {
          const l = unloadedStates.length;

          let inProgressCount = l;

          const onResolve = () => {
            if (!--inProgressCount) {
              res();
            }
          };

          for (let i = 0; i < l; i++) {
            const state = unloadedStates[i];

            const error = state.error;

            handleSuspense(state, errorBoundaryCtx, suspenseCtx).then(
              onResolve,
              safeReturn
                ? error._isExpectedError
                  ? (err) => {
                      if (error._isExpectedError!(err)) {
                        onResolve();
                      } else {
                        res();
                      }
                    }
                  : onResolve
                : res
            );
          }
        });
      }
    } else {
      useLayoutEffect(noop, [0]);
    }
  }

  return safeReturn ? [values, errors] : (values as any);
};

export default useAll;
