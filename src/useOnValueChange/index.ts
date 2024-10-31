import { useLayoutEffect, useState } from 'react';
import type { HandlePending, State } from '../types';
import onValueChange from '../onValueChange';
import getValue from '../getValue';
import toDeps from '../toDeps';

const useOnValueChange: {
  /**
   * A hook that triggers a callback function when the value of the provided {@link state} changes.
   * Useful for performing side effects whenever a single state value updates.
   */
  <T>(state: State<T>, cb: (value: HandlePending<T>) => void): void;
  /**
   * A hook that triggers a callback function when the values of multiple {@link states} change.
   * Useful for performing side effects whenever any of the provided state values update.
   */
  <const S extends State[]>(
    states: S,
    cb: (
      ...values: {
        [index in keyof S]: HandlePending<
          S[index] extends State<infer K> ? K : never
        >;
      }
    ) => void
  ): void;
} = (state: State | State[], effect: (...values: any[]) => void) => {
  const [error, setError] = useState<any>();

  if (error) {
    throw error;
  }

  const isArr = 'length' in state;

  let deps;

  if (isArr) {
    deps = [];

    for (let i = 0; i < state.length; i++) {
      const item = state[i];

      deps.push(item._internal, item._path && item._path.join('.'));
    }
  } else {
    deps = toDeps(state);
  }

  useLayoutEffect(
    () =>
      onValueChange(state as any, () => {
        try {
          effect.length == 1 || !isArr
            ? effect(getValue(isArr ? state[0] : state))
            : effect(...state.map(getValue));
        } catch (err) {
          setError(err);
        }
      }),
    deps
  );
};

export default useOnValueChange;
