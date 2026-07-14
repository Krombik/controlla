import type { ReactNode } from 'react';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import { INTERNALS } from '#internal/constants';
import type { Falsy } from '#internal/types';
import useForceRerender from '#internal/useForceRerender';
import useNoopLayoutEffect from '#internal/useNoopLayoutEffect';
import useInternalsValue from '#internal/useInternalsValue';

type Props<C extends Array<ReadonlyControl | Falsy>> = {
  controls: C;
  /** Function that renders the controls value. */
  render(
    ...values: {
      [index in keyof C]:
        | (Exclude<C[index], Falsy> extends ReadonlyAsyncControl<infer K>
            ? K | undefined
            : Exclude<C[index], Falsy> extends ReadonlyControl<infer K>
              ? K
              : never)
        | ([Extract<C[index], Falsy>] extends [never] ? never : undefined);
    }
  ): ReactNode;
};

const ControlsConsumer: {
  /**
   * Renders the values of multiple {@link Props.controls controls} via the
   * {@link Props.render render} prop — the multi-control counterpart of
   * `ControlConsumer`, keeping the subscriptions and rerenders inside this
   * component instead of the parent.
   *
   * Values are passed positionally; async controls provide
   * `value | undefined`. An entry may be falsy — its value is `undefined`.
   * Entries may switch between a control and falsy across renders, but the
   * **array length must stay constant**.
   *
   * @example
   * ```jsx
   * <ControlsConsumer
   *   controls={[$user, $cart, hasPromo && $promo]}
   *   render={(user, cart, promo) => (
   *     <p>
   *       {user.name} — {cart.length} items {promo && `(${promo.code})`}
   *     </p>
   *   )}
   * />
   * ```
   */
  <C extends Array<ReadonlyControl | Falsy>>(props: Props<C>): ReactNode;
} = (props: Props<Array<ReadonlyControl | Falsy>>) => {
  const forceRerender = useForceRerender();

  const controls = props.controls;

  const l = controls.length;

  const values = Array(l);

  for (let i = 0; i < l; i++) {
    const control = controls[i];

    values[i] = control
      ? useInternalsValue(control[INTERNALS], forceRerender)
      : useNoopLayoutEffect();
  }

  return props.render(...values);
};

export default ControlsConsumer;
