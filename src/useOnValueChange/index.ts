import { useLayoutEffect, useState } from 'react';
import type { HandlePending, StateBase as State } from '../types';
import onValueChange from '../onValueChange';

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
    cb: (values: {
      [index in keyof S]: HandlePending<
        S[index] extends State<infer K> ? K : never
      >;
    }) => void
  ): void;
} = (state: State | State[], cb: (values: any[]) => void) => {
  const [error, setError] = useState<any>();

  if (error) {
    throw error;
  }

  const isArr = 'length' in state;

  useLayoutEffect(
    () =>
      onValueChange(state as any, () => {
        try {
          cb.length == 1 || !isArr
            ? cb(isArr ? state[0].get() : state.get())
            : cb(state.map((state) => state.get()));
        } catch (err) {
          setError(err);
        }
      }),
    isArr ? state : [state]
  );
};

export default useOnValueChange;
