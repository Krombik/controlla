import { ContextType, useContext, useLayoutEffect } from 'react';
import type {
  AnyAsyncState,
  Falsy,
  ExtractValues,
  AsyncState,
  ExtractErrors,
  ArrayOfUndefined,
} from '../types';
import noop from 'lodash.noop';
import ErrorBoundaryContext from '../utils/ErrorBoundaryContext';
import { handleLoad } from '../utils/handleSuspense';
import SuspenseContext from '../utils/SuspenseContext';
import useForceRerender from 'react-helpful-utils/useForceRerender';
import useHandleSuspenseValue from '../utils/useHandleSuspenseValue';

const awaitAll = (
  states: AnyAsyncState[],
  errorBoundaryCtx: ContextType<typeof ErrorBoundaryContext>,
  suspenseCtx: ContextType<typeof SuspenseContext>,
  settle?: boolean
) =>
  new Promise<void>((res) => {
    const l = states.length;

    let inProgressCount = l;

    const onResolve = () => {
      if (--inProgressCount) {
        res();
      }
    };

    const onReject = settle ? onResolve : res;

    for (let i = 0; i < l; i++) {
      handleLoad(states[i], errorBoundaryCtx, suspenseCtx).then(
        onResolve,
        onReject
      );
    }
  });

const useAll = ((states: (AnyAsyncState | Falsy)[], safeReturn?: boolean) => {
  const l = states.length;

  const values: any[] = [];

  const errors: any[] = [];

  const errorBoundaryCtx = useContext(ErrorBoundaryContext);

  const suspenseCtx = useContext(SuspenseContext);

  const forceRerender = useForceRerender();

  for (let i = 0; i < l; i++) {
    const state = states[i];

    if (state) {
      const utils = state._internal;

      const err = utils._errorUtils._value;

      const isError = err !== undefined;

      if (isError && !safeReturn) {
        throw err;
      }

      if (utils._value !== undefined || isError) {
        values.push(
          useHandleSuspenseValue(
            state,
            errorBoundaryCtx,
            suspenseCtx,
            forceRerender
          )
        );

        errors.push(err);
      } else {
        const unloadedStates: AnyAsyncState[] = [state];

        while (++i < l) {
          const state = states[i];

          if (state) {
            const utils = state._internal;

            const err = utils._errorUtils._value;

            if (err === undefined) {
              if (utils._value === undefined) {
                unloadedStates.push(state);
              }
            } else if (!safeReturn) {
              throw err;
            }
          }
        }

        throw awaitAll(
          unloadedStates,
          errorBoundaryCtx,
          suspenseCtx,
          safeReturn
        );
      }
    } else {
      values.length++;

      errors.length++;

      useLayoutEffect(noop, [0, 0]);
    }
  }

  return safeReturn ? [values, errors] : (values as ReadonlyArray<any>);
}) as {
  <
    const S extends (AsyncState<any> | Falsy)[],
    SafeReturn extends boolean = false,
  >(
    states: S,
    safeReturn?: SafeReturn
  ): SafeReturn extends false
    ? ExtractValues<S>
    : Readonly<
        | [values: ExtractValues<S>, errors: ArrayOfUndefined<S>]
        | [values: ExtractValues<S, true>, errors: ExtractErrors<S>]
      >;
};

export default useAll;
