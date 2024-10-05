import { useLayoutEffect, useRef } from 'react';
import { AnyAsyncState, AsyncState, State } from '../types';
import getValue from '../getValue';
import onValueChange from '../onValueChange';
import useForceRerender from 'react-helpful-utils/useForceRerender';
import handleListeners from '../utils/handleListeners';

const simpleIsEqual = (next: any, prev: any) => next === prev;

const useMappedValue = ((
  state: AnyAsyncState<any>,
  mapper: (value: any, isLoaded?: boolean, error?: any) => any,
  isEqual: (nextValue: any, prevValue: any) => boolean = simpleIsEqual
) => {
  const { _internal: utils, isLoaded, error } = state;

  const mappedValue = mapper(
    getValue(state),
    isLoaded && getValue(isLoaded),
    error && getValue(error)
  );

  const forceRerender = useForceRerender();

  const prevMappedValueRef = useRef(mappedValue);

  prevMappedValueRef.current = mappedValue;

  useLayoutEffect(
    () =>
      handleListeners([
        onValueChange(state, (value) => {
          if (
            !isEqual(
              mapper(value, isLoaded && getValue(isLoaded)),
              prevMappedValueRef.current
            )
          ) {
            forceRerender();
          }
        }),
        'load' in state && !state._withoutLoading && state.load(),
        error &&
          mapper.length > 2 &&
          onValueChange(error, (err) => {
            if (
              !isEqual(mapper(undefined, true, err), prevMappedValueRef.current)
            ) {
              forceRerender();
            }
          }),
      ]),
    [utils, state._path && state._path.join('.')]
  );

  return mappedValue;
}) as {
  <T, V, E = any>(
    state: AsyncState<T, E>,
    mapper: (
      value: T | undefined,
      isLoaded: boolean,
      error: E | undefined
    ) => V,
    isEqual?: (nextMappedValue: V, prevMappedValue: V) => boolean
  ): V;
  <T, V>(
    state: State<T>,
    mapper: (value: T) => V,
    isEqual?: (nextMappedValue: V, prevMappedValue: V) => boolean
  ): V;
};

export default useMappedValue;
