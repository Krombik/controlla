import { useCallback, useSyncExternalStore } from 'react';
import type { AnyAsyncState, AsyncState, StateBase as State } from '../types';
import noop from 'lodash.noop';
import { postBatchCallbacksPush } from '../utils/batching';

const useMergedValue = ((
  states: AnyAsyncState[],
  merger: (values: any[]) => any
) =>
  useSyncExternalStore(
    useCallback((cb) => {
      let isAvailable = true;

      const fn = () => {
        if (isAvailable) {
          isAvailable = false;

          postBatchCallbacksPush(() => {
            cb();

            isAvailable = true;
          });
        }
      };

      const l = states.length;

      const unlisteners = new Array<() => void>(l);

      for (let i = 0; i < l; i++) {
        const state = states[i];

        unlisteners[i] = (state._subscribeWithLoad || state._onValueChange)(fn);
      }

      return () => {
        for (let i = 0; i < l; i++) {
          unlisteners[i]();
        }

        cb = noop;
      };
    }, states),
    () => merger(states.map((state) => state.get()))
  )) as {
  /**
   * A hook to merge values from multiple {@link states}.
   * It applies a provided {@link merger} function to combine the state values, ensuring the component re-renders only when the merged value changes.
   * This hook ensures efficient updates using an optional equality function ({@link isEqual}) to prevent unnecessary re-renders.
   *
   * @param merger - A function that merges the values from the provided {@link states}.
   * @param isEqual - An optional comparison function to determine if the merged value has changed
   * @returns The merged value.
   */
  <const S extends State[], V>(
    states: S,
    merger: (values: {
      [index in keyof S]: S[index] extends State<infer K>
        ? K | (S[index] extends AsyncState ? undefined : never)
        : never;
    }) => V
  ): V;
};

export default useMergedValue;
