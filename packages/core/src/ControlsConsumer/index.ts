import { type ReactNode, useLayoutEffect, useReducer } from 'react';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import { INTERNALS } from '#shared-internal/constants';
import type { Falsy } from '#internal/types';
import noop from 'lodash.noop';
import forceRerenderReducer from '#internal/forceRerenderReducer';
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
  <C extends Array<ReadonlyControl | Falsy>>(props: Props<C>): ReactNode;
} = (props: Props<Array<ReadonlyControl | Falsy>>) => {
  const forceRerender = useReducer(forceRerenderReducer, 0)[1];

  const controls = props.controls;

  const l = controls.length;

  const values = Array(l);

  for (let i = 0; i < l; i++) {
    const control = controls[i];

    values[i] = control
      ? useInternalsValue(control[INTERNALS], forceRerender)
      : useLayoutEffect(noop, [0]);
  }

  return props.render(...values);
};

export default ControlsConsumer;
