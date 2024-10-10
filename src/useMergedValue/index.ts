import { useLayoutEffect, useMemo } from 'react';
import { AnyAsyncState, HandlePending, State } from '../types';
import getValue from '../getValue';
import onValueChange from '../onValueChange';
import useForceRerender from 'react-helpful-utils/useForceRerender';

import simpleIsEqual from '../utils/simpleIsEqual';

const useMergedValue = ((
  states: AnyAsyncState<any>[],
  merger: (...values: any[]) => any,
  isEqual: (
    nextMergedValue: any,
    prevMergedValue: any
  ) => boolean = simpleIsEqual
) => {
  const l = states.length;

  const forceRerender = useForceRerender();

  const deps = [];

  for (let i = 0; i < l; i++) {
    const state = states[i];

    deps.push(state._internal);

    if (state._path) {
      deps.push(state._path.join('.'));
    }
  }

  const mergedValueRef = useMemo(
    () => ({ _value: merger(...states.map(getValue)) }),
    deps
  );

  useLayoutEffect(() => {
    const values: any[] = [];

    const unlisteners: Array<() => void> = [];

    for (let i = 0; i < l; i++) {
      const state = states[i];

      values.push(getValue(state));

      unlisteners.push(
        onValueChange(state, (value) => {
          values[i] = value;

          const nextValue = merger(...values);

          if (!isEqual(nextValue, mergedValueRef._value)) {
            mergedValueRef._value = nextValue;

            forceRerender();
          }
        })
      );

      if ('load' in state && !state._withoutLoading) {
        unlisteners.push(state.load());
      }
    }

    return () => {
      for (let i = 0; i < unlisteners.length; i++) {
        unlisteners[i]();
      }
    };
  }, deps);

  return mergedValueRef._value;
}) as {
  <const S extends State<any>[], V>(
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
