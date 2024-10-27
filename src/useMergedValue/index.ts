import { useLayoutEffect, useRef } from 'react';
import { AnyAsyncState, HandlePending, State } from '../types';
import getValue from '../getValue';
import onValueChange from '../onValueChange';
import useForceRerender from 'react-helpful-utils/useForceRerender';
import simpleIsEqual from '../utils/simpleIsEqual';

const useMergedValue = ((
  states: AnyAsyncState[],
  merger: (...values: any[]) => any,
  isEqual: (
    nextMergedValue: any,
    prevMergedValue: any
  ) => boolean = simpleIsEqual
) => {
  const forceRerender = useForceRerender();

  const deps = [];

  for (let i = 0; i < states.length; i++) {
    const state = states[i];

    deps.push(state._internal, state._path && state._path.join('.'));
  }

  const mergedValue = merger(...states.map(getValue));

  const mergedValueRef = useRef(mergedValue);

  mergedValueRef.current = mergedValue;

  useLayoutEffect(() => {
    const valuesUnlistener = onValueChange(states, (...values) => {
      if (!isEqual(merger(...values), mergedValueRef.current)) {
        forceRerender();
      }
    });

    const loadUnlisteners: Array<() => void> = [];

    for (let i = 0; i < states.length; i++) {
      const state = states[i];

      if ('load' in state && !state._withoutLoading) {
        loadUnlisteners.push(state.load());
      }
    }

    return loadUnlisteners.length
      ? () => {
          valuesUnlistener();

          for (let i = 0; i < loadUnlisteners.length; i++) {
            loadUnlisteners[i]();
          }
        }
      : valuesUnlistener;
  }, deps);

  return mergedValue;
}) as {
  <const S extends State[], V>(
    states: S,
    merger: (
      ...values: {
        [index in keyof S]: HandlePending<
          S[index] extends State<infer T> ? T : never
        >;
      }
    ) => V,
    isEqual?: (nextMergedValue: V, prevMergedValue: V) => boolean
  ): V;
};

export default useMergedValue;
