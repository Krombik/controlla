import type {
  StateInitializer,
  State,
  ValueChangeCallbacks,
  InternalState,
} from '../types';
import { ROOT } from '../utils/constants';
import createSubscribe from '../utils/createSubscribe';
import handleState from '../utils/handleState';
import { get, set } from '../utils/state/common';

/**
 * Creates a {@link State state} for managing simple state value.
 */
const createState = ((
  value?: unknown | (() => unknown),
  stateInitializer?: StateInitializer,
  keys?: any[]
) => {
  const callbacks: ValueChangeCallbacks = new Set();

  return {
    [ROOT]: handleState<InternalState>(
      {
        _value: undefined,
        _get: get,
        _callbacks: callbacks,
        _set: set,
        _onValueChange: createSubscribe(callbacks),
        _valueToggler: 0,
      },
      value,
      stateInitializer,
      keys
    ),
  };
}) as {
  /** @internal */
  (
    value?: unknown | (() => unknown),
    stateInitializer?: StateInitializer,
    keys?: any[]
  ): State;
  <T>(): State<T | undefined>;
  <T>(
    value: T | (() => T),
    stateInitializer?: StateInitializer<T | undefined>
  ): State<T>;
};

export type { State };

export default createState;
