import type { ReactNode } from 'react';
import type { ReadonlyAsyncControl, ReadonlyControl } from '../types';
import useMergedValue from '../useMergedValue';

type Props<S extends ReadonlyControl[], V> = {
  controls: S;
  /** Function that merges the values from the provided {@link Props.controls controls}. */
  merger(values: {
    [index in keyof S]: S[index] extends ReadonlyControl<infer K>
      ? K | (S[index] extends ReadonlyAsyncControl ? undefined : never)
      : never;
  }): V;
  /** Function that renders the merged value. */
  render(mergedValue: V): ReactNode;
};

/**
 * A controller that {@link Props.merger merges} values from multiple {@link Props.controls controls} and passes the result to a {@link Props.render render} function.
 * This component serves as a wrapper for the {@link useMergedValue} hook.
 * @example
 * ```jsx
 * <MergedController
 *   controls={[control1, control2]}
 *   merger={(value1, value2) => `${value1} and ${value2}`}
 *   render={(mergedValue) => <span>Merged: {mergedValue}</span>}
 * />
 * ```
 */
const MergedController = <const S extends ReadonlyControl[], V>(
  props: Props<S, V>
): ReactNode =>
  props.render(useMergedValue(props.controls, props.merger as any));

export default MergedController;
