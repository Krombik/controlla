import type {
  ValueChangeCallbacks,
  Internal,
  StateInternalUtils,
  InitModule,
  State,
} from '../types';
import executeSetters from '../utils/executeSetters';
import { RootKey } from '../utils/constants';
import identity from 'lodash.identity';
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

function _set(this: _InternalUtils, value: any, isSet: boolean) {
  const data = this._data;

  if (data.get(RootKey.VALUE) !== value) {
    if (isSet) {
      data.set(RootKey.VALUE, value);
    }

    executeSetters(this._valueSet, value);
  }
}

const createState: {
  /** @internal */
  <T extends Record<string, any>>(
    value?: unknown | (() => unknown),
    initModule?: InitModule,
    keys?: any[],
    utils?: T
  ): State<unknown> & Internal<T>;
  <T>(): State<T | undefined>;
  <T>(value: T | (() => T), initModule?: InitModule<T>): State<T>;
} = (
  value?: unknown | (() => unknown),
  initModule?: InitModule,
  keys?: any[],
  utils?: Record<string, any>
) => {
  utils = {
    _data: undefined!,
    _valueSet: new Set(),
    _set,
    _get: identity,
    _onValueChange,
    ...utils,
  } as _InternalUtils;

  return {
    _internal: utils,
    _anchor: handleState(value, initModule, keys, utils as _InternalUtils),
  } as Partial<State<any>> as State<any>;
};

export default createState;
