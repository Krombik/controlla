import { useMemo, useSyncExternalStore } from 'react';
import type {
  AnyAsyncState,
  AsyncState,
  InternalAsyncState,
  ReadonlyState,
} from '../types';
import noop from 'lodash.noop';
import { postBatchCallbacksPush } from '../utils/batching';
import { ROOT } from '../utils/constants';

const useMergedValue = ((
  states: AnyAsyncState[],
  merger: (values: any[]) => any
) =>
  useMemo(() => {
    const l = states.length;

    const utils = Array<InternalAsyncState>(l);

    for (let i = 0; i < l; i++) {
      utils[i] = states[i][ROOT];
    }

    const subscribe = (onStoreChange: () => void) => {
      let isAvailable = true;

      const fn = () => {
        if (isAvailable) {
          isAvailable = false;

          postBatchCallbacksPush(() => {
            onStoreChange();

            isAvailable = true;
          });
        }
      };

      const unlisteners = Array<() => void>(l);

      for (let i = 0; i < l; i++) {
        const util = utils[i];

        unlisteners[i] = (util._subscribeWithLoad || util._onValueChange)(fn);
      }

      return () => {
        for (let i = 0; i < l; i++) {
          unlisteners[i]();
        }

        onStoreChange = noop;
      };
    };

    const getSnapshot = () => {
      const values = Array(l);

      for (let i = 0; i < l; i++) {
        values[i] = utils[i]._get();
      }

      return merger(values);
    };

    return () => useSyncExternalStore(subscribe, getSnapshot);
  }, states)()) as {
  /**
   * A hook to merge values from multiple {@link states}.
   * It applies a provided {@link merger} function to combine the state values, ensuring the component re-renders only when the merged value changes.
   * This hook ensures efficient updates using an optional equality function ({@link isEqual}) to prevent unnecessary re-renders.
   *
   * @param merger - A function that merges the values from the provided {@link states}.
   * @param isEqual - An optional comparison function to determine if the merged value has changed
   * @returns The merged value.
   */
  <const S extends ReadonlyState[], V>(
    states: S,
    merger: (values: {
      [index in keyof S]: S[index] extends ReadonlyState<infer K>
        ? K | (S[index] extends AsyncState ? undefined : never)
        : never;
    }) => V
  ): V;
};

export default useMergedValue;
