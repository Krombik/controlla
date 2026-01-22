import type { OnValueChange } from '#_types';
import { ROOT } from '#shared/constants';
import rootGet from '#utils/rootGet';
import type { Control } from '#types';
import { createSubscriber, enqueuePrimitiveSet } from '#utils/batching';
import alwaysNoop from '#shared/alwaysNoop';

/** @internal */
const createSimpleControl = <T>(value?: T) => {
  const callbacks: OnValueChange[] = [];

  return {
    [ROOT]: {
      _value: value,
      _get: rootGet,
      _callbacks: callbacks,
      _enqueueSet: enqueuePrimitiveSet,
      _subscribe: createSubscriber(callbacks, alwaysNoop),
      _valueToggler: true,
    },
  } as Control<T>;
};

/** @internal */
export default createSimpleControl;
