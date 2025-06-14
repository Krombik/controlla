import { useContext, useSyncExternalStore } from 'react';
import type { Falsy, ReadonlyAsyncControl } from '../types';
import ErrorBoundaryContext from '../utils/ErrorBoundaryContext';
import SuspenseContext from '../utils/SuspenseContext';
import handleSuspense from '../utils/handleSuspense';
import alwaysNoop from '../utils/alwaysNoop';
import noop from 'lodash.noop';
import { ROOT } from '../utils/constants';

const use: {
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

      const value = withValueWatching ? utils._get() : undefined;

      return safeReturn ? [value, err] : value;
    }

    throw handleSuspense(
      root,
      useContext(ErrorBoundaryContext),
      useContext(SuspenseContext)
    );
  }

  useSyncExternalStore(alwaysNoop, noop);
};

export default use;
