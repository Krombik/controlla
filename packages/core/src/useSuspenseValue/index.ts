import { useContext, useLayoutEffect, useReducer } from 'react';
import type { Falsy } from '#internal/types';
import ErrorBoundaryContext from '#internal/ErrorBoundaryContext';
import SuspenseContext from '#internal/SuspenseContext';
import suspendOnControl from '#internal/suspendOnControl';
import noop from 'lodash.noop';
import { INTERNALS } from '#shared-internal/constants';
import type { ReadonlyAsyncControl } from '#types';
import forceRerenderReducer from '#internal/forceRerenderReducer';

const useSuspenseValue: {
  /**
   * Hook to retrieve the current value of the loaded {@link control}.
   * If the {@link control} isn't loaded, the component using this hook suspends.
   * Ensure the component is wrapped in a <Suspense> component to handle the loading control.
   * If loading fails and {@link safeReturn} is not enabled, an error is thrown.
   *
   * @example
   * ```jsx
   * const DataComponent = () => {
   *   const data = use(asyncControl); // Suspends if not loaded
   *
   *   return <div>Data: {JSON.stringify(data)}</div>;
   * };
   *
   * const SafeComponent = () => {
   *   const [data, error] = use(asyncControl, true); // Safely returns a tuple
   *
   *   if (error) {
   *     return <div>Error: {error.message}</div>;
   *   }
   *
   *   return <div>Data: {JSON.stringify(data)}</div>;
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
  <S extends ReadonlyAsyncControl | Falsy, SafeReturn extends boolean = false>(
    control: S,
    safeReturn?: SafeReturn
  ): S extends ReadonlyAsyncControl<infer T, infer E>
    ? SafeReturn extends false
      ? T
      : Readonly<[value: T, error: undefined] | [value: undefined, error: E]>
    : undefined;
} = (control, safeReturn) => {
  const errorBoundaryCtx = useContext(ErrorBoundaryContext);

  const suspenseCtx = useContext(SuspenseContext);

  const forceRerender = useReducer(forceRerenderReducer, 0)[1];

  if (control) {
    const internals = control[INTERNALS];

    const root = internals[INTERNALS];

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

      return safeReturn ? [value, err] : value;
    }

    throw suspendOnControl(root, errorBoundaryCtx, suspenseCtx);
  }

  useLayoutEffect(noop, [0]);
};

export default useSuspenseValue;
