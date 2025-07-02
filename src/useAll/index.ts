import { useContext, useSyncExternalStore } from 'react';
import type {
  Falsy,
  ExtractValues,
  ExtractErrors,
  InternalAsyncControl,
  ReadonlyAsyncControl,
} from '../types';
import noop from 'lodash.noop';
import ErrorBoundaryContext from '../utils/ErrorBoundaryContext';
import handleSuspense from '../utils/handleSuspense';
import SuspenseContext from '../utils/SuspenseContext';
import alwaysNoop from '../utils/alwaysNoop';
import { ROOT } from '../utils/constants';

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
const useAll = <
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

  const errors = Array(l);

  const errorBoundaryCtx = useContext(ErrorBoundaryContext);

  const suspenseCtx = useContext(SuspenseContext);

  for (let i = 0; i < l; i++) {
    const control = controls[i];

    if (control) {
      const utils = control[ROOT];

      const root = utils[ROOT];

      const errorControl = root._errorControl[ROOT];

      const err = errorControl._value;

      const isError = err !== undefined;

      if (isError && !safeReturn) {
        throw err;
      }

      if (root._value !== undefined || isError) {
        const withValueWatching = !utils._awaitOnly;

        useSyncExternalStore(utils._subscribeWithError, () =>
          withValueWatching
            ? (errorControl._valueToggler << 1) | utils._valueToggler
            : (((errorControl._value === undefined) as any) << 1) |
              ((root._value !== undefined) as any)
        );

        if (withValueWatching) {
          values[i] = utils._get();
        }

        errors[i] = err;
      } else {
        const unloadedControls: InternalAsyncControl[] = [root];

        while (++i < l) {
          const control = controls[i];

          if (control) {
            const root = control[ROOT][ROOT];

            const err = root._errorControl[ROOT]._value;

            if (err === undefined) {
              if (root._value === undefined) {
                unloadedControls.push(root);
              }
            } else if (!safeReturn) {
              throw err;
            }
          }

          useSyncExternalStore(alwaysNoop, noop);
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
            handleSuspense(
              unloadedControls[i],
              errorBoundaryCtx,
              suspenseCtx
            ).then(onResolve, rej);
          }
        });
      }
    } else {
      useSyncExternalStore(alwaysNoop, noop);
    }
  }

  return (safeReturn ? [values, errors] : values) as any;
};

export default useAll;
