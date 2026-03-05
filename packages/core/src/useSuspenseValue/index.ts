import { useContext, useSyncExternalStore } from 'react';
import type { Falsy } from '#internal/types';
import ErrorBoundaryContext from '#internal/ErrorBoundaryContext';
import SuspenseContext from '#internal/SuspenseContext';
import suspendOnControl from '#internal/suspendOnControl';
import alwaysNoop from '#shared-internal/alwaysNoop';
import noop from 'lodash.noop';
import { INTERNALS } from '#shared-internal/constants';
import type { ReadonlyAsyncControl } from '#types';

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

  if (control) {
    const utils = control[INTERNALS];

    const root = utils._root;

    const err =
      root._errorControl[INTERNALS]._useSubscribeWithLoad(useSyncExternalStore);

    const isError = err !== undefined;

    if (isError && !safeReturn) {
      throw err;
    }

    if (root._value !== undefined || isError) {
      const value = utils._useSubscribeWithLoad(useSyncExternalStore);

      return safeReturn ? [value, err] : value;
    }

    useSyncExternalStore(alwaysNoop, noop);

    throw suspendOnControl(root, errorBoundaryCtx, suspenseCtx);
  }

  useSyncExternalStore(alwaysNoop, noop);

  useSyncExternalStore(alwaysNoop, noop);
};

export default useSuspenseValue;
