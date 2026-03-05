import type { ChangeListener } from '#internal/types';
import { INTERNALS } from '#shared-internal/constants';
import readRootValue from '#internal/readRootValue';
import type { Control } from '#types';
import { createSubscriber, enqueuePrimitiveSet } from '#internal/flushQueue';
import alwaysNoop from '#shared-internal/alwaysNoop';

/** @internal */
const createSimpleControl = <T>(value?: T) => {
  const callbacks: ChangeListener[] = [];

  return {
    [INTERNALS]: {
      _value: value,
      _get: readRootValue,
      _listeners: callbacks,
      _enqueueSet: enqueuePrimitiveSet,
      _subscribe: createSubscriber(callbacks, alwaysNoop),
      _version: true,
    },
  } as Control<T>;
};

/** @internal */
export default createSimpleControl;
