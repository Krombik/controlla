import { useLayoutEffect, useRef } from 'react';
import type {
  AnyAsyncState,
  HandlePending,
  LoadableState,
  StateBase as State,
} from '../types';
import onValueChange from '../onValueChange';
import useForceRerender from 'react-helpful-utils/useForceRerender';
import simpleIsEqual from '../utils/simpleIsEqual';

const useMergedValue = ((
  states: AnyAsyncState[],
  merger: (values: any[]) => any,
  isEqual: (
    nextMergedValue: any,
    prevMergedValue: any
  ) => boolean = simpleIsEqual
) => {
  const forceRerender = useForceRerender();

  const mergedValue = merger(states.map((state) => state.get()));

  const mergedValueRef = useRef(mergedValue);

  mergedValueRef.current = mergedValue;

  useLayoutEffect(() => {
    const valuesUnlistener = onValueChange(states, () => {
      let nextValue;

      try {
        nextValue = merger(states.map((state) => state.get()));
      } catch {
        forceRerender();

        return;
      }

      if (!isEqual(nextValue, mergedValueRef.current)) {
        forceRerender();
      }
    });

    const loadUnlisteners: Array<() => void> = [];

    for (let i = 0; i < states.length; i++) {
      const state = states[i];

      if (state._load && !state._withoutLoading) {
        loadUnlisteners.push((state as LoadableState).load());
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
  }, states);

  return mergedValue;
}) as {
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
      [index in keyof S]: HandlePending<
        S[index] extends State<infer T> ? T : never
      >;
    }) => V,
    isEqual?: (nextMergedValue: V, prevMergedValue: V) => boolean
  ): V;
};

export default useMergedValue;
