import ControlConsumer from '#core/ControlConsumer';
import { useDerived } from '#internal/makeUseDerivedControl';
import makeDerivedControl from '#internal/makeDerivedControl';
import type { RenderablePrimitives } from '#internal/types';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import type { ReactNode } from 'react';

type CombineProps<Controls extends ReadonlyControl[], T> = {
  controls: Controls;
  combiner: (
    ...value: {
      [index in keyof Controls]: Controls[index] extends ReadonlyControl<
        infer K
      >
        ? K | (Controls[index] extends ReadonlyAsyncControl ? undefined : never)
        : never;
    }
  ) => T;
};

type RenderProps<Controls extends ReadonlyControl[], T> = CombineProps<
  Controls,
  T
> & {
  /** Function that renders the control’s value. */
  render(value: T): ReactNode;
  children?: never;
};

type TruthyGateProps<Controls extends ReadonlyControl[]> = CombineProps<
  Controls,
  RenderablePrimitives
> & {
  children: ReactNode;
  render?: never;
};

type PrimitiveDisplayProps<Controls extends ReadonlyControl[]> = CombineProps<
  Controls,
  RenderablePrimitives | Array<RenderablePrimitives>
> & {
  render?: never;
  children?: never;
};

const CombinedControlsConsumer = ((
  props:
    | RenderProps<ReadonlyControl[], any>
    | TruthyGateProps<ReadonlyControl[]>
    | PrimitiveDisplayProps<ReadonlyControl[]>
) =>
  ControlConsumer({
    ...(props as any),
    control: useDerived(makeDerivedControl, props.controls, props.combiner),
  })) as {
  /**
   * Combines the {@link CombineProps.controls controls}' values through
   * {@link CombineProps.combiner combiner} and renders the result via the
   * {@link RenderProps.render render} prop.
   *
   * Unlike `ControlsConsumer`, which reruns `render` on every source change,
   * this reruns only when the **combined value** changes — the combiner is a
   * derived control under the hood, so unchanged results are deduped. Use it
   * when several controls feed one rendered value and you want to rerender
   * on that value, not on each source.
   *
   * Values are passed positionally; async controls provide `value | undefined`.
   * The derived control is rebuilt when a `controls` entry changes identity;
   * `combiner` may be a fresh closure each render (no memoization needed).
   *
   * @example
   * ```jsx
   * <CombinedControlsConsumer
   *   controls={[$firstName, $lastName]}
   *   combiner={(first, last) => `${first} ${last}`}
   *   render={(fullName) => <h1>{fullName}</h1>}
   * />
   * ```
   */
  <const Controls extends ReadonlyControl[], T>(
    props: RenderProps<Controls, T>
  ): ReactNode;
  /**
   * Renders {@link TruthyGateProps.children children} only while the combined
   * value — the {@link CombineProps.controls controls} passed through
   * {@link CombineProps.combiner combiner} — is truthy.
   *
   * @example
   * ```jsx
   * <CombinedControlsConsumer
   *   controls={[$hasItems, $isReady]}
   *   combiner={(hasItems, isReady) => hasItems && isReady}
   * >
   *   <Checkout />
   * </CombinedControlsConsumer>
   * ```
   */
  <const Controls extends ReadonlyControl[]>(
    props: TruthyGateProps<Controls>
  ): ReactNode;
  /**
   * Renders the combined value — the {@link CombineProps.controls controls} passed
   * through {@link CombineProps.combiner combiner} — directly as a React node, for
   * combiners returning renderable primitives.
   *
   * @example
   * ```jsx
   * <span>
   *   Total:{' '}
   *   <CombinedControlsConsumer
   *     controls={[$price, $qty]}
   *     combiner={(price, qty) => price * qty}
   *   />
   * </span>
   * ```
   */
  <const Controls extends ReadonlyControl[]>(
    props: PrimitiveDisplayProps<Controls>
  ): ReactNode;
};

export default CombinedControlsConsumer;
