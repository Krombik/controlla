import type {
  ValueChangeCallbacks,
  Internal,
  StateInternalUtils,
  StateInitializer,
  State,
} from '../types';
import handleSetExecution from '../utils/handleSetExecution';
import handleState from '../utils/handleState';

type _InternalUtils = StateInternalUtils & {
  _valueSet: ValueChangeCallbacks;
};

function _onValueChange(this: _InternalUtils, cb: (value: any) => void) {
  const set = this._valueSet;

  set.add(cb);

  return () => {
    set.delete(cb);
  };
}

function _set(this: _InternalUtils, value: any) {
  if (this._value !== value) {
    this._value = value;

    handleSetExecution(this._valueSet, value);
  }
}

function _get(this: _InternalUtils) {
  return this._value;
}

const createState: {
  /** @internal */
  <T extends Record<string, any>>(
    value?: unknown | (() => unknown),
    stateInitializer?: StateInitializer,
    keys?: any[],
    utils?: T
  ): State<unknown> & Internal<T>;
  <T>(): State<T | undefined>;
  <T>(value: T | (() => T), stateInitializer?: StateInitializer<T>): State<T>;
} = (
  value?: unknown | (() => unknown),
  stateInitializer?: StateInitializer,
  keys?: any[],
  utils?: Record<string, any>
) => {
  utils = {
    _value: undefined,
    _data: undefined!,
    _valueSet: new Set(),
    _set,
    _get,
    _onValueChange,
    ...utils,
  } as _InternalUtils;

  return {
    _internal: utils,
    _anchor: handleState(
      value,
      stateInitializer,
      keys,
      utils as _InternalUtils
    ),
  } as Partial<State<any>> as State<any>;
};

export type { State };

export default createState;
