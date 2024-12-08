import { useContext } from 'react';
import type { AsyncState, Falsy } from '../types';
import useNoop from '../utils/useNoop';
import ErrorBoundaryContext from '../utils/ErrorBoundaryContext';
import SuspenseContext from '../utils/SuspenseContext';
import handleSuspense from '../utils/handleSuspense';
import useHandleSuspenseValue from '../utils/useHandleSuspenseValue';
import useForceRerender from 'react-helpful-utils/useForceRerender';

const use: {
  /**
   * Hook to retrieve the current value of the loaded {@link state}.
   * If the {@link state} isn't loaded, the component using this hook suspends.
   * Ensure the component is wrapped in a <Suspense> component to handle the loading state.
   * If loading fails and {@link safeReturn} is not enabled, an error is thrown.
   *
   * @example
   * ```jsx
   * const DataComponent = () => {
   *   const data = use(asyncState); // Suspends if not loaded
   *
   *   return <div>Data: {JSON.stringify(data)}</div>;
   * };
   *
   * const SafeComponent = () => {
   *   const [data, error] = use(asyncState, true); // Safely returns a tuple
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
  <S extends AsyncState | Falsy, SafeReturn extends boolean = false>(
    state: S,
    safeReturn?: SafeReturn
  ): S extends AsyncState<infer T, infer E>
    ? SafeReturn extends false
      ? T
      : Readonly<[value: T, error: undefined] | [value: undefined, error: E]>
    : undefined;
} = (state, safeReturn) => {
  const errorBoundaryCtx = useContext(ErrorBoundaryContext);

  const suspenseCtx = useContext(SuspenseContext);

  if (state) {
    const err = state.error.get();

    const isError = err !== undefined;

    if (isError && !safeReturn) {
      throw err;
    }

    if (state._internal._value !== undefined || isError) {
      const value = useHandleSuspenseValue(state, useForceRerender());

      return safeReturn ? [value, err] : value;
    }

    throw handleSuspense(state, errorBoundaryCtx, suspenseCtx);
  }

  useNoop();
};

export default use;
