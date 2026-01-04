import { useMemo, useSyncExternalStore } from 'react';
import type { AnyAsyncControl, InternalAsyncControl } from '#_types';
import noop from 'lodash.noop';
import { postBatchCallbacksPush } from '#shared/batching';
import { ROOT } from '#shared/constants';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';

const useMergedValue = ((
  controls: AnyAsyncControl[],
  merger: (values: any[]) => any
) =>
  useMemo(() => {
    const l = controls.length;

    const utils = Array<InternalAsyncControl>(l);

    for (let i = 0; i < l; i++) {
      utils[i] = controls[i][ROOT];
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

        unlisteners[i] = (util._subscribeWithLoad || util._subscribe)(fn);
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
  }, controls)()) as {
  /**
   * A hook to merge values from multiple {@link controls}.
   * It applies a provided {@link merger} function to combine the control values, ensuring the component re-renders only when the merged value changes.
   * This hook ensures efficient updates using an optional equality function ({@link isEqual}) to prevent unnecessary re-renders.
   *
   * @param merger - A function that merges the values from the provided {@link controls}.
   * @returns The merged value.
   */
  <const S extends ReadonlyControl[], V>(
    controls: S,
    merger: (values: {
      [index in keyof S]: S[index] extends ReadonlyControl<infer K>
        ? K | (S[index] extends ReadonlyAsyncControl ? undefined : never)
        : never;
    }) => V
  ): V;
};

export default useMergedValue;
