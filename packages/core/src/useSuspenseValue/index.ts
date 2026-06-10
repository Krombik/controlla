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

      return safeReturn ? [value, err] : value;
    }

    throw suspendOnControl(root, errorBoundaryCtx, suspenseCtx);
  }

  useLayoutEffect(noop, [0]);
};

export default useSuspenseValue;
