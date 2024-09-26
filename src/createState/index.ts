import type {
  CallbackRegistry,
  InternalDataMap,
  InternalUtils,
  OriginalStateCreator,
  State,
  StateType,
} from '../types';
import executeSetters from '../utils/executeSetters';
import { RootKey } from '../utils/constants';
import identity from 'lodash.identity';

type _InternalUtils = InternalUtils & {
  _valueSet: CallbackRegistry;
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
  <T>(value?: T | (() => T)): State<T>;
} = (value: unknown | (() => unknown), keys?: any[]) => {
  const data: InternalDataMap = new Map();

  if (typeof value == 'function') {
    value = keys ? value(...keys) : value();
  }

  if (value !== undefined) {
    data.set(RootKey.VALUE, value);
  }

  return {
    _internal: {
      _data: data,
      _valueSet: new Set(),
      _set,
      _get: identity,
      _onValueChange,
    } as _InternalUtils,
  } as Partial<State<any>> as State<any>;
};

export default createState as OriginalStateCreator<
  typeof createState,
  StateType.STATE
>;
