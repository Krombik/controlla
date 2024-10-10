import { FC } from 'react';
import { HandlePending, State } from '../types';
import useMergedValue from '../useMergedValue';

type Props<S extends State<any>[], V> = {
  states: S;
  /** Function that merge the values from the states. */
  merger(
    ...values: {
      [index in keyof S]: HandlePending<
        S[index] extends State<infer T> ? T : never
      >;
    }
  ): V;
  /** Function to render the merged value. */
  render(mergedValue: V): ReturnType<FC>;
  /** Optional comparison function to determine if the next merged value is equal to the previous. */
  isEqual?(nextMergedValue: V, prevMergedValue: V): boolean;
};

/** A controller that merges a values from states and passes it to a render function. Component wrapper of {@link useMergedValue} hook */
const MergedController: {
  <const S extends State<any>[], V>(props: Props<S, V>): ReturnType<FC>;
} = (props: Props<any, any>) =>
  props.render(useMergedValue(props.states, props.merger, props.isEqual));

export default MergedController;
