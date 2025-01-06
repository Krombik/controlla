import type { StateInitializer, State, ValueChangeCallbacks } from '../types';
import createSubscribe from '../utils/createSubscribe';
import handleState from '../utils/handleState';
import { get, set } from '../utils/state/common';

/**
 * Creates a {@link State state} for managing simple state value.
 */
const createState: {
  /** @internal */
  (
    value?: unknown | (() => unknown),
    stateInitializer?: StateInitializer,
    keys?: any[]
  ): State;
  <T>(): State<T | undefined>;
  <T>(value: T | (() => T), stateInitializer?: StateInitializer<T>): State<T>;
} = (
  value?: unknown | (() => unknown),
  stateInitializer?: StateInitializer,
  keys?: any[]
) => {
  const callbacks: ValueChangeCallbacks = new Set();

  return handleState<State>(
    {
      _value: undefined,
      get,
      _callbacks: callbacks,
      set,
      _onValueChange: createSubscribe(callbacks),
      _valueToggler: 0,
    },
    value,
    stateInitializer,
    keys
  );
};

export type { State };

export default createState;
