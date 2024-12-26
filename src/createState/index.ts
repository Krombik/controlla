import type { StateInitializer, State, ValueChangeCallbacks } from '../types';
import handleState from '../utils/handleState';
import { get, _onValueChange, set } from '../utils/state/common';

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
) =>
  handleState<State, ValueChangeCallbacks>(
    {
      _value: undefined,
      get,
      _setData: new Set(),
      set,
      _onValueChange,
    },
    value,
    stateInitializer,
    keys
  );

export type { State };

export default createState;
