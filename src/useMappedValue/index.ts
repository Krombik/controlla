import { useLayoutEffect, useRef } from 'react';
import type { AnyAsyncState, AsyncState, StateBase as State } from '../types';
import onValueChange from '../onValueChange';
import useForceRerender from 'react-helpful-utils/useForceRerender';
import handleUnlisteners from '../utils/handleUnlisteners';
import simpleIsEqual from '../utils/simpleIsEqual';

const useMappedValue = ((
  state: AnyAsyncState,
  mapper: (value: any, isLoaded?: boolean, error?: any) => any,
  isEqual: (nextValue: any, prevValue: any) => boolean = simpleIsEqual
) => {
  const isLoadedState = mapper.length > 1 && state.isLoaded;

  const errorState = mapper.length > 2 && state.error;

  const forceRerender = useForceRerender();

  const mappedValue = mapper(
    state.get(),
    isLoadedState && isLoadedState._value,
    errorState && errorState.get()
  );

  const mappedValueRef = useRef(mappedValue);

  mappedValueRef.current = mappedValue;

  useLayoutEffect(
    () =>
      handleUnlisteners(
        onValueChange<[State, State, State]>(
          isLoadedState
            ? errorState
              ? [state, isLoadedState, errorState]
              : [state, isLoadedState]
            : (state as any),
          () => {
            let nextValue;

            try {
              nextValue = mapper(
                state.get(),
                isLoadedState && isLoadedState._value,
                errorState && errorState.get()
              );
            } catch {
              forceRerender();

              return;
            }

            if (!isEqual(nextValue, mappedValueRef.current)) {
              forceRerender();
            }
          }
        ),
        state
      ),
    [state]
  );

  return mappedValue;
}) as {
  /**
   * Hook to {@link mapper map} and retrieve a value from a {@link state}.
   * @param mapper - Function that maps the value.
   * @param isEqual - Optional comparison function to determine equality of the mapped values.
   */
  <T, V, E = any>(
    state: AsyncState<T, E>,
    mapper: (
      value: T | undefined,
      isLoaded: boolean,
      error: E | undefined
    ) => V,
    isEqual?: (nextMappedValue: V, prevMappedValue: V) => boolean
  ): V;
  /**
   * Hook to {@link mapper map} and retrieve a value from a {@link state}.
   * @param mapper - Function that maps the value.
   * @param isEqual - Optional comparison function to determine equality of the mapped values.
   */
  <T, V>(
    state: State<T>,
    mapper: (value: T) => V,
    isEqual?: (nextMappedValue: V, prevMappedValue: V) => boolean
  ): V;
};

export default useMappedValue;
