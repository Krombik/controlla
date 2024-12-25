import type { FC } from 'react';
import type { HandlePending, StateBase as State } from '../types';
import useMergedValue from '../useMergedValue';

type Props<S extends State[], V> = {
  states: S;
  /** Function that merges the values from the provided {@link Props.states states}. */
  merger(values: {
    [index in keyof S]: HandlePending<
      S[index] extends State<infer T> ? T : never
    >;
  }): V;
  /** Function that renders the merged value. */
  render(mergedValue: V): ReturnType<FC>;
  /** Optional comparison function to determine if the next merged value is equal to the previous. */
  isEqual?(nextMergedValue: V, prevMergedValue: V): boolean;
};

/**
 * A controller that {@link Props.merger merges} values from multiple {@link Props.states states} and passes the result to a {@link Props.render render} function.
 * This component serves as a wrapper for the {@link useMergedValue} hook.
 * @example
 * ```jsx
 * <MergedController
 *   states={[state1, state2]}
 *   merger={(value1, value2) => `${value1} and ${value2}`}
 *   render={(mergedValue) => <span>Merged: {mergedValue}</span>}
 * />
 * ```
 */
const MergedController = <const S extends State[], V>(
  props: Props<S, V>
): ReturnType<FC> =>
  props.render(useMergedValue(props.states, props.merger, props.isEqual));

export default MergedController;
