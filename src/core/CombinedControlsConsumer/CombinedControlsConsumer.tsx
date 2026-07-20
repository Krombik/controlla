import ControlConsumer from '#core/ControlConsumer';
import { EMPTY_ARR, INTERNALS } from '#internal/constants';
import type { DerivedControlInternals } from '#internal/derivedControlUtils';
import makeDerivedControl from '#internal/makeDerivedControl';
import removeFromArray from '#internal/removeFromArray';
import type { RenderablePrimitives } from '#internal/types';
import type { Control, ReadonlyAsyncControl, ReadonlyControl } from '#types';
import { useEffect, useRef, type ReactNode } from 'react';

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
) => {
  const $derivedControlRef = useRef<Control | null>(null);

  if ($derivedControlRef.current === null) {
    const controls = props.controls;

    const l = controls.length;

    const params = Array(l + 1);

    for (let i = 0; i < l; i++) {
      params[i] = controls[i];
    }

    params[l] = props.combiner;

    $derivedControlRef.current = makeDerivedControl(params);
  }

  const $derivedControl = $derivedControlRef.current!;

  useEffect(
    () => () => {
      const notifiers = ($derivedControl[INTERNALS] as DerivedControlInternals)
        ._notifiers;

      if (Array.isArray(notifiers)) {
        for (let i = 0, l = notifiers.length; i < l; i++) {
          const notifier = notifiers[i];

          removeFromArray(notifier._attachedTo, notifier);
        }
      } else {
        removeFromArray(notifiers._attachedTo, notifiers);
      }
    },
    EMPTY_ARR
  );

  return <ControlConsumer control={$derivedControl} {...(props as any)} />;
}) as {
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
   * Sources are captured once — control identities must stay stable.
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
  <Controls extends ReadonlyControl[], T>(
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
  <Controls extends ReadonlyControl[]>(
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
  <Controls extends ReadonlyControl[]>(
    props: PrimitiveDisplayProps<Controls>
  ): ReactNode;
};

export default CombinedControlsConsumer;
