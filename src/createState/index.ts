import type {
  CallbackRegistry,
  InternalDataMap,
  InternalUtils,
  State,
} from '../types';
import executeSetters from '../utils/executeSetters';
import { RootKey } from '../utils/constants';
import identity from 'lodash.identity';

type _InternalUtils = InternalUtils & {
  _valueSet: CallbackRegistry;
};

function _getValueChangeCallbackSet(this: _InternalUtils) {
  return this._valueSet;
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

const createState = <T>(value?: T | (() => T)): State<T> => {
  const data: InternalDataMap = new Map();

  if (typeof value == 'function') {
    value = (value as Function)();
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
      _getValueChangeCallbackSet,
    } as _InternalUtils,
  };
};

export default createState;
