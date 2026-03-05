import { type ReactNode, useSyncExternalStore } from 'react';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import { INTERNALS } from '#shared-internal/constants';
import type { Falsy } from '#internal/types';
import alwaysNoop from '#shared-internal/alwaysNoop';
import noop from 'lodash.noop';

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
  const controls = props.controls;

  const l = controls.length;

  const values = Array(l);

  for (let i = 0; i < l; i++) {
    const control = controls[i];

    if (control) {
      values[i] =
        control[INTERNALS]._useSubscribeWithLoad(useSyncExternalStore);
    } else {
      useSyncExternalStore(alwaysNoop, noop);
    }
  }

  return props.render(...values);
};

export default ControlsConsumer;
