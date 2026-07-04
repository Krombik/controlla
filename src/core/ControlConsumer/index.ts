import { type ReactNode, useReducer } from 'react';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import type useValue from '#core/useValue';
import { INTERNALS } from '#internal/constants';
import type { RenderablePrimitives } from '#internal/types';
import forceRerenderReducer from '#internal/forceRerenderReducer';
import useInternalsValue from '#internal/useInternalsValue';

type RenderProps<S extends ReadonlyControl> = {
  control: S;
  /** Function that renders the control’s value. */
  render(
    value: S extends ReadonlyAsyncControl<infer V>
      ? V | undefined
      : S extends ReadonlyControl<infer V>
        ? V
        : never
  ): ReactNode;
  children?: never;
};

type TruthyGateProps = {
  control: ReadonlyControl<boolean | RenderablePrimitives>;
  children: ReactNode;
  render?: never;
};

type PrimitiveDisplayProps = {
  control: ReadonlyControl<RenderablePrimitives | Array<RenderablePrimitives>>;
  render?: never;
  children?: never;
};

const ControlConsumer = ((
  props:
    | RenderProps<ReadonlyAsyncControl>
    | TruthyGateProps
    | PrimitiveDisplayProps
) => {
  const value = useInternalsValue(
    props.control[INTERNALS],
    useReducer(forceRerenderReducer, 0)[1]
  );

  return 'render' in props
    ? props.render!(value)
    : 'children' in props
      ? value
        ? props.children
        : null
      : value;
}) as {
  /**
   * Renders the {@link RenderProps.control control}'s value via the
   * {@link RenderProps.render render} prop — an inline alternative to the
   * {@link useValue} hook that keeps the subscription and rerenders inside
   * this component instead of the parent.
   *
   * For an async control the value is `undefined` until ready.
   *
   * @example
   * ```jsx
   * <ControlConsumer
   *   control={$name}
   *   render={(name) => <div>{name}</div>}
   * />
   * ```
   */
  <S extends ReadonlyControl>(props: RenderProps<S>): ReactNode;
  /**
   * Renders {@link TruthyGateProps.children children} only while the
   * {@link TruthyGateProps.control control}'s value is truthy.
   *
   * @example
   * ```jsx
   * <ControlConsumer control={$saved}>
   *   <p>Saved ✓</p>
   * </ControlConsumer>
   * ```
   */
  (props: TruthyGateProps): ReactNode;
  /**
   * Renders the {@link PrimitiveDisplayProps.control control}'s value directly
   * as a React node — for controls holding renderable primitives (strings,
   * numbers, etc).
   *
   * @example
   * ```jsx
   * <span>Total: <ControlConsumer control={$total} /></span>
   * ```
   */
  (props: PrimitiveDisplayProps): ReactNode;
};

export default ControlConsumer;
